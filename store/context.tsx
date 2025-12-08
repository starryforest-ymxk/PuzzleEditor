import React, { createContext, useContext, useReducer, ReactNode, Dispatch } from 'react';
import { EditorState, INITIAL_STATE, Action } from './types';
import { editorReducer } from './reducer';
import { apiService } from '../api/service';

// Context Definitions
const StateContext = createContext<EditorState>(INITIAL_STATE);
const DispatchContext = createContext<Dispatch<Action>>(() => null);

// Provider Component
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

// Custom Hooks
export const useEditorState = () => useContext(StateContext);
export const useEditorDispatch = () => useContext(DispatchContext);

// Thunk-like Actions (Helper functions)
export const loadProjectData = async (dispatch: Dispatch<Action>) => {
  dispatch({ type: 'INIT_START' });
  try {
    const [projectData, manifest] = await Promise.all([
      apiService.loadProject(),
      apiService.loadManifest()
    ]);
    
    dispatch({ 
      type: 'INIT_SUCCESS', 
      payload: { 
        stageTree: projectData.stageTree,
        nodes: projectData.nodes,
        stateMachines: projectData.stateMachines,
        presentationGraphs: projectData.presentationGraphs,
        meta: projectData.meta,
        scripts: manifest.scripts,
        triggers: manifest.triggers
      } 
    });
  } catch (error) {
    console.error("Failed to load project:", error);
    // In a real app, dispatch an ERROR action here
  }
};
