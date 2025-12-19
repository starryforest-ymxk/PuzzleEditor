/**
 * store/slices/runtimeSlice.ts
 * 运行时状态切片 - 处理 Electron 相关的运行时状态
 */

import { EditorState, Action } from '../types';

// ========== Runtime Action 类型守卫 ==========
export type RuntimeAction = Extract<Action,
    | { type: 'SET_PROJECT_PATH'; payload: string | null }
    | { type: 'SET_NEW_UNSAVED_PROJECT'; payload: boolean }
    | { type: 'SET_PREFERENCES_LOADED'; payload: boolean }
>;

/**
 * 判断是否为 Runtime 相关 Action
 */
export const isRuntimeAction = (action: Action): action is RuntimeAction => {
    return [
        'SET_PROJECT_PATH',
        'SET_NEW_UNSAVED_PROJECT',
        'SET_PREFERENCES_LOADED'
    ].includes(action.type);
};

/**
 * Runtime Slice Reducer
 * 处理运行时状态的更新
 */
export const runtimeReducer = (state: EditorState, action: RuntimeAction): EditorState => {
    switch (action.type) {
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
