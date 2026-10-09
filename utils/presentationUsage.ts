/** 演出图的直接绑定与调用上下文单一来源，查询、校验及影响预览共同使用。 */
import type { PresentationBinding } from '../types/common';
import type { ProjectLike } from './validation/types';
import type { ReferenceNavigationContext } from './validation/globalVariableReferences';
import { ownEntry } from './recordLookup';

export const referencePath = (...parts: (string | number)[]) =>
  '/' + parts.map((part) => String(part).replaceAll('~', '~0').replaceAll('/', '~1')).join('/');
export interface PresentationCaller {
  path: string;
  stageId?: string;
  nodeId?: string;
  fsmId?: string;
  transitionId?: string;
  field: 'onEnterPresentation' | 'onExitPresentation' | 'presentation';
}
export interface PresentationCallContext {
  caller: PresentationCaller;
  /** 菱形调用只记录一条代表链；全部直接边在 bindings 中保留。 */
  graphPath: string[];
}
export interface PresentationGraphBinding {
  graphId: string;
  path: string;
  location: string;
  navContext: ReferenceNavigationContext;
  ownerGraphId?: string;
  caller?: PresentationCaller;
}
export function buildPresentationUsage(project: ProjectLike) {
  const bindings: PresentationGraphBinding[] = [];
  const add = (
    binding: PresentationBinding | undefined,
    site: Omit<PresentationGraphBinding, 'graphId'>,
  ) => {
    if (binding?.type === 'Graph') bindings.push({ ...site, graphId: binding.graphId });
  };
  for (const stage of Object.values(project.stageTree.stages)) {
    for (const field of ['onEnterPresentation', 'onExitPresentation'] as const) {
      const path = referencePath('stageTree', 'stages', stage.id, field);
      add(stage[field], {
        path,
        location: `Stage ${stage.name} > ${field}`,
        navContext: { targetType: 'STAGE', stageId: stage.id },
        caller: { path, field, stageId: stage.id },
      });
    }
  }
  for (const node of Object.values(project.nodes)) {
    const fsm = ownEntry(project.stateMachines, node.stateMachineId);
    if (!fsm) continue;
    for (const transition of Object.values(fsm.transitions)) {
      const path = referencePath(
        'stateMachines',
        fsm.id,
        'transitions',
        transition.id,
        'presentation',
      );
      add(transition.presentation, {
        path,
        location: `Node ${node.name} > Transition ${transition.name} > Presentation`,
        navContext: { targetType: 'TRANSITION', nodeId: node.id, transitionId: transition.id },
        caller: {
          path,
          field: 'presentation',
          stageId: node.stageId,
          nodeId: node.id,
          fsmId: fsm.id,
          transitionId: transition.id,
        },
      });
    }
  }
  for (const graph of Object.values(project.presentationGraphs ?? {})) {
    for (const node of Object.values(graph.nodes))
      add(node.presentation, {
        path: referencePath('presentationGraphs', graph.id, 'nodes', node.id, 'presentation'),
        location: `Presentation ${graph.name} > Node ${node.name}`,
        ownerGraphId: graph.id,
        navContext: {
          targetType: 'PRESENTATION_NODE',
          graphId: graph.id,
          presentationNodeId: node.id,
        },
      });
  }
  const outgoing = new Map<string, PresentationGraphBinding[]>();
  for (const binding of bindings)
    if (binding.ownerGraphId) {
      const list = outgoing.get(binding.ownerGraphId) ?? [];
      list.push(binding);
      outgoing.set(binding.ownerGraphId, list);
    }
  const contexts = new Map<string, PresentationCallContext[]>();
  // 每个根绑定分别 BFS；环和菱形图不会无限递归，也不会吞掉另一调用者。
  for (const root of bindings.filter((binding) => binding.caller)) {
    const queue = [{ graphId: root.graphId, graphPath: [root.graphId] }];
    const visited = new Set<string>();
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (visited.has(item.graphId)) continue;
      visited.add(item.graphId);
      const list = contexts.get(item.graphId) ?? [];
      list.push({ caller: root.caller!, graphPath: item.graphPath });
      contexts.set(item.graphId, list);
      for (const binding of outgoing.get(item.graphId) ?? [])
        if (!visited.has(binding.graphId))
          queue.push({ graphId: binding.graphId, graphPath: [...item.graphPath, binding.graphId] });
    }
  }
  // 迭代的强连通分量分析覆盖菱形和交叉边，不能只标记 DFS 首次回边上的节点。
  const visitedGraphs = new Set<string>(),
    finishOrder: string[] = [];
  const reverse = new Map<string, string[]>();
  for (const [from, edges] of outgoing)
    for (const edge of edges) {
      const list = reverse.get(edge.graphId) ?? [];
      list.push(from);
      reverse.set(edge.graphId, list);
    }
  for (const start of outgoing.keys()) {
    if (visitedGraphs.has(start)) continue;
    const stack = [{ id: start, index: 0 }];
    visitedGraphs.add(start);
    while (stack.length) {
      const frame = stack[stack.length - 1],
        edges = outgoing.get(frame.id) ?? [];
      if (frame.index >= edges.length) {
        finishOrder.push(frame.id);
        stack.pop();
        continue;
      }
      const next = edges[frame.index++].graphId;
      if (!visitedGraphs.has(next)) {
        visitedGraphs.add(next);
        stack.push({ id: next, index: 0 });
      }
    }
  }
  const assigned = new Set<string>(),
    recursiveGraphs = new Set<string>();
  for (const start of finishOrder.reverse()) {
    if (assigned.has(start)) continue;
    const members: string[] = [],
      pending = [start];
    assigned.add(start);
    while (pending.length) {
      const id = pending.pop()!;
      members.push(id);
      for (const parent of reverse.get(id) ?? [])
        if (!assigned.has(parent)) {
          assigned.add(parent);
          pending.push(parent);
        }
    }
    if (members.length > 1 || outgoing.get(start)?.some((edge) => edge.graphId === start))
      for (const id of members) recursiveGraphs.add(id);
  }
  return { bindings, contexts, outgoing, recursiveGraphs: [...recursiveGraphs] };
}

/** 最近祖先优先；相同局部 ID 在不同 Stage/Node 中仍是不同资源。 */
export function resolveLocalVariableOwner(
  project: ProjectLike,
  scope: 'StageLocal' | 'NodeLocal',
  id: string,
  context: Pick<PresentationCaller, 'stageId' | 'nodeId'>,
) {
  if (scope === 'NodeLocal')
    return context.nodeId && ownEntry(ownEntry(project.nodes, context.nodeId)?.localVariables, id)
      ? { ownerType: 'puzzle' as const, ownerId: context.nodeId }
      : undefined;
  const visited = new Set<string>();
  let stageId = context.stageId;
  while (stageId && !visited.has(stageId)) {
    visited.add(stageId);
    const stage = ownEntry(project.stageTree.stages, stageId);
    if (ownEntry(stage?.localVariables, id))
      return { ownerType: 'stage' as const, ownerId: stageId };
    stageId = stage?.parentId ?? undefined;
  }
  return undefined;
}
