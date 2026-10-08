/**
 * Editor Reducer - 核心 Reducer
 * 使用切片模式组织代码，负责协调基础 reducer 与全局历史/初始化逻辑
 */

import { EditorState, Action } from './types';
import { ACTION_POLICIES, type ActionPolicy } from './actionPolicy';
import { equalProjectData } from '../utils/equalProjectData';
import { reconcileHistoryUi } from './historyUi';
import { normalizePanelSizes } from '../utils/panelSizes';
import { acknowledgeSave, beginDocument, getHistoryEntry, isPermanentResourceDeletion, MAX_HISTORY_LENGTH, restoreHistory } from './documentHistory';
import {
    fsmReducer, isFsmAction,
    presentationReducer, isPresentationAction,
    nodeParamsReducer, isNodeParamsAction,
    blackboardReducer, isBlackboardAction,
    navigationReducer, isNavigationAction,
    uiReducer, isUiAction,
    projectReducer, isProjectAction,
    projectMetaReducer, isProjectMetaAction,
    runtimeReducer, isRuntimeAction
} from './slices';

// ========== Core Business Logic Reducer ==========
/**
 * 基础业务逻辑 Reducer
 * 将基础相关的 Action 分派给对应的 Slice
 */
const internalReducer = (state: EditorState, action: Action): EditorState => {
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

    if (isProjectMetaAction(action)) {
        return projectMetaReducer(state, action);
    }

    if (isRuntimeAction(action)) {
        return runtimeReducer(state, action);
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
                    scripts: action.payload.scripts
                },
                history: { past: [], future: [] },
                manifest: {
                    scripts: Object.values(action.payload.scripts.scripts),
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
                    multiSelectPresentationNodeIds: [],
                    view: 'EDITOR'
                }
            };

        case 'INIT_ERROR':
            return {
                ...state,
                ui: { ...state.ui, isLoading: false, errorMessage: action.payload.message }
            };

        // 设置相关 Actions
        case 'UPDATE_TRANSLATION_SETTINGS':
            return {
                ...state,
                settings: {
                    ...state.settings,
                    translation: {
                        ...state.settings.translation,
                        ...action.payload
                    }
                }
            };

        case 'UPDATE_AUTO_SAVE_SETTINGS':
            return {
                ...state,
                settings: {
                    ...state.settings,
                    autoSave: {
                        ...state.settings.autoSave,
                        ...action.payload
                    }
                }
            };

        case 'UPDATE_MESSAGE_FILTERS':
            return {
                ...state,
                settings: {
                    ...state.settings,
                    messageFilters: {
                        ...state.settings.messageFilters,
                        ...action.payload
                    }
                }
            };

        default:
            return state;
    }
};

// ========== 统一操作约束与历史管理 ==========
/** 全局约束先于切片执行，业务更新只执行一次。 */
export const editorReducer = (state: EditorState, action: Action): EditorState => {
    const policy: ActionPolicy = ACTION_POLICIES[action.type];
    if (!policy || (state.ui.readOnly && !policy.allowReadOnly)) return state;
    // 最终候选写入期间暂时冻结内容，避免确认后仍有旧会话编辑被丢弃。
    if (state.runtime.projectOperation.phase === 'committing' && policy.changesContent) return state;
    if (action.type === 'SYNC_RESOURCE_STATES' && action.sessionId !== state.document.sessionId) return state;
    if (action.type === 'UNDO' || action.type === 'REDO') return restoreHistory(state, action.type);
    if (action.type === 'PROJECT_SAVE_SUCCEEDED') return acknowledgeSave(state, action.payload);

    const next = internalReducer(state, action);
    if (action.type === 'INIT_SUCCESS') {
        const es = action.editorState;
        const ui = reconcileHistoryUi({
            ...next.ui,
            panelSizes: normalizePanelSizes(es?.panelSizes ?? next.ui.panelSizes),
            stageExpanded: es?.stageExpanded ?? {},
            currentStageId: es?.currentStageId ?? action.payload.stageTree.rootId ?? null,
            currentNodeId: es?.currentNodeId ?? null,
            currentGraphId: es?.currentGraphId ?? null,
            view: es?.view === 'BLACKBOARD' ? 'BLACKBOARD' : 'EDITOR',
            selection: !es && action.payload.stageTree.rootId ? { type: 'STAGE', id: action.payload.stageTree.rootId } : next.ui.selection,
            validationResults: action.validationResults ?? [], showValidationPanel: (action.validationResults?.length ?? 0) > 0
        }, action.payload);
        return beginDocument(state, { ...next, ui }, action.saved !== false, action.path ?? null);
    }
    if (action.type === 'RESET_PROJECT') return beginDocument(state, next, true);
    if (!policy.changesContent || next === state) return next;

    // 引用变化不等同于内容变化；同值更新不得产生空历史或清空 redo。
    if (equalProjectData(state.project, next.project)) {
        return next.ui === state.ui ? state : { ...next, project: state.project };
    }
    const barrier = policy.history === 'barrier'
        || (policy.history === 'resource-delete' && isPermanentResourceDeletion(state.project, next.project, action));
    const revision = state.document.nextRevision;
    return {
        ...next,
        document: { ...state.document, revision, nextRevision: revision + 1 },
        manifest: { ...next.manifest, scripts: Object.values(next.project.scripts.scripts) },
        history: barrier ? { past: [], future: [] } : {
            past: [...state.history.past, getHistoryEntry(state)].slice(-MAX_HISTORY_LENGTH),
            future: []
        },
        ui: { ...next.ui, isDirty: revision !== state.document.savedRevision }
    };
};
