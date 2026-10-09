import { describe, expect, it } from 'vitest';
import { presentationProject } from './c4Fixtures';
import { createEditorStore } from '../../store/editorStore';
import { INITIAL_STATE } from '../../store/types';
import { createPresentationCommands } from '../../store/commands/presentation';
import { buildBlackboardReferenceCounts } from '../../utils/blackboardReferences';
import { collectResourceReferences } from '../../utils/resourceReferences';
import { buildPresentationUsage } from '../../utils/presentationUsage';
import { validateProject } from '../../utils/validation/validator';
import { findStageVariableReferences } from '../../utils/validation/stageVariableReferences';
import { findNodeVariableReferences } from '../../utils/validation/variableReferences';
import { findScriptReferences } from '../../utils/validation/scriptReferences';

function setup() {
  const store = createEditorStore({
    ...structuredClone(INITIAL_STATE),
    project: { ...presentationProject(), isLoaded: true },
  });
  const graph = () => store.getState().project.presentationGraphs.intro;
  const commands = () => createPresentationCommands(graph(), store.dispatch);
  return { store, graph, commands };
}
describe('C4 真实画布命令与历史', () => {
  it('端点和方向均未改变的手势不产生脏状态或历史', () => {
    const { store, commands } = setup();
    const before = store.getState();
    commands().onLinkUpdate('branch->edge:0', 'target', 'yes');
    commands().onLinkUpdate('branch->edge:0', 'source', 'branch', 'right');
    store.dispatch({
      type: 'UPDATE_EDGE_PROPERTIES',
      payload: { graphId: 'intro', fromNodeId: 'branch', toNodeId: 'yes', toSide: 'left' },
    });
    expect(store.getState()).toBe(before);
  });
  it('True 剪线保留 False，撤销/重做同时还原槽位和样式', () => {
    const { store, graph, commands } = setup();
    const original = structuredClone(graph());
    commands().onLinkDelete('branch->edge:0');
    expect(graph().nodes.branch.nextIds).toEqual(['', 'no']);
    expect(graph().edgeProperties).not.toHaveProperty('branch->yes');
    store.dispatch({ type: 'UNDO' });
    expect(graph()).toEqual(original);
    store.dispatch({ type: 'REDO' });
    expect(graph().nodes.branch.nextIds).toEqual(['', 'no']);
    commands().onLinkComplete('branch', 'finish');
    expect(graph().nodes.branch.nextIds).toEqual(['finish', 'no']);
  });
  it('改接 True 原位替换，换源原子提交并保留另一端样式', () => {
    const { store, graph, commands } = setup();
    commands().onLinkUpdate('branch->edge:0', 'target', 'finish', 'bottom');
    expect(graph().nodes.branch.nextIds).toEqual(['finish', 'no']);
    expect(graph().edgeProperties?.['branch->finish']).toEqual({
      fromSide: 'right',
      toSide: 'bottom',
    });
    const before = structuredClone(graph());
    commands().onLinkUpdate('branch->edge:0', 'source', 'call', 'left');
    expect(graph().nodes.branch.nextIds).toEqual(['', 'no']);
    expect(graph().nodes.call.nextIds).toEqual(['finish']);
    expect(graph().edgeProperties?.['call->finish']).toEqual({
      fromSide: 'left',
      toSide: 'bottom',
    });
    store.dispatch({ type: 'UNDO' });
    expect(graph()).toEqual(before);
  });
  it('满槽及重复目标拒绝，改接失败保留整个图', () => {
    const { graph, commands } = setup();
    const original = structuredClone(graph());
    commands().onLinkComplete('branch', 'finish');
    commands().onLinkComplete('yes', 'finish');
    commands().onLinkUpdate('branch->edge:0', 'target', 'no');
    commands().onLinkUpdate('branch->edge:0', 'source', 'yes');
    expect(graph()).toEqual(original);
  });
  it('同次剪线读取原目标，Parallel 删除后索引变化不会错删', () => {
    const { graph, commands } = setup();
    const cutting = commands();
    cutting.onLinkDelete('parallel->edge:0');
    cutting.onLinkDelete('parallel->edge:1');
    expect(graph().nodes.parallel.nextIds).toEqual([]);
  });
  it('删除节点的分支入边不移位，删除入口不随意改选其他节点', () => {
    const { store, graph, commands } = setup();
    commands().deleteNode('yes');
    expect(graph().nodes.branch.nextIds).toEqual(['', 'no']);
    expect(graph().edgeProperties).not.toHaveProperty('yes->parallel');
    commands().deleteNode('branch');
    expect(graph().startNodeId).toBeNull();
    store.dispatch({ type: 'UNDO' });
    expect(graph().startNodeId).toBe('branch');
  });
});

describe('C4 独立引用预期与上下文验证', () => {
  it('计数按手工预期覆盖条件脚本、事件派发、局部变量遮蔽和共享图', () => {
    const project = presentationProject(),
      root = project.stageTree.rootId;
    project.presentationGraphs.leaf.nodes.call.presentation = {
      type: 'Script',
      scriptId: 'effect',
      parameters: [
        {
          paramName: 'Value',
          source: { type: 'VariableRef', scope: 'StageLocal', variableId: 'shared' },
        },
      ],
    };
    project.presentationGraphs.intro.nodes.branch.condition = {
      type: 'And',
      children: [
        { type: 'Not', operand: { type: 'ScriptRef', scriptId: 'check' } },
        { type: 'Literal', value: true },
      ],
    };
    project.stateMachines['door-fsm'].transitions.go.invokeEventIds = ['open'];
    const counts = buildBlackboardReferenceCounts(project);
    expect(counts.scriptRefCounts).toEqual({ effect: 2, deleted: 0, check: 1 });
    expect(counts.eventRefCounts).toEqual({ open: 3 });
    expect(counts.graphRefCounts).toEqual({ intro: 2, child: 1, leaf: 1 });
    expect(counts.globalVariableRefCounts).toEqual({ flag: 2 });
    expect(counts.localVariableRefCounts).toEqual({
      [JSON.stringify(['Stage', root, 'shared'])]: 1,
      [JSON.stringify(['Stage', 'room', 'shared'])]: 1,
    });
    expect(
      findStageVariableReferences(project, root, 'shared')[0].contexts?.[0].caller.stageId,
    ).toBe(root);
    expect(findScriptReferences(project, 'check')).toHaveLength(1);
  });
  it('同 ID NodeLocal 只落到实际调用 Puzzle；孤立图不冒充所有局部变量引用', () => {
    const project = presentationProject();
    for (const nodeId of ['door', 'lock'])
      project.nodes[nodeId].localVariables.value = {
        id: 'value',
        name: 'Value',
        assetName: 'Value',
        type: 'integer',
        scope: 'NodeLocal',
        value: 0,
        state: 'Draft',
      };
    project.presentationGraphs.leaf.nodes.call.presentation = {
      type: 'Script',
      scriptId: 'effect',
      parameters: [
        {
          paramName: 'Value',
          source: { type: 'VariableRef', scope: 'NodeLocal', variableId: 'value' },
        },
      ],
    };
    expect(findNodeVariableReferences(project, 'door', 'value')).toHaveLength(1);
    expect(findNodeVariableReferences(project, 'lock', 'value')).toHaveLength(0);
    project.presentationGraphs.child.nodes.call.presentation = undefined;
    expect(findNodeVariableReferences(project, 'door', 'value')).toHaveLength(0);
    expect(collectResourceReferences(project).find((ref) => ref.id === 'value')).toMatchObject({
      resolution: 'unresolved',
      contexts: [],
    });
    expect(
      validateProject(project).some(
        (result) => result.code === 'ERR_VAR_MISSING' && result.graphId === 'leaf',
      ),
    ).toBe(true);
  });
  it('Stage 直接引用按最近祖先解析，不把遮蔽变量算给根 Stage', () => {
    const project = presentationProject();
    project.stageTree.stages.room.onExitPresentation = {
      type: 'Script',
      scriptId: 'effect',
      parameters: [
        {
          paramName: 'Value',
          source: { type: 'VariableRef', scope: 'StageLocal', variableId: 'shared' },
        },
      ],
    };
    expect(findStageVariableReferences(project, project.stageTree.rootId, 'shared')).toHaveLength(
      0,
    );
    expect(findStageVariableReferences(project, 'room', 'shared')).toHaveLength(1);
  });
  it('递归子图和菱形调用收敛，保留全部直接绑定且每根调用只验证一次', () => {
    const project = presentationProject();
    project.presentationGraphs.leaf.nodes.call.presentation = { type: 'Graph', graphId: 'intro' };
    project.presentationGraphs.side = {
      ...structuredClone(project.presentationGraphs.child),
      id: 'side',
      name: 'Side',
    };
    project.presentationGraphs.intro.nodes.finish.presentation = { type: 'Graph', graphId: 'side' };
    const usage = buildPresentationUsage(project);
    expect(usage.contexts.get('leaf')).toHaveLength(2);
    expect(usage.bindings.filter((ref) => ref.graphId === 'leaf')).toHaveLength(2);
    expect(new Set(usage.recursiveGraphs)).toEqual(new Set(['intro', 'child', 'leaf', 'side']));
    expect(
      validateProject(project).filter((result) => result.code === 'WARN_SUBGRAPH_RECURSION'),
    ).toHaveLength(4);
  });
  it('共享图 Temporary 类型必须适合所有调用者；错误定位携带所属图', () => {
    const project = presentationProject();
    project.stageTree.stages.room.localVariables.shared.type = 'string';
    project.stageTree.stages.room.localVariables.shared.value = 'Text';
    project.presentationGraphs.leaf.nodes.call.presentation = {
      type: 'Script',
      scriptId: 'effect',
      parameters: [
        {
          paramName: 'Value',
          kind: 'Temporary',
          tempVariable: { id: 'temp', name: 'Value', type: 'integer' },
          source: { type: 'VariableRef', scope: 'StageLocal', variableId: 'shared' },
        },
      ],
    };
    const errors = validateProject(project).filter(
      (result) => result.code === 'ERR_TEMP_SOURCE_TYPE',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      objectType: 'PRESENTATION_NODE',
      objectId: 'call',
      graphId: 'leaf',
    });
    expect(errors[0].message).toContain('door-fsm');
  });
});
