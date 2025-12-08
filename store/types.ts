/**
 * store/types.ts
 * Redux-like Store 类型定义
 */

import { StageTreeData } from '../types/stage';
import { PuzzleNode } from '../types/puzzleNode';
import { ScriptDefinition, TriggerDefinition } from '../types/manifest';
import { StateMachine, State, Transition } from '../types/stateMachine';
import { PresentationGraph, PresentationNode } from '../types/presentation';
import { VariableDefinition } from '../types/blackboard';
import {
  PuzzleNodeId,
  StateMachineId,
  PresentationGraphId,
  StateId
} from '../types/common';

// ========== Undo/Redo 快照数据 ==========
export interface ProjectContent {
  stageTree: StageTreeData;
  nodes: Record<PuzzleNodeId, PuzzleNode>;
  stateMachines: Record<StateMachineId, StateMachine>;
  presentationGraphs: Record<PresentationGraphId, PresentationGraph>;
  meta: { name: string; version: string };
}

// ========== Editor 全局状态 ==========
export interface EditorState {
  project: {
    isLoaded: boolean;
    meta: { name: string; version: string };
    stageTree: StageTreeData;
    nodes: Record<PuzzleNodeId, PuzzleNode>;
    stateMachines: Record<StateMachineId, StateMachine>;
    presentationGraphs: Record<PresentationGraphId, PresentationGraph>;
  };
  // 历史记录（Undo/Redo）
  history: {
    past: ProjectContent[];
    future: ProjectContent[];
  };
  manifest: {
    scripts: ScriptDefinition[];
    triggers: TriggerDefinition[];
    isLoaded: boolean;
  };
  ui: {
    isLoading: boolean;
    selection: {
      type: 'STAGE' | 'NODE' | 'STATE' | 'TRANSITION' | 'PRESENTATION_GRAPH' | 'PRESENTATION_NODE' | 'NONE';
      id: string | null;
      contextId?: string | null;
    };
    multiSelectStateIds: StateId[];  // 框选的状态节点ID列表
  };
}

// ========== 初始状态 ==========
export const INITIAL_STATE: EditorState = {
  project: {
    isLoaded: false,
    meta: { name: '', version: '' },
    stageTree: { rootId: '', stages: {} },
    nodes: {},
    stateMachines: {},
    presentationGraphs: {}
  },
  history: {
    past: [],
    future: []
  },
  manifest: {
    scripts: [],
    triggers: [],
    isLoaded: false
  },
  ui: {
    isLoading: false,
    selection: { type: 'NONE', id: null },
    multiSelectStateIds: []
  }
};

// ========== Action 类型定义 ==========
export type Action =
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'INIT_START' }
  | { type: 'INIT_SUCCESS'; payload: { stageTree: StageTreeData; nodes: Record<string, PuzzleNode>; stateMachines: Record<string, StateMachine>; presentationGraphs: Record<string, PresentationGraph>; meta: { name: string; version: string }; scripts: ScriptDefinition[]; triggers: TriggerDefinition[] } }
  | { type: 'SELECT_OBJECT'; payload: { type: 'STAGE' | 'NODE' | 'STATE' | 'TRANSITION' | 'PRESENTATION_GRAPH' | 'PRESENTATION_NODE' | 'NONE'; id: string | null; contextId?: string | null } }
  | { type: 'UPDATE_STAGE_TREE'; payload: StageTreeData }
  | { type: 'TOGGLE_STAGE_EXPAND'; payload: { id: string } }
  // FSM CRUD
  | { type: 'ADD_STATE'; payload: { fsmId: string; state: State } }
  | { type: 'DELETE_STATE'; payload: { fsmId: string; stateId: string } }
  | { type: 'UPDATE_STATE'; payload: { fsmId: string; stateId: string; data: Partial<State> } }
  | { type: 'UPDATE_FSM'; payload: { fsmId: string; data: Partial<StateMachine> } }
  | { type: 'ADD_TRANSITION'; payload: { fsmId: string; transition: Transition } }
  | { type: 'DELETE_TRANSITION'; payload: { fsmId: string; transitionId: string } }
  | { type: 'UPDATE_TRANSITION'; payload: { fsmId: string; transitionId: string; data: Partial<Transition> } }
  // Presentation Graph CRUD
  | { type: 'ADD_PRESENTATION_NODE'; payload: { graphId: string; node: PresentationNode } }
  | { type: 'DELETE_PRESENTATION_NODE'; payload: { graphId: string; nodeId: string } }
  | { type: 'UPDATE_PRESENTATION_NODE'; payload: { graphId: string; nodeId: string; data: Partial<PresentationNode> } }
  | { type: 'LINK_PRESENTATION_NODES'; payload: { graphId: string; fromNodeId: string; toNodeId: string } }
  | { type: 'UNLINK_PRESENTATION_NODES'; payload: { graphId: string; fromNodeId: string; toNodeId: string } }
  // Node Parameters (局部变量) CRUD
  | { type: 'ADD_NODE_PARAM'; payload: { nodeId: string; variable: VariableDefinition } }
  | { type: 'UPDATE_NODE_PARAM'; payload: { nodeId: string; varId: string; data: Partial<VariableDefinition> } }
  | { type: 'DELETE_NODE_PARAM'; payload: { nodeId: string; varId: string } }
  // Multi-Select (框选)
  | { type: 'SET_MULTI_SELECT_STATES'; payload: string[] };
