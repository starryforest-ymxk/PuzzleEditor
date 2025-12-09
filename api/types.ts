/**
 * API 服务接口定义
 * 定义数据访问层的抽象接口，实现与后端的解耦
 */

import { ExportManifest } from '../types/project';
import { ScriptsManifest, TriggersManifest } from '../types/manifest';

// ========== 数据类型定义 ==========

/** Manifest 数据结构 */
export interface ManifestData {
    scripts: ScriptsManifest;
    triggers: TriggersManifest;
}

// ========== API 服务接口定义 ==========

/**
 * API 服务抽象接口
 * 所有 API 实现（Mock、HTTP、LocalStorage 等）都应该实现此接口
 */
export interface IApiService {
    /** 加载项目数据 */
    loadProject(): Promise<ExportManifest>;

    /** 加载 Manifest 数据（脚本、触发器定义等） */
    loadManifest(): Promise<ManifestData>;

    /** 保存项目数据 */
    saveProject(data: ExportManifest): Promise<boolean>;
}

// 便于外部引用导出类型
export type { ExportManifest };
