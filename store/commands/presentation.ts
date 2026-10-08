import type { Action } from '../types';
import type { PresentationGraph, PresentationNodeType } from '../../types/presentation';
import type { Side, Vector2 } from '../../types/common';
import { parseVirtualEdgeId } from '../../utils/graphAdapter';
import { generateResourceId } from '../../utils/resourceIdGenerator';
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
      // 避免重复连接
      const sourceNode = graph.nodes[sourceId];
      if (sourceNode?.nextIds.includes(targetId)) return;
      // 避免自连接
      if (sourceId === targetId) return;

      dispatch({
        type: 'LINK_PRESENTATION_NODES',
        payload: { graphId: graph.id, fromNodeId: sourceId, toNodeId: targetId },
      });

      // 如果有吸附点信息，保存边属性
      if (options?.sourceSide || options?.targetSide) {
        dispatch({
          type: 'UPDATE_EDGE_PROPERTIES',
          payload: {
            graphId: graph.id,
            fromNodeId: sourceId,
            toNodeId: targetId,
            fromSide: options.sourceSide,
            toSide: options.targetSide,
          },
        });
      }
    },
    onLinkUpdate: (edgeId, handle, newTargetId, side) => {
      // 解析虚拟边ID获取源节点和连接索引
      const parsed = parseVirtualEdgeId(edgeId);
      if (!parsed) return;

      const { fromNodeId, index } = parsed;
      const fromNode = graph.nodes[fromNodeId];
      if (!fromNode) return;

      const oldTargetId = fromNode.nextIds[index];
      if (!oldTargetId) return;

      // 构造边属性查找键（仅用于读取当前属性进行对比）
      const edgeKey = `${fromNodeId}->${oldTargetId}`;

      if (handle === 'target') {
        // 修改目标端点
        if (newTargetId === oldTargetId) {
          // 目标节点没变，检查是否有方向变化
          if (side && side !== graph.edgeProperties?.[edgeKey]?.toSide) {
            dispatch({
              type: 'UPDATE_EDGE_PROPERTIES',
              payload: { graphId: graph.id, fromNodeId, toNodeId: oldTargetId, toSide: side },
            });
          }
          return;
        }
        if (newTargetId === fromNodeId) return; // 避免自连接
        if (fromNode.nextIds.includes(newTargetId)) return; // 避免重复连接

        // 连接改变：先删除旧连接，再创建新连接 (同时携带方向信息)
        dispatch({
          type: 'UNLINK_PRESENTATION_NODES',
          payload: { graphId: graph.id, fromNodeId, toNodeId: oldTargetId },
        });
        dispatch({
          type: 'LINK_PRESENTATION_NODES',
          payload: { graphId: graph.id, fromNodeId, toNodeId: newTargetId },
        });
        // 如果有方向信息，更新新边的属性
        if (side) {
          dispatch({
            type: 'UPDATE_EDGE_PROPERTIES',
            payload: { graphId: graph.id, fromNodeId, toNodeId: newTargetId, toSide: side },
          });
        }
      } else {
        // 修改源端点
        if (newTargetId === fromNodeId) {
          // 源节点没变，检查是否有方向变化
          if (side && side !== graph.edgeProperties?.[edgeKey]?.fromSide) {
            dispatch({
              type: 'UPDATE_EDGE_PROPERTIES',
              payload: { graphId: graph.id, fromNodeId, toNodeId: oldTargetId, fromSide: side },
            });
          }
          return;
        }

        if (newTargetId === oldTargetId) return; // 避免自连接
        const newSourceNode = graph.nodes[newTargetId];
        if (newSourceNode?.nextIds.includes(oldTargetId)) return; // 避免重复连接

        dispatch({
          type: 'UNLINK_PRESENTATION_NODES',
          payload: { graphId: graph.id, fromNodeId, toNodeId: oldTargetId },
        });
        dispatch({
          type: 'LINK_PRESENTATION_NODES',
          payload: { graphId: graph.id, fromNodeId: newTargetId, toNodeId: oldTargetId },
        });
        // 如果有方向信息，更新新边的属性
        if (side) {
          dispatch({
            type: 'UPDATE_EDGE_PROPERTIES',
            payload: {
              graphId: graph.id,
              fromNodeId: newTargetId,
              toNodeId: oldTargetId,
              fromSide: side,
            },
          });
        }
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
          node: { id, name: `${type} Node`, type, position, nextIds: [] },
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
