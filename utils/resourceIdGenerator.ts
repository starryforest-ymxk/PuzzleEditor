/**
 * utils/resourceIdGenerator.ts
 * 资源 ID 生成器 - 使用"资源类型_计数器"的命名规则
 * 
 * 职责：
 * - 为不同类型的资源生成唯一 ID
 * - ID 格式：{TYPE}_{COUNT}，如 VAR_1, EVENT_2, SCRIPT_3
 * - 计数器基于当前项目中已存在的同类型资源数量
 * 
 * 注意：
 * - ID 一旦生成不可修改
 * - 即使删除资源，计数器也不会重置（避免 ID 冲突）
 */

import type { ProjectData } from '../types/project';

// ========== 资源类型前缀定义 ==========
export type ResourceIdType = 'VAR' | 'EVENT' | 'SCRIPT' | 'GRAPH' | 'FSM' | 'STATE' | 'TRANSITION' | 'STAGE' | 'NODE' | 'PNODE';

const RESOURCE_TYPE_PREFIX: Record<ResourceIdType, string> = {
    VAR: 'VAR',
    EVENT: 'EVENT', 
    SCRIPT: 'SCRIPT',
    GRAPH: 'GRAPH',
    FSM: 'FSM',
    STATE: 'STATE',
    TRANSITION: 'TRANS',
    STAGE: 'STAGE',
    NODE: 'NODE',
    PNODE: 'PNODE',  // 演出图节点
};

// ========== ID 生成函数 ==========

/**
 * 从现有 ID 集合中提取最大计数值
 * @param existingIds 现有的 ID 集合
 * @param prefix 资源类型前缀
 * @returns 最大计数值，如无则返回 0
 */
const getMaxCount = (existingIds: string[], prefix: string): number => {
    let maxCount = 0;
    const pattern = new RegExp(`^${prefix}_(\\d+)$`);
    
    for (const id of existingIds) {
        const match = id.match(pattern);
        if (match) {
            const count = parseInt(match[1], 10);
            if (count > maxCount) {
                maxCount = count;
            }
        }
    }
    
    return maxCount;
};

/**
 * 生成新的资源 ID
 * @param type 资源类型
 * @param existingIds 现有同类型资源的 ID 集合
 * @returns 新的唯一 ID
 */
export const generateResourceId = (type: ResourceIdType, existingIds: string[]): string => {
    const prefix = RESOURCE_TYPE_PREFIX[type];
    const maxCount = getMaxCount(existingIds, prefix);
    return `${prefix}_${maxCount + 1}`;
};

// ========== 便捷函数：从项目中获取现有 ID 并生成新 ID ==========

/**
 * 为全局变量生成新 ID
 */
export const generateVariableId = (project: ProjectData): string => {
    const existingIds = Object.keys(project.blackboard?.globalVariables || {});
    return generateResourceId('VAR', existingIds);
};

/**
 * 为事件生成新 ID
 */
export const generateEventId = (project: ProjectData): string => {
    const existingIds = Object.keys(project.blackboard?.events || {});
    return generateResourceId('EVENT', existingIds);
};

/**
 * 为脚本生成新 ID
 */
export const generateScriptId = (project: ProjectData): string => {
    const existingIds = Object.keys(project.scripts?.scripts || {});
    return generateResourceId('SCRIPT', existingIds);
};

/**
 * 为演出图生成新 ID
 */
export const generateGraphId = (project: ProjectData): string => {
    const existingIds = Object.keys(project.presentationGraphs || {});
    return generateResourceId('GRAPH', existingIds);
};

/**
 * 为状态机生成新 ID
 */
export const generateFsmId = (project: ProjectData): string => {
    const existingIds = Object.keys(project.stateMachines || {});
    return generateResourceId('FSM', existingIds);
};

/**
 * 为 Stage 生成新 ID
 */
export const generateStageId = (project: ProjectData): string => {
    const existingIds = Object.keys(project.stageTree?.stages || {});
    return generateResourceId('STAGE', existingIds);
};

/**
 * 为 PuzzleNode 生成新 ID
 */
export const generateNodeId = (project: ProjectData): string => {
    const existingIds = Object.keys(project.nodes || {});
    return generateResourceId('NODE', existingIds);
};

/**
 * 为状态节点生成新 ID
 * @param existingStates 现有状态的 ID 集合
 */
export const generateStateId = (existingStates: string[]): string => {
    return generateResourceId('STATE', existingStates);
};

/**
 * 为转换连线生成新 ID
 * @param existingTransitions 现有转换的 ID 集合
 */
export const generateTransitionId = (existingTransitions: string[]): string => {
    return generateResourceId('TRANSITION', existingTransitions);
};
