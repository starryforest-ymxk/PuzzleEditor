/**
 * utils/graphAdapter.ts
 * 图数据适配器 - 将不同图数据结构转换为统一的渲染格式
 * 
 * 主要功能：
 * 1. 演出图 nextIds 转换为虚拟边对象
 * 2. FSM Transition 转换为标准边格式
 * 3. 提供统一的图渲染数据接口
 */

import { PresentationNode, PresentationGraph } from '../types/presentation';
import { State, Transition, StateMachine } from '../types/stateMachine';
import { IGraphNode, IGraphEdge, VirtualEdge } from '../types/graphCore';
import { Side } from '../types/common';

// ========== 演出图适配器 ==========

/**
 * 将演出图的 nextIds 转换为虚拟边对象数组
 * 供 UI 渲染连线使用
 * 
 * @param graph 演出图（需要访问 edgeProperties）
 * @returns 虚拟边数组
 */
export function presentationNodesToEdges(
    nodes: Record<string, PresentationNode>,
    edgeProperties?: Record<string, { fromSide?: Side; toSide?: Side }>
): VirtualEdge[] {
    const edges: VirtualEdge[] = [];

    Object.values(nodes).forEach(node => {
        node.nextIds.forEach((targetId, index) => {
            // 确保目标节点存在
            if (nodes[targetId]) {
                // 边属性 key 格式：fromNodeId->toNodeId
                const edgeKey = `${node.id}->${targetId}`;
                const props = edgeProperties?.[edgeKey];

                edges.push({
                    id: `${node.id}->edge:${index}`,
                    fromNodeId: node.id,
                    toNodeId: targetId,
                    isVirtual: true,
                    sourceIndex: index,
                    // 从 edgeProperties 读取边的端点方向
                    fromSide: props?.fromSide,
                    toSide: props?.toSide
                });
            }
        });
    });

    return edges;
}

/**
 * 将虚拟边操作转换为 presentationSlice 的 action payload
 * 用于处理连线创建/删除时的数据转换
 */
export function virtualEdgeToLinkPayload(
    edge: VirtualEdge
): { fromNodeId: string; toNodeId: string } {
    return {
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId
    };
}

// ========== FSM 适配器 ==========

/**
 * 将 FSM Transition 转换为标准 IGraphEdge 格式
 * 用于通用组件渲染
 * 
 * @param transition FSM 转移对象
 * @returns 标准边格式
 */
export function transitionToGraphEdge(transition: Transition): IGraphEdge {
    return {
        id: transition.id,
        fromNodeId: transition.fromStateId,
        toNodeId: transition.toStateId,
        fromSide: transition.fromSide,
        toSide: transition.toSide
    };
}

/**
 * 将 FSM 所有 Transition 转换为标准边数组
 */
export function fsmTransitionsToEdges(
    transitions: Record<string, Transition>
): IGraphEdge[] {
    return Object.values(transitions).map(transitionToGraphEdge);
}

/**
 * 将 FSM State 转换为 IGraphNode 格式
 * State 本身已兼容 IGraphNode，此函数主要用于类型断言
 */
export function stateToGraphNode(state: State): IGraphNode {
    return {
        id: state.id,
        name: state.name,
        position: state.position,
        description: state.description
    };
}

/**
 * 将演出图节点转换为 IGraphNode 格式
 */
export function presentationNodeToGraphNode(node: PresentationNode): IGraphNode {
    return {
        id: node.id,
        name: node.name,
        position: node.position,
        description: node.description
    };
}

// ========== 通用渲染数据结构 ==========

/**
 * 统一的图渲染数据
 * 用于通用画布组件
 */
export interface UnifiedGraphData {
    nodes: IGraphNode[];
    edges: IGraphEdge[];
    startNodeId: string | null;
}

/**
 * 将演出图转换为统一渲染格式
 */
export function presentationGraphToUnified(
    graph: PresentationGraph
): UnifiedGraphData {
    return {
        nodes: Object.values(graph.nodes).map(presentationNodeToGraphNode),
        edges: presentationNodesToEdges(graph.nodes),
        startNodeId: graph.startNodeId
    };
}

/**
 * 将 FSM 转换为统一渲染格式
 */
export function fsmToUnified(fsm: StateMachine): UnifiedGraphData {
    return {
        nodes: Object.values(fsm.states).map(stateToGraphNode),
        edges: fsmTransitionsToEdges(fsm.transitions),
        startNodeId: fsm.initialStateId
    };
}

// ========== 边查找辅助函数 ==========

/**
 * 根据边 ID 查找原始 Transition（用于 FSM）
 */
export function findTransitionByEdgeId(
    transitions: Record<string, Transition>,
    edgeId: string
): Transition | undefined {
    return transitions[edgeId];
}

/**
 * 根据虚拟边 ID 解析出源节点和目标节点（用于演出图）
 * 虚拟边 ID 格式：`${fromNodeId}->edge:${index}`
 */
export function parseVirtualEdgeId(
    edgeId: string
): { fromNodeId: string; index: number } | null {
    const match = edgeId.match(/^(.+)->edge:(\d+)$/);
    if (!match) return null;
    return {
        fromNodeId: match[1],
        index: parseInt(match[2], 10)
    };
}

/**
 * 根据虚拟边 ID 和节点集合获取目标节点 ID
 */
export function getVirtualEdgeTarget(
    nodes: Record<string, PresentationNode>,
    edgeId: string
): string | null {
    const parsed = parseVirtualEdgeId(edgeId);
    if (!parsed) return null;

    const fromNode = nodes[parsed.fromNodeId];
    if (!fromNode) return null;

    return fromNode.nextIds[parsed.index] || null;
}
