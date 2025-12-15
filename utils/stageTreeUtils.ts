/**
 * utils/stageTreeUtils.ts
 * Stage 树操作工具函数
 * 提供 Stage 的创建、查询和关系计算等核心功能
 */

import { StageId, PuzzleNodeId, VariableId } from '../types/common';
import { StageNode, StageTreeData } from '../types/stage';
import { PuzzleNode } from '../types/puzzleNode';
import { VariableDefinition } from '../types/blackboard';

// 用于生成 Stage ID 的计数器
let stageCounter = 0;

/**
 * 生成唯一的 Stage ID
 * 格式: stage-{计数器}
 */
export function generateStageId(): StageId {
    stageCounter += 1;
    return `stage-${stageCounter}` as StageId;
}

/**
 * 重置 Stage ID 计数器（用于测试或项目加载时）
 * @param maxId 当前项目中最大的 Stage ID 数字部分
 */
export function resetStageCounter(maxId: number): void {
    stageCounter = maxId;
}

/**
 * 从 Stage ID 中提取数字部分
 */
export function extractStageIdNumber(stageId: StageId): number {
    const match = stageId.match(/stage-(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
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
 * @param name 可选的名称，默认为 "New Stage"
 * @returns 新创建的 StageNode 对象
 */
export function createDefaultStage(parentId: StageId | null, name?: string): StageNode {
    const id = generateStageId();
    return {
        id,
        name: name || 'New Stage',
        description: '',
        parentId,
        childrenIds: [],
        isInitial: false,
        localVariables: {},
        eventListeners: [],
        isExpanded: false
    };
}

/**
 * 生成唯一的 Stage 局部变量 ID
 * @param existingVarIds 已存在的变量 ID 列表
 * @returns 新的唯一变量 ID
 */
export function generateStageVariableId(existingVarIds: VariableId[]): VariableId {
    // 找出最大的变量编号
    let maxNum = 0;
    existingVarIds.forEach(id => {
        const match = id.match(/stagevar-(\d+)/);
        if (match) {
            maxNum = Math.max(maxNum, parseInt(match[1], 10));
        }
    });
    return `stagevar-${maxNum + 1}` as VariableId;
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
