/**
 * Blackboard Reducer 切片
 * 处理所有与黑板数据相关的操作：全局变量、事件、脚本、Stage/Node局部变量
 */

import { EditorState, Action } from '../types';
import { resolveDeleteAction } from '../../utils/resourceLifecycle';
import { VariableDefinition, EventDefinition } from '../../types/blackboard';
import { ScriptDefinition } from '../../types/manifest';

// ========== Blackboard 相关 Actions 类型定义 ==========
export type BlackboardAction =
    | { type: 'ADD_GLOBAL_VARIABLE'; payload: { variable: VariableDefinition } }
    | { type: 'UPDATE_GLOBAL_VARIABLE'; payload: { id: string; data: Partial<VariableDefinition> } }
    | { type: 'SOFT_DELETE_GLOBAL_VARIABLE'; payload: { id: string } }
    | { type: 'APPLY_DELETE_GLOBAL_VARIABLE'; payload: { id: string } }
    | { type: 'ADD_EVENT'; payload: { event: EventDefinition } }
    | { type: 'UPDATE_EVENT'; payload: { id: string; data: Partial<EventDefinition> } }
    | { type: 'SOFT_DELETE_EVENT'; payload: { id: string } }
    | { type: 'APPLY_DELETE_EVENT'; payload: { id: string } }
    | { type: 'ADD_SCRIPT'; payload: { script: ScriptDefinition } }
    | { type: 'UPDATE_SCRIPT'; payload: { id: string; data: Partial<ScriptDefinition> } }
    | { type: 'SOFT_DELETE_SCRIPT'; payload: { id: string } }
    | { type: 'APPLY_DELETE_SCRIPT'; payload: { id: string } }
    // Reorder Actions
    | { type: 'REORDER_GLOBAL_VARIABLES'; payload: { orderedIds: string[] } }
    | { type: 'REORDER_EVENTS'; payload: { orderedIds: string[] } }
    | { type: 'REORDER_SCRIPTS'; payload: { category: string; lifecycleType?: string; orderedIds: string[] } }
    | { type: 'REORDER_LOCAL_VARIABLES'; payload: { scopeType: 'Stage' | 'Node'; scopeId: string; orderedIds: string[] } }
    | { type: 'REORDER_FSMS'; payload: { orderedIds: string[] } }
    | { type: 'REORDER_PRESENTATION_GRAPHS'; payload: { orderedIds: string[] } }
    | { type: 'SOFT_DELETE_STAGE_VARIABLE'; payload: { stageId: string; varId: string } }
    | { type: 'APPLY_DELETE_STAGE_VARIABLE'; payload: { stageId: string; varId: string } };

// ========== 类型守卫：判断是否为 Blackboard Action ==========
export const isBlackboardAction = (action: Action): action is BlackboardAction => {
    const blackboardActionTypes = [
        'ADD_GLOBAL_VARIABLE', 'UPDATE_GLOBAL_VARIABLE',
        'SOFT_DELETE_GLOBAL_VARIABLE', 'APPLY_DELETE_GLOBAL_VARIABLE',
        'ADD_EVENT', 'UPDATE_EVENT',
        'SOFT_DELETE_EVENT', 'APPLY_DELETE_EVENT',
        'ADD_SCRIPT', 'UPDATE_SCRIPT',
        'SOFT_DELETE_SCRIPT', 'APPLY_DELETE_SCRIPT',
        'REORDER_GLOBAL_VARIABLES', 'REORDER_EVENTS', 'REORDER_SCRIPTS',
        'REORDER_LOCAL_VARIABLES', 'REORDER_FSMS', 'REORDER_PRESENTATION_GRAPHS',
        'SOFT_DELETE_STAGE_VARIABLE', 'APPLY_DELETE_STAGE_VARIABLE'
    ];
    return blackboardActionTypes.includes(action.type);
};

// ========== Blackboard Reducer ==========
export const blackboardReducer = (state: EditorState, action: BlackboardAction): EditorState => {
    switch (action.type) {
        // --- 全局变量操作 ---
        case 'ADD_GLOBAL_VARIABLE': {
            const vars = state.project.blackboard.globalVariables || {};
            return {
                ...state,
                project: {
                    ...state.project,
                    blackboard: {
                        ...state.project.blackboard,
                        globalVariables: { ...vars, [action.payload.variable.id]: action.payload.variable }
                    }
                }
            };
        }

        case 'UPDATE_GLOBAL_VARIABLE': {
            const vars = state.project.blackboard.globalVariables || {};
            const variable = vars[action.payload.id];
            if (!variable) return state;
            return {
                ...state,
                project: {
                    ...state.project,
                    blackboard: {
                        ...state.project.blackboard,
                        globalVariables: {
                            ...vars,
                            [action.payload.id]: { ...variable, ...action.payload.data }
                        }
                    }
                }
            };
        }

        case 'SOFT_DELETE_GLOBAL_VARIABLE': {
            const vars = state.project.blackboard.globalVariables || {};
            const variable = vars[action.payload.id];
            if (!variable) return state;
            const resolution = resolveDeleteAction(variable.state);
            const nextVars = { ...vars };
            if (resolution.shouldRemove) {
                delete nextVars[action.payload.id];
            } else {
                nextVars[action.payload.id] = { ...variable, state: resolution.nextState };
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
            if (!vars[action.payload.id]) return state;
            const nextVars = { ...vars };
            delete nextVars[action.payload.id];
            return {
                ...state,
                project: {
                    ...state.project,
                    blackboard: { ...state.project.blackboard, globalVariables: nextVars }
                }
            };
        }

        // --- 事件操作 ---
        case 'ADD_EVENT': {
            const events = state.project.blackboard.events || {};
            return {
                ...state,
                project: {
                    ...state.project,
                    blackboard: {
                        ...state.project.blackboard,
                        events: { ...events, [action.payload.event.id]: action.payload.event }
                    }
                }
            };
        }

        case 'UPDATE_EVENT': {
            const events = state.project.blackboard.events || {};
            const event = events[action.payload.id];
            if (!event) return state;
            return {
                ...state,
                project: {
                    ...state.project,
                    blackboard: {
                        ...state.project.blackboard,
                        events: {
                            ...events,
                            [action.payload.id]: { ...event, ...action.payload.data }
                        }
                    }
                }
            };
        }

        case 'SOFT_DELETE_EVENT': {
            const events = state.project.blackboard.events || {};
            const event = events[action.payload.id];
            if (!event) return state;
            const resolution = resolveDeleteAction(event.state);
            const nextEvents = { ...events };
            if (resolution.shouldRemove) {
                delete nextEvents[action.payload.id];
            } else {
                nextEvents[action.payload.id] = { ...event, state: resolution.nextState };
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
            if (!events[action.payload.id]) return state;
            const nextEvents = { ...events };
            delete nextEvents[action.payload.id];
            return {
                ...state,
                project: {
                    ...state.project,
                    blackboard: { ...state.project.blackboard, events: nextEvents }
                }
            };
        }

        // --- 脚本操作 ---
        case 'ADD_SCRIPT': {
            const scripts = state.project.scripts.scripts || {};
            return {
                ...state,
                project: {
                    ...state.project,
                    scripts: {
                        ...state.project.scripts,
                        scripts: { ...scripts, [action.payload.script.id]: action.payload.script }
                    }
                }
            };
        }

        case 'UPDATE_SCRIPT': {
            const scripts = state.project.scripts.scripts || {};
            const script = scripts[action.payload.id];
            if (!script) return state;
            return {
                ...state,
                project: {
                    ...state.project,
                    scripts: {
                        ...state.project.scripts,
                        scripts: {
                            ...scripts,
                            [action.payload.id]: { ...script, ...action.payload.data }
                        }
                    }
                }
            };
        }

        case 'SOFT_DELETE_SCRIPT': {
            const scripts = state.project.scripts.scripts || {};
            const script = scripts[action.payload.id];
            if (!script) return state;
            const resolution = resolveDeleteAction(script.state);
            const nextScripts = { ...scripts };
            if (resolution.shouldRemove) {
                delete nextScripts[action.payload.id];
            } else {
                nextScripts[action.payload.id] = { ...script, state: resolution.nextState };
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
            if (!scripts[action.payload.id]) return state;
            const nextScripts = { ...scripts };
            delete nextScripts[action.payload.id];
            return {
                ...state,
                project: {
                    ...state.project,
                    scripts: { ...state.project.scripts, scripts: nextScripts }
                }
            };
        }

        // --- 拖拽排序操作 ---
        case 'REORDER_GLOBAL_VARIABLES': {
            // 根据 orderedIds 更新 displayOrder
            const vars = state.project.blackboard.globalVariables || {};
            const nextVars = { ...vars };
            action.payload.orderedIds.forEach((id, index) => {
                if (nextVars[id]) {
                    nextVars[id] = { ...nextVars[id], displayOrder: index };
                }
            });
            return {
                ...state,
                project: {
                    ...state.project,
                    blackboard: { ...state.project.blackboard, globalVariables: nextVars }
                }
            };
        }

        case 'REORDER_EVENTS': {
            const events = state.project.blackboard.events || {};
            const nextEvents = { ...events };
            action.payload.orderedIds.forEach((id, index) => {
                if (nextEvents[id]) {
                    nextEvents[id] = { ...nextEvents[id], displayOrder: index };
                }
            });
            return {
                ...state,
                project: {
                    ...state.project,
                    blackboard: { ...state.project.blackboard, events: nextEvents }
                }
            };
        }

        case 'REORDER_SCRIPTS': {
            // 只更新指定分组内脚本的 displayOrder
            const scripts = state.project.scripts.scripts || {};
            const nextScripts = { ...scripts };
            action.payload.orderedIds.forEach((id, index) => {
                if (nextScripts[id]) {
                    nextScripts[id] = { ...nextScripts[id], displayOrder: index };
                }
            });
            return {
                ...state,
                project: {
                    ...state.project,
                    scripts: { ...state.project.scripts, scripts: nextScripts }
                }
            };
        }

        case 'REORDER_LOCAL_VARIABLES': {
            const { scopeType, scopeId, orderedIds } = action.payload;

            if (scopeType === 'Stage') {
                const stage = state.project.stageTree.stages[scopeId];
                if (!stage?.localVariables) return state;

                const nextVars = { ...stage.localVariables };
                orderedIds.forEach((id, index) => {
                    if (nextVars[id]) {
                        nextVars[id] = { ...nextVars[id], displayOrder: index };
                    }
                });
                return {
                    ...state,
                    project: {
                        ...state.project,
                        stageTree: {
                            ...state.project.stageTree,
                            stages: {
                                ...state.project.stageTree.stages,
                                [scopeId]: { ...stage, localVariables: nextVars }
                            }
                        }
                    }
                };
            } else {
                // Node local variables
                const node = state.project.nodes[scopeId];
                if (!node?.localVariables) return state;

                const nextVars = { ...node.localVariables };
                orderedIds.forEach((id, index) => {
                    if (nextVars[id]) {
                        nextVars[id] = { ...nextVars[id], displayOrder: index };
                    }
                });
                return {
                    ...state,
                    project: {
                        ...state.project,
                        nodes: {
                            ...state.project.nodes,
                            [scopeId]: { ...node, localVariables: nextVars }
                        }
                    }
                };
            }
        }

        case 'REORDER_FSMS': {
            const fsms = state.project.stateMachines || {};
            const nextFsms = { ...fsms };
            action.payload.orderedIds.forEach((id, index) => {
                if (nextFsms[id]) {
                    nextFsms[id] = { ...nextFsms[id], displayOrder: index };
                }
            });
            return {
                ...state,
                project: {
                    ...state.project,
                    stateMachines: nextFsms
                }
            };
        }

        case 'REORDER_PRESENTATION_GRAPHS': {
            const graphs = state.project.presentationGraphs || {};
            const nextGraphs = { ...graphs };
            action.payload.orderedIds.forEach((id, index) => {
                if (nextGraphs[id]) {
                    nextGraphs[id] = { ...nextGraphs[id], displayOrder: index };
                }
            });
            return {
                ...state,
                project: {
                    ...state.project,
                    presentationGraphs: nextGraphs
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
