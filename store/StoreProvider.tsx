import { useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { StateContext, DispatchContext, SessionContext } from './context';
import { createEditorStore } from './editorStore';
import { ProjectSession } from '../services/projectSession';
import { projectPlatform } from '../services/projectPlatform';

/** 每个 Provider 持有独立且稳定的 Store/项目会话；组件单独导出支持 Fast Refresh。 */
export const StoreProvider = ({ children }: PropsWithChildren) => {
  const [store] = useState(createEditorStore);
  const [session] = useState(() => new ProjectSession(store, projectPlatform));
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={store.dispatch}>
        <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
};
