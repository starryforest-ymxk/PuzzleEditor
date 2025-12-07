/**
 * Editor Reducer - 主 Reducer
 * 使用切片模式组织代码，将复杂逻辑委托给各个领域 slice
 */

import { EditorState, Action, ProjectContent } from './types';
import { fsmReducer, isFsmAction, presentationReducer, isPresentationAction, nodeParamsReducer, isNodeParamsAction } from './slices';

// ========== 常量配置 ==========
const MAX_HISTORY_LENGTH = 50;

// 触发历史快照的 Actions
const HISTORY_ACTIONS = new Set([
    'UPDATE_STAGE_TREE',
    'ADD_STATE', 'DELETE_STATE', 'UPDATE_STATE', 'UPDATE_FSM',
    'ADD_TRANSITION', 'DELETE_TRANSITION', 'UPDATE_TRANSITION',
    'ADD_PRESENTATION_NODE', 'DELETE_PRESENTATION_NODE', 'UPDATE_PRESENTATION_NODE',
    'LINK_PRESENTATION_NODES', 'UNLINK_PRESENTATION_NODES',
    'ADD_NODE_PARAM', 'UPDATE_NODE_PARAM', 'DELETE_NODE_PARAM'
]);

// ========== 快照工具函数 ==========
/**
 * 提取项目数据的纯数据部分用于快照
 */
const getProjectSnapshot = (state: EditorState): ProjectContent => ({
    stages: state.project.stages,
    nodes: state.project.nodes,
    stateMachines: state.project.stateMachines,
    presentationGraphs: state.project.presentationGraphs,
    rootStageId: state.project.rootStageId,
    meta: state.project.meta
});

// ========== Core Business Logic Reducer ==========
/**
 * 核心业务逻辑 Reducer
 * 将领域相关的 Action 委托给对应的 Slice
 */
const internalReducer = (state: EditorState, action: Action): EditorState => {
    // 使用类型守卫委托到各个 Slice
    if (isFsmAction(action)) {
        return fsmReducer(state, action);
    }

    if (isPresentationAction(action)) {
        return presentationReducer(state, action);
    }

    if (isNodeParamsAction(action)) {
        return nodeParamsReducer(state, action);
    }

    // 处理剩余的全局 Actions
    switch (action.type) {
        case 'INIT_START':
            return {
                ...state,
                ui: { ...state.ui, isLoading: true }
            };

        case 'INIT_SUCCESS':
            return {
                ...state,
                project: {
                    isLoaded: true,
                    meta: action.payload.project.meta,
                    stages: action.payload.project.stages,
                    nodes: action.payload.project.nodes,
                    stateMachines: action.payload.project.stateMachines || {},
                    presentationGraphs: action.payload.project.presentationGraphs || {},
                    rootStageId: action.payload.project.rootStageId
                },
                history: { past: [], future: [] }, // 加载时重置历史
                manifest: {
                    isLoaded: true,
                    scripts: action.payload.scripts,
                    triggers: action.payload.triggers
                },
                ui: { ...state.ui, isLoading: false }
            };

        case 'SELECT_OBJECT':
            return {
                ...state,
                ui: { ...state.ui, selection: action.payload, multiSelectStateIds: [] }
            };

        case 'UPDATE_STAGE_TREE':
            return {
                ...state,
                project: { ...state.project, stages: action.payload }
            };

        case 'TOGGLE_STAGE_EXPAND': {
            const stage = state.project.stages[action.payload.id];
            if (!stage) return state;
            return {
                ...state,
                project: {
                    ...state.project,
                    stages: {
                        ...state.project.stages,
                        [action.payload.id]: { ...stage, isExpanded: !stage.isExpanded }
                    }
                }
            };
        }

        case 'SET_MULTI_SELECT_STATES': {
            return {
                ...state,
                ui: { ...state.ui, multiSelectStateIds: action.payload }
            };
        }

        default:
            return state;
    }
};

// ========== History Wrapper Reducer ==========
/**
 * 顶层 Reducer，包装历史管理功能 (Undo/Redo)
 */
export const editorReducer = (state: EditorState, action: Action): EditorState => {
    // 1. 处理 UNDO
    if (action.type === 'UNDO') {
        const { past, future } = state.history;
        if (past.length === 0) return state;

        const previous = past[past.length - 1];
        const newPast = past.slice(0, past.length - 1);
        const currentSnapshot = getProjectSnapshot(state);

        return {
            ...state,
            project: { ...state.project, ...previous },
            history: {
                past: newPast,
                future: [currentSnapshot, ...future]
            }
        };
    }

    // 2. 处理 REDO
    if (action.type === 'REDO') {
        const { past, future } = state.history;
        if (future.length === 0) return state;

        const next = future[0];
        const newFuture = future.slice(1);
        const currentSnapshot = getProjectSnapshot(state);

        return {
            ...state,
            project: { ...state.project, ...next },
            history: {
                past: [...past, currentSnapshot],
                future: newFuture
            }
        };
    }

    const shouldSaveHistory = HISTORY_ACTIONS.has(action.type);

    if (shouldSaveHistory) {
        const snapshot = getProjectSnapshot(state);
        const newState = internalReducer(state, action);

        // 只有状态真正改变时才记录历史
        if (newState !== state) {
            return {
                ...newState,
                history: {
                    past: [...state.history.past, snapshot].slice(-MAX_HISTORY_LENGTH),
                    future: [] // 新操作清空重做栈
                }
            };
        }
    }

    // 4. 其他 Actions 直接处理（Selection, Init 等）
    return internalReducer(state, action);
};
