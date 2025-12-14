/**
 * StateMachineCanvas.tsx - FSM 画布主组件
 * 重构后：将复杂逻辑拆分到独立的 hooks 和子组件中
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { PuzzleNode } from '../../types/puzzleNode';
import { Transition } from '../../types/stateMachine';
import { Side } from '../../types/common';
import * as Geom from '../../utils/geometry';
import { CANVAS, INTERACTION } from '../../utils/constants';
import { devLog } from '../../utils/debug';
import { generateStateId, generateTransitionId } from '../../utils/resourceIdGenerator';
import { useCanvasNavigation } from '../../hooks/useCanvasNavigation';
import { useGraphInteraction } from '../../hooks/useGraphInteraction';
import { useCuttingLine } from '../../hooks/useCuttingLine';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { CanvasContextMenu, ContextMenuState } from './Elements/CanvasContextMenu';
import { CanvasInfoOverlay, BoxSelectOverlay, SnapPointsLayer, CuttingLineOverlay, ShortcutPanel } from './Elements/CanvasOverlays';
import { ConnectionArrowMarkers } from './Elements/TempConnectionLine';
import { TransitionsSvgLayer, TempConnectionLine, TransitionsControlsLayer } from './Elements/TransitionsLayer';
import { StatesLayer } from './Elements/StatesLayer';
import { validateStateMachine } from '../../utils/fsmValidation';

// ========== 常量（使用统一定义） ==========
const CANVAS_SIZE = CANVAS.SIZE;
const DRAG_THRESHOLD = INTERACTION.DRAG_THRESHOLD;
const CLICK_THRESHOLD = INTERACTION.CLICK_THRESHOLD;

// ========== Props ==========
interface Props {
    node: PuzzleNode;
    readOnly?: boolean;
}

/**
 * FSM 画布主组件
 * 职责：组装各子模块，管理顶层状态和事件分发
 */
export const StateMachineCanvas = ({ node, readOnly = false }: Props) => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();
    const editorState = useEditorState();

    // ========== Refs ==========
    const canvasRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const lastNodeIdRef = useRef<string | null>(null);

    // 选中和拖拽状态
    const pendingStateSelect = useRef<string | null>(null);
    const pendingCanvasSelect = useRef(false);
    const isBoxSelecting = useRef(false);
    const blankClickStart = useRef<{ x: number; y: number } | null>(null);
    const dragStartPos = useRef<{ x: number; y: number } | null>(null);
    const dragMoved = useRef(false);

    // ========== Local State ==========
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [isLinkKeyActive, setIsLinkKeyActive] = useState(false);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    // ========== Derived Data ==========
    const fsm = project.stateMachines[node.stateMachineId];
    const multiSelectIds = ui.multiSelectStateIds || [];

    // ========== Utils ==========
    const getLocalCoordinates = useCallback((clientX: number, clientY: number) => {
        if (!contentRef.current) return { x: 0, y: 0 };
        const rect = contentRef.current.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }, []);

    // ========== Hooks ==========

    // 1. 画布导航（平移/缩放）
    const { isPanningActive, handleMouseDown: handlePanMouseDown } = useCanvasNavigation({ canvasRef });

    // 2. 图形交互（拖拽/连线/框选）
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
        getNodes: () => fsm?.states || {},
        getContentOffset: getLocalCoordinates,
        onNodeMove: (id, pos) => dispatch({ type: 'UPDATE_STATE', payload: { fsmId: fsm.id, stateId: id, data: { position: pos } } }),
        onMultiNodeMove: (nodeIds, delta) => {
            nodeIds.forEach(id => {
                const state = fsm.states[id];
                if (state) {
                    dispatch({
                        type: 'UPDATE_STATE',
                        payload: {
                            fsmId: fsm.id,
                            stateId: id,
                            data: { position: { x: state.position.x + delta.dx, y: state.position.y + delta.dy } }
                        }
                    });
                }
            });
        },
        onLinkComplete: (sourceId, targetId, options) => {
            // 重复连接保护
            if (Object.values(fsm.transitions).some((t: Transition) => t.fromStateId === sourceId && t.toStateId === targetId)) return;

            const sourcePos = getNodeDisplayPosition(sourceId, fsm.states[sourceId].position);
            const targetPos = fsm.states[targetId].position;
            const fromSide = options?.sourceSide || Geom.getClosestSide(sourcePos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, targetPos);
            const toSide = options?.targetSide || Geom.getClosestSide(targetPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, sourcePos);

            // 使用"资源类型_计数器"格式生成 ID
            const transitionId = generateTransitionId(Object.keys(fsm.transitions));

            dispatch({
                type: 'ADD_TRANSITION',
                payload: {
                    fsmId: fsm.id,
                    transition: {
                        id: transitionId,
                        name: 'Transition',
                        fromStateId: sourceId,
                        toStateId: targetId,
                        fromSide,
                        toSide,
                        condition: { type: 'LITERAL', value: true },
                        priority: 0,
                        triggers: [{ type: 'Always' }],
                        parameterModifiers: []
                    }
                }
            });
        },
        onLinkUpdate: (transId, handle, targetId, side) => {
            const trans = fsm.transitions[transId];
            const data: any = {};

            if (handle === 'target') {
                data.toStateId = targetId;
                data.toSide = side;
            } else {
                data.fromStateId = targetId;
                data.fromSide = side;
            }

            if (!side) {
                const staticId = handle === 'target' ? trans.fromStateId : trans.toStateId;
                const staticPos = fsm.states[staticId].position;
                const movingPos = fsm.states[targetId].position;
                const autoSide = Geom.getClosestSide(movingPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, staticPos);
                if (handle === 'target') data.toSide = autoSide;
                else data.fromSide = autoSide;
            }

            dispatch({ type: 'UPDATE_TRANSITION', payload: { fsmId: fsm.id, transitionId: transId, data } });
        },
        onLinkDelete: (transId) => {
            dispatch({ type: 'DELETE_TRANSITION', payload: { fsmId: fsm.id, transitionId: transId } });
        },
        onBoxSelectEnd: (selectedIds) => {
            dispatch({ type: 'SET_MULTI_SELECT_STATES', payload: selectedIds });
            isBoxSelecting.current = false;
            pendingCanvasSelect.current = false;
        }
    });

    // 3. 剪线逻辑
    const {
        cuttingLine,
        startCutting,
        isLineCuttingMode,
        setIsLineCuttingMode
    } = useCuttingLine({
        getLocalCoordinates,
        transitions: fsm?.transitions || {},
        states: fsm?.states || {},
        getNodeDisplayPosition,
        onDeleteTransition: (transId) => dispatch({ type: 'DELETE_TRANSITION', payload: { fsmId: fsm.id, transitionId: transId } }),
        readOnly
    });

    // 4. 键盘快捷键
    useKeyboardShortcuts({
        fsmId: fsm?.id || '',
        nodeId: node.id,
        multiSelectIds,
        selection: ui.selection,
        readOnly,
        onDeleteState: (stateId) => dispatch({ type: 'DELETE_STATE', payload: { fsmId: fsm.id, stateId } }),
        onDeleteTransition: (transId) => dispatch({ type: 'DELETE_TRANSITION', payload: { fsmId: fsm.id, transitionId: transId } }),
        onClearMultiSelect: () => dispatch({ type: 'SET_MULTI_SELECT_STATES', payload: [] }),
        onSetLineCuttingMode: setIsLineCuttingMode,
        onSetLinkKeyActive: setIsLinkKeyActive
    });

    // ========== FSM 校验 ==========
    const validationResult = useMemo(() => {
        if (!fsm) return { states: {}, transitions: {}, hasInitialState: true };
        return validateStateMachine(fsm.id, editorState, node.id);
    }, [fsm, editorState, node.id]);

    // ========== Effects ==========

    // 进入状态机画布时，默认选中当前 PuzzleNode
    useEffect(() => {
        if (lastNodeIdRef.current !== node.id) {
            lastNodeIdRef.current = node.id;
            dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: node.id } });
        }
    }, [node.id, dispatch]);

    // 监听全局鼠标移动判断是否进入拖拽状态
    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            if (!pendingStateSelect.current || !dragStartPos.current) return;
            const dx = Math.abs(e.clientX - dragStartPos.current.x);
            const dy = Math.abs(e.clientY - dragStartPos.current.y);
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

    // ========== Event Handlers ==========

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        pendingCanvasSelect.current = false;
        if (handlePanMouseDown(e)) return;
        if (e.button !== 0) return;

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

        pendingCanvasSelect.current = false;
        isBoxSelecting.current = true;
        blankClickStart.current = isInsideContent ? { x: e.clientX, y: e.clientY } : null;
        startBoxSelect(e);
    };

    const handleCanvasMouseUp = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if (cuttingLine || linkingState || modifyingTransition) {
            pendingCanvasSelect.current = false;
            return;
        }

        if (isBoxSelecting.current) return;

        if (pendingCanvasSelect.current) {
            dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: node.id } });
            pendingCanvasSelect.current = false;
            return;
        }

        // 空白点击选中 PuzzleNode
        if (blankClickStart.current) {
            const dx = Math.abs(e.clientX - blankClickStart.current.x);
            const dy = Math.abs(e.clientY - blankClickStart.current.y);
            if (dx <= CLICK_THRESHOLD && dy <= CLICK_THRESHOLD) {
                dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: node.id } });
            }
            blankClickStart.current = null;
        }
    };

    const handleStateMouseDown = (e: React.MouseEvent, stateId: string) => {
        e.stopPropagation();
        if (e.button !== 0) return;

        const isLinkInteraction = !readOnly && (e.shiftKey || Boolean(linkingState) || Boolean(modifyingTransition));

        pendingStateSelect.current = null;
        dragMoved.current = false;
        dragStartPos.current = { x: e.clientX, y: e.clientY };

        if (multiSelectIds.includes(stateId) && !isLinkInteraction && !readOnly) {
            startMultiNodeDrag(e, multiSelectIds);
            return;
        }

        if (multiSelectIds.length > 0 && !e.ctrlKey && !e.metaKey) {
            dispatch({ type: 'SET_MULTI_SELECT_STATES', payload: [] });
        }

        if (e.shiftKey && !readOnly) {
            startLinking(e, stateId);
            return;
        }

        if (!linkingState && !modifyingTransition && !readOnly) {
            startNodeDrag(e, stateId, fsm.states[stateId].position);
            pendingStateSelect.current = stateId;
        } else if (readOnly) {
            pendingStateSelect.current = stateId;
        }

        if (!isLinkInteraction && !pendingStateSelect.current) {
            pendingStateSelect.current = stateId;
        }
    };

    const handleStateMouseUp = (e: React.MouseEvent, stateId: string) => {
        e.stopPropagation();
        if (e.button !== 0) return;

        if (pendingStateSelect.current === stateId && !linkingState && !modifyingTransition && !dragMoved.current) {
            dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STATE', id: stateId, contextId: node.id } });
        }

        pendingStateSelect.current = null;
        dragStartPos.current = null;
        dragMoved.current = false;
    };

    const handleContextMenu = (e: React.MouseEvent, type: 'CANVAS' | 'NODE' | 'TRANSITION', targetId?: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (readOnly) return;
        const pos = getLocalCoordinates(e.clientX, e.clientY);
        setContextMenu({ x: pos.x, y: pos.y, type, targetId });
    };

    const handleTransitionSelect = (e: React.MouseEvent, id: string) => {
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'TRANSITION', id, contextId: node.id } });
    };

    const handleTransitionContextMenu = (e: React.MouseEvent, id: string) => {
        handleContextMenu(e, 'TRANSITION', id);
    };

    const handleTransitionHandleDown = (e: React.MouseEvent, id: string, type: 'source' | 'target') => {
        e.stopPropagation();
        startModifyingTransition(e, id, type);
    };

    const handleTransitionCut = (e: React.MouseEvent, id: string) => {
        dispatch({ type: 'DELETE_TRANSITION', payload: { fsmId: fsm.id, transitionId: id } });
    };

    // ========== Render ==========

    if (!fsm) {
        return <div className="empty-state">Missing Data</div>;
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            {/* 信息覆盖层 */}
            <CanvasInfoOverlay
                nodeName={node.name}
                multiSelectCount={multiSelectIds.length}
                isLineCuttingMode={isLineCuttingMode}
                isLinkMode={Boolean(linkingState) || isLinkKeyActive}
                isPanMode={isPanningActive}
                hasNoInitialState={!validationResult.hasInitialState}
            />
            <ShortcutPanel visible={showShortcuts} onToggle={() => setShowShortcuts(v => !v)} />

            {/* 主画布区域 */}
            <div
                ref={canvasRef}
                className="canvas-grid"
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    overflow: 'auto',
                    backgroundColor: '#18181b',
                    cursor: isPanningActive
                        ? 'grabbing'
                        : linkingState || modifyingTransition
                            ? 'crosshair'
                            : boxSelectRect
                                ? 'crosshair'
                                : 'default'
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onContextMenu={(e) => handleContextMenu(e, 'CANVAS')}
            >
                {/* 右键菜单 */}
                {contextMenu && (
                    <CanvasContextMenu
                        menu={contextMenu}
                        onClose={() => setContextMenu(null)}
                        onAddState={(x, y) => {
                            // 使用"资源类型_计数器"格式生成 ID
                            const stateId = generateStateId(Object.keys(fsm.states));
                            dispatch({
                                type: 'ADD_STATE',
                                payload: {
                                    fsmId: fsm.id,
                                    state: { id: stateId, name: 'New State', position: { x, y }, eventListeners: [] }
                                }
                            });
                        }}
                        onSetInitial={(stateId) =>
                            dispatch({
                                type: 'UPDATE_FSM',
                                payload: { fsmId: fsm.id, data: { initialStateId: stateId } }
                            })
                        }
                        onStartLink={(stateId, x, y) => startLinking({ clientX: x, clientY: y } as any, stateId)}
                        onDeleteState={(stateId) =>
                            dispatch({
                                type: 'DELETE_STATE',
                                payload: { fsmId: fsm.id, stateId }
                            })
                        }
                        onDeleteTransition={(transitionId) =>
                            dispatch({
                                type: 'DELETE_TRANSITION',
                                payload: { fsmId: fsm.id, transitionId }
                            })
                        }
                        isInitialState={contextMenu.type === 'NODE' && fsm.initialStateId === contextMenu.targetId}
                        contentRef={contentRef}
                    />
                )}

                {/* 画布内容区域 */}
                <div ref={contentRef} style={{ position: 'relative', minWidth: `${CANVAS_SIZE}px`, minHeight: `${CANVAS_SIZE}px` }}>
                    {/* 框选区域 */}
                    <BoxSelectOverlay rect={boxSelectRect} />

                    {/* SVG 层：连线 + 临时连线 + 剪线 */}
                    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}>
                        <ConnectionArrowMarkers />

                        {/* 现有连线 */}
                        <TransitionsSvgLayer
                            transitions={fsm.transitions}
                            states={fsm.states}
                            modifyingTransition={modifyingTransition}
                            getNodeDisplayPosition={getNodeDisplayPosition}
                            selection={ui.selection}
                            contextMenuTarget={contextMenu}
                            validationResults={validationResult.transitions}
                            nodeId={node.id}
                            onSelect={handleTransitionSelect}
                            onContextMenu={handleTransitionContextMenu}
                            onHandleDown={handleTransitionHandleDown}
                            onCut={handleTransitionCut}
                        />

                        {/* 临时连线 */}
                        <TempConnectionLine
                            linkingState={linkingState}
                            modifyingTransition={modifyingTransition}
                            transitions={fsm.transitions}
                            states={fsm.states}
                            activeSnapPoint={activeSnapPoint}
                            mousePos={mousePos}
                            getNodeDisplayPosition={getNodeDisplayPosition}
                        />

                        {/* 剪线视觉 */}
                        <CuttingLineOverlay line={cuttingLine} />
                    </svg>

                    {/* HTML 控件层：连线标签和手柄 */}
                    <TransitionsControlsLayer
                        transitions={fsm.transitions}
                        states={fsm.states}
                        modifyingTransition={modifyingTransition}
                        getNodeDisplayPosition={getNodeDisplayPosition}
                        selection={ui.selection}
                        contextMenuTarget={contextMenu}
                        validationResults={validationResult.transitions}
                        nodeId={node.id}
                        readOnly={readOnly}
                        onSelect={handleTransitionSelect}
                        onContextMenu={handleTransitionContextMenu}
                        onHandleDown={handleTransitionHandleDown}
                    />

                    {/* 吸附点提示层 */}
                    <SnapPointsLayer snapPoints={snapPoints} activeSnapPoint={activeSnapPoint} visible={Boolean(linkingState || modifyingTransition)} />

                    {/* 状态节点层 */}
                    <StatesLayer
                        states={fsm.states}
                        initialStateId={fsm.initialStateId}
                        multiSelectIds={multiSelectIds}
                        selection={ui.selection}
                        contextMenuTarget={contextMenu}
                        validationResults={validationResult.states}
                        readOnly={readOnly}
                        getNodeDisplayPosition={getNodeDisplayPosition}
                        onMouseDown={handleStateMouseDown}
                        onMouseUp={handleStateMouseUp}
                        onContextMenu={(e, stateId) => handleContextMenu(e, 'NODE', stateId)}
                    />
                </div>

            </div>
        </div>
    );
};
