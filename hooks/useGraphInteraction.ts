/**
 * useGraphInteraction Hook
 * 处理图形编辑器中的节点拖拽、连线和框选交互
 */

import React, { useState, useEffect, useRef } from 'react';
import { Side } from '../types/common';
import * as Geom from '../utils/geometry';

// ========== 类型定义 ==========
interface SnapPoint {
    nodeId: string;
    side: Side;
    x: number;
    y: number;
}

interface BoxSelectRect {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

interface InteractionOptions {
    onNodeMove: (nodeId: string, pos: { x: number, y: number }) => void;
    onMultiNodeMove: (nodeIds: string[], delta: { dx: number, dy: number }) => void;
    onLinkComplete: (sourceId: string, targetId: string, options?: { targetSide?: Side; sourceSide?: Side }) => void;
    onLinkUpdate: (transId: string, handle: 'source' | 'target', targetId: string, side?: Side) => void;
    onLinkDelete?: (transId: string) => void;
    onBoxSelectEnd: (nodeIds: string[]) => void;
    getContentOffset: (clientX: number, clientY: number) => { x: number, y: number };
    getNodes: () => Record<string, any>;
    /** 节点尺寸（可选，默认使用FSM状态节点尺寸） */
    nodeDimensions?: { width: number; height: number };
}

const SNAP_THRESHOLD = 30;

export const useGraphInteraction = ({
    onNodeMove,
    onMultiNodeMove,
    onLinkComplete,
    onLinkUpdate,
    onLinkDelete,
    onBoxSelectEnd,
    getContentOffset,
    getNodes,
    nodeDimensions
}: InteractionOptions) => {
    // 节点尺寸（使用传入值或默认FSM尺寸）
    const nodeWidth = nodeDimensions?.width ?? Geom.STATE_WIDTH;
    const nodeHeight = nodeDimensions?.height ?? Geom.STATE_ESTIMATED_HEIGHT;

    // === 节点拖拽状态 ===
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // === 多选拖拽状态 ===
    const [isDraggingMultiple, setIsDraggingMultiple] = useState(false);
    const multiDragStart = useRef<{ x: number, y: number } | null>(null);
    const multiDragNodeIds = useRef<string[]>([]);

    // === 连线状态 ===
    const [linkingState, setLinkingState] = useState<{ nodeId: string } | null>(null);
    const [modifyingTransition, setModifyingTransition] = useState<{ id: string, handle: 'source' | 'target' } | null>(null);

    // === 框选状态 ===
    const [boxSelectRect, setBoxSelectRect] = useState<BoxSelectRect | null>(null);
    const boxSelectActive = useRef(false);

    // === 反馈状态 ===
    const [activeSnapPoint, setActiveSnapPoint] = useState<SnapPoint | null>(null);
    const [snapPoints, setSnapPoints] = useState<SnapPoint[]>([]); // 当前可见的吸附点列表，用于 UI 高亮
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // 缓存锚点用于优化
    const cachedSnapPoints = useRef<SnapPoint[]>([]);

    const updateSnapCache = () => {
        const nodes = getNodes();
        const points: SnapPoint[] = [];
        Object.values(nodes).forEach((node: any) => {
            const pos = node.position;
            // 使用传入的节点尺寸或默认值
            const anchors = [
                { side: 'top', ...Geom.getNodeAnchor(pos, nodeWidth, nodeHeight, 'top') },
                { side: 'bottom', ...Geom.getNodeAnchor(pos, nodeWidth, nodeHeight, 'bottom') },
                { side: 'left', ...Geom.getNodeAnchor(pos, nodeWidth, nodeHeight, 'left') },
                { side: 'right', ...Geom.getNodeAnchor(pos, nodeWidth, nodeHeight, 'right') },
            ];
            anchors.forEach(a => points.push({ nodeId: node.id, side: a.side as Side, x: a.x, y: a.y }));
        });
        cachedSnapPoints.current = points;
        setSnapPoints(points);
    };

    // === 开始单节点拖拽 ===
    const startNodeDrag = (e: React.MouseEvent, nodeId: string, currentPos: { x: number, y: number }) => {
        const pos = getContentOffset(e.clientX, e.clientY);
        setDraggingNodeId(nodeId);
        setDragOffset({ x: pos.x - currentPos.x, y: pos.y - currentPos.y });
        setMousePos(pos);
    };

    // === 开始多节点拖拽 ===
    const startMultiNodeDrag = (e: React.MouseEvent, nodeIds: string[]) => {
        const pos = getContentOffset(e.clientX, e.clientY);
        setIsDraggingMultiple(true);
        multiDragStart.current = pos;
        multiDragNodeIds.current = nodeIds;
        setMousePos(pos);
    };

    // === 开始连线 ===
    const startLinking = (e: React.MouseEvent, nodeId: string) => {
        const pos = getContentOffset(e.clientX, e.clientY);
        updateSnapCache();
        setLinkingState({ nodeId });
        setMousePos(pos);
    };

    // === 开始修改转移 ===
    const startModifyingTransition = (e: React.MouseEvent, transId: string, handle: 'source' | 'target') => {
        const pos = getContentOffset(e.clientX, e.clientY);
        updateSnapCache();
        setModifyingTransition({ id: transId, handle });
        setMousePos(pos);
    };

    // === 开始框选 ===
    const startBoxSelect = (e: React.MouseEvent) => {
        const pos = getContentOffset(e.clientX, e.clientY);
        boxSelectActive.current = true;
        setBoxSelectRect({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
        setMousePos(pos);
    };

    // === 全局事件处理 ===
    useEffect(() => {
        const handleWindowMouseMove = (e: MouseEvent) => {
            const pos = getContentOffset(e.clientX, e.clientY);
            setMousePos(pos);

            // 框选更新
            if (boxSelectRect) {
                setBoxSelectRect(prev => prev ? { ...prev, endX: pos.x, endY: pos.y } : null);
                return;
            }

            // 连线时的吸附计算
            if (linkingState || modifyingTransition) {
                let closest: SnapPoint | null = null;
                let minDist = SNAP_THRESHOLD;

                for (const point of cachedSnapPoints.current) {
                    const dist = Math.hypot(point.x - pos.x, point.y - pos.y);
                    if (dist < minDist) {
                        minDist = dist;
                        closest = point;
                    }
                }
                setActiveSnapPoint(closest);
            }
        };

        const handleWindowMouseUp = (e: MouseEvent) => {
            const pos = getContentOffset(e.clientX, e.clientY);

            // 框选结束
            if (boxSelectRect) {
                const nodes = getNodes();
                const rect = normalizeRect(boxSelectRect.startX, boxSelectRect.startY, pos.x, pos.y);
                const selectedIds: string[] = [];

                Object.values(nodes).forEach((node: any) => {
                    const nodeRect = {
                        left: node.position.x,
                        top: node.position.y,
                        // 使用传入的节点尺寸，保证框选命中区域与实际节点一致
                        right: node.position.x + nodeWidth,
                        bottom: node.position.y + nodeHeight
                    };

                    if (rectsIntersect(rect, nodeRect)) {
                        selectedIds.push(node.id);
                    }
                });

                onBoxSelectEnd(selectedIds);
                setBoxSelectRect(null);
                boxSelectActive.current = false;
                return;
            }

            // 多节点拖拽结束
            if (isDraggingMultiple && multiDragStart.current) {
                const dx = pos.x - multiDragStart.current.x;
                const dy = pos.y - multiDragStart.current.y;
                if (dx !== 0 || dy !== 0) {
                    onMultiNodeMove(multiDragNodeIds.current, { dx, dy });
                }
                setIsDraggingMultiple(false);
                multiDragStart.current = null;
                multiDragNodeIds.current = [];
                return;
            }

            // 连线完成
            if (linkingState) {
                const nodes = getNodes();
                const sourceNode = nodes[linkingState.nodeId];
                // 记录释放时的起点侧，确保新连线起点与拖拽时的吸附方向一致
                const sourceSide = sourceNode
                    ? Geom.getClosestSide(
                        sourceNode.position,
                        Geom.STATE_WIDTH,
                        Geom.STATE_ESTIMATED_HEIGHT,
                        activeSnapPoint ? { x: activeSnapPoint.x, y: activeSnapPoint.y } : pos
                    )
                    : undefined;

                if (activeSnapPoint) {
                    onLinkComplete(linkingState.nodeId, activeSnapPoint.nodeId, { targetSide: activeSnapPoint.side, sourceSide });
                } else {
                    const elements = document.elementsFromPoint(e.clientX, e.clientY);
                    const stateEl = elements.find(el => el.hasAttribute('data-node-id'));
                    if (stateEl) {
                        const targetId = stateEl.getAttribute('data-node-id');
                        if (targetId) onLinkComplete(linkingState.nodeId, targetId, { sourceSide });
                    }
                }
                setLinkingState(null);
            }
            // 修改转移
            else if (modifyingTransition) {
                if (activeSnapPoint) {
                    onLinkUpdate(modifyingTransition.id, modifyingTransition.handle, activeSnapPoint.nodeId, activeSnapPoint.side);
                } else {
                    const elements = document.elementsFromPoint(e.clientX, e.clientY);
                    const stateEl = elements.find(el => el.hasAttribute('data-node-id'));
                    if (stateEl) {
                        const targetId = stateEl.getAttribute('data-node-id');
                        if (targetId) onLinkUpdate(modifyingTransition.id, modifyingTransition.handle, targetId);
                    } else {
                        if (onLinkDelete) onLinkDelete(modifyingTransition.id);
                    }
                }
                setModifyingTransition(null);
            }
            // 单节点拖拽
            else if (draggingNodeId) {
                onNodeMove(draggingNodeId, { x: pos.x - dragOffset.x, y: pos.y - dragOffset.y });
                setDraggingNodeId(null);
            }

            setActiveSnapPoint(null);
            setSnapPoints([]);
            setDragOffset({ x: 0, y: 0 });
        };

        const isActive = draggingNodeId || linkingState || modifyingTransition || boxSelectRect || isDraggingMultiple;

        if (isActive) {
            // 使用捕获阶段确保即使子组件 stopPropagation 也能收到事件，避免拖拽状态无法释放
            window.addEventListener('mousemove', handleWindowMouseMove, { capture: true });
            window.addEventListener('mouseup', handleWindowMouseUp, { capture: true });
        }
        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove, { capture: true } as any);
            window.removeEventListener('mouseup', handleWindowMouseUp, { capture: true } as any);
        };
    }, [draggingNodeId, linkingState, modifyingTransition, dragOffset, activeSnapPoint, boxSelectRect, isDraggingMultiple, onLinkDelete, nodeWidth, nodeHeight]);

    // === 获取节点显示位置（拖拽时使用临时位置）===
    const getNodeDisplayPosition = (nodeId: string, actualPos: { x: number, y: number }) => {
        if (draggingNodeId === nodeId) {
            return { x: mousePos.x - dragOffset.x, y: mousePos.y - dragOffset.y };
        }
        // 多选拖拽时的位置计算
        if (isDraggingMultiple && multiDragStart.current && multiDragNodeIds.current.includes(nodeId)) {
            const dx = mousePos.x - multiDragStart.current.x;
            const dy = mousePos.y - multiDragStart.current.y;
            return { x: actualPos.x + dx, y: actualPos.y + dy };
        }
        return actualPos;
    };

    // === 获取多选拖拽的偏移量 ===
    const getMultiDragDelta = () => {
        if (isDraggingMultiple && multiDragStart.current) {
            return {
                dx: mousePos.x - multiDragStart.current.x,
                dy: mousePos.y - multiDragStart.current.y
            };
        }
        return { dx: 0, dy: 0 };
    };

    return {
        // 状态
        draggingNodeId,
        linkingState,
        modifyingTransition,
        activeSnapPoint,
        snapPoints,
        mousePos,
        boxSelectRect,
        isDraggingMultiple,
        // 方法
        startNodeDrag,
        startMultiNodeDrag,
        startLinking,
        startModifyingTransition,
        startBoxSelect,
        getNodeDisplayPosition,
        getMultiDragDelta
    };
};

// === 工具函数 ===
function normalizeRect(x1: number, y1: number, x2: number, y2: number) {
    return {
        left: Math.min(x1, x2),
        top: Math.min(y1, y2),
        right: Math.max(x1, x2),
        bottom: Math.max(y1, y2)
    };
}

function rectsIntersect(
    a: { left: number, top: number, right: number, bottom: number },
    b: { left: number, top: number, right: number, bottom: number }
) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}
