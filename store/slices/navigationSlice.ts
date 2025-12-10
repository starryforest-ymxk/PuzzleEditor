/**
 * Navigation Reducer 切片
 * 处理所有与导航相关的操作：视图切换、导航跳转、返回等
 */

import { EditorState, Action } from '../types';

// ========== Navigation 相关 Actions 类型定义 ==========
export type NavigationAction =
    | { type: 'SWITCH_VIEW'; payload: 'EDITOR' | 'BLACKBOARD' }
    | { type: 'NAVIGATE_TO'; payload: { stageId?: string | null; nodeId?: string | null; graphId?: string | null } }
    | { type: 'NAVIGATE_BACK' };

// ========== 类型守卫：判断是否为 Navigation Action ==========
export const isNavigationAction = (action: Action): action is NavigationAction => {
    const navigationActionTypes = ['SWITCH_VIEW', 'NAVIGATE_TO', 'NAVIGATE_BACK'];
    return navigationActionTypes.includes(action.type);
};

// ========== Navigation Reducer ==========
export const navigationReducer = (state: EditorState, action: NavigationAction): EditorState => {
    switch (action.type) {
        case 'SWITCH_VIEW': {
            return {
                ...state,
                ui: { ...state.ui, view: action.payload }
            };
        }

        case 'NAVIGATE_TO': {
            // 当导航到 Stage 时，清除当前 Node；当导航到 Node 时，保持 Stage
            // 若 payload 显式传了 null，则清除对应层级
            const nextStageId = action.payload.stageId !== undefined
                ? action.payload.stageId
                : state.ui.currentStageId;

            const nextNodeId = action.payload.nodeId !== undefined
                ? action.payload.nodeId
                : state.ui.currentNodeId;

            // 若显式传入 graphId 则采用；否则若导航到 Stage/Node 就清空当前演出图，以免画布停留在旧的演出图
            const isStageOrNodeNav = action.payload.stageId !== undefined || action.payload.nodeId !== undefined;
            const nextGraphId = action.payload.graphId !== undefined
                ? action.payload.graphId
                : (isStageOrNodeNav ? null : state.ui.currentGraphId);

            // 记录进入演出图前的上下文，以便面包屑返回
            const prevContext = state.ui.lastEditorContext;
            const nextLastContext = action.payload.graphId
                ? { stageId: state.ui.currentStageId, nodeId: state.ui.currentNodeId }
                : (isStageOrNodeNav || state.ui.currentGraphId ? { stageId: null, nodeId: null } : prevContext);

            // 面包屑后退历史：若上下文有变化则压栈当前上下文
            const currCtx = { stageId: state.ui.currentStageId, nodeId: state.ui.currentNodeId, graphId: state.ui.currentGraphId };
            const nextCtx = { stageId: nextStageId, nodeId: nextNodeId, graphId: nextGraphId };
            const hasChanged = currCtx.stageId !== nextCtx.stageId || currCtx.nodeId !== nextCtx.nodeId || currCtx.graphId !== nextCtx.graphId;
            const nextNavStack = hasChanged ? [...state.ui.navStack, currCtx] : state.ui.navStack;

            return {
                ...state,
                ui: {
                    ...state.ui,
                    currentStageId: nextStageId,
                    currentNodeId: nextNodeId,
                    currentGraphId: nextGraphId,
                    lastEditorContext: nextLastContext,
                    navStack: nextNavStack,
                    // 导航时自动切回编辑器视图
                    view: 'EDITOR',
                    // 导航通常意味着选择变化，顺带清理旧选区
                    selection: { type: 'NONE', id: null },
                    multiSelectStateIds: []
                }
            };
        }

        case 'NAVIGATE_BACK': {
            if (state.ui.navStack.length === 0) return state;
            const previous = state.ui.navStack[state.ui.navStack.length - 1];
            const nextStack = state.ui.navStack.slice(0, -1);
            return {
                ...state,
                ui: {
                    ...state.ui,
                    currentStageId: previous.stageId,
                    currentNodeId: previous.nodeId,
                    currentGraphId: previous.graphId,
                    navStack: nextStack,
                    view: 'EDITOR',
                    selection: { type: 'NONE', id: null },
                    multiSelectStateIds: []
                }
            };
        }

        default:
            return state;
    }
};
