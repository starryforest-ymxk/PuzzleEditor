/**
 * utils/projectFactory.ts
 * 项目工厂函数 - 创建新的空白项目
 * 
 * P4-T06: 项目级操作与多工程支持
 */

import { ProjectData, ProjectMeta } from '../types/project';
import { StageTreeData, StageNode } from '../types/stage';
import { StageId } from '../types/common';

/**
 * 生成项目唯一 ID
 */
const generateProjectId = (): string => {
    return `project-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

/**
 * 生成 Stage 唯一 ID
 */
const generateStageId = (): StageId => {
    return `stage-${Date.now()}-${Math.random().toString(36).substring(2, 8)}` as StageId;
};

/**
 * 创建默认的根 Stage 节点
 */
const createRootStage = (id: StageId): StageNode => ({
    id,
    name: 'Root Stage',
    description: 'Project root stage',
    parentId: null,
    childrenIds: [],
    localVariables: {},
    eventListeners: [],
    isExpanded: true
});

/**
 * 创建空白项目数据
 * @param name 项目名称（必填）
 * @param description 项目描述（可选）
 * @returns 完整的 ProjectData 对象
 */
export function createEmptyProject(name: string, description?: string): ProjectData {
    const now = new Date().toISOString();
    const projectId = generateProjectId();
    const rootStageId = generateStageId();

    const meta: ProjectMeta = {
        id: projectId,
        name: name.trim() || 'New Project',
        description: description?.trim() || '',
        version: '1.0.0',
        createdAt: now,
        updatedAt: now
    };

    const rootStage = createRootStage(rootStageId);

    const stageTree: StageTreeData = {
        rootId: rootStageId,
        stages: {
            [rootStageId]: rootStage
        }
    };

    return {
        meta,
        blackboard: {
            globalVariables: {},
            events: {}
        },
        scripts: {
            version: '1.0.0',
            scripts: {}
        },
        triggers: {
            triggers: {}
        },
        stageTree,
        nodes: {},
        stateMachines: {},
        presentationGraphs: {}
    };
}

/**
 * 更新项目元信息的 updatedAt 时间戳
 */
export function updateProjectTimestamp(meta: ProjectMeta): ProjectMeta {
    return {
        ...meta,
        updatedAt: new Date().toISOString()
    };
}
