
import { StageTreeData } from '../types/stage';
import { PuzzleNode } from '../types/puzzleNode';
import { ScriptDefinition, TriggerDefinition } from '../types/manifest';
import { StateMachine, State, Transition, ConditionExpression } from '../types/stateMachine';
import { PresentationGraph, PresentationNode } from '../types/presentation';
import { BlackboardVariable } from '../types/blackboard';
import { ProjectData } from '../api/types';

// Data that constitutes a "Snapshot" for Undo/Redo
export interface ProjectContent {
  stages: StageTreeData;
  nodes: Record<string, PuzzleNode>;
  stateMachines: Record<string, StateMachine>;
  presentationGraphs: Record<string, PresentationGraph>;
  rootStageId: string | null;
  meta: { name: string; version: string };
}

export interface EditorState {
  project: {
    isLoaded: boolean;
    meta: { name: string; version: string };
    stages: StageTreeData;
    nodes: Record<string, PuzzleNode>;
    stateMachines: Record<string, StateMachine>;
    presentationGraphs: Record<string, PresentationGraph>;
    rootStageId: string | null;
  };
  // History tracking
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
    multiSelectStateIds: string[]; // 框选的状态节点ID列表
  };
}

export const INITIAL_STATE: EditorState = {
  project: {
    isLoaded: false,
    meta: { name: '', version: '' },
    stages: {},
    nodes: {},
    stateMachines: {},
    presentationGraphs: {},
    rootStageId: null
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

// Actions
export type Action =
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'INIT_START' }
  | { type: 'INIT_SUCCESS'; payload: { project: ProjectData; scripts: ScriptDefinition[]; triggers: TriggerDefinition[] } }
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
  // Node Parameters (Blackboard) CRUD
  | { type: 'ADD_NODE_PARAM'; payload: { nodeId: string; variable: BlackboardVariable } }
  | { type: 'UPDATE_NODE_PARAM'; payload: { nodeId: string; varId: string; data: Partial<BlackboardVariable> } }
  | { type: 'DELETE_NODE_PARAM'; payload: { nodeId: string; varId: string } }
  // Multi-Select (框选)
  | { type: 'SET_MULTI_SELECT_STATES'; payload: string[] };
