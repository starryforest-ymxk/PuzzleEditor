/**
 * types/project.ts
 * 项目层项目结构定义 - 完整的工程数据模型
 * 
 * 文件格式说明：
 * - ProjectFile (.puzzle.json): 完整编辑状态，包含 UI 偏好、视口状态等
 * - ExportBundle (.json): 精简运行时数据，供游戏引擎加载
 */

import {
  ProjectId,
  PuzzleNodeId,
  StateMachineId,
  PresentationGraphId
} from './common';
import { BlackboardData } from './blackboard';
import { ScriptsManifest, TriggersManifest } from './manifest';
import { StageTreeData } from './stage';
import { PuzzleNode } from './puzzleNode';
import { StateMachine } from './stateMachine';
import { PresentationGraph } from './presentation';

// ========== 项目元数据 ==========
/**
 * 项目基本信息
 */
export interface ProjectMeta {
  id: ProjectId;
  name: string;
  description?: string;
  version: string;          // 数据版本号
  createdAt: string;        // ISO8601 格式
  updatedAt: string;        // ISO8601 格式
  exportFileName?: string;  // 自定义导出文件名 (默认: <项目名>.export.json)
  exportPath?: string;      // 项目导出目录路径 (默认: 使用 Preference 中的目录)
}

// ========== 完整项目数据（业务数据） ==========
/**
 * 项目核心业务数据
 * 这是整个工程的业务数据部分
 */
export interface ProjectData {
  // 元数据
  meta: ProjectMeta;

  // 黑板资源（全局变量与事件）
  blackboard: BlackboardData;

  // 脚本清单（黑板脚本定义）
  scripts: ScriptsManifest;

  // 触发器清单
  triggers: TriggersManifest;

  // 阶段树
  stageTree: StageTreeData;

  // 解谜节点（扁平化存储）
  nodes: Record<PuzzleNodeId, PuzzleNode>;

  // 状态机（扁平化存储）
  stateMachines: Record<StateMachineId, StateMachine>;

  // 演出子图（扁平化存储）
  presentationGraphs: Record<PresentationGraphId, PresentationGraph>;
}

// ========== 编辑器 UI 状态（项目文件专用） ==========
/**
 * 编辑器 UI 偏好设置
 * 保存时记录，加载时恢复完整编辑环境
 */
export interface EditorUIState {
  // 面板尺寸
  panelSizes: {
    explorerWidth: number;
    inspectorWidth: number;
    stagesHeight: number;
  };
  // 阶段树展开状态
  stageExpanded: Record<string, boolean>;
  // 当前导航位置
  currentStageId: string | null;
  currentNodeId: string | null;
  currentGraphId: string | null;
  // 当前视图
  view: 'EDITOR' | 'BLACKBOARD';
}

// ========== 项目文件格式 (.puzzle.json) ==========
/**
 * 完整项目文件 - 用于保存/打开
 * 包含完整编辑状态，可恢复编辑环境
 */
export interface ProjectFile {
  /** 文件格式标识 */
  fileType: 'puzzle-project';
  /** 编辑器版本 */
  editorVersion: string;
  /** 保存时间 */
  savedAt: string;
  /** 核心业务数据 */
  project: ProjectData;
  /** 编辑器 UI 状态 */
  editorState?: EditorUIState;
}

// ========== 导出文件格式 (.json) ==========
/**
 * 精简导出数据 - 用于游戏引擎加载
 * 仅包含运行时必需的业务数据
 */
export interface ExportBundle {
  /** 文件格式标识 */
  fileType: 'puzzle-export';
  /** 数据版本号 */
  manifestVersion: string;
  /** 导出时间 */
  exportedAt: string;
  /** 项目名称 */
  projectName: string;
  /** 项目版本 */
  projectVersion: string;
  /** 运行时数据 */
  data: {
    blackboard: BlackboardData;
    scripts: ScriptsManifest;
    triggers: TriggersManifest;
    stageTree: StageTreeData;
    nodes: Record<PuzzleNodeId, PuzzleNode>;
    stateMachines: Record<StateMachineId, StateMachine>;
    presentationGraphs: Record<PresentationGraphId, PresentationGraph>;
  };
}

// ========== 兼容旧版导出格式 ==========
/**
 * @deprecated 旧版导出格式，保留用于兼容性
 */
export interface ExportManifest {
  manifestVersion: '1.0.0';
  exportedAt: string;
  project: ProjectData;
}

