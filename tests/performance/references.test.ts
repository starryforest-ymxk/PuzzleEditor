import { describe, it, expect } from 'vitest';
import { buildBlackboardReferenceCounts } from '../../utils/blackboardReferences';
import { createPerformanceProject } from './fixtures';
import { referenceOracle } from './referenceOracle';
import { importProject } from '../../utils/projectImport';
import { serializeProject } from '../../services/projectFiles';
import { normalizeForExport } from '../../utils/exportNormalizer';
import { validateProject } from '../../utils/validation/validator';
import { createEditorStore } from '../../store/editorStore';
import type { ProjectData } from '../../types/project';
import type { ConditionExpression } from '../../types/stateMachine';
import type { ValueSource } from '../../types/common';
import example from '../../overview/example_project/BubbleHorror.puzzle.json';

describe('引用计数索引保持原查询语义', () => {
  it('真实示例的所有资源计数与引用位置列表长度一致', () => {
    const project = importProject(JSON.stringify(example)).project;
    expect(buildBlackboardReferenceCounts(project)).toEqual(referenceOracle(project));
  });
  it.each(['medium', 'large'] as const)('%s 夹具校验无 error、可往返，全部计数一致', (size) => {
    const project = createPerformanceProject(size);
    expect(validateProject(project).filter((issue) => issue.level === 'error')).toEqual([]);
    const imported = importProject(
      serializeProject(project, undefined, project.meta.updatedAt),
    ).project;
    // 导入会恢复参数辅助 ID/kind；比较运行时语义，不能把合法规范化当作数据丢失。
    expect(normalizeForExport(imported)).toEqual(normalizeForExport(project));
    expect(buildBlackboardReferenceCounts(imported)).toEqual(referenceOracle(project));
    expect(buildBlackboardReferenceCounts(project)).toEqual(referenceOracle(project));
  });
  it('嵌套条件、三类作用域同名 ID、共享/嵌套图、参数与修饰器不重计或漏计', () => {
    const project = createPerformanceProject('medium');
    const parent = project.stageTree.stages[project.stageTree.rootId],
      child = project.stageTree.stages['stage-0'];
    parent.localVariables = structuredClone(child.localVariables);
    const node = project.nodes.node_0,
      fsm = project.stateMachines.fsm_0;
    const compare = (
      scope: 'Global' | 'StageLocal' | 'NodeLocal',
      id: string,
    ): ConditionExpression => ({
      type: 'Comparison',
      operator: '==',
      left: { type: 'VariableRef', scope, variableId: id },
      right: { type: 'VariableRef', scope, variableId: id },
    });
    const condition: ConditionExpression = {
      type: 'Not',
      operand: {
        type: 'Or',
        children: [
          compare('Global', 'global_0'),
          compare('StageLocal', 'counter'),
          compare('NodeLocal', 'counter'),
          { type: 'ScriptRef', scriptId: 'condition_0' },
        ],
      },
    };
    child.unlockCondition = condition;
    fsm.transitions.transition_1.condition = condition;
    child.unlockTriggers = [
      { type: 'CustomScript', scriptId: 'trigger_0' },
      { type: 'OnEvent', eventId: 'event_0' },
    ];
    fsm.transitions.transition_1.invokeEventIds = ['event_0']; // 当前查询不统计该字段；本批保持边界。
    fsm.transitions.transition_1.parameterModifiers = [
      {
        targetScope: 'NodeLocal',
        targetVariableId: 'counter',
        operation: 'Set',
        source: { type: 'VariableRef', scope: 'StageLocal', variableId: 'counter' },
      },
    ];
    node.eventListeners.push({ eventId: 'event_0', action: { type: 'InvokeScript' } });
    project.presentationGraphs.graph_0.nodes.p_0.condition = condition;
    project.presentationGraphs.graph_0.nodes.p_0.presentation = {
      type: 'Graph',
      graphId: 'graph_1',
    };
    const sources: ValueSource[] = [
      { type: 'VariableRef', scope: 'Global', variableId: 'global_0' },
      { type: 'VariableRef', scope: 'StageLocal', variableId: 'counter' },
      { type: 'VariableRef', scope: 'NodeLocal', variableId: 'counter' },
      { type: 'Constant', value: false },
    ];
    project.presentationGraphs.graph_1.nodes.p_0.presentation = {
      type: 'Script',
      scriptId: 'performance_0',
      parameters: sources.map((source, i) => ({ paramName: `p${i}`, source })),
    };
    expect(buildBlackboardReferenceCounts(project)).toEqual(referenceOracle(project));
  });
  it('编辑、标记删除、恢复、Undo/Redo 与切换项目均重新计算正确', () => {
    const project = createPerformanceProject('medium');
    const store = createEditorStore();
    store.dispatch({ type: 'INIT_SUCCESS', payload: project });
    const check = () =>
      expect(buildBlackboardReferenceCounts(store.getState().project)).toEqual(
        referenceOracle(store.getState().project),
      );
    store.dispatch({
      type: 'UPDATE_TRANSITION',
      payload: {
        fsmId: 'fsm_0',
        transitionId: 'transition_1',
        data: { presentation: { type: 'Script', scriptId: 'performance_1', parameters: [] } },
      },
    });
    check();
    store.dispatch({
      type: 'UPDATE_SCRIPT',
      payload: { id: 'performance_1', data: { state: 'MarkedForDelete' } },
    });
    check();
    store.dispatch({ type: 'UNDO' });
    check();
    store.dispatch({ type: 'UNDO' });
    check();
    store.dispatch({ type: 'REDO' });
    check();
    store.dispatch({ type: 'INIT_SUCCESS', payload: createPerformanceProject('large') });
    check();
  });
  it('全节点枚举次数不随资源数量重复，输入工程不被修改', () => {
    const project = createPerformanceProject('medium'),
      original = structuredClone(project);
    let enumerations = 0;
    const counted: ProjectData = {
      ...project,
      nodes: new Proxy(project.nodes, {
        ownKeys: (target) => {
          enumerations++;
          return Reflect.ownKeys(target);
        },
      }),
    };
    const indexed = buildBlackboardReferenceCounts(counted),
      indexedScans = enumerations;
    enumerations = 0;
    const legacy = referenceOracle(counted);
    expect(indexed).toEqual(legacy);
    expect(indexedScans).toBeLessThanOrEqual(3);
    expect(enumerations).toBeGreaterThan(200);
    expect(project).toEqual(original);
  });
});
