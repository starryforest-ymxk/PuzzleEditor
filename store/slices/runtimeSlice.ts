/**
 * store/slices/runtimeSlice.ts
 * 运行时状态切片 - 处理 Electron 相关的运行时状态
 */

import { isActionForDomain, type ActionForDomain } from '../actionPolicy';
import { EditorState, Action } from '../types';

// ========== Runtime Action 类型守卫 ==========
export type RuntimeAction = ActionForDomain<'runtime'>;

/**
 * 判断是否为 Runtime 相关 Action
 */
export const isRuntimeAction = (action: Action): action is RuntimeAction => isActionForDomain(action, 'runtime');

/**
 * Runtime Slice Reducer
 * 处理运行时状态的更新
 */
export const runtimeReducer = (state: EditorState, action: RuntimeAction): EditorState => {
    switch (action.type) {
        case 'SET_PROJECT_OPERATION':
            return { ...state, runtime: { ...state.runtime, projectOperation: action.payload } };
        case 'SET_PROJECT_PATH':
            return {
                ...state,
                runtime: {
                    ...state.runtime,
                    currentProjectPath: action.payload
                }
            };

        case 'SET_NEW_UNSAVED_PROJECT':
            return {
                ...state,
                runtime: {
                    ...state.runtime,
                    isNewUnsavedProject: action.payload
                }
            };

        case 'SET_PREFERENCES_LOADED':
            return {
                ...state,
                runtime: {
                    ...state.runtime,
                    preferencesLoaded: action.payload
                }
            };

        default:
            return state;
    }
};
