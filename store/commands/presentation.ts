import type { Action } from '../types';
import type { PresentationGraph, PresentationNodeType } from '../../types/presentation';
import type { Side, Vector2 } from '../../types/common';
import { parseVirtualEdgeId } from '../../utils/graphAdapter';
import { generateResourceId } from '../../utils/resourceIdGenerator';
import { createPresentationNode } from '../../utils/presentation';
import {
  changePresentationEdge,
  nextPresentationSlot,
  PresentationEditError,
} from '../../utils/presentationEditing';
export interface PresentationCommands {
  onNodeMove: (id: string, pos: Vector2) => void;
  onMultiNodeMove: (ids: string[], delta: { dx: number; dy: number }) => void;
  onLinkComplete: (
    sourceId: string,
    targetId: string,
    options?: { sourceSide?: Side; targetSide?: Side },
  ) => void;
  onLinkUpdate: (id: string, handle: 'source' | 'target', targetId: string, side?: Side) => void;
  onLinkDelete: (id: string) => void;
  addNode: (type: PresentationNodeType, position: Vector2) => void;
  deleteNode: (nodeId: string) => void;
  setStartNode: (nodeId: string) => void;
}
/** 将交互意图映射为既有动作；图数据由调用方提供当前快照，便于用真实 Store 回归。 */
export function createPresentationCommands(
  graph: PresentationGraph,
  dispatch: (action: Action) => void,
): PresentationCommands {
  return {
    onNodeMove: (nodeId, pos) => {
      dispatch({
        type: 'UPDATE_PRESENTATION_NODE',
        payload: { graphId: graph.id, nodeId, data: { position: pos } },
      });
    },
    onMultiNodeMove: (nodeIds, delta) => {
      nodeIds.forEach((id) => {
        const node = graph.nodes[id];
        if (node) {
          dispatch({
            type: 'UPDATE_PRESENTATION_NODE',
            payload: {
              graphId: graph.id,
              nodeId: id,
              data: { position: { x: node.position.x + delta.dx, y: node.position.y + delta.dy } },
            },
          });
        }
      });
    },
    onLinkComplete: (sourceId, targetId, options) => {
      if (sourceId === targetId || graph.nodes[sourceId]?.nextIds.includes(targetId)) return;
      dispatch({
        type: 'LINK_PRESENTATION_NODES',
        payload: {
          graphId: graph.id,
          fromNodeId: sourceId,
          toNodeId: targetId,
          fromSide: options?.sourceSide,
          toSide: options?.targetSide,
        },
      });
    },
    onLinkUpdate: (edgeId, handle, newTargetId, side) => {
      const parsed = parseVirtualEdgeId(edgeId);
      if (!parsed) return;
      const { fromNodeId, index } = parsed;
      const oldTarget = graph.nodes[fromNodeId]?.nextIds[index];
      if (!oldTarget) return;
      try {
        let updated: PresentationGraph;
        if (handle === 'target' || newTargetId === fromNodeId) {
          if (handle === 'target' && newTargetId === fromNodeId) return;
          updated = changePresentationEdge(graph, {
            kind: handle === 'target' && newTargetId !== oldTarget ? 'redirect' : 'update',
            from: fromNodeId,
            index,
            to: newTargetId,
            style: handle === 'target' ? { toSide: side } : { fromSide: side },
          });
        } else {
          if (newTargetId === oldTarget || !graph.nodes[newTargetId]) return;
          // 换源一次提交，保留旧边样式；若新源无法接收，整次手势不改变数据。
          const style = {
            ...graph.edgeProperties?.[fromNodeId + '->' + oldTarget],
            ...(side ? { fromSide: side } : {}),
          };
          updated = changePresentationEdge(graph, { kind: 'disconnect', from: fromNodeId, index });
          updated = changePresentationEdge(updated, {
            kind: 'connect',
            from: newTargetId,
            index: nextPresentationSlot(updated.nodes[newTargetId]),
            to: oldTarget,
            style,
          });
        }
        if (updated === graph) return;
        dispatch({
          type: 'UPDATE_PRESENTATION_GRAPH',
          payload: { graphId: graph.id, data: updated },
        });
      } catch (error) {
        if (!(error instanceof PresentationEditError)) throw error;
      }
    },
    onLinkDelete: (edgeId) => {
      // 拖拽到空白处删除连接
      const parsed = parseVirtualEdgeId(edgeId);
      if (!parsed) return;

      const { fromNodeId, index } = parsed;
      const fromNode = graph.nodes[fromNodeId];
      if (!fromNode) return;

      const toNodeId = fromNode.nextIds[index];
      if (!toNodeId) return;

      dispatch({
        type: 'UNLINK_PRESENTATION_NODES',
        payload: { graphId: graph.id, fromNodeId, toNodeId },
      });
    },

    addNode(type, position) {
      const id = generateResourceId('PNODE', Object.keys(graph.nodes));
      dispatch({
        type: 'ADD_PRESENTATION_NODE',
        payload: {
          graphId: graph.id,
          node: createPresentationNode({ id, name: `${type} Node`, type, position }),
        },
      });
    },
    deleteNode(nodeId) {
      dispatch({ type: 'DELETE_PRESENTATION_NODE', payload: { graphId: graph.id, nodeId } });
    },
    setStartNode(nodeId) {
      dispatch({
        type: 'UPDATE_PRESENTATION_GRAPH',
        payload: { graphId: graph.id, data: { startNodeId: nodeId } },
      });
    },
  };
}
