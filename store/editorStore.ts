import { editorReducer } from './reducer';
import { INITIAL_STATE, type Action, type EditorState } from './types';
import { equalProjectData } from '../utils/equalProjectData';

export interface ContentVersion { sessionId: number; contentEpoch: number }

export interface EditorStore {
    getState(): EditorState;
    dispatch(action: Action): void;
    subscribe(listener: () => void): () => void;
    getVersion(): ContentVersion;
    compareAndDispatch(expected: ContentVersion, action: Action): boolean;
}

/** 同步应用 Reducer，再通知 React；连续操作始终读取已完成的上一操作。 */
export function createEditorStore(initialState: EditorState = INITIAL_STATE): EditorStore {
    let state = initialState;
    let contentEpoch = 0;
    const listeners = new Set<() => void>();
    const store: EditorStore = {
        getState: () => state,
        getVersion: () => ({ sessionId: state.document.sessionId, contentEpoch }),
        compareAndDispatch: (expected, action) => {
            if (expected.sessionId !== state.document.sessionId || expected.contentEpoch !== contentEpoch) return false;
            store.dispatch(action);
            return true;
        },
        dispatch: action => {
            const next = editorReducer(state, action);
            if (next === state) return;
            // 同一同步入口覆盖手工、Agent、保存、Undo/Redo 与外部同步；导航不使内容令牌失效。
            if (next.document.sessionId !== state.document.sessionId || action.type === 'UNDO' || action.type === 'REDO' || action.type === 'RESTORE_AUTOMATION_HISTORY' || !equalProjectData(next.project, state.project)) contentEpoch++;
            state = next;
            listeners.forEach(listener => listener());
        },
        subscribe: listener => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        }
    };
    return store;
}
