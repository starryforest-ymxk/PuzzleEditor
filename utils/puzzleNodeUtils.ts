/**
 * utils/puzzleNodeUtils.ts
 * PuzzleNode 操作工具函数
 * 提供 Node 和 StateMachine 的创建、ID生成等核心功能
 */

import { PuzzleNodeId, StateMachineId, StageId, StateId } from '../types/common';
import { PuzzleNode } from '../types/puzzleNode';
import { StateMachine, State } from '../types/stateMachine';

// ========== ID 生成计数器 ==========
let nodeCounter = 0;
let fsmCounter = 0;
let stateCounter = 0;

/**
 * 生成唯一的 PuzzleNode ID
 * 格式: node-{计数器}
 */
export function generateNodeId(): PuzzleNodeId {
    nodeCounter += 1;
    return `node-${nodeCounter}` as PuzzleNodeId;
}

/**
 * 生成唯一的 StateMachine ID
 * 格式: fsm-{计数器}
 */
export function generateFsmId(): StateMachineId {
    fsmCounter += 1;
    return `fsm-${fsmCounter}` as StateMachineId;
}

/**
 * 生成唯一的 State ID
 * 格式: state-{计数器}
 */
export function generateStateId(): StateId {
    stateCounter += 1;
    return `state-${stateCounter}` as StateId;
}

/**
 * 从 Node ID 中提取数字部分
 */
export function extractNodeIdNumber(nodeId: PuzzleNodeId): number {
    const match = nodeId.match(/node-(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * 从 FSM ID 中提取数字部分
 */
export function extractFsmIdNumber(fsmId: StateMachineId): number {
    const match = fsmId.match(/fsm-(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * 重置 Node ID 计数器（用于项目加载时）
 */
export function resetNodeCounter(maxId: number): void {
    nodeCounter = maxId;
}

/**
 * 重置 FSM ID 计数器（用于项目加载时）
 */
export function resetFsmCounter(maxId: number): void {
    fsmCounter = maxId;
}

/**
 * 重置 State ID 计数器（用于项目加载时）
 */
export function resetStateCounter(maxId: number): void {
    stateCounter = maxId;
}

/**
 * 创建默认的初始状态
 * @param fsmId 所属状态机 ID
 * @returns 新的 State 对象
 */
export function createDefaultInitialState(fsmId: StateMachineId): State {
    const id = generateStateId();
    return {
        id,
        name: 'Initial State',
        description: 'The initial state of this puzzle node',
        position: { x: 200, y: 150 },
        eventListeners: []
    };
}

/**
 * 创建默认的空状态机
 * @param nodeId 所属 PuzzleNode ID
 * @param initialState 可选的初始状态，如不提供则自动创建
 * @returns 新的 StateMachine 对象
 */
export function createDefaultStateMachine(nodeId: PuzzleNodeId, initialState?: State): StateMachine {
    const fsmId = generateFsmId();
    const state = initialState || createDefaultInitialState(fsmId);

    // StateMachine 结构不包含 name/description/nodeId，这些信息在 PuzzleNode 中跟踪
    return {
        id: fsmId,
        initialStateId: state.id,
        states: {
            [state.id]: state
        },
        transitions: {}
    };
}

/**
 * 创建默认的 PuzzleNode
 * @param stageId 所属 Stage ID
 * @param stateMachineId 关联的状态机 ID
 * @param name 可选的名称，默认为 "New Node"
 * @param displayOrder 可选的显示顺序
 * @returns 新的 PuzzleNode 对象
 */
export function createDefaultPuzzleNode(
    stageId: StageId,
    stateMachineId: StateMachineId,
    name?: string,
    displayOrder?: number
): PuzzleNode {
    const id = generateNodeId();
    return {
        id,
        name: name || 'New Node',
        description: '',
        stageId,
        stateMachineId,
        localVariables: {},
        eventListeners: [],
        displayOrder: displayOrder ?? 0
    };
}

/**
 * 创建一对 PuzzleNode 和 StateMachine
 * 便捷函数，同时创建关联的 Node 和 FSM
 * @param stageId 所属 Stage ID
 * @param name 可选的名称
 * @param displayOrder 可选的显示顺序
 * @returns 包含 node 和 stateMachine 的对象
 */
export function createNodeWithStateMachine(
    stageId: StageId,
    name?: string,
    displayOrder?: number
): { node: PuzzleNode; stateMachine: StateMachine } {
    // 先创建 Node ID 以便 FSM 引用
    const nodeId = generateNodeId();

    // 创建 FSM（StateMachine 不包含 name/description/nodeId）
    const fsmId = generateFsmId();
    const initialState = createDefaultInitialState(fsmId);
    const stateMachine: StateMachine = {
        id: fsmId,
        initialStateId: initialState.id,
        states: {
            [initialState.id]: initialState
        },
        transitions: {}
    };

    // 创建 Node（不使用 generateNodeId，直接使用已生成的 ID）
    const node: PuzzleNode = {
        id: nodeId,
        name: name || 'New Node',
        description: '',
        stageId,
        stateMachineId: fsmId,
        localVariables: {},
        eventListeners: [],
        displayOrder: displayOrder ?? 0
    };

    return { node, stateMachine };
}

/**
 * 获取指定 Stage 下节点的最大 displayOrder
 * @param nodes 所有节点映射表
 * @param stageId 目标 Stage ID
 * @returns 最大的 displayOrder 值，如无节点则返回 -1
 */
export function getMaxDisplayOrder(
    nodes: Record<PuzzleNodeId, PuzzleNode>,
    stageId: StageId
): number {
    let maxOrder = -1;
    Object.values(nodes).forEach(node => {
        if (node.stageId === stageId && (node.displayOrder ?? 0) > maxOrder) {
            maxOrder = node.displayOrder ?? 0;
        }
    });
    return maxOrder;
}

/**
 * 检查 PuzzleNode 的 FSM 中是否有内容
 * 用于删除前确认弹窗的判断逻辑
 * @param stateMachines 所有状态机映射表
 * @param node 目标 PuzzleNode
 * @returns 包含状态数和转移数的统计信息
 */
export function hasPuzzleNodeContent(
    stateMachines: Record<StateMachineId, StateMachine>,
    node: PuzzleNode
): {
    hasContent: boolean;
    stateCount: number;
    transitionCount: number;
} {
    const fsm = node.stateMachineId ? stateMachines[node.stateMachineId] : null;

    if (!fsm) {
        return {
            hasContent: false,
            stateCount: 0,
            transitionCount: 0
        };
    }

    const stateCount = Object.keys(fsm.states || {}).length;
    const transitionCount = Object.keys(fsm.transitions || {}).length;

    // 当状态数超过1个（初始状态默认存在）或有任何转移时，认为有内容
    return {
        hasContent: stateCount > 1 || transitionCount > 0,
        stateCount,
        transitionCount
    };
}
