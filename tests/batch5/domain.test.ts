import { describe, it, expect } from 'vitest';
import { createProjectFixture, createEditorFixture } from '../fixtures/editor';
import { createEditorStore } from '../../store/editorStore';
import { createPresentationCommands } from '../../store/commands/presentation';
import { selectBlackboardResources, localVariableKey, reorderedIds } from '../../utils/blackboard';
import {
  presentationEdgeAnchors,
  presentationLinkPath,
  presentationModifiedPath,
} from '../../utils/presentationGeometry';
import { checkStateValidation } from '../../utils/validation/fsmValidation';
import { validatePresentationGraph } from '../../utils/validation/presentationValidation';
import { normalizeConditionRoot, countGroupContent } from '../../utils/conditionBuilder';

describe('Blackboard 领域计算', () => {
  it('组合名称/ID/作用域、类型与资源状态筛选，不改动原数据', () => {
    const project = createProjectFixture();
    const stage = project.stageTree.stages[project.stageTree.rootId];
    stage.name = 'North Room';
    stage.localVariables = {
      score: {
        id: 'score',
        name: 'Counter',
        type: 'integer',
        value: 0,
        state: 'Implemented',
        scope: 'StageLocal',
      },
    };
    project.blackboard.globalVariables = {
      flag: {
        id: 'flag',
        name: 'Flag',
        type: 'boolean',
        value: false,
        state: 'Draft',
        scope: 'Global',
      },
    };
    const before = structuredClone(project);
    const selected = selectBlackboardResources(project, {
      filter: 'north',
      stateFilter: 'Implemented',
      varTypeFilter: 'integer',
    });
    expect(selected.filteredVariables).toEqual([]);
    expect(selected.filteredLocalVariables.map((v) => v.id)).toEqual(['score']);
    expect(
      selectBlackboardResources(project, { filter: 'FLAG' }).filteredVariables.map((v) => v.name),
    ).toEqual(['Flag']);
    expect(project).toEqual(before);
  });
  it('分组和引用键保留完整作用域 ID，重名变量不会共享引用计数键', () => {
    const project = createProjectFixture();
    const root = project.stageTree.stages[project.stageTree.rootId];
    root.id = 'room-with-hyphens';
    root.localVariables = {
      same: {
        id: 'same',
        name: 'Same',
        type: 'boolean',
        value: false,
        state: 'Draft',
        scope: 'StageLocal',
      },
    };
    const local = selectBlackboardResources(project, { filter: '' }).filteredLocalVariables[0];
    expect(local.scopeId).toBe('room-with-hyphens');
    expect(localVariableKey(local)).not.toBe(localVariableKey({ ...local, scopeId: 'other-room' }));
  });
  it('按显示顺序排列脚本，生命周期缺省仍归 Stage', () => {
    const project = createProjectFixture();
    project.scripts.scripts = {
      b: { id: 'b', name: 'B', category: 'Performance', state: 'Draft', displayOrder: 0 },
      a: { id: 'a', name: 'A', category: 'Performance', state: 'Draft', displayOrder: 1 },
      life: { id: 'life', name: 'Life', category: 'Lifecycle', state: 'Draft' },
    };
    const lists = selectBlackboardResources(project, { filter: '' });
    expect(lists.scriptGroups.Performance.map((s) => s.id)).toEqual(['b', 'a']);
    expect(lists.lifecycleGroups.Stage[0].id).toBe('life');
    expect(reorderedIds(lists.scriptGroups.Performance, 0, 1)).toEqual(['a', 'b']);
    expect(reorderedIds(lists.scriptGroups.Performance, -1, 1)).toBeNull();
  });
});

describe('演出图命令与真实 reducer', () => {
  function setup() {
    const initial = createEditorFixture();
    const graph = initial.project.presentationGraphs.graph;
    graph.nodes.third = {
      id: 'third',
      name: 'Third',
      type: 'Wait',
      position: { x: 400, y: 200 },
      nextIds: [],
    };
    const store = createEditorStore(initial);
    return {
      store,
      graph: () => store.getState().project.presentationGraphs.graph,
      commands: () =>
        createPresentationCommands(
          store.getState().project.presentationGraphs.graph,
          store.dispatch,
        ),
    };
  }
  it('连接吸附边、避免重复与自连接，撤销移动还原坐标', () => {
    const { store, graph, commands } = setup();
    commands().onLinkComplete('second', 'third', { sourceSide: 'bottom', targetSide: 'top' });
    expect(graph().nodes.second.nextIds).toEqual(['third']);
    expect(graph().edgeProperties?.['second->third']).toEqual({
      fromSide: 'bottom',
      toSide: 'top',
    });
    const revision = store.getState().document.revision;
    commands().onLinkComplete('second', 'third');
    commands().onLinkComplete('second', 'second');
    expect(store.getState().document.revision).toBe(revision);
    commands().onNodeMove('second', { x: 210, y: 300 });
    expect(graph().nodes.second.position).toEqual({ x: 210, y: 300 });
    store.dispatch({ type: 'UNDO' });
    expect(graph().nodes.second.position).toEqual({ x: 100, y: 0 });
  });
  it('端点换边、换目标和换源仍产生正确连接，拖到空白可删除', () => {
    const { graph, commands } = setup();
    commands().onLinkUpdate('first->edge:0', 'target', 'second', 'bottom');
    expect(graph().edgeProperties?.['first->second']?.toSide).toBe('bottom');
    commands().onLinkUpdate('first->edge:0', 'target', 'third', 'left');
    expect(graph().nodes.first.nextIds).toEqual(['third']);
    commands().onLinkUpdate('first->edge:0', 'source', 'second', 'right');
    expect(graph().nodes.first.nextIds).toEqual([]);
    expect(graph().nodes.second.nextIds).toEqual(['third']);
    commands().onLinkDelete('second->edge:0');
    expect(graph().nodes.second.nextIds).toEqual([]);
  });
  it('创建、设为起点、多节点拖动与删除清除入边', () => {
    const { graph, commands } = setup();
    commands().addNode('Branch', { x: 10, y: 20 });
    const branch = Object.values(graph().nodes).find((n) => n.type === 'Branch')!;
    commands().setStartNode(branch.id);
    expect(graph().startNodeId).toBe(branch.id);
    commands().onMultiNodeMove(['first', 'second'], { dx: 25, dy: 30 });
    expect(graph().nodes.first.position).toEqual({ x: 25, y: 30 });
    expect(graph().nodes.second.position).toEqual({ x: 125, y: 30 });
    commands().deleteNode('second');
    expect(graph().nodes.first.nextIds).toEqual([]);
  });
  it('一次剪线使用手势开始时的边索引，连续删除不会错删另一条边', () => {
    const { graph, commands } = setup();
    commands().onLinkComplete('first', 'third');
    const cutting = commands();
    cutting.onLinkDelete('first->edge:0');
    cutting.onLinkDelete('first->edge:1');
    expect(graph().nodes.first.nextIds).toEqual([]);
  });
});

describe('纯几何与领域校验边界', () => {
  it('锚点、临时连线与修改连线保持固定端方向', () => {
    expect(
      presentationEdgeAnchors(
        { x: 0, y: 0 },
        { x: 300, y: 200 },
        { fromSide: 'bottom', toSide: 'top' },
      ),
    ).toEqual({ start: { x: 80, y: 85 }, end: { x: 380, y: 200 } });
    expect(presentationLinkPath({ x: 0, y: 0 }, { x: 300, y: 42.5 }, 'left')).toContain(
      'M 160 42.5',
    );
    const graph = createProjectFixture().presentationGraphs.graph;
    graph.edgeProperties = { 'first->second': { fromSide: 'bottom' } };
    expect(
      presentationModifiedPath(
        graph,
        'first->edge:0',
        'target',
        { x: 300, y: 200 },
        'top',
        (_id, p) => p,
      ),
    ).toContain('M 80 85');
    expect(
      presentationModifiedPath(
        graph,
        'missing',
        'target',
        { x: 0, y: 0 },
        undefined,
        (_id, p) => p,
      ),
    ).toBeNull();
  });
  it('只传 ProjectData 即可检查已删除资源和孤立节点', () => {
    const project = createProjectFixture();
    project.scripts.scripts.gone = {
      id: 'gone',
      name: 'Gone',
      category: 'Lifecycle',
      state: 'MarkedForDelete',
    };
    expect(
      checkStateValidation(
        {
          id: 'state',
          name: 'State',
          assetName: 'State',
          position: { x: 0, y: 0 },
          eventListeners: [],
          lifecycleScriptId: 'gone',
        },
        project,
        'owner',
      ).hasError,
    ).toBe(true);
    project.presentationGraphs.graph.nodes.first.nextIds = [];
    const results = validatePresentationGraph(project.presentationGraphs.graph, project);
    expect(results.second.issues.some((i) => i.message.includes('No incoming'))).toBe(true);
  });
  it('显式空组与单叶优化区分，递归删除数量包含嵌套组', () => {
    const leaf = { type: 'Literal' as const, value: true };
    expect(normalizeConditionRoot({ type: 'And', children: [leaf] }, 0)).toEqual(leaf);
    expect(normalizeConditionRoot({ type: 'And', children: [] }, 0)).toBeUndefined();
    expect(normalizeConditionRoot({ type: 'And', children: [] }, 0, true)).toEqual({
      type: 'And',
      children: [],
    });
    expect(countGroupContent({ type: 'And', children: [{ type: 'Not', operand: leaf }] })).toBe(2);
  });
});
