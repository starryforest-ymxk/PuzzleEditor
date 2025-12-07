/**
 * Mock API 服务实现
 * 用于前端独立开发，提供模拟的项目数据和 Manifest
 */

import { IApiService, ProjectData, ManifestData } from './types';
import {
    MOCK_STAGES,
    MOCK_NODES,
    MOCK_SCRIPTS,
    MOCK_TRIGGERS,
    MOCK_STATE_MACHINES,
    MOCK_PRESENTATION_GRAPHS
} from './mockData';

// ========== 模拟延迟配置 ==========
const MOCK_LATENCY = {
    /** 项目加载延迟 (ms) */
    PROJECT_LOAD: 800,
    /** Manifest 加载延迟 (ms) */
    MANIFEST_LOAD: 500,
    /** 保存操作延迟 (ms) */
    SAVE: 300
};

/**
 * Mock API 服务
 * 实现 IApiService 接口，使用本地 Mock 数据
 */
export class MockApiService implements IApiService {
    async loadProject(): Promise<ProjectData> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    meta: {
                        name: "Demo Puzzle Project",
                        version: "0.0.1"
                    },
                    // 使用深拷贝避免污染原始 Mock 数据
                    stages: JSON.parse(JSON.stringify(MOCK_STAGES)),
                    nodes: JSON.parse(JSON.stringify(MOCK_NODES)),
                    stateMachines: JSON.parse(JSON.stringify(MOCK_STATE_MACHINES)),
                    presentationGraphs: JSON.parse(JSON.stringify(MOCK_PRESENTATION_GRAPHS)),
                    rootStageId: 'stage-root'
                });
            }, MOCK_LATENCY.PROJECT_LOAD);
        });
    }

    async loadManifest(): Promise<ManifestData> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    scripts: MOCK_SCRIPTS,
                    triggers: MOCK_TRIGGERS
                });
            }, MOCK_LATENCY.MANIFEST_LOAD);
        });
    }

    async saveProject(data: ProjectData): Promise<boolean> {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('[MockAPI] Project saved:', data);
                resolve(true);
            }, MOCK_LATENCY.SAVE);
        });
    }
}
