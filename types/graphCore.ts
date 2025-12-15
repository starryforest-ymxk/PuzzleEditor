/**
 * types/graphCore.ts
 * 通用图结构类型定义 - 提供 FSM 和演出图共享的抽象接口
 * 
 * 设计目标：
 * 1. 统一节点和边的基础接口，便于组件复用
 * 2. 保持与现有 State/Transition/PresentationNode 类型兼容
 * 3. 支持不同图类型的扩展
 */

import { Vector2, Side } from './common';

// ========== 通用图节点接口 ==========
/**
 * 图中节点的基础接口
 * FSM 的 State 和演出图的 PresentationNode 都应实现此接口
 */
export interface IGraphNode {
    id: string;
    name: string;
    position: Vector2;
    description?: string;
}

// ========== 通用图边接口 ==========
/**
 * 图中边的基础接口
 * FSM 的 Transition 实现此接口
 * 演出图的 nextIds 需要通过适配器转换为此格式
 */
export interface IGraphEdge {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    fromSide?: Side;
    toSide?: Side;
}

// ========== 虚拟边类型 ==========
/**
 * 用于演出图的虚拟边
 * 从 PresentationNode.nextIds 转换而来，供 UI 渲染使用
 */
export interface VirtualEdge extends IGraphEdge {
    /** 标记此边是否为虚拟边（从 nextIds 转换） */
    isVirtual: true;
    /** 原始 fromNode 中 nextIds 的索引 */
    sourceIndex: number;
}

// ========== 通用图容器接口 ==========
/**
 * 图容器的抽象接口
 * 统一 FSM (StateMachine) 和演出图 (PresentationGraph) 的容器结构
 */
export interface IGraphContainer<
    N extends IGraphNode = IGraphNode,
    E extends IGraphEdge = IGraphEdge
> {
    id: string;
    nodes: Record<string, N>;
    /** 起始节点 ID */
    startNodeId: string | null;
}

// ========== 带边的图容器接口 ==========
/**
 * 扩展接口：包含独立边表的图容器（如 FSM）
 */
export interface IGraphContainerWithEdges<
    N extends IGraphNode = IGraphNode,
    E extends IGraphEdge = IGraphEdge
> extends IGraphContainer<N, E> {
    edges: Record<string, E>;
}

// ========== 节点尺寸配置 ==========
/**
 * 节点渲染尺寸配置
 * 不同类型的节点可能有不同的尺寸
 */
export interface NodeDimensions {
    width: number;
    height: number;
    /** 最小高度（节点内容可能影响实际高度） */
    minHeight?: number;
}

// ========== 图交互回调接口 ==========
/**
 * 图交互事件回调
 * 供 BaseCanvas 等通用组件使用
 */
export interface GraphInteractionCallbacks {
    /** 节点移动 */
    onNodeMove: (nodeId: string, position: Vector2) => void;
    /** 多节点移动 */
    onMultiNodeMove: (nodeIds: string[], delta: { dx: number; dy: number }) => void;
    /** 连线完成 */
    onLinkComplete: (
        fromNodeId: string,
        toNodeId: string,
        options?: { fromSide?: Side; toSide?: Side }
    ) => void;
    /** 节点选中 */
    onNodeSelect?: (nodeId: string) => void;
    /** 边选中 */
    onEdgeSelect?: (edgeId: string) => void;
    /** 取消选中 */
    onDeselect?: () => void;
}

// ========== 类型守卫 ==========
/**
 * 判断对象是否实现了 IGraphNode 接口
 */
export function isGraphNode(obj: unknown): obj is IGraphNode {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'id' in obj &&
        'name' in obj &&
        'position' in obj
    );
}

/**
 * 判断对象是否实现了 IGraphEdge 接口
 */
export function isGraphEdge(obj: unknown): obj is IGraphEdge {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'id' in obj &&
        'fromNodeId' in obj &&
        'toNodeId' in obj
    );
}

/**
 * 判断边是否为虚拟边
 */
export function isVirtualEdge(edge: IGraphEdge): edge is VirtualEdge {
    return 'isVirtual' in edge && (edge as VirtualEdge).isVirtual === true;
}
