/** 演出图连线的唯一修改规则：分支槽位不压缩，视觉属性与真实连线一起移动。 */
import type { PresentationGraph, PresentationNode } from '../types/presentation';
import type { Side } from '../types/common';
import { ownEntry } from './recordLookup';

export class PresentationEditError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const reject = (code: string, message: string): never => {
  throw new PresentationEditError(code, message);
};
export type EdgeStylePatch = { fromSide?: Side | null; toSide?: Side | null };
export type PresentationEdgeEdit = {
  kind: 'connect' | 'disconnect' | 'redirect' | 'update';
  from: string;
  index: number;
  to?: string;
  style?: EdgeStylePatch;
};
export function nextPresentationSlot(node: PresentationNode): number {
  return node.type === 'Branch'
    ? ([0, 1].find((index) => !node.nextIds[index]) ?? 2)
    : node.type === 'Parallel'
      ? node.nextIds.length
      : 0;
}
/** 只清理指定改动产生的失效边属性，不全图改写其他节点或布局。 */
export function changePresentationEdge(
  graph: PresentationGraph,
  edit: PresentationEdgeEdit,
): PresentationGraph {
  const node = ownEntry(graph.nodes, edit.from);
  if (!node)
    return reject('ENTITY_NOT_FOUND', `Node ${edit.from} does not exist in graph ${graph.id}.`);
  const { index, kind, to } = edit;
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    (node.type === 'Branch' && index > 1) ||
    (node.type !== 'Branch' && node.type !== 'Parallel' && index !== 0) ||
    (node.type === 'Parallel' && index > node.nextIds.length)
  )
    return reject('EDGE_SLOT_INVALID', 'The edge slot is outside the node output range.');
  const oldTarget = node.nextIds[index];
  if (kind !== 'connect' && !oldTarget)
    return reject('EDGE_NOT_FOUND', 'There is no edge in the requested slot.');
  if (kind === 'connect' && node.type !== 'Parallel' && oldTarget)
    return reject('EDGE_SLOT_OCCUPIED', 'The output slot already has an edge; use redirect.');
  if (kind === 'connect' || kind === 'redirect') {
    if (!to || !ownEntry(graph.nodes, to))
      return reject('ENTITY_NOT_FOUND', `Target ${to} does not exist in graph ${graph.id}.`);
    if (node.nextIds.some((id, i) => id === to && (kind === 'connect' || i !== index)))
      return reject('DUPLICATE_EDGE', 'A source node cannot connect to the same target twice.');
  }
  const nextIds = [...node.nextIds];
  if (kind === 'disconnect') {
    if (node.type === 'Branch') nextIds[index] = '';
    else nextIds.splice(index, 1);
  } else if (kind === 'connect' && node.type === 'Parallel') nextIds.splice(index, 0, to!);
  else if (kind === 'connect' || kind === 'redirect') {
    while (nextIds.length <= index) nextIds.push('');
    nextIds[index] = to!;
  }
  const oldKey = `${node.id}->${oldTarget}`;
  const edgeProperties = { ...graph.edgeProperties };
  const style = kind === 'connect' ? {} : { ...ownEntry(edgeProperties, oldKey) };
  if (kind === 'disconnect' || (kind === 'redirect' && to !== oldTarget))
    delete edgeProperties[oldKey];
  if (kind !== 'disconnect') {
    for (const key of ['fromSide', 'toSide'] as const) {
      if (edit.style?.[key] === null) delete style[key];
      else if (edit.style?.[key] !== undefined) style[key] = edit.style[key];
    }
    const key = `${node.id}->${nextIds[index]}`;
    if (Object.keys(style).length) edgeProperties[key] = style;
    else delete edgeProperties[key];
  }
  if (
    kind === 'update' &&
    JSON.stringify(edgeProperties) === JSON.stringify(graph.edgeProperties ?? {})
  )
    return graph;
  return {
    ...graph,
    nodes: kind === 'update' ? graph.nodes : { ...graph.nodes, [node.id]: { ...node, nextIds } },
    ...(graph.edgeProperties || Object.keys(edgeProperties).length ? { edgeProperties } : {}),
  };
}

/** 删除节点只清除相关边；入口清空，由调用者显式指定替代入口。 */
export function removePresentationNode(graph: PresentationGraph, id: string): PresentationGraph {
  if (!ownEntry(graph.nodes, id)) return graph;
  const nodes = { ...graph.nodes };
  delete nodes[id];
  const removedKeys = new Set(graph.nodes[id].nextIds.map((target) => `${id}->${target}`));
  for (const node of Object.values(nodes)) {
    if (!node.nextIds.includes(id)) continue;
    removedKeys.add(`${node.id}->${id}`);
    nodes[node.id] = {
      ...node,
      nextIds:
        node.type === 'Branch'
          ? node.nextIds.map((target) => (target === id ? '' : target))
          : node.nextIds.filter((target) => target !== id),
    };
  }
  const edgeProperties = { ...graph.edgeProperties };
  for (const key of removedKeys) delete edgeProperties[key];
  return {
    ...graph,
    nodes,
    startNodeId: graph.startNodeId === id ? null : graph.startNodeId,
    ...(graph.edgeProperties ? { edgeProperties } : {}),
  };
}
