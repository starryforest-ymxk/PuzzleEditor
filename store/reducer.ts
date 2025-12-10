/**
 * Editor Reducer - 核心 Reducer
 * 使用切片模式组织代码，负责协调基础 reducer 与全局历史/初始化逻辑
 */

import { EditorState, Action, ProjectContent } from './types';
import {
    fsmReducer, isFsmAction,
    presentationReducer, isPresentationAction,
    nodeParamsReducer, isNodeParamsAction,
    blackboardReducer, isBlackboardAction,
    navigationReducer, isNavigationAction,
    uiReducer, isUiAction,
    projectReducer, isProjectAction
} from './slices';

// ========== 常量配置 ==========
const MAX_HISTORY_LENGTH = 50;

// 触发历史快照的 Actions
const HISTORY_ACTIONS = new Set([
    'UPDATE_STAGE_TREE',
    'UPDATE_NODE',
    'SOFT_DELETE_GLOBAL_VARIABLE', 'APPLY_DELETE_GLOBAL_VARIABLE',
    'SOFT_DELETE_EVENT', 'APPLY_DELETE_EVENT',
    'SOFT_DELETE_SCRIPT', 'APPLY_DELETE_SCRIPT',
    'SOFT_DELETE_STAGE_VARIABLE', 'APPLY_DELETE_STAGE_VARIABLE',
    'ADD_STATE', 'DELETE_STATE', 'UPDATE_STATE', 'UPDATE_FSM',
    'ADD_TRANSITION', 'DELETE_TRANSITION', 'UPDATE_TRANSITION',
    'ADD_PRESENTATION_NODE', 'DELETE_PRESENTATION_NODE', 'UPDATE_PRESENTATION_NODE',
    'LINK_PRESENTATION_NODES', 'UNLINK_PRESENTATION_NODES',
    'ADD_NODE_PARAM', 'UPDATE_NODE_PARAM', 'DELETE_NODE_PARAM'
]);

// 只读模式下阻断的数据修改 Actions
const READONLY_BLOCKED_ACTIONS = new Set<string>(HISTORY_ACTIONS);

// ========== 快照工具函数 ==========
/** 提取项目数据的纯数据部分用于快照 */
const getProjectSnapshot = (state: EditorState): ProjectContent => ({
    stageTree: state.project.stageTree,
    nodes: state.project.nodes,
    stateMachines: state.project.stateMachines,
    presentationGraphs: state.project.presentationGraphs,
    blackboard: state.project.blackboard,
    meta: state.project.meta,
    scripts: state.project.scripts,
    triggers: state.project.triggers
});

// ========== Core Business Logic Reducer ==========
/**
 * 基础业务逻辑 Reducer
 * 将基础相关的 Action 分派给对应的 Slice
 */
const internalReducer = (state: EditorState, action: Action): EditorState => {
    // P2 只读模式：阻止数据写操作（初始化/导航/选择等 UI 操作仍允许）
    if (state.ui.readOnly && READONLY_BLOCKED_ACTIONS.has(action.type)) {
        return state;
    }

    // 使用类型守卫分发到各 Slice
    if (isFsmAction(action)) {
        return fsmReducer(state, action);
    }

    if (isPresentationAction(action)) {
        return presentationReducer(state, action);
    }

    if (isNodeParamsAction(action)) {
        return nodeParamsReducer(state, action);
    }

    if (isBlackboardAction(action)) {
        return blackboardReducer(state, action);
    }

    if (isNavigationAction(action)) {
        return navigationReducer(state, action);
    }

    if (isUiAction(action)) {
        return uiReducer(state, action);
    }

    if (isProjectAction(action)) {
        return projectReducer(state, action);
    }

    // 处理初始化相关 Actions（不适合放入 Slice）
    switch (action.type) {
        case 'INIT_START':
            return {
                ...state,
                ui: { ...state.ui, isLoading: true, errorMessage: null }
            };

        case 'INIT_SUCCESS':
            return {
                ...state,
                project: {
                    isLoaded: true,
                    meta: action.payload.meta,
                    stageTree: action.payload.stageTree,
                    nodes: action.payload.nodes,
                    stateMachines: action.payload.stateMachines || {},
                    presentationGraphs: action.payload.presentationGraphs || {},
                    blackboard: action.payload.blackboard || { globalVariables: {}, events: {} },
                    scripts: action.payload.scripts,
                    triggers: action.payload.triggers
                },
                history: { past: [], future: [] },
                manifest: {
                    scripts: Object.values(action.payload.scripts.scripts),
                    triggers: Object.values(action.payload.triggers.triggers || {}),
                    isLoaded: true
                },
                ui: {
                    ...state.ui,
                    isLoading: false,
                    errorMessage: null,
                    stageExpanded: {},
                    // 重置导航状态：清空当前选中的 Stage/Node/Graph
                    currentStageId: null,
                    currentNodeId: null,
                    currentGraphId: null,
                    lastEditorContext: { stageId: null, nodeId: null },
                    navStack: [],
                    selection: { type: 'NONE', id: null },
                    multiSelectStateIds: [],
                    view: 'EDITOR'
                }
            };

        case 'INIT_ERROR':
            return {
                ...state,
                ui: { ...state.ui, isLoading: false, errorMessage: action.payload.message }
            };

        default:
            return state;
    }
};

// ========== History Wrapper Reducer ==========
/**
 * 顶层 Reducer，包装历史管理功能（Undo/Redo）
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
