/**
 * utils/resourceIdGenerator.ts
 * 资源 ID 生成器 - 使用"资源类型_计数器"的命名规则
 * 
 * 职责：
 * - 为不同类型的资源生成唯一 ID
 * - ID 格式：{TYPE}_{COUNT}，如 VAR_1, EVENT_2, SCRIPT_PERF_3
 * - 计数器基于当前项目中已存在的同类型资源数量
 * 
 * 注意：
 * - ID 一旦生成不可修改
 * - 即使删除资源，计数器也不会重置（避免 ID 冲突）
 */

import type { ProjectData } from '../types/project';
import type { ScriptCategory } from '../types/common';

// ========== 资源类型前缀定义 ==========

// 基础资源类型
export type ResourceIdType =
    | 'VAR' | 'EVENT' | 'GRAPH' | 'FSM' | 'STATE' | 'TRANSITION' | 'STAGE' | 'NODE' | 'PNODE' | 'PROJECT'
    | 'STAGEVAR'     // Stage 局部变量
    | 'NODEVAR'      // Node 局部变量
    // 脚本类型（按分类区分）
    | 'SCRIPT_PERF'  // 演出脚本
    | 'SCRIPT_LIFE'  // 生命周期脚本
    | 'SCRIPT_COND'  // 条件脚本
    | 'SCRIPT_TRIG'; // 触发器脚本

const RESOURCE_TYPE_PREFIX: Record<ResourceIdType, string> = {
    VAR: 'VAR',
    EVENT: 'EVENT',
    GRAPH: 'GRAPH',
    FSM: 'FSM',
    STATE: 'STATE',
    TRANSITION: 'TRANS',
    STAGE: 'STAGE',
    NODE: 'NODE',
    PNODE: 'PNODE',
    PROJECT: 'PROJECT',
    STAGEVAR: 'STAGEVAR',
    NODEVAR: 'NODEVAR',       // Node 局部变量
    // 脚本类型前缀
    SCRIPT_PERF: 'SCRIPT_PERF',
    SCRIPT_LIFE: 'SCRIPT_LIFE',
    SCRIPT_COND: 'SCRIPT_COND',
    SCRIPT_TRIG: 'SCRIPT_TRIG',
};

// 脚本分类到 ID 类型的映射
const SCRIPT_CATEGORY_TO_TYPE: Record<ScriptCategory, ResourceIdType> = {
    Performance: 'SCRIPT_PERF',
    Lifecycle: 'SCRIPT_LIFE',
    Condition: 'SCRIPT_COND',
    Trigger: 'SCRIPT_TRIG',
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
 * 为脚本生成新 ID（按类型区分）
 * @param category 脚本分类
 * @param existingScriptIds 现有所有脚本的 ID 集合
 */
export const generateTypedScriptId = (category: ScriptCategory, existingScriptIds: string[]): string => {
    const type = SCRIPT_CATEGORY_TO_TYPE[category];
    return generateResourceId(type, existingScriptIds);
};

/**
 * 为脚本生成新 ID（便捷函数，从项目中获取现有 ID）
 * @param project 项目数据
 * @param category 脚本分类
 */
export const generateScriptId = (project: ProjectData, category: ScriptCategory): string => {
    const existingIds = Object.keys(project.scripts?.scripts || {});
    return generateTypedScriptId(category, existingIds);
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

/**
 * 为项目生成新 ID
 * @param existingProjects 现有项目的 ID 集合（通常在多项目模式使用）
 */
export const generateProjectId = (existingProjects: string[] = []): string => {
    return generateResourceId('PROJECT', existingProjects);
};

/**
 * 为 Stage 局部变量生成新 ID
 * @param existingVarIds 现有 Stage 局部变量的 ID 集合
 */
export const generateStageVariableId = (existingVarIds: string[]): string => {
    return generateResourceId('STAGEVAR', existingVarIds);
};

/**
 * 为 Node 局部变量生成新 ID
 * @param existingVarIds 现有 Node 局部变量的 ID 集合
 */
export const generateNodeVariableId = (existingVarIds: string[]): string => {
    return generateResourceId('NODEVAR', existingVarIds);
};
