/**
 * utils/stageTreeUtils.ts
 * Stage 树操作工具函数
 * 提供 Stage 的创建、查询和关系计算等核心功能
 * 
 * 更新：统一使用 resourceIdGenerator 生成 ID，格式为 {TYPE}_{COUNT}
 */

import { StageId, PuzzleNodeId, VariableId } from '../types/common';
import { StageNode, StageTreeData } from '../types/stage';
import { PuzzleNode } from '../types/puzzleNode';
import { VariableDefinition } from '../types/blackboard';
import { generateResourceId, generateStageVariableId as genStageVarId } from './resourceIdGenerator';

/**
 * 生成唯一的 Stage ID
 * 格式: STAGE_{COUNT}
 * @param existingStageIds 已存在的 Stage ID 列表
 */
export function generateStageId(existingStageIds: string[]): StageId {
    return generateResourceId('STAGE', existingStageIds) as StageId;
}

/**
 * 从 Stage ID 中提取数字部分
 * 支持新格式 STAGE_{NUM} 和旧格式 stage-{NUM}
 */
export function extractStageIdNumber(stageId: StageId): number {
    // 新格式: STAGE_1, STAGE_2, ...
    const newMatch = stageId.match(/STAGE_(\d+)/);
    if (newMatch) return parseInt(newMatch[1], 10);
    // 旧格式: stage-1, stage-2, ...
    const oldMatch = stageId.match(/stage-(\d+)/);
    return oldMatch ? parseInt(oldMatch[1], 10) : 0;
}

/**
 * 获取 Stage 的所有后代 Stage ID（递归）
 * @param stageTree Stage 树数据
 * @param stageId 目标 Stage ID
 * @returns 所有后代 Stage ID 数组
 */
export function getDescendantStageIds(stageTree: StageTreeData, stageId: StageId): StageId[] {
    const stage = stageTree.stages[stageId];
    if (!stage) return [];

    const descendants: StageId[] = [];
    const queue = [...stage.childrenIds];

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        descendants.push(currentId);
        const currentStage = stageTree.stages[currentId];
        if (currentStage && currentStage.childrenIds.length > 0) {
            queue.push(...currentStage.childrenIds);
        }
    }

    return descendants;
}

/**
 * 获取指定 Stage 下的所有 PuzzleNode ID
 * @param nodes 所有 PuzzleNode 的映射表
 * @param stageId 目标 Stage ID
 * @returns 该 Stage 下的 PuzzleNode ID 数组
 */
export function getStageNodeIds(
    nodes: Record<PuzzleNodeId, PuzzleNode>,
    stageId: StageId
): PuzzleNodeId[] {
    return Object.values(nodes)
        .filter(node => node.stageId === stageId)
        .map(node => node.id);
}

/**
 * 检查 Stage 是否有子内容（子 Stage 或 PuzzleNode）
 * @param stageTree Stage 树数据
 * @param nodes 所有 PuzzleNode 的映射表
 * @param stageId 目标 Stage ID
 * @returns 包含子内容统计信息的对象
 */
export function hasStageContent(
    stageTree: StageTreeData,
    nodes: Record<PuzzleNodeId, PuzzleNode>,
    stageId: StageId
): {
    hasChildren: boolean;
    childStageCount: number;
    nodeCount: number;
    totalDescendantStages: number;
    totalDescendantNodes: number;
} {
    const stage = stageTree.stages[stageId];
    if (!stage) {
        return {
            hasChildren: false,
            childStageCount: 0,
            nodeCount: 0,
            totalDescendantStages: 0,
            totalDescendantNodes: 0
        };
    }

    // 直接子 Stage 数量
    const childStageCount = stage.childrenIds.length;

    // 直接挂载的 PuzzleNode 数量
    const nodeCount = getStageNodeIds(nodes, stageId).length;

    // 所有后代 Stage
    const descendantStageIds = getDescendantStageIds(stageTree, stageId);
    const totalDescendantStages = descendantStageIds.length;

    // 所有后代节点（包括后代 Stage 下的节点）
    const allStageIds = [stageId, ...descendantStageIds];
    const totalDescendantNodes = allStageIds.reduce((count, sid) => {
        return count + getStageNodeIds(nodes, sid).length;
    }, 0);

    return {
        hasChildren: childStageCount > 0 || nodeCount > 0,
        childStageCount,
        nodeCount,
        totalDescendantStages,
        totalDescendantNodes
    };
}

/**
 * 创建默认的新 Stage
 * @param parentId 父 Stage ID
 * @param existingStageIds 已存在的 Stage ID 列表
 * @param name 可选的名称，默认为 "New Stage"
 * @returns 新创建的 StageNode 对象
 */
export function createDefaultStage(
    parentId: StageId | null,
    existingStageIds: string[],
    name?: string
): StageNode {
    const id = generateStageId(existingStageIds);
    return {
        id,
        name: name || 'New Stage',
        description: '',
        parentId,
        childrenIds: [],
        isInitial: false,
        unlockTriggers: [{ type: 'Always' }],
        localVariables: {},
        eventListeners: [],
        isExpanded: false
    };
}

/**
 * 生成唯一的 Stage 局部变量 ID
 * 格式: STAGEVAR_{COUNT}
 * @param existingVarIds 已存在的变量 ID 列表
 * @returns 新的唯一变量 ID
 */
export function generateStageVariableId(existingVarIds: VariableId[]): VariableId {
    return genStageVarId(existingVarIds as string[]) as VariableId;
}

/**
 * 创建默认的 Stage 局部变量
 * @param existingVarIds 已存在的变量 ID 列表
 * @returns 新的变量定义
 */
export function createDefaultStageVariable(existingVarIds: VariableId[]): VariableDefinition {
    const id = generateStageVariableId(existingVarIds);
    return {
        id,
        name: 'New Variable',
        description: '',
        type: 'boolean',
        value: false,
        defaultValue: false,
        state: 'Draft',
        scope: 'StageLocal'
    } as VariableDefinition;
}

/**
 * 检查是否可以将 Stage 移动到目标位置
 * 防止循环引用（不能将父节点移动到子节点下）
 * @param stageTree Stage 树数据
 * @param stageId 要移动的 Stage ID
 * @param newParentId 目标父 Stage ID
 * @returns 是否可以移动
 */
export function canMoveStage(
    stageTree: StageTreeData,
    stageId: StageId,
    newParentId: StageId
): boolean {
    // 不能移动到自身
    if (stageId === newParentId) return false;

    // 不能移动到自己的后代节点下
    const descendants = getDescendantStageIds(stageTree, stageId);
    if (descendants.includes(newParentId)) return false;

    return true;
}
