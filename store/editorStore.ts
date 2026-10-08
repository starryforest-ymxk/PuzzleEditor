import { editorReducer } from './reducer';
import { INITIAL_STATE, type Action, type EditorState } from './types';

export interface EditorStore {
    getState(): EditorState;
    dispatch(action: Action): void;
    subscribe(listener: () => void): () => void;
}

/** 同步应用 Reducer，再通知 React；连续操作始终读取已完成的上一操作。 */
export function createEditorStore(initialState: EditorState = INITIAL_STATE): EditorStore {
    let state = initialState;
    const listeners = new Set<() => void>();
    return {
        getState: () => state,
        dispatch: action => {
            const next = editorReducer(state, action);
            if (next === state) return;
            state = next;
            listeners.forEach(listener => listener());
        },
        subscribe: listener => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        }
    };
}
