/**
 * store/context.tsx
 * 全局状态管理 Context 定义
 * - 提供 React Context 封装的 Reducer 状态管理
 * - 使用双 Context 模式拆分状态与派发，优化组件订阅
 */

import React, { createContext, useContext, useReducer, Dispatch } from 'react';
import { EditorState, INITIAL_STATE, Action } from './types';
import { editorReducer } from './reducer';

// ========== Context 定义 ==========
const StateContext = createContext<EditorState>(INITIAL_STATE);
const DispatchContext = createContext<Dispatch<Action>>(() => null);

// ========== Provider 组件 ==========
export const StoreProvider = ({ children }: React.PropsWithChildren<{}>) => {
  const [state, dispatch] = useReducer(editorReducer, INITIAL_STATE);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
};

// ========== 自定义 Hooks ==========
export const useEditorState = () => useContext(StateContext);
export const useEditorDispatch = () => useContext(DispatchContext);

