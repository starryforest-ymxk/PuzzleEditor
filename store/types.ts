/**
 * store/types.ts
 * Redux-like Store 类型定义
 */

import { StageTreeData } from '../types/stage';
import { PuzzleNode } from '../types/puzzleNode';
import { ScriptsManifest, TriggersManifest } from '../types/manifest';
import { StateMachine, State, Transition } from '../types/stateMachine';
import { PresentationGraph, PresentationNode } from '../types/presentation';
import { VariableDefinition, BlackboardData } from '../types/blackboard';
import {
  PuzzleNodeId,
  StateMachineId,
  PresentationGraphId,
  StateId
} from '../types/common';
import { ProjectMeta } from '../types/project';

// ========== Undo/Redo 快照数据 ==========
export interface ProjectContent {
  stageTree: StageTreeData;
  nodes: Record<PuzzleNodeId, PuzzleNode>;
  stateMachines: Record<StateMachineId, StateMachine>;
  presentationGraphs: Record<PresentationGraphId, PresentationGraph>;
  blackboard: BlackboardData;
  meta: ProjectMeta;
  scripts: ScriptsManifest;
  triggers: TriggersManifest;
}

// ========== Editor 全局状态 ==========
export interface EditorState {
  project: {
    isLoaded: boolean;
    meta: ProjectMeta;
    stageTree: StageTreeData;
    nodes: Record<PuzzleNodeId, PuzzleNode>;
    stateMachines: Record<StateMachineId, StateMachine>;
    presentationGraphs: Record<PresentationGraphId, PresentationGraph>;
    blackboard: BlackboardData;
    scripts: ScriptsManifest;
    triggers: TriggersManifest;
  };
  // 历史记录（Undo/Redo）
  history: {
    past: ProjectContent[];
    future: ProjectContent[];
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
    meta: { id: '', name: '', version: '', createdAt: '', updatedAt: '' },
    stageTree: { rootId: '', stages: {} },
    nodes: {},
    stateMachines: {},
    presentationGraphs: {},
    blackboard: { globalVariables: {}, events: {} },
    scripts: { version: '', scripts: {} },
    triggers: { triggers: {} }
  },
  history: {
    past: [],
    future: []
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
  | { type: 'INIT_SUCCESS'; payload: { stageTree: StageTreeData; nodes: Record<string, PuzzleNode>; stateMachines: Record<string, StateMachine>; presentationGraphs: Record<string, PresentationGraph>; blackboard: BlackboardData; meta: ProjectMeta; scripts: ScriptsManifest; triggers: TriggersManifest } }
  | { type: 'SELECT_OBJECT'; payload: { type: 'STAGE' | 'NODE' | 'STATE' | 'TRANSITION' | 'PRESENTATION_GRAPH' | 'PRESENTATION_NODE' | 'NONE'; id: string | null; contextId?: string | null } }
  | { type: 'UPDATE_STAGE_TREE'; payload: StageTreeData }
  | { type: 'TOGGLE_STAGE_EXPAND'; payload: { id: string } }
  | { type: 'UPDATE_NODE'; payload: { nodeId: string; data: Partial<PuzzleNode> } }
  // Blackboard & Script lifecycle
  | { type: 'SOFT_DELETE_GLOBAL_VARIABLE'; payload: { varId: string } }
  | { type: 'APPLY_DELETE_GLOBAL_VARIABLE'; payload: { varId: string } }
  | { type: 'SOFT_DELETE_EVENT'; payload: { eventId: string } }
  | { type: 'APPLY_DELETE_EVENT'; payload: { eventId: string } }
  | { type: 'SOFT_DELETE_SCRIPT'; payload: { scriptId: string } }
  | { type: 'APPLY_DELETE_SCRIPT'; payload: { scriptId: string } }
  | { type: 'SOFT_DELETE_STAGE_VARIABLE'; payload: { stageId: string; varId: string } }
  | { type: 'APPLY_DELETE_STAGE_VARIABLE'; payload: { stageId: string; varId: string } }
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
