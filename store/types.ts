/**
 * store/types.ts
 * Redux-like Store 类型定义
 */

import type { ValidationResult } from '../types/validation';
import type { RequiredCapability } from '../contracts/automation/permissions';
import { StageTreeData } from '../types/stage';
import { PuzzleNode } from '../types/puzzleNode';
import { ScriptsManifest, ScriptDefinition } from '../types/manifest';
import { StateMachine, State, Transition } from '../types/stateMachine';
import { PresentationGraph, PresentationNode } from '../types/presentation';
import { VariableDefinition, BlackboardData } from '../types/blackboard';
import {
  PuzzleNodeId,
  StateMachineId,
  PresentationGraphId,
  StateId,
  Side
} from '../types/common';
import { ProjectMeta, EditorUIState } from '../types/project';
import { EditorSettings, DEFAULT_SETTINGS, TranslationSettings, AutoSaveSettings } from '../types/settings';

// ========== Undo/Redo 快照数据 ==========
export interface ProjectContent {
  stageTree: StageTreeData;
  nodes: Record<PuzzleNodeId, PuzzleNode>;
  stateMachines: Record<StateMachineId, StateMachine>;
  presentationGraphs: Record<PresentationGraphId, PresentationGraph>;
  blackboard: BlackboardData;
  meta: ProjectMeta;
  scripts: ScriptsManifest;
}

/** 版本只在当前编辑会话内使用，不进入项目文件或运行时导出。 */
export interface DocumentState {
  sessionId: number;
  revision: number;
  nextRevision: number;
  savedRevision: number | null;
  /** 未取得覆盖许可的 Agent 修订随内容历史恢复，不写入工程文件。 */
  restrictedRevisions?: number[];
}

export interface HistorySnapshot {
  content: ProjectContent;
  revision: number;
  restrictedRevisions?: number[];
}

/** 操作身份跟随 past/future 移动；仅在当前会话内使用，不进入工程文件。 */
export interface HistoryOperation {
  entryId: string;
  source: 'human' | 'agent' | 'system';
  summary: string;
  requiredCapabilities: RequiredCapability[];
}
export interface HistoryEntry extends HistorySnapshot {
  operation: HistoryOperation;
}

/** 保存前捕获身份，异步完成时只确认实际写入的那一版。 */
export interface SaveAcknowledgement {
  sessionId: number;
  revision: number;
  path: string | null;
  previousPath?: string | null;
  savedAt: string;
}

export interface ProjectOperation {
  phase: 'idle' | 'preparing' | 'confirming' | 'saving' | 'committing';
  nextAction?: string;
  message?: string;
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
  document: DocumentState;
  project: {
    isLoaded: boolean;
    meta: ProjectMeta;
    stageTree: StageTreeData;
    nodes: Record<PuzzleNodeId, PuzzleNode>;
    stateMachines: Record<StateMachineId, StateMachine>;
    presentationGraphs: Record<PresentationGraphId, PresentationGraph>;
    blackboard: BlackboardData;
    scripts: ScriptsManifest;
  };
  // 运行时状态（Electron 相关）
  runtime: {
    projectOperation: ProjectOperation;
    currentProjectPath: string | null;  // 当前项目文件路径
    isNewUnsavedProject: boolean;       // 是否为新建未保存项目
    preferencesLoaded: boolean;         // 偏好设置是否已加载
  };
  // 历史记录（Undo/Redo）
  history: {
    past: HistoryEntry[];
    future: HistoryEntry[];
  };
  // 全局可用脚本（UI 展示）
  manifest: {
    scripts: ScriptDefinition[];
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
    multiSelectPresentationNodeIds: string[]; // 框选的演出节点ID列表
    // Panel sizes for resizable borders (in pixels)
    panelSizes: {
      explorerWidth: number;   // Left sidebar width
      inspectorWidth: number;  // Right sidebar width
      stagesHeight: number;    // Stages section height percentage (0-100)
    };
    // 脏状态：标记是否有未保存的更改
    isDirty: boolean;
    validationResults: ValidationResult[];
    showValidationPanel: boolean;
    confirmDialog: {
      isOpen: boolean;
      title: string;
      message: string;
      confirmAction: Action;
      danger?: boolean;
      references?: string[];
    };
  };
  // 编辑器设置（用户偏好，不导出到项目文件）
  settings: EditorSettings;
}

// ========== 初始状态 ==========
export const INITIAL_STATE: EditorState = {
  document: { sessionId: 0, revision: 0, nextRevision: 1, savedRevision: 0 },
  project: {
    isLoaded: false,
    meta: { id: '', name: '', version: '', createdAt: '', updatedAt: '', description: '' },
    stageTree: { rootId: '', stages: {} },
    nodes: {},
    stateMachines: {},
    presentationGraphs: {},
    blackboard: { globalVariables: {}, events: {} },
    scripts: { version: '', scripts: {} }
  },
  runtime: {
    projectOperation: { phase: 'idle' },
    currentProjectPath: null,
    isNewUnsavedProject: false,
    preferencesLoaded: false
  },
  history: {
    past: [],
    future: []
  },
  manifest: {
    scripts: [],
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
    multiSelectPresentationNodeIds: [],
    panelSizes: {
      explorerWidth: 280,
      inspectorWidth: 320,
      stagesHeight: 55
    },
    isDirty: false,
    validationResults: [],
    showValidationPanel: false,
    confirmDialog: {
      isOpen: false,
      title: '',
      message: '',
      confirmAction: { type: 'SET_CONFIRM_DIALOG', payload: { isOpen: false } },
      danger: false
    }
  },
  settings: DEFAULT_SETTINGS
};

// ========== Action 类型定义 ==========
export type Action =
  | { type: 'COMMIT_AUTOMATION'; payload: ProjectContent; validationResults: ValidationResult[]; restrictAutoSave: boolean; history?: Pick<HistoryOperation, 'summary' | 'requiredCapabilities'> }
  | { type: 'RESTORE_AUTOMATION_HISTORY'; direction: 'UNDO' | 'REDO'; entryId: string; restrictAutoSave: boolean; validationResults: ValidationResult[] }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'INIT_START' }
  | { type: 'INIT_SUCCESS'; payload: ProjectContent; saved?: boolean; path?: string | null; editorState?: EditorUIState; validationResults?: ValidationResult[] }
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
  // Blackboard Reorder (拖拽排序)
  | { type: 'REORDER_GLOBAL_VARIABLES'; payload: { orderedIds: string[] } }
  | { type: 'REORDER_EVENTS'; payload: { orderedIds: string[] } }
  | { type: 'REORDER_SCRIPTS'; payload: { category: string; lifecycleType?: string; orderedIds: string[] } }
  | { type: 'REORDER_LOCAL_VARIABLES'; payload: { scopeType: 'Stage' | 'Node'; scopeId: string; orderedIds: string[] } }
  | { type: 'REORDER_FSMS'; payload: { orderedIds: string[] } }
  | { type: 'REORDER_PRESENTATION_GRAPHS'; payload: { orderedIds: string[] } }
  | { type: 'SOFT_DELETE_STAGE_VARIABLE'; payload: { stageId: string; varId: string } }
  | { type: 'APPLY_DELETE_STAGE_VARIABLE'; payload: { stageId: string; varId: string } }
  // Stage CRUD (P4-T02)
  | { type: 'ADD_STAGE'; payload: { parentId: string; afterStageId?: string; stage: import('../types/stage').StageNode } }
  | { type: 'DELETE_STAGE'; payload: { stageId: string } }
  | { type: 'UPDATE_STAGE'; payload: { stageId: string; data: Partial<import('../types/stage').StageNode> } }
  | { type: 'REORDER_STAGE'; payload: { stageId: string; newIndex: number } }
  | { type: 'MOVE_STAGE'; payload: { stageId: string; newParentId: string; insertIndex?: number } }
  // Stage Local Variable CRUD (P4-T02)
  | { type: 'ADD_STAGE_VARIABLE'; payload: { stageId: string; variable: VariableDefinition } }
  | { type: 'UPDATE_STAGE_VARIABLE'; payload: { stageId: string; varId: string; data: Partial<VariableDefinition> } }
  | { type: 'DELETE_STAGE_VARIABLE'; payload: { stageId: string; varId: string } }
  // PuzzleNode CRUD (P4-T03)
  | { type: 'ADD_PUZZLE_NODE'; payload: { stageId: string; node: PuzzleNode; stateMachine: StateMachine } }
  | { type: 'DELETE_PUZZLE_NODE'; payload: { nodeId: string } }
  | { type: 'REORDER_PUZZLE_NODES'; payload: { stageId: string; nodeIds: string[] } }
  | { type: 'ADD_STATE'; payload: { fsmId: string; state: State } }
  | { type: 'DELETE_STATE'; payload: { fsmId: string; stateId: string } }
  | { type: 'UPDATE_STATE'; payload: { fsmId: string; stateId: string; data: Partial<State> } }
  | { type: 'UPDATE_FSM'; payload: { fsmId: string; data: Partial<StateMachine> } }
  | { type: 'ADD_TRANSITION'; payload: { fsmId: string; transition: Transition } }
  | { type: 'DELETE_TRANSITION'; payload: { fsmId: string; transitionId: string } }
  | { type: 'UPDATE_TRANSITION'; payload: { fsmId: string; transitionId: string; data: Partial<Transition> } }
  // Presentation Graph CRUD
  | { type: 'ADD_PRESENTATION_GRAPH'; payload: { graph: PresentationGraph } }
  | { type: 'UPDATE_PRESENTATION_GRAPH'; payload: { graphId: string; data: Partial<PresentationGraph> } }
  | { type: 'DELETE_PRESENTATION_GRAPH'; payload: { graphId: string } }
  | { type: 'ADD_PRESENTATION_NODE'; payload: { graphId: string; node: PresentationNode } }
  | { type: 'DELETE_PRESENTATION_NODE'; payload: { graphId: string; nodeId: string } }
  | { type: 'UPDATE_PRESENTATION_NODE'; payload: { graphId: string; nodeId: string; data: Partial<PresentationNode> } }
  | { type: 'LINK_PRESENTATION_NODES'; payload: { graphId: string; fromNodeId: string; toNodeId: string; fromSide?: Side; toSide?: Side } }
  | { type: 'UNLINK_PRESENTATION_NODES'; payload: { graphId: string; fromNodeId: string; toNodeId: string } }
  | { type: 'UPDATE_EDGE_PROPERTIES'; payload: { graphId: string; fromNodeId: string; toNodeId: string; fromSide?: Side; toSide?: Side } }
  // Node Parameters (局部变量 CRUD)
  | { type: 'ADD_NODE_PARAM'; payload: { nodeId: string; variable: VariableDefinition } }
  | { type: 'UPDATE_NODE_PARAM'; payload: { nodeId: string; varId: string; data: Partial<VariableDefinition> } }
  | { type: 'DELETE_NODE_PARAM'; payload: { nodeId: string; varId: string } }
  // Multi-Select (框选)
  | { type: 'SET_MULTI_SELECT_STATES'; payload: string[] }
  | { type: 'SET_MULTI_SELECT_PRESENTATION_NODES'; payload: string[] }
  // Navigation (P2-T02)
  | { type: 'SWITCH_VIEW'; payload: 'EDITOR' | 'BLACKBOARD' }
  | { type: 'NAVIGATE_TO'; payload: { stageId?: string | null; nodeId?: string | null; graphId?: string | null; selection?: Selection } }
  | { type: 'NAVIGATE_BACK' }
  | { type: 'SET_READ_ONLY'; payload: boolean }
  | { type: 'SET_BLACKBOARD_VIEW'; payload: { activeTab?: 'Variables' | 'Scripts' | 'Events' | 'Graphs'; filter?: string; expandedSections?: Record<string, boolean>; stateFilter?: 'ALL' | 'Draft' | 'Implemented' | 'MarkedForDelete'; varTypeFilter?: 'ALL' | 'boolean' | 'integer' | 'float' | 'string' } }
  | { type: 'SET_STAGE_EXPANDED'; payload: { id: string; expanded: boolean } }
  | { type: 'ADD_MESSAGE'; payload: UiMessage }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_PANEL_SIZES'; payload: Partial<{ explorerWidth: number; inspectorWidth: number; stagesHeight: number }> }
  // Project Meta Actions (P4-T06)
  | { type: 'UPDATE_PROJECT_META'; payload: Partial<ProjectMeta> }
  | { type: 'SYNC_RESOURCE_STATES'; payload: import('../types/project').ProjectData; sessionId: number }
  | { type: 'RESET_PROJECT' }
  | { type: 'PROJECT_SAVE_SUCCEEDED'; payload: SaveAcknowledgement }
  | { type: 'SET_VALIDATION_RESULTS'; payload: ValidationResult[] }
  | { type: 'SET_SHOW_VALIDATION_PANEL'; payload: boolean }
  // Runtime Actions (P4-T06 Electron)
  | { type: 'SET_PROJECT_PATH'; payload: string | null }
  | { type: 'SET_PROJECT_OPERATION'; payload: ProjectOperation }
  | { type: 'SET_NEW_UNSAVED_PROJECT'; payload: boolean }
  | { type: 'SET_PREFERENCES_LOADED'; payload: boolean }
  // Settings Actions (Translation)
  | { type: 'UPDATE_TRANSLATION_SETTINGS'; payload: Partial<TranslationSettings> }
  | { type: 'UPDATE_AUTO_SAVE_SETTINGS'; payload: Partial<AutoSaveSettings> }
  | { type: 'UPDATE_MESSAGE_FILTERS'; payload: Partial<import('../types/settings').MessageFilters> }
  | { type: 'SET_CONFIRM_DIALOG'; payload: { isOpen: boolean; title?: string; message?: string; confirmAction?: Action; danger?: boolean; references?: string[] } };
