/**
 * useGraphCuttingLine.ts - 通用图编辑器剪线交互 Hook
 * 
 * 从 useCuttingLine.ts 泛化而来，支持 FSM Transition 和演出图虚拟边
 * 处理 Ctrl + 拖拽 切断连线的完整逻辑
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Side } from '../types/common';
import * as Geom from '../utils/geometry';

/** 剪线状态：起点和终点坐标 */
export interface CuttingLineState {
    start: { x: number; y: number };
    end: { x: number; y: number };
}

/** 通用边接口 */
export interface GraphEdgeForCutting {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    fromSide?: Side;
    toSide?: Side;
}

/** 节点尺寸配置 */
export interface NodeDimensions {
    width: number;
    height: number;
}

/** Hook 参数 */
interface UseGraphCuttingLineOptions {
    /** 获取画布局部坐标的函数 */
    getLocalCoordinates: (clientX: number, clientY: number) => { x: number; y: number };
    /** 边数据列表 */
    edges: GraphEdgeForCutting[];
    /** 节点位置数据 */
    nodes: Record<string, { position: { x: number; y: number } }>;
    /** 获取节点显示位置（考虑拖拽偏移） */
    getNodeDisplayPosition: (nodeId: string, originalPos: { x: number; y: number }) => { x: number; y: number };
    /** 删除边的回调 */
    onDeleteEdge: (edgeId: string) => void;
    /** 节点尺寸（可选，默认使用 FSM 状态节点尺寸） */
    nodeDimensions?: NodeDimensions;
    /** 只读模式 */
    readOnly?: boolean;
}

/** Hook 返回值 */
interface UseGraphCuttingLineReturn {
    /** 当前剪线状态 */
    cuttingLine: CuttingLineState | null;
    /** 开始剪线：在 Ctrl+mousedown 时调用 */
    startCutting: (clientX: number, clientY: number) => void;
    /** 是否处于剪线模式（Ctrl 按住） */
    isLineCuttingMode: boolean;
    /** 设置剪线模式提示 */
    setIsLineCuttingMode: (value: boolean) => void;
}

/** 默认节点尺寸（FSM 状态节点） */
const DEFAULT_NODE_DIMENSIONS: NodeDimensions = {
    width: Geom.STATE_WIDTH,
    height: Geom.STATE_ESTIMATED_HEIGHT
};

/**
 * 通用图编辑器剪线交互 Hook
 * 职责：
 * 1. 管理剪线状态（起点/终点）
 * 2. 检测剪线路径与连线的碰撞
 * 3. 在 mouseup 时执行批量删除
 */
export function useGraphCuttingLine({
    getLocalCoordinates,
    edges,
    nodes,
    getNodeDisplayPosition,
    onDeleteEdge,
    nodeDimensions = DEFAULT_NODE_DIMENSIONS,
    readOnly = false
}: UseGraphCuttingLineOptions): UseGraphCuttingLineReturn {
    // 剪线模式提示（Ctrl 按住时显示）
    const [isLineCuttingMode, setIsLineCuttingMode] = useState(false);

    // 剪线拖拽状态：记录起点/终点
    const [cuttingLine, setCuttingLine] = useState<CuttingLineState | null>(null);

    // 前一帧位置：用于计算线段移动
    const cuttingPrevPos = useRef<{ x: number; y: number } | null>(null);

    // 已检测到碰撞的边 ID 集合（避免重复删除）
    const cutEdgesSet = useRef<Set<string>>(new Set());

    const { width: nodeWidth, height: nodeHeight } = nodeDimensions;

    /**
     * 开始剪线：记录起点
     */
    const startCutting = useCallback((clientX: number, clientY: number) => {
        if (readOnly) return;
        const pos = getLocalCoordinates(clientX, clientY);
        setCuttingLine({ start: pos, end: pos });
        cuttingPrevPos.current = pos;
        cutEdgesSet.current = new Set();
        // 开发调试日志
        if (import.meta.env.DEV) {
            console.log('[Cutting] Started at', pos);
        }
    }, [getLocalCoordinates, readOnly]);

    /**
     * 剪线拖拽的鼠标移动和抬起处理
     */
    useEffect(() => {
        if (!cuttingLine) return;

        const handleMouseMove = (e: MouseEvent) => {
            const pos = getLocalCoordinates(e.clientX, e.clientY);
            setCuttingLine(prev => (prev ? { ...prev, end: pos } : null));

            // 检测剪线路径与边的碰撞
            if (cuttingPrevPos.current && edges && nodes) {
                const prevPos = cuttingPrevPos.current;

                edges.forEach((edge) => {
                    // 已标记的跳过
                    if (cutEdgesSet.current.has(edge.id)) return;

                    const fromNode = nodes[edge.fromNodeId];
                    const toNode = nodes[edge.toNodeId];
                    if (!fromNode || !toNode) return;

                    const fromPos = getNodeDisplayPosition(edge.fromNodeId, fromNode.position);
                    const toPos = getNodeDisplayPosition(edge.toNodeId, toNode.position);

                    const fromSide = edge.fromSide || Geom.getClosestSide(fromPos, nodeWidth, nodeHeight, toPos);
                    const toSide = edge.toSide || Geom.getClosestSide(toPos, nodeWidth, nodeHeight, fromPos);

                    const curveStart = Geom.getNodeAnchor(fromPos, nodeWidth, nodeHeight, fromSide);
                    const curveEnd = Geom.getNodeAnchor(toPos, nodeWidth, nodeHeight, toSide);

                    // 检测剪线段与贝塞尔曲线是否相交
                    if (Geom.doesLineIntersectBezier(prevPos, pos, curveStart, curveEnd, fromSide, toSide)) {
                        cutEdgesSet.current.add(edge.id);
                    }
                });
            }

            cuttingPrevPos.current = pos;
        };

        const handleMouseUp = () => {
            // 批量删除所有被剪断的边
            if (cutEdgesSet.current.size > 0) {
                cutEdgesSet.current.forEach(edgeId => {
                    onDeleteEdge(edgeId);
                });
            }
            // 重置状态
            setCuttingLine(null);
            cuttingPrevPos.current = null;
            cutEdgesSet.current = new Set();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [cuttingLine, edges, nodes, nodeWidth, nodeHeight, getLocalCoordinates, getNodeDisplayPosition, onDeleteEdge]);

    return {
        cuttingLine,
        startCutting,
        isLineCuttingMode,
        setIsLineCuttingMode
    };
}
