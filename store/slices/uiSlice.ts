/**
 * UI Reducer 切片
 * 处理所有与 UI 状态相关的操作：选择、面板尺寸、黑板视图、消息等
 */

import { EditorState, Action, Selection, BlackboardViewState, UiMessage } from '../types';

// ========== UI 相关 Actions 类型定义 ==========
export type UiAction =
    | { type: 'SELECT_OBJECT'; payload: Selection }
    | { type: 'SET_MULTI_SELECT_STATES'; payload: string[] }
    | { type: 'SET_MULTI_SELECT_PRESENTATION_NODES'; payload: string[] }
    | { type: 'TOGGLE_STAGE_EXPAND'; payload: { id: string } }
    | { type: 'SET_STAGE_EXPANDED'; payload: { id: string; expanded: boolean } }
    | { type: 'SET_BLACKBOARD_VIEW'; payload: Partial<BlackboardViewState> }
    | { type: 'SET_PANEL_SIZES'; payload: Partial<{ explorerWidth: number; inspectorWidth: number; stagesHeight: number }> }
    | { type: 'SET_READ_ONLY'; payload: boolean }
    | { type: 'ADD_MESSAGE'; payload: UiMessage }
    | { type: 'CLEAR_MESSAGES' };

// ========== 类型守卫：判断是否为 UI Action ==========
export const isUiAction = (action: Action): action is UiAction => {
    const uiActionTypes = [
        'SELECT_OBJECT', 'SET_MULTI_SELECT_STATES', 'SET_MULTI_SELECT_PRESENTATION_NODES',
        'TOGGLE_STAGE_EXPAND', 'SET_STAGE_EXPANDED',
        'SET_BLACKBOARD_VIEW', 'SET_PANEL_SIZES',
        'ADD_MESSAGE', 'CLEAR_MESSAGES'
    ];
    return uiActionTypes.includes(action.type);
};

// ========== UI Reducer ==========
export const uiReducer = (state: EditorState, action: UiAction): EditorState => {
    switch (action.type) {
        case 'SELECT_OBJECT':
            return {
                ...state,
                ui: { ...state.ui, selection: action.payload, multiSelectStateIds: [], multiSelectPresentationNodeIds: [] }
            };

        case 'SET_MULTI_SELECT_STATES': {
            return {
                ...state,
                ui: { ...state.ui, multiSelectStateIds: action.payload }
            };
        }

        case 'SET_MULTI_SELECT_PRESENTATION_NODES': {
            return {
                ...state,
                ui: { ...state.ui, multiSelectPresentationNodeIds: action.payload }
            };
        }

        case 'TOGGLE_STAGE_EXPAND': {
            const current = state.ui.stageExpanded[action.payload.id] ?? state.project.stageTree.stages[action.payload.id]?.isExpanded ?? false;
            return {
                ...state,
                ui: {
                    ...state.ui,
                    stageExpanded: { ...state.ui.stageExpanded, [action.payload.id]: !current }
                }
            };
        }

        case 'SET_STAGE_EXPANDED': {
            return {
                ...state,
                ui: {
                    ...state.ui,
                    stageExpanded: { ...state.ui.stageExpanded, [action.payload.id]: action.payload.expanded }
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

        case 'SET_READ_ONLY': {
            return {
                ...state,
                ui: { ...state.ui, readOnly: action.payload }
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

        case 'ADD_MESSAGE': {
            return {
                ...state,
                ui: { ...state.ui, messages: [...state.ui.messages, action.payload] }
            };
        }

        case 'CLEAR_MESSAGES': {
            return {
                ...state,
                ui: { ...state.ui, messages: [] }
            };
        }

        default:
            return state;
    }
};
