/**
 * components/Canvas/PresentationCanvas.tsx
 * 演出子图画布组件 - 使用通用组件重构版本
 * 
 * 重构说明：
 * 1. 使用 GraphNode 通用节点组件替代内联渲染
 * 2. 使用 GraphEdge 通用边组件替代手动路径绘制
 * 3. 使用 graphAdapter 将 nextIds 转换为虚拟边
 * 4. 使用 GraphContextMenu 通用右键菜单组件
 * 5. 复用 useCanvasNavigation 和 useGraphInteraction hooks
 */

import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { PresentationGraph, PresentationNode, PresentationNodeType } from '../../types/presentation';
import * as Geom from '../../utils/geometry';
import { useCanvasNavigation } from '../../hooks/useCanvasNavigation';
import { useGraphInteraction } from '../../hooks/useGraphInteraction';
import { useGraphKeyboardShortcuts } from '../../hooks/useGraphKeyboardShortcuts';
import { useGraphCuttingLine, GraphEdgeForCutting } from '../../hooks/useGraphCuttingLine';
import { generateResourceId } from '../../utils/resourceIdGenerator';
import { presentationNodesToEdges, parseVirtualEdgeId } from '../../utils/graphAdapter';
import { GraphNode, GraphEdge, GraphEdgeControls, GraphContextMenu, GraphContextMenuState, GraphMenuElement } from './shared';
import { ConnectionArrowMarkers } from './Elements/TempConnectionLine';
import { ShortcutPanel, CuttingLineOverlay, BoxSelectOverlay, CanvasInfoOverlay } from './Elements/CanvasOverlays';
import { CANVAS } from '../../utils/constants';
import { IGraphNode } from '../../types/graphCore';

// ========== Props ==========
interface Props {
    graph: PresentationGraph;
    ownerNodeId?: string | null;
    readOnly?: boolean;
}

// ========== 节点尺寸常量 ==========
const PRESENTATION_NODE_DIMENSIONS = {
    width: 160,
    // GraphNode 实际最小高度约 85（标题栏 28 + 底边 1 + 内容最小 40 + 内边距 16），用 85 让吸附点精准落在四边中心
    height: 85,
    minHeight: 85
};


/**
 * 演出子图画布组件
 * 支持节点创建、拖拽、连线等编辑功能
 */
export const PresentationCanvas: React.FC<Props> = ({ graph, ownerNodeId, readOnly = false }) => {
    const { ui } = useEditorState();
    const dispatch = useEditorDispatch();

    // ========== Refs ==========
    const canvasRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // ========== Local State ==========
    const [contextMenu, setContextMenu] = useState<GraphContextMenuState | null>(null);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [isLinkKeyActive, setIsLinkKeyActive] = useState(false);

    // 选中和拖拽状态
    const pendingNodeSelect = useRef<string | null>(null);
    const dragStartPos = useRef<{ x: number; y: number } | null>(null);
    const dragMoved = useRef(false);

    // 画布空白点击检测（用于点击空白选中父级节点）
    const blankClickStart = useRef<{ x: number; y: number } | null>(null);
    const isBoxSelecting = useRef(false);

    // ========== 将 nextIds 转换为虚拟边 ==========
    const edges = useMemo(() => presentationNodesToEdges(graph.nodes), [graph.nodes]);

    const multiSelectIds = ui.multiSelectPresentationNodeIds || [];

    // ========== 工具函数 ==========
    const getLocalCoordinates = useCallback((clientX: number, clientY: number) => {
        if (!contentRef.current) return { x: 0, y: 0 };
        const rect = contentRef.current.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }, []);

    // ========== Hooks ==========

    // 画布导航（平移/缩放）
    const { isPanningActive, handleMouseDown: handlePanMouseDown } = useCanvasNavigation({ canvasRef });

    // 图形交互（拖拽/连线/框选）
    const {
        linkingState,
        modifyingTransition,
        activeSnapPoint,
        snapPoints,
        mousePos,
        boxSelectRect,
        startNodeDrag,
        startMultiNodeDrag,
        startLinking,
        startModifyingTransition,
        startBoxSelect,
        getNodeDisplayPosition
    } = useGraphInteraction({
        getNodes: () => graph.nodes,
        getContentOffset: getLocalCoordinates,
        onNodeMove: (nodeId, pos) => {
            dispatch({
                type: 'UPDATE_PRESENTATION_NODE',
                payload: { graphId: graph.id, nodeId, data: { position: pos } }
            });
        },
        onMultiNodeMove: (nodeIds, delta) => {
            nodeIds.forEach(id => {
                const node = graph.nodes[id];
                if (node) {
                    dispatch({
                        type: 'UPDATE_PRESENTATION_NODE',
                        payload: {
                            graphId: graph.id,
                            nodeId: id,
                            data: { position: { x: node.position.x + delta.dx, y: node.position.y + delta.dy } }
                        }
                    });
                }
            });
        },
        onLinkComplete: (sourceId, targetId) => {
            // 避免重复连接
            const sourceNode = graph.nodes[sourceId];
            if (sourceNode?.nextIds.includes(targetId)) return;
            // 避免自连接
            if (sourceId === targetId) return;

            dispatch({
                type: 'LINK_PRESENTATION_NODES',
                payload: { graphId: graph.id, fromNodeId: sourceId, toNodeId: targetId }
            });
        },
        onLinkUpdate: (edgeId, handle, newTargetId) => {
            // 解析虚拟边ID获取源节点和连接索引
            const parsed = parseVirtualEdgeId(edgeId);
            if (!parsed) return;

            const { fromNodeId, index } = parsed;
            const fromNode = graph.nodes[fromNodeId];
            if (!fromNode) return;

            const oldTargetId = fromNode.nextIds[index];
            if (!oldTargetId) return;

            if (handle === 'target') {
                // 修改目标端点：删除旧连接 + 创建新连接
                if (newTargetId === oldTargetId) return; // 目标没变
                if (newTargetId === fromNodeId) return; // 避免自连接
                if (fromNode.nextIds.includes(newTargetId)) return; // 避免重复连接

                dispatch({
                    type: 'UNLINK_PRESENTATION_NODES',
                    payload: { graphId: graph.id, fromNodeId, toNodeId: oldTargetId }
                });
                dispatch({
                    type: 'LINK_PRESENTATION_NODES',
                    payload: { graphId: graph.id, fromNodeId, toNodeId: newTargetId }
                });
            } else {
                // 修改源端点：删除旧连接 + 从新源创建连接
                if (newTargetId === fromNodeId) return; // 源没变
                if (newTargetId === oldTargetId) return; // 避免自连接
                const newSourceNode = graph.nodes[newTargetId];
                if (newSourceNode?.nextIds.includes(oldTargetId)) return; // 避免重复连接

                dispatch({
                    type: 'UNLINK_PRESENTATION_NODES',
                    payload: { graphId: graph.id, fromNodeId, toNodeId: oldTargetId }
                });
                dispatch({
                    type: 'LINK_PRESENTATION_NODES',
                    payload: { graphId: graph.id, fromNodeId: newTargetId, toNodeId: oldTargetId }
                });
            }
        },
        onLinkDelete: (edgeId) => {
            // 拖拽到空白处删除连接
            const parsed = parseVirtualEdgeId(edgeId);
            if (!parsed) return;

            const { fromNodeId, index } = parsed;
            const fromNode = graph.nodes[fromNodeId];
            if (!fromNode) return;

            const toNodeId = fromNode.nextIds[index];
            if (!toNodeId) return;

            dispatch({
                type: 'UNLINK_PRESENTATION_NODES',
                payload: { graphId: graph.id, fromNodeId, toNodeId }
            });
        },
        onBoxSelectEnd: (selectedIds) => {
            dispatch({ type: 'SET_MULTI_SELECT_PRESENTATION_NODES', payload: selectedIds });
        },
        // 传入演出图节点尺寸，修复吸附点偏移问题
        nodeDimensions: PRESENTATION_NODE_DIMENSIONS
    });

    // 将虚拟边转换为剪线 Hook 需要的格式
    const edgesForCutting: GraphEdgeForCutting[] = useMemo(() =>
        edges.map(e => ({
            id: e.id,
            fromNodeId: e.fromNodeId,
            toNodeId: e.toNodeId,
            fromSide: e.fromSide,
            toSide: e.toSide
        })), [edges]);

    // 剪线逻辑
    const {
        cuttingLine,
        startCutting,
        isLineCuttingMode,
        setIsLineCuttingMode
    } = useGraphCuttingLine({
        getLocalCoordinates,
        edges: edgesForCutting,
        nodes: graph.nodes,
        getNodeDisplayPosition,
        onDeleteEdge: (edgeId) => {
            // 解析虚拟边ID获取源节点和连接索引
            const parsed = parseVirtualEdgeId(edgeId);
            if (!parsed) return;
            const { fromNodeId, index } = parsed;
            const fromNode = graph.nodes[fromNodeId];
            if (!fromNode) return;
            const toNodeId = fromNode.nextIds[index];
            if (!toNodeId) return;
            dispatch({
                type: 'UNLINK_PRESENTATION_NODES',
                payload: { graphId: graph.id, fromNodeId, toNodeId }
            });
        },
        nodeDimensions: PRESENTATION_NODE_DIMENSIONS,
        readOnly
    });

    // 监听全局鼠标移动判断是否进入拖拽状态
    React.useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            if (!pendingNodeSelect.current || !dragStartPos.current) return;
            const dx = Math.abs(e.clientX - dragStartPos.current.x);
            const dy = Math.abs(e.clientY - dragStartPos.current.y);
            const DRAG_THRESHOLD = 3;
            if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
                dragMoved.current = true;
            }
        };

        const handleUp = () => {
            dragStartPos.current = null;
        };

        window.addEventListener('mousemove', handleMove, { capture: true });
        window.addEventListener('mouseup', handleUp, { capture: true });
        return () => {
            window.removeEventListener('mousemove', handleMove, { capture: true });
            window.removeEventListener('mouseup', handleUp, { capture: true });
        };
    }, []);

    // 键盘快捷键更新
    useGraphKeyboardShortcuts({
        contextId: graph.id,
        nodeSelectionType: 'PRESENTATION_NODE',
        edgeSelectionType: null, // 演出图边无独立选中
        multiSelectIds,
        selection: ui.selection,
        readOnly,
        onDeleteNode: (nodeId) => {
            dispatch({
                type: 'DELETE_PRESENTATION_NODE',
                payload: { graphId: graph.id, nodeId }
            });
        },
        onClearMultiSelect: () => dispatch({ type: 'SET_MULTI_SELECT_PRESENTATION_NODES', payload: [] }),
        onSetLineCuttingMode: setIsLineCuttingMode,
        onSetLinkKeyActive: setIsLinkKeyActive
    });

    // ========== Event Handlers ==========

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (handlePanMouseDown(e)) return;
        if (e.button !== 0) return;

        // 点击空白区域取消选中并关闭菜单
        setContextMenu(null);

        if (!readOnly) {
            if (linkingState || modifyingTransition) return;
            // Ctrl+左键开始剪线
            if (e.ctrlKey || e.metaKey) {
                startCutting(e.clientX, e.clientY);
                return;
            }
        }

        const rect = contentRef.current?.getBoundingClientRect();
        const isInsideContent = rect ? (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) : true;

        // 记录空白点击开始位置
        isBoxSelecting.current = true;
        blankClickStart.current = isInsideContent ? { x: e.clientX, y: e.clientY } : null;

        // 清空多选（如果没有按住 Ctrl）
        if (multiSelectIds.length > 0 && !e.ctrlKey && !e.metaKey) {
            dispatch({ type: 'SET_MULTI_SELECT_PRESENTATION_NODES', payload: [] });
        }

        startBoxSelect(e);
    };

    // 点击空白处选中父级节点（ownerNodeId）或演出图本身
    const handleCanvasMouseUp = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if (cuttingLine || linkingState || modifyingTransition) {
            blankClickStart.current = null;
            return;
        }

        // 如果正在框选中则不处理（框选结束由 onBoxSelectEnd 处理）
        if (isBoxSelecting.current && boxSelectRect) return;

        // 空白点击选中父级节点
        if (blankClickStart.current) {
            const CLICK_THRESHOLD = 3; // 点击判定阈值
            const dx = Math.abs(e.clientX - blankClickStart.current.x);
            const dy = Math.abs(e.clientY - blankClickStart.current.y);
            if (dx <= CLICK_THRESHOLD && dy <= CLICK_THRESHOLD) {
                // 如果有 ownerNodeId，选中父级 PuzzleNode；否则选中 PRESENTATION_GRAPH 本身
                if (ownerNodeId) {
                    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: ownerNodeId } });
                } else {
                    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_GRAPH', id: graph.id } });
                }
            }
            blankClickStart.current = null;
        }

        isBoxSelecting.current = false;
    };

    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        if (e.button !== 0) return;

        // 关闭菜单
        setContextMenu(null);

        // Shift+点击开始连线
        if (e.shiftKey && !readOnly) {
            startLinking(e, nodeId);
            return;
        }

        pendingNodeSelect.current = null;
        dragMoved.current = false;
        dragStartPos.current = { x: e.clientX, y: e.clientY };

        // 多选拖拽
        if (multiSelectIds.includes(nodeId) && !readOnly) {
            startMultiNodeDrag(e, multiSelectIds);
            return;
        }

        // 如果有多选且没按 Ctrl，清空多选（但在 MouseDown 时不清空，而在 MouseUp 或 确定是单选拖拽时清空？）
        // FSM 逻辑：MouseDown 时，如果不包含在多选里，则清空多选。
        if (multiSelectIds.length > 0 && !e.ctrlKey && !e.metaKey) {
            dispatch({ type: 'SET_MULTI_SELECT_PRESENTATION_NODES', payload: [] });
        }

        // 延迟选择模式
        if (!readOnly) {
            // 开始拖拽（视觉上）
            startNodeDrag(e, nodeId, graph.nodes[nodeId].position);
            // 记录 pending
            pendingNodeSelect.current = nodeId;
        } else {
            pendingNodeSelect.current = nodeId;
        }
    };

    const handleNodeMouseUp = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        if (e.button !== 0) return;

        // 如果有 pendingSelect 且没有发生拖拽，则执行选择
        if (pendingNodeSelect.current === nodeId && !linkingState && !dragMoved.current) {
            dispatch({
                type: 'SELECT_OBJECT',
                payload: { type: 'PRESENTATION_NODE', id: nodeId, contextId: graph.id }
            });
        }

        pendingNodeSelect.current = null;
        dragStartPos.current = null;
        dragMoved.current = false;
    };

    const handleContextMenu = (e: React.MouseEvent, type: 'CANVAS' | 'NODE' | 'EDGE', targetId?: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (readOnly) return;

        const pos = getLocalCoordinates(e.clientX, e.clientY);
        setContextMenu({ x: pos.x, y: pos.y, type, targetId });
    };

    const handleAddNode = (type: PresentationNodeType) => {
        if (!contextMenu) return;

        const nodeId = generateResourceId('PNODE', Object.keys(graph.nodes));
        const newNode: PresentationNode = {
            id: nodeId,
            name: `${type} Node`,
            type,
            position: { x: contextMenu.x, y: contextMenu.y },
            nextIds: []
        };

        dispatch({
            type: 'ADD_PRESENTATION_NODE',
            payload: { graphId: graph.id, node: newNode }
        });
        setContextMenu(null);
    };

    const handleDeleteNode = (nodeId: string) => {
        dispatch({
            type: 'DELETE_PRESENTATION_NODE',
            payload: { graphId: graph.id, nodeId }
        });
        setContextMenu(null);
    };

    const handleSetStartNode = (nodeId: string) => {
        dispatch({
            type: 'UPDATE_PRESENTATION_GRAPH',
            payload: { graphId: graph.id, data: { startNodeId: nodeId } }
        });
        setContextMenu(null);
    };

    const handleEdgeSelect = (e: React.MouseEvent, edgeId: string) => {
        // 演出图的边不可独立选中，选中源节点
        const parts = edgeId.split('->edge:');
        if (parts[0]) {
            dispatch({
                type: 'SELECT_OBJECT',
                payload: { type: 'PRESENTATION_NODE', id: parts[0], contextId: graph.id }
            });
        }
    };

    const handleEdgeContextMenu = (e: React.MouseEvent, edgeId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (readOnly) return;

        const pos = getLocalCoordinates(e.clientX, e.clientY);
        setContextMenu({ x: pos.x, y: pos.y, type: 'EDGE', targetId: edgeId });
    };

    // 处理边端点手柄拖拽开始（复用FSM的交互模式）
    const handleEdgeHandleDown = (e: React.MouseEvent, edgeId: string, handle: 'source' | 'target') => {
        e.stopPropagation();
        if (readOnly) return;
        startModifyingTransition(e, edgeId, handle);
    };

    // ========== 菜单项配置（与 FSM 保持一致的结构） ==========
    const getMenuItems = useCallback((type: 'CANVAS' | 'NODE' | 'EDGE', targetId?: string): GraphMenuElement[] => {
        if (type === 'CANVAS') {
            return [
                { id: 'add-presentation', label: '+ Add Presentation Node', onClick: () => handleAddNode('PresentationNode') },
                { id: 'add-wait', label: '+ Add Wait Node', onClick: () => handleAddNode('Wait') },
                { id: 'add-branch', label: '+ Add Branch Node', onClick: () => handleAddNode('Branch') },
                { id: 'add-parallel', label: '+ Add Parallel Node', onClick: () => handleAddNode('Parallel') }
            ];
        }

        if (type === 'NODE' && targetId) {
            const isStartNode = graph.startNodeId === targetId;
            const items: GraphMenuElement[] = [];

            // 设为起始节点（与 FSM 的 Set as Initial State 对应）
            if (!isStartNode) {
                items.push({ id: 'set-start', label: 'Set as Start Node', onClick: () => handleSetStartNode(targetId) });
            }

            // 创建连线（与 FSM 的 Create Transition 对应）
            items.push({
                id: 'create-link', label: 'Create Connection', onClick: () => {
                    const node = graph.nodes[targetId];
                    if (node && contextMenu) {
                        startLinking({ clientX: contextMenu.x, clientY: contextMenu.y } as React.MouseEvent, targetId);
                    }
                    setContextMenu(null);
                }
            });

            // 分隔符 + 删除
            items.push({ type: 'separator' });
            items.push({ id: 'delete-node', label: 'Delete Node', danger: true, onClick: () => handleDeleteNode(targetId) });

            return items;
        }

        // 边的右键菜单（与 FSM 的 Delete Transition 对应）
        if (type === 'EDGE' && targetId) {
            const parts = targetId.split('->edge:');
            if (parts.length === 2) {
                const fromNodeId = parts[0];
                const index = parseInt(parts[1], 10);
                const fromNode = graph.nodes[fromNodeId];
                if (fromNode && fromNode.nextIds[index]) {
                    const toNodeId = fromNode.nextIds[index];
                    return [
                        {
                            id: 'delete-edge', label: 'Delete Connection', danger: true, onClick: () => {
                                dispatch({
                                    type: 'UNLINK_PRESENTATION_NODES',
                                    payload: { graphId: graph.id, fromNodeId, toNodeId }
                                });
                                setContextMenu(null);
                            }
                        }
                    ];
                }
            }
        }

        return [];
    }, [graph, contextMenu, dispatch, startLinking]);

    // ========== 自定义节点内容渲染 ==========
    const renderNodeContent = (node: IGraphNode) => {
        const presentationNode = node as PresentationNode;
        const binding = presentationNode.presentation;
        return (
            <div style={{ fontSize: '10px', color: '#888' }}>
                {presentationNode.type}
                {binding?.type === 'Script' && binding.scriptId && (
                    <div style={{ marginTop: '2px', color: '#c586c0' }}>
                        Script: {binding.scriptId}
                    </div>
                )}
                {binding?.type === 'Graph' && binding.graphId && (
                    <div style={{ marginTop: '2px', color: '#9cdcfe' }}>
                        Graph: {binding.graphId}
                    </div>
                )}
            </div>
        );
    };

    // ========== Render ==========
    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            {/* 左上角标题显示（与FSM保持一致） */}
            <CanvasInfoOverlay
                nodeName={graph.name || 'Presentation Graph'}
                multiSelectCount={multiSelectIds.length}
                isLineCuttingMode={isLineCuttingMode}
                isLinkMode={Boolean(linkingState || modifyingTransition || isLinkKeyActive)}
                isPanMode={isPanningActive}
                hasNoInitialState={!graph.startNodeId && Object.keys(graph.nodes).length > 0}
                headerLabel="Presentation Editor"
            />

            {/* 快捷键面板 */}
            <ShortcutPanel visible={showShortcuts} onToggle={() => setShowShortcuts(v => !v)} />

            {/* 画布区域 */}
            <div
                ref={canvasRef}
                className="canvas-grid"
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    overflow: 'auto',
                    backgroundColor: '#1a1a1d',
                    cursor: isPanningActive
                        ? 'grabbing'
                        : (linkingState || modifyingTransition || cuttingLine || boxSelectRect)
                            ? 'crosshair'
                            : 'default'
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onContextMenu={(e) => handleContextMenu(e, 'CANVAS')}
            >
                {/* 使用通用右键菜单组件 */}
                {contextMenu && (
                    <GraphContextMenu
                        menu={contextMenu}
                        onClose={() => setContextMenu(null)}
                        getMenuItems={getMenuItems}
                        contentRef={contentRef}
                    />
                )}

                {/* 画布内容区域 */}
                <div
                    ref={contentRef}
                    style={{
                        position: 'relative',
                        minWidth: `${CANVAS.SIZE}px`,
                        minHeight: `${CANVAS.SIZE}px`
                    }}
                >
                    {/* 框选可视化，与 FSM 画布保持一致 */}
                    <BoxSelectOverlay rect={boxSelectRect} />

                    {/* SVG 层：连线 */}
                    <svg
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            overflow: 'visible',
                            pointerEvents: 'none',
                            zIndex: 0
                        }}
                    >
                        <ConnectionArrowMarkers />

                        {/* 渲染所有边 */}
                        {edges.map(edge => {
                            const fromNode = graph.nodes[edge.fromNodeId];
                            const toNode = graph.nodes[edge.toNodeId];
                            if (!fromNode || !toNode) return null;

                            const fromPos = getNodeDisplayPosition(edge.fromNodeId, fromNode.position);
                            const toPos = getNodeDisplayPosition(edge.toNodeId, toNode.position);
                            const isModifying = modifyingTransition?.id === edge.id;

                            return (
                                <GraphEdge
                                    key={edge.id}
                                    edge={edge}
                                    fromPos={fromPos}
                                    toPos={toPos}
                                    nodeDimensions={PRESENTATION_NODE_DIMENSIONS}
                                    isSelected={false}
                                    isContextTarget={contextMenu?.type === 'EDGE' && contextMenu?.targetId === edge.id}
                                    isModifying={isModifying}
                                    disableInteractions
                                    onSelect={handleEdgeSelect}
                                    onContextMenu={handleEdgeContextMenu}
                                />
                            );
                        })}

                        {/* 临时连线（正在创建中）- 使用贝塞尔曲线与FSM保持一致 */}
                        {linkingState && (() => {
                            const sourceNode = graph.nodes[linkingState.nodeId];
                            if (!sourceNode) return null;

                            // 计算源节点显示位置
                            const sourcePos = getNodeDisplayPosition(linkingState.nodeId, sourceNode.position);
                            const targetPos = activeSnapPoint || mousePos;

                            const nodeWidth = PRESENTATION_NODE_DIMENSIONS.width;
                            const nodeHeight = PRESENTATION_NODE_DIMENSIONS.height;

                            // 计算连线方向（复用几何工具函数）
                            const fromSide = Geom.getClosestSide(sourcePos, nodeWidth, nodeHeight, targetPos);
                            const start = Geom.getNodeAnchor(sourcePos, nodeWidth, nodeHeight, fromSide);
                            const toSide = activeSnapPoint?.side || Geom.getNaturalEnteringSide(start, targetPos);

                            return (
                                <path
                                    d={Geom.getBezierPathData(start, targetPos, fromSide, toSide)}
                                    fill="none"
                                    stroke="#c586c0"
                                    strokeWidth="2"
                                    strokeDasharray="5,5"
                                    markerEnd="url(#arrow-temp)"
                                    style={{ pointerEvents: 'none' }}
                                />
                            );
                        })()}

                        {/* 临时修改连线（拖拽端点时） */}
                        {modifyingTransition && (() => {
                            const parsed = parseVirtualEdgeId(modifyingTransition.id);
                            if (!parsed) return null;

                            const { fromNodeId, index } = parsed;
                            const fromNode = graph.nodes[fromNodeId];
                            if (!fromNode) return null;

                            const toNodeId = fromNode.nextIds[index];
                            const toNode = toNodeId ? graph.nodes[toNodeId] : null;
                            if (!toNode) return null;

                            const nodeWidth = PRESENTATION_NODE_DIMENSIONS.width;
                            const nodeHeight = PRESENTATION_NODE_DIMENSIONS.height;
                            const mouseOrSnap = activeSnapPoint || mousePos;

                            let p1: { x: number; y: number };
                            let p2: { x: number; y: number };
                            let fromSide: any;
                            let toSide: any;

                            if (modifyingTransition.handle === 'target') {
                                // 拖拽目标端点
                                const sourcePos = getNodeDisplayPosition(fromNodeId, fromNode.position);
                                fromSide = Geom.getClosestSide(sourcePos, nodeWidth, nodeHeight, mouseOrSnap);
                                p1 = Geom.getNodeAnchor(sourcePos, nodeWidth, nodeHeight, fromSide);
                                p2 = mouseOrSnap;
                                toSide = activeSnapPoint?.side || Geom.getNaturalEnteringSide(p1, p2);
                            } else {
                                // 拖拽源端点
                                const targetPos = getNodeDisplayPosition(toNodeId, toNode.position);
                                toSide = Geom.getClosestSide(targetPos, nodeWidth, nodeHeight, mouseOrSnap);
                                p2 = Geom.getNodeAnchor(targetPos, nodeWidth, nodeHeight, toSide);
                                p1 = mouseOrSnap;
                                fromSide = activeSnapPoint?.side || Geom.getClosestSide(
                                    { x: p1.x - nodeWidth / 2, y: p1.y - nodeHeight / 2 },
                                    nodeWidth, nodeHeight, p2
                                );
                            }

                            return (
                                <path
                                    d={Geom.getBezierPathData(p1, p2, fromSide, toSide)}
                                    fill="none"
                                    stroke="#888"
                                    strokeWidth="2"
                                    strokeDasharray="5,5"
                                    markerEnd="url(#arrow-temp)"
                                    style={{ pointerEvents: 'none' }}
                                />
                            );
                        })()}

                        {/* 剪线视觉反馈 */}
                        <CuttingLineOverlay line={cuttingLine} />
                    </svg>

                    {/* 节点层 */}
                    {(Object.values(graph.nodes) as PresentationNode[]).map(node => {
                        const pos = getNodeDisplayPosition(node.id, node.position);
                        const isSingleSelected = ui.selection.type === 'PRESENTATION_NODE' && ui.selection.id === node.id;
                        const isMultiSelected = multiSelectIds.includes(node.id); // 检查是否在多选列表中
                        const isStart = graph.startNodeId === node.id;

                        return (
                            <GraphNode
                                key={node.id}
                                node={node}
                                position={pos}
                                dimensions={PRESENTATION_NODE_DIMENSIONS}
                                isSelected={isSingleSelected}
                                isMultiSelected={isMultiSelected}
                                isInitial={isStart}
                                isContextTarget={contextMenu?.type === 'NODE' && contextMenu?.targetId === node.id}
                                readOnly={readOnly}
                                renderContent={renderNodeContent}
                                onMouseDown={handleNodeMouseDown}
                                onMouseUp={handleNodeMouseUp}
                                onContextMenu={(e, id) => handleContextMenu(e, 'NODE', id)}
                            />
                        );
                    })}

                    {/* 边端点手柄层（仅显示拖拽手柄，不显示标签） */}
                    {!readOnly && edges.map(edge => {
                        const fromNode = graph.nodes[edge.fromNodeId];
                        const toNode = graph.nodes[edge.toNodeId];
                        if (!fromNode || !toNode) return null;
                        if (modifyingTransition?.id === edge.id) return null;

                        const fromPos = getNodeDisplayPosition(edge.fromNodeId, fromNode.position);
                        const toPos = getNodeDisplayPosition(edge.toNodeId, toNode.position);

                        // 使用演出图节点尺寸计算吸附点
                        const nodeWidth = PRESENTATION_NODE_DIMENSIONS.width;
                        const nodeHeight = PRESENTATION_NODE_DIMENSIONS.height;

                        const fromSide = edge.fromSide || Geom.getClosestSide(fromPos, nodeWidth, nodeHeight, toPos);
                        const toSide = edge.toSide || Geom.getClosestSide(toPos, nodeWidth, nodeHeight, fromPos);

                        const start = Geom.getNodeAnchor(fromPos, nodeWidth, nodeHeight, fromSide);
                        const end = Geom.getNodeAnchor(toPos, nodeWidth, nodeHeight, toSide);

                        return (
                            <React.Fragment key={`handles-${edge.id}`}>
                                {/* 源端手柄 - 使用 CSS .handle 类的 transform 居中 */}
                                <div
                                    className="handle"
                                    style={{ left: start.x, top: start.y, zIndex: 31 }}
                                    onMouseDown={(e) => handleEdgeHandleDown(e, edge.id, 'source')}
                                />
                                {/* 目标端手柄 */}
                                <div
                                    className="handle"
                                    style={{ left: end.x, top: end.y, zIndex: 31 }}
                                    onMouseDown={(e) => handleEdgeHandleDown(e, edge.id, 'target')}
                                />
                            </React.Fragment>
                        );
                    })}


                    {/* 吸附点提示（连线/修改连线时） */}
                    {(linkingState || modifyingTransition) && snapPoints.map((point, idx) => (
                        <div
                            key={idx}
                            style={{
                                position: 'absolute',
                                left: point.x - 4,
                                top: point.y - 4,
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: activeSnapPoint === point ? 'var(--accent-color)' : '#888',
                                border: '1px solid #666',
                                pointerEvents: 'none',
                                zIndex: 100
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PresentationCanvas;
