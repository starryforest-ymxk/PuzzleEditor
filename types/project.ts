/**
 * types/project.ts
 * 项目层项目结构定义 - 完整的工程数据模型
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
}

// ========== 完整项目数据 ==========
/**
 * 项目层项目数据结构
 * 这是整个工程的 JSON Manifest 顶层结构
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

// ========== 导出完整清单 ==========
/**
 * 导出时的 JSON 结构
 * 包含版本信息以便兼容性处理
 */
export interface ExportManifest {
  manifestVersion: '1.0.0';
  exportedAt: string;
  project: ProjectData;
}
