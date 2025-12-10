/**
 * store/context.tsx
 * 全局状态管理 Context 定义
 * - 提供 React Context 封装的 Reducer 状态管理
 * - 使用双 Context 模式拆分状态与派发，优化组件订阅
 */

import React, { createContext, useContext, useReducer, Dispatch } from 'react';
import { EditorState, INITIAL_STATE, Action } from './types';
import { editorReducer } from './reducer';
import { apiService } from '../api/service';
import { normalizeProjectForStore } from '../utils/projectNormalizer';

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

// ========== 异步 Action 辅助函数 ==========
/**
 * 项目加载：从 API 获取数据并进行版本兼容归一化，注入 Store
 */
export const loadProjectData = async (dispatch: Dispatch<Action>) => {
  dispatch({ type: 'INIT_START' });
  try {
    let manifestError: Error | undefined;
    const [projectPayload, manifest] = await Promise.all([
      apiService.loadProject(),
      // Manifest 加载失败不阻断主流程，仅用于补充脚本/触发器
      apiService.loadManifest().catch((err) => { manifestError = err as Error; return undefined; })
    ]);

    const normalized = normalizeProjectForStore(projectPayload as any, manifest);

    dispatch({
      type: 'INIT_SUCCESS',
      payload: {
        stageTree: normalized.project.stageTree,
        nodes: normalized.project.nodes,
        stateMachines: normalized.project.stateMachines,
        presentationGraphs: normalized.project.presentationGraphs,
        blackboard: normalized.project.blackboard,
        meta: normalized.project.meta,
        scripts: normalized.project.scripts,
        triggers: normalized.project.triggers
      }
    });

    // 若 Manifest 加载失败，记录警告消息
    if (manifestError) {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: `msg-${Date.now()}`,
          level: 'warning',
          text: 'Manifest 加载失败，使用项目内置脚本/触发器清单',
          timestamp: new Date().toISOString()
        }
      });
    } else {
      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: `msg-${Date.now()}`,
          level: 'info',
          text: '项目加载完成',
          timestamp: new Date().toISOString()
        }
      });
    }

    // P2-T02: Navigate to Root Stage by default
    if (normalized.project.stageTree.rootId) {
      dispatch({
        type: 'NAVIGATE_TO',
        payload: { stageId: normalized.project.stageTree.rootId, nodeId: null }
      });
    }
  } catch (error: any) {
    console.error('项目加载失败:', error);
    const message = error?.message ?? '项目加载失败';
    dispatch({ type: 'INIT_ERROR', payload: { message } });
    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id: `msg-${Date.now()}`,
        level: 'error',
        text: message,
        timestamp: new Date().toISOString()
      }
    });
  }
};
