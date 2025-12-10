/**
 * Editor Reducer - 核心 Reducer
 * 使用切片模式组织代码，负责协调领域 reducer 与全局历史/初始化逻辑
 */

import { EditorState, Action, ProjectContent } from './types';
import { fsmReducer, isFsmAction, presentationReducer, isPresentationAction, nodeParamsReducer, isNodeParamsAction } from './slices';
import { resolveDeleteAction } from '../utils/resourceLifecycle';

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

// ========== 快照工具函数 ==========
/**
 * 提取项目数据的纯数据部分用于快照
 */
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
                ui: { ...state.ui, isLoading: false, errorMessage: null }
            };

        case 'INIT_ERROR':
            return {
                ...state,
                ui: { ...state.ui, isLoading: false, errorMessage: action.payload.message }
            };

        case 'SELECT_OBJECT':
            return {
                ...state,
                ui: { ...state.ui, selection: action.payload, multiSelectStateIds: [] }
            };

        case 'UPDATE_STAGE_TREE':
            return {
                ...state,
                project: { ...state.project, stageTree: action.payload }
            };

        case 'UPDATE_NODE': {
            const node = state.project.nodes[action.payload.nodeId];
            if (!node) return state;
            return {
                ...state,
                project: {
                    ...state.project,
                    nodes: {
                        ...state.project.nodes,
                        [action.payload.nodeId]: { ...node, ...action.payload.data }
                    }
                }
            };
        }

        case 'SOFT_DELETE_GLOBAL_VARIABLE': {
            const vars = state.project.blackboard.globalVariables || {};
            const variable = vars[action.payload.varId];
            if (!variable) return state;
            const resolution = resolveDeleteAction(variable.state);
            const nextVars = { ...vars };
            if (resolution.shouldRemove) {
                delete nextVars[action.payload.varId];
            } else {
                nextVars[action.payload.varId] = { ...variable, state: resolution.nextState };
            }
            return {
                ...state,
                project: {
                    ...state.project,
                    blackboard: { ...state.project.blackboard, globalVariables: nextVars }
                }
            };
        }

        case 'APPLY_DELETE_GLOBAL_VARIABLE': {
            const vars = state.project.blackboard.globalVariables || {};
            if (!vars[action.payload.varId]) return state;
            const nextVars = { ...vars };
            delete nextVars[action.payload.varId];
            return {
                ...state,
                project: {
                    ...state.project,
                    blackboard: { ...state.project.blackboard, globalVariables: nextVars }
                }
            };
        }

        case 'SOFT_DELETE_EVENT': {
            const events = state.project.blackboard.events || {};
            const event = events[action.payload.eventId];
            if (!event) return state;
            const resolution = resolveDeleteAction(event.state);
            const nextEvents = { ...events };
            if (resolution.shouldRemove) {
                delete nextEvents[action.payload.eventId];
            } else {
                nextEvents[action.payload.eventId] = { ...event, state: resolution.nextState };
            }
            return {
                ...state,
                project: {
                    ...state.project,
                    blackboard: { ...state.project.blackboard, events: nextEvents }
                }
            };
        }

        case 'SOFT_DELETE_STAGE_VARIABLE': {
            const stage = state.project.stageTree.stages[action.payload.stageId];
            if (!stage) return state;
            const vars = stage.localVariables || {};
            const variable = vars[action.payload.varId];
            if (!variable) return state;
            const resolution = resolveDeleteAction(variable.state);
            const nextVars = { ...vars };
            if (resolution.shouldRemove) {
                delete nextVars[action.payload.varId];
            } else {
                nextVars[action.payload.varId] = { ...variable, state: resolution.nextState };
            }
            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: {
                            ...state.project.stageTree.stages,
                            [stage.id]: { ...stage, localVariables: nextVars }
                        }
                    }
                }
            };
        }

        case 'APPLY_DELETE_STAGE_VARIABLE': {
            const stage = state.project.stageTree.stages[action.payload.stageId];
            if (!stage) return state;
            const vars = stage.localVariables || {};
            if (!vars[action.payload.varId]) return state;
            const nextVars = { ...vars };
            delete nextVars[action.payload.varId];
            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: {
                            ...state.project.stageTree.stages,
                            [stage.id]: { ...stage, localVariables: nextVars }
                        }
                    }
                }
            };
        }

        case 'APPLY_DELETE_EVENT': {
            const events = state.project.blackboard.events || {};
            if (!events[action.payload.eventId]) return state;
            const nextEvents = { ...events };
            delete nextEvents[action.payload.eventId];
            return {
                ...state,
                project: {
                    ...state.project,
                    blackboard: { ...state.project.blackboard, events: nextEvents }
                }
            };
        }

        case 'SOFT_DELETE_SCRIPT': {
            const scripts = state.project.scripts.scripts || {};
            const script = scripts[action.payload.scriptId];
            if (!script) return state;
            const resolution = resolveDeleteAction(script.state);
            const nextScripts = { ...scripts };
            if (resolution.shouldRemove) {
                delete nextScripts[action.payload.scriptId];
            } else {
                nextScripts[action.payload.scriptId] = { ...script, state: resolution.nextState };
            }
            return {
                ...state,
                project: {
                    ...state.project,
                    scripts: { ...state.project.scripts, scripts: nextScripts }
                }
            };
        }

        case 'APPLY_DELETE_SCRIPT': {
            const scripts = state.project.scripts.scripts || {};
            if (!scripts[action.payload.scriptId]) return state;
            const nextScripts = { ...scripts };
            delete nextScripts[action.payload.scriptId];
            return {
                ...state,
                project: {
                    ...state.project,
                    scripts: { ...state.project.scripts, scripts: nextScripts }
                }
            };
        }

        case 'TOGGLE_STAGE_EXPAND': {
            const stage = state.project.stageTree.stages[action.payload.id];
            if (!stage) return state;
            return {
                ...state,
                project: {
                    ...state.project,
                    stageTree: {
                        ...state.project.stageTree,
                        stages: {
                            ...state.project.stageTree.stages,
                            [action.payload.id]: { ...stage, isExpanded: !stage.isExpanded }
                        }
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

        // Navigation (P2-T02)
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

            // 若显式传入 graphId 则采用；否则只要导航到 Stage/Node 就清空当前演出图，以免画布停留在旧的演出图
            const isStageOrNodeNav = action.payload.stageId !== undefined || action.payload.nodeId !== undefined;
            const nextGraphId = action.payload.graphId !== undefined
                ? action.payload.graphId
                : (isStageOrNodeNav ? null : state.ui.currentGraphId);

            // 记录进入演出图前的上下文，便于面包屑返回
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

        case 'SET_BLACKBOARD_VIEW': {
            return {
                ...state,
                ui: {
                    ...state.ui,
                    blackboardView: {
                        ...state.ui.blackboardView,
                        // 仅覆盖传入的字段，保持其余状态用于记忆
                        ...action.payload
                    }
                }
            };
        }

        case 'SET_PANEL_SIZES': {
            return {
                ...state,
                ui: {
                    ...state.ui,
                    panelSizes: {
                        ...state.ui.panelSizes,
                        ...action.payload
                    }
                }
            };
        }

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
