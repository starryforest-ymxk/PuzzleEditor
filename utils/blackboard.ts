import type { ProjectData } from '../types/project';
import type { LocalVarWithScope } from '../types/blackboard';
import type { ScriptDefinition } from '../types/manifest';
import type { ResourceState } from '../types/common';

export interface BlackboardFilters {
  filter: string;
  stateFilter?: 'ALL' | ResourceState;
  varTypeFilter?: 'ALL' | 'boolean' | 'integer' | 'float' | 'string';
}

/** 排序不修改项目记录；缺少顺序的资源继续按 ID 稳定显示。 */
export function sortByDisplayOrder<T extends { id: string; displayOrder?: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const orderA = a.displayOrder ?? Infinity;
    const orderB = b.displayOrder ?? Infinity;
    return orderA !== orderB ? orderA - orderB : a.id.localeCompare(b.id);
  });
}

export function collectLocalVariables(project: ProjectData): LocalVarWithScope[] {
  return [
    ...Object.values(project.stageTree.stages).flatMap((stage) =>
      Object.values(stage.localVariables || {}).map((variable) => ({
        ...variable,
        scopeType: 'Stage' as const,
        scopeName: stage.name,
        scopeId: stage.id,
      })),
    ),
    ...Object.values(project.nodes).flatMap((node) =>
      Object.values(node.localVariables || {}).map((variable) => ({
        ...variable,
        scopeType: 'Node' as const,
        scopeName: node.name,
        scopeId: node.id,
      })),
    ),
  ];
}

/** 作用域键只用于索引，不从拼接键还原 ID，允许导入含连字符的旧 ID。 */
export function localVariableKey(variable: LocalVarWithScope): string {
  return JSON.stringify([variable.scopeType, variable.scopeId, variable.id]);
}

export function selectBlackboardResources(project: ProjectData, filters: BlackboardFilters) {
  const { filter, stateFilter = 'ALL', varTypeFilter = 'ALL' } = filters;
  const query = filter.toLowerCase();
  const matches = (...values: string[]) =>
    !filter.trim() || values.some((v) => v.toLowerCase().includes(query));
  const matchesState = (state?: ResourceState) => stateFilter === 'ALL' || state === stateFilter;
  const matchesType = (type: string) => varTypeFilter === 'ALL' || type === varTypeFilter;
  const localVariableList = collectLocalVariables(project);
  const filteredVariables = sortByDisplayOrder(
    Object.values(project.blackboard.globalVariables).filter(
      (v) => matches(v.name, v.id) && matchesState(v.state) && matchesType(v.type),
    ),
  );
  const filteredLocalVariables = sortByDisplayOrder(
    localVariableList.filter(
      (v) => matches(v.name, v.id, v.scopeName) && matchesState(v.state) && matchesType(v.type),
    ),
  );
  const filteredEvents = sortByDisplayOrder(
    Object.values(project.blackboard.events).filter(
      (e) => matches(e.name, e.id) && matchesState(e.state),
    ),
  );
  const filteredScripts = sortByDisplayOrder(
    Object.values(project.scripts.scripts).filter(
      (s) => matches(s.name, s.id) && matchesState(s.state),
    ),
  );
  const scriptGroups: Record<'Performance' | 'Condition' | 'Trigger', ScriptDefinition[]> = {
    Performance: [],
    Condition: [],
    Trigger: [],
  };
  const lifecycleGroups: Record<'Stage' | 'Node' | 'State', ScriptDefinition[]> = {
    Stage: [],
    Node: [],
    State: [],
  };
  filteredScripts.forEach((script) => {
    if (script.category === 'Lifecycle')
      lifecycleGroups[script.lifecycleType || 'Stage'].push(script);
    else scriptGroups[script.category].push(script);
  });
  const localVariablesByScope: Record<string, LocalVarWithScope[]> = {};
  filteredLocalVariables.forEach((variable) => {
    const key = `${variable.scopeType}-${variable.scopeId}`;
    (localVariablesByScope[key] ??= []).push(variable);
  });
  const fsmOwnerNames = Object.fromEntries(
    Object.values(project.nodes)
      .filter((n) => n.stateMachineId)
      .map((n) => [n.stateMachineId!, n.name]),
  );
  const filteredFsms = sortByDisplayOrder(
    Object.values(project.stateMachines).filter((fsm) =>
      matches(fsmOwnerNames[fsm.id] || '', fsm.id),
    ),
  );
  const filteredGraphs = sortByDisplayOrder(
    Object.values(project.presentationGraphs).filter((graph) => matches(graph.name, graph.id)),
  );
  return {
    filteredVariables,
    filteredLocalVariables,
    filteredEvents,
    scriptGroups,
    lifecycleGroups,
    localVariablesByScope,
    stageLocalVariables: filteredLocalVariables.filter((v) => v.scopeType === 'Stage'),
    nodeLocalVariables: filteredLocalVariables.filter((v) => v.scopeType === 'Node'),
    filteredFsms,
    filteredGraphs,
    fsmOwnerNames,
  };
}

/** 越界或未移动时返回空，拖拽层据此避免派发无意义的历史记录。 */
export function reorderedIds(items: { id: string }[], from: number, to: number): string[] | null {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return null;
  const ids = items.map((item) => item.id);
  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved);
  return ids;
}
