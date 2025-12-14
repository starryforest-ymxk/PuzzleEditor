/**
 * store/types.ts
 * Redux-like Store 类型定义
 */

import { StageTreeData } from '../types/stage';
import { PuzzleNode } from '../types/puzzleNode';
import { ScriptsManifest, TriggersManifest, ScriptDefinition, TriggerDefinition } from '../types/manifest';
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

// ========== UI 消息类型 ==========
export type MessageLevel = 'info' | 'warning' | 'error';
export interface UiMessage {
  id: string;
  level: MessageLevel;
  text: string;
  timestamp: string;
}

// ========== UI 状态类型 ==========
export interface BlackboardViewState {
  activeTab: 'Variables' | 'Scripts' | 'Events' | 'Graphs';
  filter: string;
  expandedSections: Record<string, boolean>;
  stateFilter?: 'ALL' | 'Draft' | 'Implemented' | 'MarkedForDelete';
  varTypeFilter?: 'ALL' | 'boolean' | 'integer' | 'float' | 'string';
}

export interface Selection {
  type: 'STAGE' | 'NODE' | 'STATE' | 'TRANSITION' | 'FSM' | 'PRESENTATION_GRAPH' | 'PRESENTATION_NODE' | 'VARIABLE' | 'SCRIPT' | 'EVENT' | 'NONE';
  id: string | null;
  contextId?: string | null;
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
  // 全局可用脚本/触发器（UI 展示）
  manifest: {
    scripts: ScriptDefinition[];
    triggers: TriggerDefinition[];
    isLoaded: boolean;
  };
  ui: {
    isLoading: boolean;
    errorMessage?: string | null;
    // 全局只读模式：阶段三起默认关闭，如需只读可再切换
    readOnly: boolean;
    view: 'EDITOR' | 'BLACKBOARD'; // P2-T02: 视图切换
    currentStageId: string | null; // P2-T02: 面包屑导航追踪
    currentNodeId: string | null;
    currentGraphId: string | null; // P2-T07: 当前查看的演出图
    // 进入演出图前的编辑器上下文，用于面包屑返回
    lastEditorContext: { stageId: string | null; nodeId: string | null };
    // 面包屑"后退"历史栈：存储最近浏览过的上下文（stage/node/graph）
    navStack: { stageId: string | null; nodeId: string | null; graphId: string | null }[];
    // Stage 展开状态（仅 UI，避免污染导出）
    stageExpanded: Record<string, boolean>;
    // 全局消息堆栈
    messages: UiMessage[];
    // 黑板视图 UI 状态（用于跨视图记忆）
    blackboardView: BlackboardViewState;
    selection: Selection;
    multiSelectStateIds: StateId[];  // 框选的状态节点ID列表
    // Panel sizes for resizable borders (in pixels)
    panelSizes: {
      explorerWidth: number;   // Left sidebar width
      inspectorWidth: number;  // Right sidebar width
      stagesHeight: number;    // Stages section height percentage (0-100)
    };
  };
}

// ========== 初始状态 ==========
export const INITIAL_STATE: EditorState = {
  project: {
    isLoaded: false,
    meta: { id: '', name: '', version: '', createdAt: '', updatedAt: '', description: '' },
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
  manifest: {
    scripts: [],
    triggers: [],
    isLoaded: false
  },
  ui: {
    isLoading: false,
    errorMessage: null,
    readOnly: false,
    view: 'EDITOR',
    currentStageId: null,
    currentNodeId: null,
    currentGraphId: null,
    lastEditorContext: { stageId: null, nodeId: null },
    navStack: [],
    stageExpanded: {},
    messages: [],
    blackboardView: {
      activeTab: 'Variables',
      filter: '',
      expandedSections: { global: true, local: true, Performance: true, Lifecycle: true, Condition: true, Trigger: true },
      stateFilter: 'ALL',
      varTypeFilter: 'ALL'
    },
    selection: { type: 'NONE', id: null },
    multiSelectStateIds: [],
    panelSizes: {
      explorerWidth: 280,
      inspectorWidth: 320,
      stagesHeight: 55
    }
  }
};

// ========== Action 类型定义 ==========
export type Action =
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'INIT_START' }
  | { type: 'INIT_SUCCESS'; payload: { stageTree: StageTreeData; nodes: Record<string, PuzzleNode>; stateMachines: Record<string, StateMachine>; presentationGraphs: Record<string, PresentationGraph>; blackboard: BlackboardData; meta: ProjectMeta; scripts: ScriptsManifest; triggers: TriggersManifest } }
  | { type: 'INIT_ERROR'; payload: { message: string } }
  | { type: 'SELECT_OBJECT'; payload: { type: 'STAGE' | 'NODE' | 'STATE' | 'TRANSITION' | 'FSM' | 'PRESENTATION_GRAPH' | 'PRESENTATION_NODE' | 'VARIABLE' | 'SCRIPT' | 'EVENT' | 'NONE'; id: string | null; contextId?: string | null } }
  | { type: 'UPDATE_STAGE_TREE'; payload: StageTreeData }
  | { type: 'TOGGLE_STAGE_EXPAND'; payload: { id: string } }
  | { type: 'UPDATE_NODE'; payload: { nodeId: string; data: Partial<PuzzleNode> } }
  // Blackboard & Script lifecycle
  | { type: 'ADD_GLOBAL_VARIABLE'; payload: { variable: VariableDefinition } }
  | { type: 'UPDATE_GLOBAL_VARIABLE'; payload: { id: string; data: Partial<VariableDefinition> } }
  | { type: 'SOFT_DELETE_GLOBAL_VARIABLE'; payload: { id: string } }
  | { type: 'APPLY_DELETE_GLOBAL_VARIABLE'; payload: { id: string } }
  | { type: 'ADD_EVENT'; payload: { event: import('../types/blackboard').EventDefinition } }
  | { type: 'UPDATE_EVENT'; payload: { id: string; data: Partial<import('../types/blackboard').EventDefinition> } }
  | { type: 'SOFT_DELETE_EVENT'; payload: { id: string } }
  | { type: 'APPLY_DELETE_EVENT'; payload: { id: string } }
  | { type: 'ADD_SCRIPT'; payload: { script: ScriptDefinition } }
  | { type: 'UPDATE_SCRIPT'; payload: { id: string; data: Partial<ScriptDefinition> } }
  | { type: 'SOFT_DELETE_SCRIPT'; payload: { id: string } }
  | { type: 'APPLY_DELETE_SCRIPT'; payload: { id: string } }
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
  // Node Parameters (局部变量 CRUD)
  | { type: 'ADD_NODE_PARAM'; payload: { nodeId: string; variable: VariableDefinition } }
  | { type: 'UPDATE_NODE_PARAM'; payload: { nodeId: string; varId: string; data: Partial<VariableDefinition> } }
  | { type: 'DELETE_NODE_PARAM'; payload: { nodeId: string; varId: string } }
  // Multi-Select (框选)
  | { type: 'SET_MULTI_SELECT_STATES'; payload: string[] }
  // Navigation (P2-T02)
  | { type: 'SWITCH_VIEW'; payload: 'EDITOR' | 'BLACKBOARD' }
  | { type: 'NAVIGATE_TO'; payload: { stageId?: string | null; nodeId?: string | null; graphId?: string | null } }
  | { type: 'NAVIGATE_BACK' }
  | { type: 'SET_READ_ONLY'; payload: boolean }
  | { type: 'SET_BLACKBOARD_VIEW'; payload: { activeTab?: 'Variables' | 'Scripts' | 'Events' | 'Graphs'; filter?: string; expandedSections?: Record<string, boolean>; stateFilter?: 'ALL' | 'Draft' | 'Implemented' | 'MarkedForDelete'; varTypeFilter?: 'ALL' | 'boolean' | 'integer' | 'float' | 'string' } }
  | { type: 'SET_STAGE_EXPANDED'; payload: { id: string; expanded: boolean } }
  | { type: 'ADD_MESSAGE'; payload: UiMessage }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_PANEL_SIZES'; payload: Partial<{ explorerWidth: number; inspectorWidth: number; stagesHeight: number }> };
