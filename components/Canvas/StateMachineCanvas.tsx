import React, { useRef, useState, useEffect } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { PuzzleNode } from '../../types/puzzleNode';
import { State, Transition } from '../../types/stateMachine';
import { Side } from '../../types/common';
import * as Geom from '../../utils/geometry';
import { useCanvasNavigation } from '../../hooks/useCanvasNavigation';
import { useGraphInteraction } from '../../hooks/useGraphInteraction';
import { StateNode } from './Elements/StateNode';
import { ConnectionLine, ConnectionControls } from './Elements/ConnectionLine';
import { CanvasContextMenu, ContextMenuState } from './Elements/CanvasContextMenu';
import { CanvasInfoOverlay, BoxSelectOverlay, SnapPointsLayer, CuttingLineOverlay } from './Elements/CanvasOverlays';
import { TempConnectionLine, ConnectionArrowMarkers } from './Elements/TempConnectionLine';

interface Props {
    node: PuzzleNode;
    readOnly?: boolean;
}

const CANVAS_SIZE = 4000;

export const StateMachineCanvas = ({ node, readOnly = false }: Props) => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();
    const canvasRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Ctrl+拖拽切线模式状态
    const [isLineCuttingMode, setIsLineCuttingMode] = useState(false);

    // 切线拖拽状态
    const [cuttingLine, setCuttingLine] = useState<{ start: { x: number, y: number }, end: { x: number, y: number } } | null>(null);
    const cuttingPrevPos = useRef<{ x: number, y: number } | null>(null);
    const cutTransitionsSet = useRef<Set<string>>(new Set()); // 记录已切断的连线ID

    // 延迟到鼠标抬起的选中请求，保持所有选中行为在同一时刻触发
    const pendingStateSelect = useRef<string | null>(null);
    const pendingCanvasSelect = useRef(false);
    const isBoxSelecting = useRef(false);
    const blankClickStart = useRef<{ x: number, y: number } | null>(null);
    // 记录节点点击的起点，用于判定是否为拖拽，拖拽状态下不改变选中
    const dragStartPos = useRef<{ x: number, y: number } | null>(null);
    const dragMoved = useRef(false);
    const DRAG_THRESHOLD = 4; // 鼠标移动超过该像素视为拖拽

    // 1. Navigation Logic
    const { isPanningActive, handleMouseDown: handlePanMouseDown } = useCanvasNavigation({ canvasRef });

    // 2. Utils
    const getLocalCoordinates = (clientX: number, clientY: number) => {
        if (!contentRef.current) return { x: 0, y: 0 };
        const rect = contentRef.current.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const fsm = project.stateMachines[node.stateMachineId];
    const multiSelectIds = ui.multiSelectStateIds || [];

    // 3. Interaction Logic (Hook)
    const {
        draggingNodeId, linkingState, modifyingTransition, activeSnapPoint, snapPoints, mousePos,
        boxSelectRect, isDraggingMultiple,
        startNodeDrag, startMultiNodeDrag, startLinking, startModifyingTransition,
        startBoxSelect, getNodeDisplayPosition
    } = useGraphInteraction({
        getNodes: () => fsm?.states || {},
        getContentOffset: getLocalCoordinates,
        onNodeMove: (id, pos) => dispatch({ type: 'UPDATE_STATE', payload: { fsmId: fsm.id, stateId: id, data: { position: pos } } }),
        onMultiNodeMove: (nodeIds, delta) => {
            // 批量更新所有选中节点的位置
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
            // Check duplicates
            if (Object.values(fsm.transitions).some((t: Transition) => t.fromStateId === sourceId && t.toStateId === targetId)) return;

            const sourcePos = getNodeDisplayPosition(sourceId, fsm.states[sourceId].position);
            const targetPos = fsm.states[targetId].position;
            const fromSide = options?.sourceSide || Geom.getClosestSide(sourcePos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, targetPos);
            const toSide = options?.targetSide || Geom.getClosestSide(targetPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, sourcePos);

            dispatch({
                type: 'ADD_TRANSITION',
                payload: {
                    fsmId: fsm.id,
                    transition: {
                        id: `trans-${Date.now()}`, name: 'Transition', fromStateId: sourceId, toStateId: targetId,
                        fromSide, toSide, condition: { type: 'LITERAL', value: true }, priority: 0,
                        triggers: [{ type: 'Always' }], parameterModifiers: []
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

    // 4. Context Menu State（使用导入的类型，关闭逻辑内置于 CanvasContextMenu 组件）
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    // Keyboard Delete (支持多选删除)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (readOnly) return;
                // 删除多选的节点
                if (multiSelectIds.length > 0) {
                    multiSelectIds.forEach(stateId => {
                        dispatch({ type: 'DELETE_STATE', payload: { fsmId: fsm.id, stateId } });
                    });
                    dispatch({ type: 'SET_MULTI_SELECT_STATES', payload: [] });
                    return;
                }

                if (ui.selection.type === 'STATE' && ui.selection.contextId === node.id && ui.selection.id) {
                    dispatch({ type: 'DELETE_STATE', payload: { fsmId: fsm.id, stateId: ui.selection.id } });
                } else if (ui.selection.type === 'TRANSITION' && ui.selection.contextId === node.id && ui.selection.id) {
                    dispatch({ type: 'DELETE_TRANSITION', payload: { fsmId: fsm.id, transitionId: ui.selection.id } });
                }
            }

            // Escape 取消多选
            if (e.key === 'Escape') {
                dispatch({ type: 'SET_MULTI_SELECT_STATES', payload: [] });
            }
        };

        // 监听 Ctrl 键用于切线模式
        const handleKeyDown2 = (e: KeyboardEvent) => {
            if (readOnly) return;
            if (e.key === 'Control') setIsLineCuttingMode(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsLineCuttingMode(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keydown', handleKeyDown2);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keydown', handleKeyDown2);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [ui.selection, fsm?.id, node.id, multiSelectIds]);

    // Handlers
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        pendingCanvasSelect.current = false;
        if (handlePanMouseDown(e)) return;
        if (e.button !== 0) return;
        if (e.button !== 0) return;
        if (readOnly) {
            // 只允许框选（如果是为了查看检查）或者平移
            // ReadOnly usually implies simpler interaction.
            // If we allow box selecting to see multi-inspector, keep it.
            // But disable cutting line.
        }
        else {
            if (linkingState || modifyingTransition) return;
        }

        if (readOnly) {
            // In ReadOnly, prevent cutting mode.
            // Allow Pan (handled above) and Box Select.
        } else {
            // Ctrl+左键拖动开始切线模式
            if (e.ctrlKey || e.metaKey) {
                const pos = getLocalCoordinates(e.clientX, e.clientY);
                setCuttingLine({ start: pos, end: pos });
                cuttingPrevPos.current = pos;
                cutTransitionsSet.current = new Set(); // 重置已切断记录
                return;
            }
        }

        const rect = contentRef.current?.getBoundingClientRect();
        const isInsideContent = rect ? (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) : true;

        // 左键点击空白区域开始框选，选中延迟到 mouseup；框选过程不应触发空白选中
        pendingCanvasSelect.current = false;
        isBoxSelecting.current = true;
        blankClickStart.current = isInsideContent ? { x: e.clientX, y: e.clientY } : null;
        startBoxSelect(e);
    };

    const handleCanvasMouseUp = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        // 切线或其他交互时不触发空白选中
        if (cuttingLine || linkingState || modifyingTransition) {
            pendingCanvasSelect.current = false;
            return;
        }

        if (isBoxSelecting.current) {
            return;
        }

        if (pendingCanvasSelect.current) {
            dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: node.id } });
            pendingCanvasSelect.current = false;
            return;
        }

        // 仅当按下时在空白区域（未走框选），抬起仍在空白区域且移动极小，才视为空白点击用于取消选中
        if (blankClickStart.current) {
            const dx = Math.abs(e.clientX - blankClickStart.current.x);
            const dy = Math.abs(e.clientY - blankClickStart.current.y);
            const CLICK_THRESHOLD = 3;
            if (dx <= CLICK_THRESHOLD && dy <= CLICK_THRESHOLD) {
                // 空白点击：回到当前节点上下文，清除状态/连线选中，保持画布可见
                dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: node.id } });
            }
            blankClickStart.current = null;
        }
    };

    // Ctrl+拖拽切线的鼠标移动处理
    useEffect(() => {
        if (!cuttingLine) return;

        const handleMouseMove = (e: MouseEvent) => {
            const pos = getLocalCoordinates(e.clientX, e.clientY);
            setCuttingLine(prev => prev ? { ...prev, end: pos } : null);

            // 检测与连线的交点（只记录，不立即删除）
            if (cuttingPrevPos.current && fsm) {
                const prevPos = cuttingPrevPos.current;

                Object.values(fsm.transitions).forEach((trans: Transition) => {
                    // 已经标记过的不再检测
                    if (cutTransitionsSet.current.has(trans.id)) return;

                    const fromState = fsm.states[trans.fromStateId];
                    const toState = fsm.states[trans.toStateId];
                    if (!fromState || !toState) return;

                    const fromPos = getNodeDisplayPosition(trans.fromStateId, fromState.position);
                    const toPos = getNodeDisplayPosition(trans.toStateId, toState.position);

                    const fromSide = trans.fromSide || Geom.getClosestSide(fromPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, toPos);
                    const toSide = trans.toSide || Geom.getClosestSide(toPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, fromPos);

                    const curveStart = Geom.getNodeAnchor(fromPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, fromSide);
                    const curveEnd = Geom.getNodeAnchor(toPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, toSide);

                    if (Geom.doesLineIntersectBezier(prevPos, pos, curveStart, curveEnd, fromSide, toSide)) {
                        cutTransitionsSet.current.add(trans.id); // 只记录，不删除
                    }
                });
            }

            cuttingPrevPos.current = pos;
        };

        const handleMouseUp = () => {
            // 释放鼠标时才执行删除
            if (fsm && cutTransitionsSet.current.size > 0) {
                cutTransitionsSet.current.forEach(transId => {
                    dispatch({ type: 'DELETE_TRANSITION', payload: { fsmId: fsm.id, transitionId: transId } });
                });
            }
            setCuttingLine(null);
            cuttingPrevPos.current = null;
            cutTransitionsSet.current = new Set();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [cuttingLine, fsm]);

    const handleStateMouseDown = (e: React.MouseEvent, stateId: string) => {
        e.stopPropagation();
        if (e.button !== 0) return;

        const isLinkInteraction = !readOnly && (e.shiftKey || Boolean(linkingState) || Boolean(modifyingTransition));

        // 先清空本次可能的延迟选中记录
        pendingStateSelect.current = null;
        dragMoved.current = false;
        dragStartPos.current = { x: e.clientX, y: e.clientY };

        // 如果点击的是多选中的节点，开始多节点拖拽 (仅非只读)
        if (multiSelectIds.includes(stateId) && !isLinkInteraction && !readOnly) {
            startMultiNodeDrag(e, multiSelectIds);
            return;
        }

        // 清除多选（除非按住Ctrl添加到多选）
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

        // 非连线或拖拽的单击选中在 mouseup 触发
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

    // 监听全局鼠标移动以判定拖拽距离，拖拽时不触发选中
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

    const handleContextMenu = (e: React.MouseEvent, type: 'CANVAS' | 'NODE' | 'TRANSITION', targetId?: string) => {
        e.preventDefault(); e.stopPropagation();
        if (readOnly) return;
        const pos = getLocalCoordinates(e.clientX, e.clientY);
        setContextMenu({ x: pos.x, y: pos.y, type, targetId });
    };

    if (!fsm) return <div className="empty-state">Missing Data</div>;

    return (
        <div ref={canvasRef} className="canvas-grid"
            style={{
                width: '100%', height: '100%', position: 'relative', overflow: 'auto',
                backgroundColor: '#18181b',
                cursor: isPanningActive ? 'grabbing' : (linkingState || modifyingTransition ? 'crosshair' : (boxSelectRect ? 'crosshair' : 'default'))
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseUp={handleCanvasMouseUp}
            onContextMenu={(e) => handleContextMenu(e, 'CANVAS')}
        >
            {/* 信息覆盖层 */}
            <CanvasInfoOverlay
                nodeName={node.name}
                multiSelectCount={multiSelectIds.length}
                isLineCuttingMode={isLineCuttingMode}
            />

            {/* 右键菜单 */}
            {contextMenu && (
                <CanvasContextMenu
                    menu={contextMenu}
                    onClose={() => setContextMenu(null)}
                    onAddState={(x, y) => dispatch({
                        type: 'ADD_STATE',
                        payload: {
                            fsmId: fsm.id,
                            state: { id: `state-${Date.now()}`, name: '新状态', position: { x, y }, eventListeners: [] }
                        }
                    })}
                    onSetInitial={(stateId) => dispatch({
                        type: 'UPDATE_FSM',
                        payload: { fsmId: fsm.id, data: { initialStateId: stateId } }
                    })}
                    onStartLink={(stateId, x, y) => startLinking({ clientX: x, clientY: y } as any, stateId)}
                    onDeleteState={(stateId) => dispatch({
                        type: 'DELETE_STATE',
                        payload: { fsmId: fsm.id, stateId }
                    })}
                    onDeleteTransition={(transitionId) => dispatch({
                        type: 'DELETE_TRANSITION',
                        payload: { fsmId: fsm.id, transitionId }
                    })}
                    isInitialState={contextMenu.type === 'NODE' && fsm.initialStateId === contextMenu.targetId}
                    contentRef={contentRef}
                />
            )}

            <div ref={contentRef} style={{ position: 'relative', minWidth: `${CANVAS_SIZE}px`, minHeight: `${CANVAS_SIZE}px` }}>
                {/* 框选区域 */}
                <BoxSelectOverlay rect={boxSelectRect} />

                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}>
                    {/* 箭头标记定义 */}
                    <ConnectionArrowMarkers />

                    {/* 1. Existing Connections */}
                    {Object.values(fsm.transitions).map((trans: Transition) => {
                        const isModifying = modifyingTransition?.id === trans.id;
                        const fromPos = getNodeDisplayPosition(trans.fromStateId, fsm.states[trans.fromStateId]?.position || { x: 0, y: 0 });
                        const toPos = getNodeDisplayPosition(trans.toStateId, fsm.states[trans.toStateId]?.position || { x: 0, y: 0 });

                        return (
                            <ConnectionLine
                                key={trans.id}
                                transition={trans}
                                fromState={fsm.states[trans.fromStateId]}
                                toState={fsm.states[trans.toStateId]}
                                isSelected={ui.selection.type === 'TRANSITION' && ui.selection.id === trans.id}
                                isContextTarget={contextMenu?.type === 'TRANSITION' && contextMenu?.targetId === trans.id}
                                isModifying={isModifying}
                                fromPos={fromPos}
                                toPos={toPos}
                                onSelect={(e, id) => dispatch({ type: 'SELECT_OBJECT', payload: { type: 'TRANSITION', id, contextId: node.id } })}
                                onContextMenu={(e, id) => handleContextMenu(e, 'TRANSITION', id)}
                                onHandleDown={(e, id, type) => {
                                    e.stopPropagation();
                                    startModifyingTransition(e, id, type);
                                }}
                                onCut={(e, id) => {
                                    dispatch({ type: 'DELETE_TRANSITION', payload: { fsmId: fsm.id, transitionId: id } });
                                }}
                            />
                        );
                    })}

                    {/* 2. Temporary / Dragging Line */}
                    {(linkingState || modifyingTransition) && (() => {
                        const mouseOrSnap = activeSnapPoint ? { x: activeSnapPoint.x, y: activeSnapPoint.y } : mousePos;

                        let p1 = mouseOrSnap;
                        let p2 = mouseOrSnap;
                        let sSide: Side = 'right';
                        let eSide: Side = 'left';

                        if (linkingState) {
                            const sourcePos = getNodeDisplayPosition(linkingState.nodeId, fsm.states[linkingState.nodeId].position);
                            sSide = Geom.getClosestSide(sourcePos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, mouseOrSnap);
                            p1 = Geom.getNodeAnchor(sourcePos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, sSide);
                            p2 = mouseOrSnap;
                            eSide = activeSnapPoint ? activeSnapPoint.side : Geom.getNaturalEnteringSide(p1, p2);
                        }
                        else if (modifyingTransition) {
                            const trans = fsm.transitions[modifyingTransition.id];

                            if (modifyingTransition.handle === 'target') {
                                const sourcePos = getNodeDisplayPosition(trans.fromStateId, fsm.states[trans.fromStateId].position);
                                sSide = trans.fromSide || Geom.getClosestSide(sourcePos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, mouseOrSnap);
                                p1 = Geom.getNodeAnchor(sourcePos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, sSide);

                                p2 = mouseOrSnap;
                                eSide = activeSnapPoint ? activeSnapPoint.side : Geom.getNaturalEnteringSide(p1, p2);
                            } else {
                                const destPos = getNodeDisplayPosition(trans.toStateId, fsm.states[trans.toStateId].position);
                                eSide = trans.toSide || Geom.getClosestSide(destPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, mouseOrSnap);
                                p2 = Geom.getNodeAnchor(destPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, eSide);

                                p1 = mouseOrSnap;
                                sSide = activeSnapPoint ? activeSnapPoint.side : Geom.getClosestSide({ x: p1.x - Geom.STATE_WIDTH / 2, y: p1.y - Geom.STATE_ESTIMATED_HEIGHT / 2 } as any, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, p2);
                            }
                        }

                        return <path d={Geom.getBezierPathData(p1, p2, sSide, eSide)} fill="none" stroke="#888" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrow-temp)" />;
                    })()}

                    {/* 3. 切线视觉 (Ctrl+拖拽) */}
                    <CuttingLineOverlay line={cuttingLine} />
                </svg>

                {/* 3. HTML Controls for Connections (Labels & Handles) */}
                {Object.values(fsm.transitions).map((trans: Transition) => {
                    if (modifyingTransition?.id === trans.id) return null;
                    const fromPos = getNodeDisplayPosition(trans.fromStateId, fsm.states[trans.fromStateId]?.position);
                    const toPos = getNodeDisplayPosition(trans.toStateId, fsm.states[trans.toStateId]?.position);
                    return (
                        <ConnectionControls
                            key={`ctrl-${trans.id}`}
                            transition={trans}
                            fromPos={fromPos}
                            toPos={toPos}
                            isSelected={ui.selection.type === 'TRANSITION' && ui.selection.id === trans.id}
                            isContextTarget={contextMenu?.type === 'TRANSITION' && contextMenu?.targetId === trans.id}
                            onSelect={(e, id) => dispatch({ type: 'SELECT_OBJECT', payload: { type: 'TRANSITION', id, contextId: node.id } })}
                            onContextMenu={(e, id) => handleContextMenu(e, 'TRANSITION', id)}
                            onHandleDown={(e, id, type) => {
                                e.stopPropagation();
                                startModifyingTransition(e, id, type);
                            }}
                            readOnly={readOnly}
                        />
                    );
                })}

                {/* 4. 吸附点提示层：连线/调整时展示所有锚点 */}
                <SnapPointsLayer
                    snapPoints={snapPoints}
                    activeSnapPoint={activeSnapPoint}
                    visible={Boolean(linkingState || modifyingTransition)}
                />

                {/* 5. State Nodes */}
                {Object.values(fsm.states).map((state: State) => (
                    <StateNode
                        key={state.id}
                        state={state}
                        position={getNodeDisplayPosition(state.id, state.position)}
                        isSelected={ui.selection.type === 'STATE' && ui.selection.id === state.id}
                        isMultiSelected={multiSelectIds.includes(state.id)}
                        isInitial={fsm.initialStateId === state.id}
                        isContextTarget={contextMenu?.type === 'NODE' && contextMenu?.targetId === state.id}
                        onMouseDown={handleStateMouseDown}
                        onMouseUp={handleStateMouseUp}
                        onContextMenu={(e) => handleContextMenu(e, 'NODE', state.id)}
                        readOnly={readOnly}
                    />
                ))}
            </div>
            <style>{` .ctx-item { padding: 8px 12px; font-size: 13px; cursor: pointer; color: #eee; } .ctx-item:hover { background: #3e3e42; } .ctx-item.danger { color: #ff6b6b; } .handle { position: absolute; width: 12px; height: 12px; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255,255,255,0.5); border-radius: 50%; transform: translate(-50%, -50%); cursor: grab; opacity: 0; transition: opacity 0.2s, background 0.2s; } .handle:hover { opacity: 1; background: var(--accent-color); border-color: #fff; } `}</style>
        </div>
    );
};
