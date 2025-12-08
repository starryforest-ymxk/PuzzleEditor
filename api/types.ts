/**
 * API 服务接口定义
 * 定义数据访问层的抽象接口，实现与后端的解耦
 */

import {
    PuzzleNodeId,
    StateMachineId,
    PresentationGraphId
} from '../types/common';
import { StageTreeData } from '../types/stage';
import { PuzzleNode } from '../types/puzzleNode';
import { ScriptDefinition, TriggerDefinition } from '../types/manifest';
import { StateMachine } from '../types/stateMachine';
import { PresentationGraph } from '../types/presentation';

// ========== 数据类型定义 ==========

/** 项目数据结构 */
export interface ProjectData {
    meta: {
        name: string;
        version: string;
    };
    stageTree: StageTreeData;
    nodes: Record<PuzzleNodeId, PuzzleNode>;
    stateMachines: Record<StateMachineId, StateMachine>;
    presentationGraphs: Record<PresentationGraphId, PresentationGraph>;
}

/** Manifest 数据结构 */
export interface ManifestData {
    scripts: ScriptDefinition[];
    triggers: TriggerDefinition[];
}

// ========== API 服务接口定义 ==========

/**
 * API 服务抽象接口
 * 所有 API 实现（Mock、HTTP、LocalStorage 等）都应该实现此接口
 */
export interface IApiService {
    /** 加载项目数据 */
    loadProject(): Promise<ProjectData>;

    /** 加载 Manifest 数据（脚本、触发器定义等） */
    loadManifest(): Promise<ManifestData>;

    /** 保存项目数据 */
    saveProject(data: ProjectData): Promise<boolean>;
}
