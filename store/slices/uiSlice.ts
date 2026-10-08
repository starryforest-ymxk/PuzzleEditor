/**
 * UI Reducer 切片
 * 处理所有与 UI 状态相关的操作：选择、面板尺寸、黑板视图、消息等
 */

import { isActionForDomain, type ActionForDomain } from '../actionPolicy';
import { EditorState, Action } from '../types';
import { normalizePanelSizes } from '../../utils/panelSizes';

// ========== UI 相关 Actions 类型定义 ==========
export type UiAction = ActionForDomain<'ui'>;

// ========== 类型守卫：判断是否为 UI Action ==========
export const isUiAction = (action: Action): action is UiAction => isActionForDomain(action, 'ui');

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
            const merged = {
                ...state.ui.panelSizes,
                ...action.payload
            };
            return {
                ...state,
                ui: {
                    ...state.ui,
                    panelSizes: normalizePanelSizes(merged)
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

        case 'SET_VALIDATION_RESULTS': {
            return {
                ...state,
                ui: { ...state.ui, validationResults: action.payload }
            };
        }

        case 'SET_SHOW_VALIDATION_PANEL': {
            return {
                ...state,
                ui: { ...state.ui, showValidationPanel: action.payload }
            };
        }

        case 'SET_CONFIRM_DIALOG': {
            return {
                ...state,
                ui: {
                    ...state.ui,
                    confirmDialog: {
                        ...state.ui.confirmDialog,
                        ...action.payload
                    }
                }
            };
        }

        default:
            return state;
    }
};
