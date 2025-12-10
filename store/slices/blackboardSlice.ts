/**
 * Blackboard Reducer 切片
 * 处理所有与黑板数据相关的操作：全局变量、事件、脚本、Stage/Node局部变量
 */

import { EditorState, Action } from '../types';
import { resolveDeleteAction } from '../../utils/resourceLifecycle';

// ========== Blackboard 相关 Actions 类型定义 ==========
export type BlackboardAction =
    | { type: 'SOFT_DELETE_GLOBAL_VARIABLE'; payload: { varId: string } }
    | { type: 'APPLY_DELETE_GLOBAL_VARIABLE'; payload: { varId: string } }
    | { type: 'SOFT_DELETE_EVENT'; payload: { eventId: string } }
    | { type: 'APPLY_DELETE_EVENT'; payload: { eventId: string } }
    | { type: 'SOFT_DELETE_SCRIPT'; payload: { scriptId: string } }
    | { type: 'APPLY_DELETE_SCRIPT'; payload: { scriptId: string } }
    | { type: 'SOFT_DELETE_STAGE_VARIABLE'; payload: { stageId: string; varId: string } }
    | { type: 'APPLY_DELETE_STAGE_VARIABLE'; payload: { stageId: string; varId: string } };

// ========== 类型守卫：判断是否为 Blackboard Action ==========
export const isBlackboardAction = (action: Action): action is BlackboardAction => {
    const blackboardActionTypes = [
        'SOFT_DELETE_GLOBAL_VARIABLE', 'APPLY_DELETE_GLOBAL_VARIABLE',
        'SOFT_DELETE_EVENT', 'APPLY_DELETE_EVENT',
        'SOFT_DELETE_SCRIPT', 'APPLY_DELETE_SCRIPT',
        'SOFT_DELETE_STAGE_VARIABLE', 'APPLY_DELETE_STAGE_VARIABLE'
    ];
    return blackboardActionTypes.includes(action.type);
};

// ========== Blackboard Reducer ==========
export const blackboardReducer = (state: EditorState, action: BlackboardAction): EditorState => {
    switch (action.type) {
        // --- 全局变量操作 ---
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

        // --- 事件操作 ---
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

        // --- 脚本操作 ---
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

        // --- Stage 局部变量操作 ---
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

        default:
            return state;
    }
};
