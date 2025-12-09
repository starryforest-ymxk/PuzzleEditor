/**
 * store/context.tsx
 * 全局状态管理 Context 定义
 * - 提供 React Context 包装的 Reducer 状态管理
 * - 使用双 Context 模式分离状态和派发，优化组件渲染
 */

import React, { createContext, useContext, useReducer, ReactNode, Dispatch } from 'react';
import { EditorState, INITIAL_STATE, Action } from './types';
import { editorReducer } from './reducer';
import { apiService } from '../api/service';

// ========== Context 定义 ==========
/** 全局状态 Context */
const StateContext = createContext<EditorState>(INITIAL_STATE);
/** 派发函数 Context */
const DispatchContext = createContext<Dispatch<Action>>(() => null);

// ========== Provider 组件 ==========
/**
 * 全局状态 Provider
 * 包裹应用根组件，提供状态和派发能力
 */
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
/** 获取全局编辑器状态 */
export const useEditorState = () => useContext(StateContext);
/** 获取派发函数，用于触发 Action */
export const useEditorDispatch = () => useContext(DispatchContext);

// ========== 异步 Action 辅助函数 ==========
/**
 * 加载项目数据
 * 从 API 获取项目数据并初始化 Store
 */
export const loadProjectData = async (dispatch: Dispatch<Action>) => {
  dispatch({ type: 'INIT_START' });
  try {
    const exportManifest = await apiService.loadProject();
    const projectData = exportManifest.project;

    dispatch({
      type: 'INIT_SUCCESS',
      payload: {
        stageTree: projectData.stageTree,
        nodes: projectData.nodes,
        stateMachines: projectData.stateMachines,
        presentationGraphs: projectData.presentationGraphs,
        blackboard: projectData.blackboard,
        meta: projectData.meta,
        scripts: projectData.scripts,
        triggers: projectData.triggers
      }
    });
  } catch (error) {
    console.error("项目加载失败:", error);
    // TODO: 在实际应用中，这里应该派发 ERROR action
  }
};
