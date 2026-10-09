/**
 * Presentation Graph (演出子图) Reducer 切片
 * 处理所有与演出图及其节点和连线相关的操作
 */

import { isActionForDomain, type ActionForDomain } from '../actionPolicy';
import { EditorState, Action } from '../types';
import { normalizePresentationNode } from '../../utils/presentation';
import {
  changePresentationEdge,
  nextPresentationSlot,
  removePresentationNode,
  PresentationEditError,
} from '../../utils/presentationEditing';

// ========== Presentation 相关 Actions 类型定义 ==========
export type PresentationAction = ActionForDomain<'presentation'>;

// ========== 类型守卫：判断是否为 Presentation Action ==========
export const isPresentationAction = (action: Action): action is PresentationAction =>
  isActionForDomain(action, 'presentation');

// ========== Presentation Reducer ==========
export const presentationReducer = (
  state: EditorState,
  action: PresentationAction,
): EditorState => {
  switch (action.type) {
    // ========== 演出图级别操作 ==========
    case 'ADD_PRESENTATION_GRAPH': {
      const { graph } = action.payload;
      return {
        ...state,
        project: {
          ...state.project,
          presentationGraphs: {
            ...state.project.presentationGraphs,
            [graph.id]: graph,
          },
        },
      };
    }

    case 'UPDATE_PRESENTATION_GRAPH': {
      const { graphId, data } = action.payload;
      const graph = state.project.presentationGraphs[graphId];
      if (!graph) return state;

      return {
        ...state,
        project: {
          ...state.project,
          presentationGraphs: {
            ...state.project.presentationGraphs,
            [graphId]: { ...graph, ...data },
          },
        },
      };
    }

    case 'DELETE_PRESENTATION_GRAPH': {
      const { graphId } = action.payload;
      const { [graphId]: _deleted, ...remaining } = state.project.presentationGraphs;

      // 更新选择状态
      let newSelection = state.ui.selection;
      if (
        (state.ui.selection.type === 'PRESENTATION_GRAPH' && state.ui.selection.id === graphId) ||
        (state.ui.selection.type === 'PRESENTATION_NODE' &&
          state.ui.selection.contextId === graphId)
      ) {
        newSelection = { type: 'NONE', id: null };
      }

      // 如果删除的是当前正在编辑的演出图，导航回上一个界面
      let newUi = { ...state.ui, selection: newSelection };
      if (state.ui.currentGraphId === graphId) {
        if (state.ui.navStack.length > 0) {
          // 有历史记录，使用 NAVIGATE_BACK 的逻辑
          const previous = state.ui.navStack[state.ui.navStack.length - 1];
          const nextStack = state.ui.navStack.slice(0, -1);
          newUi = {
            ...newUi,
            currentStageId: previous.stageId,
            currentNodeId: previous.nodeId,
            currentGraphId: previous.graphId,
            navStack: nextStack,
            view: 'EDITOR',
          };
        } else {
          // 没有历史记录，清空当前演出图
          newUi = {
            ...newUi,
            currentGraphId: null,
          };
        }
      }

      return {
        ...state,
        ui: newUi,
        project: {
          ...state.project,
          presentationGraphs: remaining,
        },
      };
    }

    // ========== 演出节点级别操作 ==========
    case 'ADD_PRESENTATION_NODE': {
      const { graphId, node } = action.payload;
      const graph = state.project.presentationGraphs[graphId];
      if (!graph) return state;

      const normalized = normalizePresentationNode(node);

      const isFirstNode = Object.keys(graph.nodes).length === 0;

      return {
        ...state,
        project: {
          ...state.project,
          presentationGraphs: {
            ...state.project.presentationGraphs,
            [graphId]: {
              ...graph,
              nodes: { ...graph.nodes, [normalized.id]: normalized },
              startNodeId: isFirstNode ? normalized.id : graph.startNodeId,
            },
          },
        },
      };
    }

    case 'DELETE_PRESENTATION_NODE': {
      const { graphId, nodeId } = action.payload;
      const graph = state.project.presentationGraphs[graphId];
      if (!graph) return state;

      // 更新选择状态
      let newSelection = state.ui.selection;
      if (state.ui.selection.type === 'PRESENTATION_NODE' && state.ui.selection.id === nodeId) {
        newSelection = {
          type: 'PRESENTATION_GRAPH',
          id: graphId,
          contextId: state.ui.selection.contextId,
        };
      }

      return {
        ...state,
        ui: { ...state.ui, selection: newSelection },
        project: {
          ...state.project,
          presentationGraphs: {
            ...state.project.presentationGraphs,
            [graphId]: removePresentationNode(graph, nodeId),
          },
        },
      };
    }

    case 'UPDATE_PRESENTATION_NODE': {
      const { graphId, nodeId, data } = action.payload;
      const graph = state.project.presentationGraphs[graphId];
      if (!graph || !graph.nodes[nodeId]) return state;

      const updated = normalizePresentationNode({ ...graph.nodes[nodeId], ...data });

      return {
        ...state,
        project: {
          ...state.project,
          presentationGraphs: {
            ...state.project.presentationGraphs,
            [graphId]: {
              ...graph,
              nodes: {
                ...graph.nodes,
                [nodeId]: updated,
              },
            },
          },
        },
      };
    }

    // GUI 与 CLI 共用槽位及样式规则；迟到的 UI 手势保留 no-op 语义。
    case 'LINK_PRESENTATION_NODES':
    case 'UNLINK_PRESENTATION_NODES':
    case 'UPDATE_EDGE_PROPERTIES': {
      const { graphId, fromNodeId, toNodeId } = action.payload;
      const graph = state.project.presentationGraphs[graphId];
      const node = graph?.nodes[fromNodeId];
      if (!node) return state;
      const kind =
        action.type === 'LINK_PRESENTATION_NODES'
          ? 'connect'
          : action.type === 'UNLINK_PRESENTATION_NODES'
            ? 'disconnect'
            : 'update';
      const index =
        kind === 'connect' ? nextPresentationSlot(node) : node.nextIds.indexOf(toNodeId);
      const style =
        action.type === 'UNLINK_PRESENTATION_NODES'
          ? undefined
          : {
              fromSide: action.payload.fromSide,
              toSide: action.payload.toSide,
            };
      try {
        const updated = changePresentationEdge(graph, {
          kind,
          from: fromNodeId,
          index,
          to: toNodeId,
          style,
        });
        if (updated === graph) return state;
        return {
          ...state,
          project: {
            ...state.project,
            presentationGraphs: {
              ...state.project.presentationGraphs,
              [graphId]: updated,
            },
          },
        };
      } catch (error) {
        if (error instanceof PresentationEditError) return state;
        throw error;
      }
    }

    default:
      return state;
  }
};
