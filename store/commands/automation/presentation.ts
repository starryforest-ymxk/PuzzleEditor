/** 演出图领域命令：显式图权限、局部 ID 与槽位检查先于隔离状态提交。 */
import type * as z from 'zod';
import type {
  Operation,
  Ref,
  presentationNodePatchSchema,
} from '../../../contracts/automation/planSchemas';
import type { PresentationNode } from '../../../types/presentation';
import { createPresentationGraph, createPresentationNode } from '../../../utils/presentation';
import { changePresentationEdge, PresentationEditError } from '../../../utils/presentationEditing';
import { buildPresentationUsage } from '../../../utils/presentationUsage';
import { ownEntry } from '../../../utils/recordLookup';
import { condition, presentation } from './bindings';
import { CommandContext, fail } from './context';

type GraphOperation = Extract<Operation, { graph: unknown } | { op: 'presentation.create' }>;
type GraphCreate = Extract<GraphOperation, { alias: string }>;
export function isPresentationOperation(op: Operation): op is GraphOperation {
  return 'graph' in op || op.op === 'presentation.create';
}
function nodeFields(
  ctx: CommandContext,
  input: z.infer<typeof presentationNodePatchSchema>,
): Partial<PresentationNode> {
  const result: Partial<PresentationNode> = {};
  for (const key of ['name', 'description', 'type', 'position'] as const)
    if (input[key] !== undefined) Object.assign(result, { [key]: input[key] });
  if (input.duration !== undefined) result.duration = input.duration ?? undefined;
  if (input.condition !== undefined)
    result.condition = input.condition === null ? undefined : condition(ctx, input.condition);
  if (input.presentation !== undefined)
    result.presentation =
      input.presentation === null ? undefined : presentation(ctx, input.presentation);
  return result;
}
function assertNode(node: PresentationNode) {
  if (
    (node.type !== 'PresentationNode' && node.presentation !== undefined) ||
    (node.type !== 'Branch' && node.condition !== undefined) ||
    (node.type !== 'Wait' && node.duration !== undefined)
  )
    fail(
      'NODE_FIELDS_INCOMPATIBLE',
      'Node fields do not match its type. Explicitly clear incompatible fields before changing type.',
    );
  if (
    (node.type === 'Branch' && node.nextIds.length > 2) ||
    (node.type !== 'Branch' && node.type !== 'Parallel' && node.nextIds.length > 1)
  )
    fail(
      'NODE_OUTPUTS_INCOMPATIBLE',
      'Disconnect incompatible output slots before changing node type.',
    );
}
function nodeId(ctx: CommandContext, graphId: string, ref: Ref): string {
  const id = ctx.resolveInGraph(ref, graphId);
  if (!ownEntry(ctx.graph(graphId).nodes, id))
    fail('ENTITY_NOT_FOUND', `Node ${id} does not exist in graph ${graphId}.`);
  return id;
}
export function createPresentationEntity(ctx: CommandContext, op: GraphCreate): boolean {
  const id = ctx.allocations[op.alias].id;
  if (op.op === 'presentation.create') {
    ctx.allowGraph(id);
    ctx.dispatch({
      type: 'ADD_PRESENTATION_GRAPH',
      payload: { graph: createPresentationGraph({ id, ...op.data }) },
    });
    return true;
  }
  const graphId = ctx.resolve(op.graph, 'presentation');
  if (!ownEntry(ctx.project.presentationGraphs, graphId)) {
    if ('id' in op.graph) ctx.graph(graphId);
    return false;
  }
  ctx.allowGraph(graphId);
  const fields = {
    ...nodeFields(ctx, op.data),
    id,
    name: op.data.name,
    type: op.data.type,
    position: op.data.position,
    nextIds: [],
  };
  assertNode(fields);
  ctx.dispatch({
    type: 'ADD_PRESENTATION_NODE',
    payload: { graphId, node: createPresentationNode(fields) },
  });
  return true;
}
export function editPresentation(ctx: CommandContext, op: Exclude<GraphOperation, GraphCreate>) {
  const graphId = ctx.resolve(op.graph, 'presentation'),
    graph = ctx.graph(graphId);
  ctx.allowGraph(graphId);
  if (op.op === 'presentation.update') {
    ctx.dispatch({ type: 'UPDATE_PRESENTATION_GRAPH', payload: { graphId, data: op.changes } });
    return;
  }
  if (op.op === 'presentation.delete') {
    const incoming = buildPresentationUsage(ctx.project).bindings.filter(
      (binding) => binding.graphId === graphId,
    );
    if (incoming.length)
      fail(
        'GRAPH_IN_USE',
        `Graph ${graphId} has ${incoming.length} binding(s). Unbind them explicitly before deletion.`,
      );
    ctx.dispatch({ type: 'DELETE_PRESENTATION_GRAPH', payload: { graphId } });
    return;
  }
  if (op.op === 'presentation.setStart') {
    if (op.node === null && Object.keys(graph.nodes).length)
      fail('GRAPH_START_REQUIRED', 'A nonempty graph requires a start node.');
    ctx.dispatch({
      type: 'UPDATE_PRESENTATION_GRAPH',
      payload: {
        graphId,
        data: { startNodeId: op.node === null ? null : nodeId(ctx, graphId, op.node) },
      },
    });
    return;
  }
  if (op.op === 'presentationNode.update' || op.op === 'presentationNode.delete') {
    const id = nodeId(ctx, graphId, op.target),
      node = graph.nodes[id];
    if (op.op === 'presentationNode.update') {
      const data = nodeFields(ctx, op.changes);
      assertNode({ ...node, ...data });
      ctx.dispatch({ type: 'UPDATE_PRESENTATION_NODE', payload: { graphId, nodeId: id, data } });
      return;
    }
    const others = Object.keys(graph.nodes).length > 1;
    if (op.replacementStart && (graph.startNodeId !== id || !others))
      fail(
        'INVALID_START_REPLACEMENT',
        'Only deleting the start node of a nonempty remaining graph accepts a replacement.',
      );
    const replacement = op.replacementStart ? nodeId(ctx, graphId, op.replacementStart) : undefined;
    if (graph.startNodeId === id && others && (!replacement || replacement === id))
      fail(
        'START_REPLACEMENT_REQUIRED',
        'Deleting the start node requires a different replacement in the same graph.',
      );
    if (
      (node.nextIds.some(Boolean) ||
        Object.values(graph.nodes).some((n) => n.nextIds.includes(id))) &&
      !op.deleteEdges
    )
      fail('NODE_HAS_EDGES', 'Disconnect incident edges first or set deleteEdges to true.');
    if (replacement)
      ctx.dispatch({
        type: 'UPDATE_PRESENTATION_GRAPH',
        payload: { graphId, data: { startNodeId: replacement } },
      });
    ctx.dispatch({ type: 'DELETE_PRESENTATION_NODE', payload: { graphId, nodeId: id } });
    return;
  }
  const from = nodeId(ctx, graphId, op.from),
    node = graph.nodes[from];
  const index =
    node.type === 'Branch'
      ? op.slot === 'true'
        ? 0
        : op.slot === 'false'
          ? 1
          : -1
      : node.type === 'Parallel'
        ? typeof op.slot === 'number'
          ? op.slot
          : -1
        : op.slot === 'next'
          ? 0
          : -1;
  const to = 'to' in op ? nodeId(ctx, graphId, op.to) : undefined;
  try {
    const updated = changePresentationEdge(graph, {
      kind:
        op.op === 'presentationEdge.connect'
          ? 'connect'
          : op.op === 'presentationEdge.disconnect'
            ? 'disconnect'
            : op.op === 'presentationEdge.redirect'
              ? 'redirect'
              : 'update',
      from,
      index,
      to,
      style: 'style' in op ? op.style : undefined,
    });
    ctx.dispatch({ type: 'UPDATE_PRESENTATION_GRAPH', payload: { graphId, data: updated } });
  } catch (error) {
    if (error instanceof PresentationEditError) fail(error.code, error.message);
    throw error;
  }
}
