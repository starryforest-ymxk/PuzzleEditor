import type { ProjectData } from '../types/project';
import type { ConditionExpression, TriggerConfig } from '../types/stateMachine';
import type {
  EventListener,
  ParameterModifier,
  PresentationBinding,
  ValueSource,
  VariableScope,
} from '../types/common';
import { collectLocalVariables, localVariableKey } from './blackboard';

export interface BlackboardReferenceCounts {
  globalVariableRefCounts: Record<string, number>;
  localVariableRefCounts: Record<string, number>;
  scriptRefCounts: Record<string, number>;
  eventRefCounts: Record<string, number>;
  graphRefCounts: Record<string, number>;
}
interface ScopeContext {
  stageOwners: readonly string[];
  nodeId?: string;
  graph?: boolean;
}
const emptyCounts = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 0]));
// 只为已定义的资源累加，未知引用继续交给既有诊断处理；原型键不会成为计数槽。
const increment = (counts: Record<string, number>, id: string | undefined) => {
  if (id !== undefined && Object.hasOwn(counts, id)) counts[id]++;
};

/**
 * 一次按实体遍历建立黑板计数，避免每个资源分别扫描整个工程。
 * 保留既有 find*References 的统计范围；Inspector 的位置/导航查询仍使用原查询器。
 * 尤其保留演出图局部变量的防御性统计、Stage 子树及同 ID 多作用域语义。
 */
export function buildBlackboardReferenceCounts(project: ProjectData): BlackboardReferenceCounts {
  const locals = collectLocalVariables(project);
  const result: BlackboardReferenceCounts = {
    globalVariableRefCounts: emptyCounts(Object.keys(project.blackboard.globalVariables)),
    localVariableRefCounts: emptyCounts(locals.map(localVariableKey)),
    scriptRefCounts: emptyCounts(Object.keys(project.scripts.scripts)),
    eventRefCounts: emptyCounts(Object.keys(project.blackboard.events)),
    graphRefCounts: emptyCounts(Object.keys(project.presentationGraphs)),
  };
  const stages = project.stageTree.stages;
  // 依据 childrenIds（与原查询一致）把声明作用域反向映射到子树；不从字符串截取 ID。
  const stageOwners = new Map<string, string[]>();
  for (const stage of Object.values(stages)) {
    if (!Object.keys(stage.localVariables ?? {}).length) continue;
    const pending = [stage.id],
      visited = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const owners = stageOwners.get(id) ?? [];
      owners.push(stage.id);
      stageOwners.set(id, owners);
      pending.push(...(stages[id]?.childrenIds ?? []));
    }
  }
  const graphStageLocals = new Map<string, number>(),
    graphNodeLocals = new Map<string, number>();
  const localKey = (scope: 'Stage' | 'Node', ownerId: string, id: string) =>
    JSON.stringify([scope, ownerId, id]);
  const variable = (scope: VariableScope, id: string, context: ScopeContext) => {
    if (scope === 'Global') increment(result.globalVariableRefCounts, id);
    if (scope === 'NodeLocal') {
      if (context.graph) graphNodeLocals.set(id, (graphNodeLocals.get(id) ?? 0) + 1);
      else if (context.nodeId)
        increment(result.localVariableRefCounts, localKey('Node', context.nodeId, id));
    }
    if (scope === 'StageLocal') {
      if (context.graph) graphStageLocals.set(id, (graphStageLocals.get(id) ?? 0) + 1);
      else
        for (const ownerId of context.stageOwners)
          increment(result.localVariableRefCounts, localKey('Stage', ownerId, id));
    }
  };
  const value = (source: ValueSource | undefined, context: ScopeContext) => {
    if (source?.type === 'VariableRef') variable(source.scope, source.variableId, context);
  };
  const condition = (
    expr: ConditionExpression | undefined,
    context: ScopeContext,
    includeScripts: boolean,
  ) => {
    if (!expr) return;
    if (expr.type === 'And' || expr.type === 'Or')
      expr.children?.forEach((child) => condition(child, context, includeScripts));
    if (expr.type === 'Not') condition(expr.operand, context, includeScripts);
    if (expr.type === 'Comparison') {
      value(expr.left, context);
      value(expr.right, context);
    }
    // 原脚本查询尚不统计演出节点条件；性能调整不隐式扩大引用/删除语义。
    if (includeScripts && expr.type === 'ScriptRef')
      increment(result.scriptRefCounts, expr.scriptId);
  };
  const modifiers = (items: ParameterModifier[] | undefined, context: ScopeContext) =>
    items?.forEach((item) => {
      variable(item.targetScope, item.targetVariableId, context);
      value(item.source, context);
    });
  const listeners = (items: EventListener[] | undefined, context: ScopeContext) =>
    items?.forEach((item) => {
      increment(result.eventRefCounts, item.eventId);
      if (item.action.type === 'ModifyParameter') modifiers(item.action.modifiers, context);
    });
  const triggers = (items: TriggerConfig[] | undefined) =>
    items?.forEach((item) => {
      if (item.type === 'OnEvent') increment(result.eventRefCounts, item.eventId);
      if (item.type === 'CustomScript') increment(result.scriptRefCounts, item.scriptId);
    });
  const binding = (item: PresentationBinding | undefined, context: ScopeContext) => {
    if (item?.type === 'Script') {
      increment(result.scriptRefCounts, item.scriptId);
      item.parameters?.forEach((parameter) => value(parameter.source, context));
    } else if (item?.type === 'Graph') increment(result.graphRefCounts, item.graphId);
  };
  for (const stage of Object.values(stages)) {
    const context: ScopeContext = { stageOwners: stageOwners.get(stage.id) ?? [] };
    increment(result.scriptRefCounts, stage.lifecycleScriptId);
    condition(stage.unlockCondition, context, true);
    triggers(stage.unlockTriggers);
    binding(stage.onEnterPresentation, context);
    binding(stage.onExitPresentation, context);
    listeners(stage.eventListeners, context);
  }
  for (const node of Object.values(project.nodes)) {
    const context: ScopeContext = {
      stageOwners: stageOwners.get(node.stageId) ?? [],
      nodeId: node.id,
    };
    increment(result.scriptRefCounts, node.lifecycleScriptId);
    listeners(node.eventListeners, context);
    const fsm = project.stateMachines[node.stateMachineId];
    if (!fsm) continue;
    for (const state of Object.values(fsm.states)) {
      increment(result.scriptRefCounts, state.lifecycleScriptId);
      listeners(state.eventListeners, context);
    }
    for (const transition of Object.values(fsm.transitions)) {
      triggers(transition.triggers);
      condition(transition.condition, context, true);
      binding(transition.presentation, context);
      modifiers(transition.parameterModifiers, context);
    }
  }
  const graphContext: ScopeContext = { stageOwners: [], graph: true };
  for (const graph of Object.values(project.presentationGraphs))
    for (const node of Object.values(graph.nodes)) {
      binding(node.presentation, graphContext);
      condition(node.condition, graphContext, false);
    }
  // 一个共享图的内部引用只扫一次；局部变量沿用旧查询“所有图”的防御性计数。
  for (const local of locals)
    result.localVariableRefCounts[localVariableKey(local)] +=
      (local.scopeType === 'Stage' ? graphStageLocals : graphNodeLocals).get(local.id) ?? 0;
  return result;
}
