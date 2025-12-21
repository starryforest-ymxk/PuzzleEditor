/**
 * utils/puzzleNodeUtils.ts
 * PuzzleNode 操作工具函数
 * 提供 Node 和 StateMachine 的创建、ID生成等核心功能
 * 
 * 更新：统一使用扫描式 {TYPE}_{COUNT} 格式生成 ID
 * 所有 ID 生成基于扫描现有 ID，无需全局计数器
 */

import { PuzzleNodeId, StateMachineId, StageId, StateId } from '../types/common';
import { PuzzleNode } from '../types/puzzleNode';
import { StateMachine, State, Transition } from '../types/stateMachine';
import { generateResourceId } from './resourceIdGenerator';

// ========== 已有 ID 集合类型（用于工厂函数参数） ==========
export interface ExistingIds {
    nodeIds: string[];      // 现有 PuzzleNode ID
    fsmIds: string[];       // 现有 StateMachine ID  
    stateIds: string[];     // 现有 State ID（当前 FSM 内）
    transitionIds: string[]; // 现有 Transition ID（当前 FSM 内）
}

// ========== ID 生成函数（扫描式） ==========

/**
 * 生成唯一的 PuzzleNode ID
 * 格式: NODE_{COUNT}
 * @param existingNodeIds 现有 Node ID 列表
 */
export function generateNodeId(existingNodeIds: string[]): PuzzleNodeId {
    return generateResourceId('NODE', existingNodeIds) as PuzzleNodeId;
}

/**
 * 生成唯一的 StateMachine ID
 * 格式: FSM_{COUNT}
 * @param existingFsmIds 现有 FSM ID 列表
 */
export function generateFsmId(existingFsmIds: string[]): StateMachineId {
    return generateResourceId('FSM', existingFsmIds) as StateMachineId;
}

/**
 * 生成唯一的 State ID
 * 格式: STATE_{COUNT}
 * @param existingStateIds 现有 State ID 列表
 */
export function generateStateId(existingStateIds: string[]): StateId {
    return generateResourceId('STATE', existingStateIds) as StateId;
}

/**
 * 生成唯一的 Transition ID
 * 格式: TRANS_{COUNT}
 * @param existingTransitionIds 现有 Transition ID 列表
 */
export function generateTransitionId(existingTransitionIds: string[]): string {
    return generateResourceId('TRANSITION', existingTransitionIds);
}

// ========== ID 提取函数（支持新旧格式） ==========

/**
 * 从 Node ID 中提取数字部分
 * 支持新格式 NODE_{NUM} 和旧格式 node-{NUM}
 */
export function extractNodeIdNumber(nodeId: PuzzleNodeId): number {
    const newMatch = nodeId.match(/NODE_(\d+)/);
    if (newMatch) return parseInt(newMatch[1], 10);
    const oldMatch = nodeId.match(/node-(\d+)/);
    return oldMatch ? parseInt(oldMatch[1], 10) : 0;
}

/**
 * 从 FSM ID 中提取数字部分
 * 支持新格式 FSM_{NUM} 和旧格式 fsm-{NUM}
 */
export function extractFsmIdNumber(fsmId: StateMachineId): number {
    const newMatch = fsmId.match(/FSM_(\d+)/);
    if (newMatch) return parseInt(newMatch[1], 10);
    const oldMatch = fsmId.match(/fsm-(\d+)/);
    return oldMatch ? parseInt(oldMatch[1], 10) : 0;
}


// ========== 工厂函数 ==========

/**
 * 创建默认的初始状态
 * @param existingStateIds 现有的 State ID 列表
 * @returns 新的 State 对象
 */
export function createDefaultInitialState(existingStateIds: string[]): State {
    const id = generateStateId(existingStateIds);
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
 * @param existingIds 现有 ID 集合
 * @param initialState 可选的初始状态，如不提供则自动创建
 * @returns 新的 StateMachine 对象
 */
export function createDefaultStateMachine(
    existingIds: Pick<ExistingIds, 'fsmIds' | 'stateIds'>,
    initialState?: State
): StateMachine {
    const fsmId = generateFsmId(existingIds.fsmIds);
    const state = initialState || createDefaultInitialState(existingIds.stateIds);

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
 * @param existingNodeIds 现有 Node ID 列表
 * @param name 可选的名称，默认为 "New Node"
 * @param displayOrder 可选的显示顺序
 * @returns 新的 PuzzleNode 对象
 */
export function createDefaultPuzzleNode(
    stageId: StageId,
    stateMachineId: StateMachineId,
    existingNodeIds: string[],
    name?: string,
    displayOrder?: number
): PuzzleNode {
    const id = generateNodeId(existingNodeIds);
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
 * @param existingIds 现有 ID 集合
 * @param name 可选的名称
 * @param displayOrder 可选的显示顺序
 * @returns 包含 node 和 stateMachine 的对象
 */
export function createNodeWithStateMachine(
    stageId: StageId,
    existingIds: Pick<ExistingIds, 'nodeIds' | 'fsmIds' | 'stateIds'>,
    name?: string,
    displayOrder?: number,
    createInitialState: boolean = true
): { node: PuzzleNode; stateMachine: StateMachine } {
    // 生成 Node ID
    const nodeId = generateNodeId(existingIds.nodeIds);

    // 生成 FSM ID 和初始状态
    const fsmId = generateFsmId(existingIds.fsmIds);
    let initialState: State | null = null;

    if (createInitialState) {
        initialState = createDefaultInitialState(existingIds.stateIds);
    }

    const stateMachine: StateMachine = {
        id: fsmId,
        initialStateId: initialState ? initialState.id : null,
        states: initialState ? { [initialState.id]: initialState } : {},
        transitions: {}
    };

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
 * 创建一个带有 Trigger 逻辑的 PuzzleNode
 * 包含 "Not triggered" (初始) 和 "Triggered" 两个状态，以及一条连接
 * @param stageId 所属 Stage ID
 * @param existingIds 现有 ID 集合
 * @param name 可选的名称
 * @param displayOrder 可选的显示顺序
 */
export function createTriggerNodeWithStateMachine(
    stageId: StageId,
    existingIds: ExistingIds,
    name?: string,
    displayOrder?: number
): { node: PuzzleNode; stateMachine: StateMachine } {
    // 1. 生成 ID
    const nodeId = generateNodeId(existingIds.nodeIds);
    const fsmId = generateFsmId(existingIds.fsmIds);

    // 2. 创建状态 - 需要累加 existingStateIds
    const state1Id = generateStateId(existingIds.stateIds);
    const state1: State = {
        id: state1Id,
        name: 'Not triggered',
        description: 'Initial state: Waiting for trigger',
        position: { x: 200, y: 150 },
        eventListeners: []
    };

    // 第二个状态需要包含第一个状态的 ID
    const state2Id = generateStateId([...existingIds.stateIds, state1Id]);
    const state2: State = {
        id: state2Id,
        name: 'Triggered',
        description: 'State after being triggered',
        position: { x: 600, y: 150 },
        eventListeners: []
    };

    // 3. 创建连线
    const transitionId = generateTransitionId(existingIds.transitionIds);
    const transition: Transition = {
        id: transitionId,
        fromStateId: state1Id,
        toStateId: state2Id,
        priority: 0,
        name: 'Trigger',
        triggers: [{ type: 'Always' }],
        parameterModifiers: []
    };

    const stateMachine: StateMachine = {
        id: fsmId,
        initialStateId: state1Id,
        states: {
            [state1Id]: state1,
            [state2Id]: state2
        },
        transitions: {
            [transitionId]: transition
        }
    };

    const node: PuzzleNode = {
        id: nodeId,
        name: name || 'Trigger Node',
        description: '',
        stageId,
        stateMachineId: fsmId,
        localVariables: {},
        eventListeners: [],
        displayOrder: displayOrder ?? 0
    };

    return { node, stateMachine };
}

// ========== 查询工具函数 ==========

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

    return {
        hasContent: stateCount > 1 || transitionCount > 0,
        stateCount,
        transitionCount
    };
}

// ========== 便捷函数：从 project 构建 ExistingIds ==========

/**
 * 从项目数据构建 ExistingIds 对象
 * 方便调用方快速获取所有现有 ID
 */
export function buildExistingIds(
    nodes: Record<string, PuzzleNode>,
    stateMachines: Record<string, StateMachine>
): ExistingIds {
    // 收集所有 State 和 Transition ID
    let stateIds: string[] = [];
    let transitionIds: string[] = [];

    Object.values(stateMachines).forEach(fsm => {
        stateIds = stateIds.concat(Object.keys(fsm.states || {}));
        transitionIds = transitionIds.concat(Object.keys(fsm.transitions || {}));
    });

    return {
        nodeIds: Object.keys(nodes),
        fsmIds: Object.keys(stateMachines),
        stateIds,
        transitionIds
    };
}
