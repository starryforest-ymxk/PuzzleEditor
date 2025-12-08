/**
 * FSM (内部状态机) Reducer 切片
 * 处理所有与状态机状态(State)和转移(Transition)相关的操作
 */

import { EditorState, Action } from '../types';
import { StateMachine, State, Transition } from '../../types/stateMachine';

// ========== FSM 相关 Actions 类型定义 ==========
export type FsmAction =
    | { type: 'ADD_STATE'; payload: { fsmId: string; state: State } }
    | { type: 'DELETE_STATE'; payload: { fsmId: string; stateId: string } }
    | { type: 'UPDATE_STATE'; payload: { fsmId: string; stateId: string; data: Partial<State> } }
    | { type: 'UPDATE_FSM'; payload: { fsmId: string; data: Partial<StateMachine> } }
    | { type: 'ADD_TRANSITION'; payload: { fsmId: string; transition: Transition } }
    | { type: 'DELETE_TRANSITION'; payload: { fsmId: string; transitionId: string } }
    | { type: 'UPDATE_TRANSITION'; payload: { fsmId: string; transitionId: string; data: Partial<Transition> } };

// ========== 类型守卫：判断是否为 FSM Action ==========
export const isFsmAction = (action: Action): action is FsmAction => {
    const fsmActionTypes = [
        'ADD_STATE', 'DELETE_STATE', 'UPDATE_STATE',
        'UPDATE_FSM', 'ADD_TRANSITION', 'DELETE_TRANSITION', 'UPDATE_TRANSITION'
    ];
    return fsmActionTypes.includes(action.type);
};

// ========== FSM Reducer ==========
export const fsmReducer = (state: EditorState, action: FsmAction): EditorState => {
    switch (action.type) {
        case 'ADD_STATE': {
            const { fsmId, state: newState } = action.payload;
            const fsm = state.project.stateMachines[fsmId];
            if (!fsm) return state;

            return {
                ...state,
                project: {
                    ...state.project,
                    stateMachines: {
                        ...state.project.stateMachines,
                        [fsmId]: {
                            ...fsm,
                            states: { ...fsm.states, [newState.id]: newState }
                        }
                    }
                }
            };
        }

        case 'DELETE_STATE': {
            const { fsmId, stateId } = action.payload;
            const fsm = state.project.stateMachines[fsmId];
            if (!fsm) return state;

            const newStates = { ...fsm.states };
            delete newStates[stateId];

            // 同时删除关联的转移
            const newTransitions = { ...fsm.transitions };
            Object.keys(newTransitions).forEach(tId => {
                const t = newTransitions[tId];
                if (t.fromStateId === stateId || t.toStateId === stateId) {
                    delete newTransitions[tId];
                }
            });

            // 如果删除的是初始状态，清除 initialStateId
            let newInitialStateId = fsm.initialStateId;
            if (fsm.initialStateId === stateId) {
                newInitialStateId = null;
            }

            // 如果删除的是当前选中项，更新选择状态
            let newSelection = state.ui.selection;
            if (state.ui.selection.type === 'STATE' && state.ui.selection.id === stateId) {
                if (state.ui.selection.contextId) {
                    newSelection = { type: 'NODE', id: state.ui.selection.contextId };
                } else {
                    newSelection = { type: 'NONE', id: null };
                }
            }

            return {
                ...state,
                ui: { ...state.ui, selection: newSelection },
                project: {
                    ...state.project,
                    stateMachines: {
                        ...state.project.stateMachines,
                        [fsmId]: {
                            ...fsm,
                            states: newStates,
                            transitions: newTransitions,
                            initialStateId: newInitialStateId
                        }
                    }
                }
            };
        }

        case 'UPDATE_STATE': {
            const { fsmId, stateId, data } = action.payload;
            const fsm = state.project.stateMachines[fsmId];
            if (!fsm || !fsm.states[stateId]) return state;

            return {
                ...state,
                project: {
                    ...state.project,
                    stateMachines: {
                        ...state.project.stateMachines,
                        [fsmId]: {
                            ...fsm,
                            states: {
                                ...fsm.states,
                                [stateId]: { ...fsm.states[stateId], ...data }
                            }
                        }
                    }
                }
            };
        }

        case 'UPDATE_FSM': {
            const { fsmId, data } = action.payload;
            const fsm = state.project.stateMachines[fsmId];
            if (!fsm) return state;

            return {
                ...state,
                project: {
                    ...state.project,
                    stateMachines: {
                        ...state.project.stateMachines,
                        [fsmId]: { ...fsm, ...data }
                    }
                }
            };
        }

        case 'ADD_TRANSITION': {
            const { fsmId, transition } = action.payload;
            const fsm = state.project.stateMachines[fsmId];
            if (!fsm) return state;

            const fromState = fsm.states[transition.fromStateId];
            if (!fromState) return state;

            return {
                ...state,
                project: {
                    ...state.project,
                    stateMachines: {
                        ...state.project.stateMachines,
                        [fsmId]: {
                            ...fsm,
                            transitions: { ...fsm.transitions, [transition.id]: transition }
                        }
                    }
                }
            };
        }

        case 'DELETE_TRANSITION': {
            const { fsmId, transitionId } = action.payload;
            const fsm = state.project.stateMachines[fsmId];
            if (!fsm) return state;

            const trans = fsm.transitions[transitionId];
            if (!trans) return state;

            const newTransitions = { ...fsm.transitions };
            delete newTransitions[transitionId];

            let newSelection = state.ui.selection;
            if (state.ui.selection.type === 'TRANSITION' && state.ui.selection.id === transitionId) {
                if (state.ui.selection.contextId) {
                    newSelection = { type: 'NODE', id: state.ui.selection.contextId };
                } else {
                    newSelection = { type: 'NONE', id: null };
                }
            }

            return {
                ...state,
                ui: { ...state.ui, selection: newSelection },
                project: {
                    ...state.project,
                    stateMachines: {
                        ...state.project.stateMachines,
                        [fsmId]: { ...fsm, transitions: newTransitions }
                    }
                }
            };
        }

        case 'UPDATE_TRANSITION': {
            const { fsmId, transitionId, data } = action.payload;
            const fsm = state.project.stateMachines[fsmId];
            if (!fsm || !fsm.transitions[transitionId]) return state;

            return {
                ...state,
                project: {
                    ...state.project,
                    stateMachines: {
                        ...state.project.stateMachines,
                        [fsmId]: {
                            ...fsm,
                            transitions: {
                                ...fsm.transitions,
                                [transitionId]: { ...fsm.transitions[transitionId], ...data }
                            }
                        }
                    }
                }
            };
        }

        default:
            return state;
    }
};
