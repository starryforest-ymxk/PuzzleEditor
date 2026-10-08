import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../store/context';
import type { PresentationGraph, PresentationNodeType } from '../types/presentation';
import type { GraphContextMenuState, GraphMenuElement } from '../types/graphUI';
import { presentationNodesToEdges } from '../utils/graphAdapter';
import { validatePresentationGraph } from '../utils/validation/presentationValidation';
import { PRESENTATION_NODE_DIMENSIONS } from '../utils/presentationGeometry';
import { createPresentationCommands } from '../store/commands/presentation';
import { useCanvasNavigation } from './useCanvasNavigation';
import { useGraphInteraction } from './useGraphInteraction';
import { useGraphKeyboardShortcuts } from './useGraphKeyboardShortcuts';
import { useGraphCuttingLine, type GraphEdgeForCutting } from './useGraphCuttingLine';

/** 协调演出图手势与选中状态；几何、持久化命令和视图分别维护。 */
export function usePresentationCanvas(graph: PresentationGraph, readOnly: boolean) {
  const { ui, project } = useEditorState();
  const dispatch = useEditorDispatch();

  const commands = createPresentationCommands(graph, dispatch);

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
  const edges = useMemo(
    () => presentationNodesToEdges(graph.nodes, graph.edgeProperties),
    [graph.nodes, graph.edgeProperties],
  );

  const multiSelectIds = ui.multiSelectPresentationNodeIds || [];

  // ========== 演出图校验 ==========
  const validationResults = useMemo(() => {
    return validatePresentationGraph(graph, project);
  }, [graph, project]);

  // ========== 工具函数 ==========
  const getLocalCoordinates = useCallback((clientX: number, clientY: number) => {
    if (!contentRef.current) return { x: 0, y: 0 };
    const rect = contentRef.current.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  // ========== Hooks ==========

  // 画布导航（平移/缩放）
  const { isPanningActive, handleMouseDown: handlePanMouseDown } = useCanvasNavigation({
    canvasRef,
  });

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
    getNodeDisplayPosition,
  } = useGraphInteraction({
    getNodes: () => graph.nodes,
    getContentOffset: getLocalCoordinates,
    nodeDimensions: PRESENTATION_NODE_DIMENSIONS,
    onNodeMove: commands.onNodeMove,
    onMultiNodeMove: commands.onMultiNodeMove,
    onLinkComplete: commands.onLinkComplete,
    onLinkUpdate: commands.onLinkUpdate,
    onLinkDelete: commands.onLinkDelete,
    onBoxSelectEnd: (selectedIds) => {
      // 修复：先设置 contextId（会清空多选），再设置多选列表
      if (selectedIds.length > 0) {
        dispatch({
          type: 'SELECT_OBJECT',
          payload: { type: 'PRESENTATION_NODE', id: selectedIds[0], contextId: graph.id },
        });
      }
      dispatch({ type: 'SET_MULTI_SELECT_PRESENTATION_NODES', payload: selectedIds });
    },
  });

  // 将虚拟边转换为剪线 Hook 需要的格式
  const edgesForCutting: GraphEdgeForCutting[] = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        fromNodeId: e.fromNodeId,
        toNodeId: e.toNodeId,
        fromSide: e.fromSide,
        toSide: e.toSide,
      })),
    [edges],
  );

  // 剪线逻辑
  const { cuttingLine, startCutting, isLineCuttingMode, setIsLineCuttingMode } =
    useGraphCuttingLine({
      getLocalCoordinates,
      edges: edgesForCutting,
      nodes: graph.nodes,
      getNodeDisplayPosition,
      onDeleteEdge: commands.onLinkDelete,
      nodeDimensions: PRESENTATION_NODE_DIMENSIONS,
      readOnly,
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
        payload: { graphId: graph.id, nodeId },
      });
    },
    onClearMultiSelect: () =>
      dispatch({ type: 'SET_MULTI_SELECT_PRESENTATION_NODES', payload: [] }),
    onSetLineCuttingMode: setIsLineCuttingMode,
    onSetLinkKeyActive: setIsLinkKeyActive,
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
    const isInsideContent = rect
      ? e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      : true;

    // 记录空白点击开始位置
    isBoxSelecting.current = true;
    blankClickStart.current = isInsideContent ? { x: e.clientX, y: e.clientY } : null;

    // 清空多选（如果没有按住 Ctrl）
    if (multiSelectIds.length > 0 && !e.ctrlKey && !e.metaKey) {
      dispatch({ type: 'SET_MULTI_SELECT_PRESENTATION_NODES', payload: [] });
    }

    startBoxSelect(e);
  };

  // 点击空白处选中演出图本身
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
        // 点击空白处：选中空对象 (Fallback 将由 Inspector 处理显示当前图属性)
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NONE', id: null } });
      }
      blankClickStart.current = null;
    }

    isBoxSelecting.current = false;
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    // 目标点击只结束当前连线，不能同时启动拖动，否则 mouseup 后会残留拖拽状态。
    if (linkingState || modifyingTransition) return;

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
        payload: { type: 'PRESENTATION_NODE', id: nodeId, contextId: graph.id },
      });
    }

    pendingNodeSelect.current = null;
    dragStartPos.current = null;
    dragMoved.current = false;
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    type: 'CANVAS' | 'NODE' | 'EDGE',
    targetId?: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly) return;

    const pos = getLocalCoordinates(e.clientX, e.clientY);
    setContextMenu({ x: pos.x, y: pos.y, type, targetId });
  };

  const handleAddNode = (type: PresentationNodeType) => {
    if (!contextMenu) return;

    commands.addNode(type, { x: contextMenu.x, y: contextMenu.y });
    setContextMenu(null);
  };

  const handleDeleteNode = (nodeId: string) => {
    dispatch({
      type: 'DELETE_PRESENTATION_NODE',
      payload: { graphId: graph.id, nodeId },
    });
    setContextMenu(null);
  };

  const handleSetStartNode = (nodeId: string) => {
    dispatch({
      type: 'UPDATE_PRESENTATION_GRAPH',
      payload: { graphId: graph.id, data: { startNodeId: nodeId } },
    });
    setContextMenu(null);
  };

  const handleEdgeSelect = (e: React.MouseEvent, edgeId: string) => {
    // 演出图的边不可独立选中，选中源节点
    const parts = edgeId.split('->edge:');
    if (parts[0]) {
      dispatch({
        type: 'SELECT_OBJECT',
        payload: { type: 'PRESENTATION_NODE', id: parts[0], contextId: graph.id },
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
  const handleEdgeHandleDown = (
    e: React.MouseEvent,
    edgeId: string,
    handle: 'source' | 'target',
  ) => {
    e.stopPropagation();
    if (readOnly) return;
    startModifyingTransition(e, edgeId, handle);
  };

  // ========== 菜单项配置（与 FSM 保持一致的结构） ==========
  const getMenuItems = (
    type: 'CANVAS' | 'NODE' | 'EDGE',
    targetId?: string,
  ): GraphMenuElement[] => {
    if (type === 'CANVAS') {
      return [
        {
          id: 'add-presentation',
          label: '+ Add Presentation Node',
          onClick: () => handleAddNode('PresentationNode'),
        },
        { id: 'add-wait', label: '+ Add Wait Node', onClick: () => handleAddNode('Wait') },
        { id: 'add-branch', label: '+ Add Branch Node', onClick: () => handleAddNode('Branch') },
        {
          id: 'add-parallel',
          label: '+ Add Parallel Node',
          onClick: () => handleAddNode('Parallel'),
        },
      ];
    }

    if (type === 'NODE' && targetId) {
      const isStartNode = graph.startNodeId === targetId;
      const items: GraphMenuElement[] = [];

      // 设为起始节点（与 FSM 的 Set as Initial State 对应）
      if (!isStartNode) {
        items.push({
          id: 'set-start',
          label: 'Set as Start Node',
          onClick: () => handleSetStartNode(targetId),
        });
      }

      // 创建连线（与 FSM 的 Create Transition 对应）
      items.push({
        id: 'create-link',
        label: 'Create Connection',
        onClick: () => {
          const node = graph.nodes[targetId];
          if (node && contextMenu) {
            const rect = contentRef.current?.getBoundingClientRect();
            startLinking(
              {
                clientX: contextMenu.x + (rect?.left ?? 0),
                clientY: contextMenu.y + (rect?.top ?? 0),
              },
              targetId,
            );
          }
          setContextMenu(null);
        },
      });

      // 分隔符 + 删除
      items.push({ type: 'separator' });
      items.push({
        id: 'delete-node',
        label: 'Delete Node',
        danger: true,
        onClick: () => handleDeleteNode(targetId),
      });

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
              id: 'delete-edge',
              label: 'Delete Connection',
              danger: true,
              onClick: () => {
                dispatch({
                  type: 'UNLINK_PRESENTATION_NODES',
                  payload: { graphId: graph.id, fromNodeId, toNodeId },
                });
                setContextMenu(null);
              },
            },
          ];
        }
      }
    }

    return [];
  };

  return {
    canvasRef,
    contentRef,
    contextMenu,
    setContextMenu,
    showShortcuts,
    setShowShortcuts,
    isLinkKeyActive,
    edges,
    multiSelectIds,
    validationResults,
    selection: ui.selection,
    isPanningActive,
    linkingState,
    modifyingTransition,
    activeSnapPoint,
    snapPoints,
    mousePos,
    boxSelectRect,
    getNodeDisplayPosition,
    cuttingLine,
    isLineCuttingMode,
    handleCanvasMouseDown,
    handleCanvasMouseUp,
    handleNodeMouseDown,
    handleNodeMouseUp,
    handleContextMenu,
    handleEdgeSelect,
    handleEdgeContextMenu,
    handleEdgeHandleDown,
    getMenuItems,
  };
}
export type PresentationCanvasModel = ReturnType<typeof usePresentationCanvas>;
