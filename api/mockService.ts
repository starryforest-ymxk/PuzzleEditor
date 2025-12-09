/**
 * Mock API 服务实现
 * 用于前端独立开发，提供模拟的项目数据和 Manifest
 */

import { IApiService, ManifestData } from './types';
import {
    MOCK_STAGES,
    MOCK_NODES,
    MOCK_SCRIPTS_MANIFEST,
    MOCK_TRIGGERS_MANIFEST,
    MOCK_STATE_MACHINES,
    MOCK_PRESENTATION_GRAPHS,
    MOCK_BLACKBOARD
} from './mockData';
import { ExportManifest } from '../types/project';

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
    async loadProject(): Promise<ExportManifest> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    manifestVersion: '1.0.0',
                    exportedAt: new Date().toISOString(),
                    project: {
                        meta: {
                            id: "proj-demo",
                            name: "Demo Puzzle Project",
                            description: "Demo data for puzzle editor",
                            version: "0.0.1",
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        },
                        // 使用深拷贝避免污染原始 Mock 数据
                        stageTree: JSON.parse(JSON.stringify(MOCK_STAGES)),
                        nodes: JSON.parse(JSON.stringify(MOCK_NODES)),
                        stateMachines: JSON.parse(JSON.stringify(MOCK_STATE_MACHINES)),
                        presentationGraphs: JSON.parse(JSON.stringify(MOCK_PRESENTATION_GRAPHS)),
                        blackboard: JSON.parse(JSON.stringify(MOCK_BLACKBOARD)),
                        scripts: JSON.parse(JSON.stringify(MOCK_SCRIPTS_MANIFEST)),
                        triggers: JSON.parse(JSON.stringify(MOCK_TRIGGERS_MANIFEST))
                    }
                });
            }, MOCK_LATENCY.PROJECT_LOAD);
        });
    }

    async loadManifest(): Promise<ManifestData> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    scripts: MOCK_SCRIPTS_MANIFEST,
                    triggers: MOCK_TRIGGERS_MANIFEST
                });
            }, MOCK_LATENCY.MANIFEST_LOAD);
        });
    }

    async saveProject(data: ExportManifest): Promise<boolean> {
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('[MockAPI] Project saved:', data);
                resolve(true);
            }, MOCK_LATENCY.SAVE);
        });
    }
}
