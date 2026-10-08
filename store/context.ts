/** Context 与读取 Hook 保持在普通模块中，避免混合导出使 Provider 失去热更新边界。 */
import { createContext, useContext } from 'react';
import { INITIAL_STATE, type Action, type EditorState } from './types';
import type { ProjectSession } from '../services/projectSession';

function createContexts() {
  return {
    state: createContext<EditorState>(INITIAL_STATE),
    dispatch: createContext<(action: Action) => void>(() => undefined),
    session: createContext<ProjectSession | null>(null),
  };
}

type EditorContexts = ReturnType<typeof createContexts>;
let contexts: EditorContexts;
if (import.meta.hot && import.meta.hot.data) {
  // Vite 先后刷新 Provider/消费者时必须使用同一组 Context；只缓存上下文，不共享 Store。
  // hot.data 属于本模块的开发期缓存，结构由本模块唯一写入，生产构建移除此分支。
  const cache = import.meta.hot.data as { editorContexts?: EditorContexts };
  contexts = cache.editorContexts ??= createContexts();
} else {
  contexts = createContexts();
}

export const StateContext = contexts.state;
export const DispatchContext = contexts.dispatch;
export const SessionContext = contexts.session;

export const useEditorState = (): EditorState => useContext(StateContext);
export const useEditorDispatch = (): ((action: Action) => void) => useContext(DispatchContext);
export const useProjectSession = (): ProjectSession => {
  const session: ProjectSession | null = useContext(SessionContext);
  if (!session) throw new Error('Project session requires StoreProvider');
  return session;
};
