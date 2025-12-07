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

interface Props {
    node: PuzzleNode;
}

const CANVAS_SIZE = 4000;

export const StateMachineCanvas = ({ node }: Props) => {
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
        draggingNodeId, linkingState, modifyingTransition, activeSnapPoint, mousePos,
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
        onLinkComplete: (sourceId, targetId, side) => {
            // Check duplicates
            if (Object.values(fsm.transitions).some((t: Transition) => t.fromStateId === sourceId && t.toStateId === targetId)) return;

            const sourcePos = getNodeDisplayPosition(sourceId, fsm.states[sourceId].position);
            const targetPos = fsm.states[targetId].position;
            const fromSide = Geom.getClosestSide(sourcePos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, targetPos);

            dispatch({
                type: 'ADD_TRANSITION',
                payload: {
                    fsmId: fsm.id,
                    transition: {
                        id: `trans-${Date.now()}`, name: 'Transition', fromStateId: sourceId, toStateId: targetId,
                        fromSide, toSide: side, condition: { type: 'LITERAL', value: true }, priority: 0
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
        }
    });

    // 4. Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'CANVAS' | 'NODE' | 'TRANSITION'; targetId?: string; } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Global Context Menu Close
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (contextMenu) {
                if (menuRef.current && menuRef.current.contains(e.target as Node)) {
                    return;
                }
                setContextMenu(null);
                e.stopPropagation();
            }
        };
        window.addEventListener('mousedown', handleMouseDown, { capture: true });
        return () => window.removeEventListener('mousedown', handleMouseDown, { capture: true });
    }, [contextMenu]);

    // Keyboard Delete (支持多选删除)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
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
        if (handlePanMouseDown(e)) return;
        if (e.button !== 0) return;
        if (linkingState || modifyingTransition) return;

        // Ctrl+左键拖动开始切线模式
        if (e.ctrlKey || e.metaKey) {
            const pos = getLocalCoordinates(e.clientX, e.clientY);
            setCuttingLine({ start: pos, end: pos });
            cuttingPrevPos.current = pos;
            cutTransitionsSet.current = new Set(); // 重置已切断记录
            return;
        }

        // 左键点击空白区域开始框选
        startBoxSelect(e);
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: node.id } });
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

        const isLinkInteraction = e.shiftKey || Boolean(linkingState) || Boolean(modifyingTransition);

        // 如果点击的是多选中的节点，开始多节点拖拽
        if (multiSelectIds.includes(stateId) && !isLinkInteraction) {
            startMultiNodeDrag(e, multiSelectIds);
            return;
        }

        // 清除多选（除非按住Ctrl添加到多选）
        if (multiSelectIds.length > 0 && !e.ctrlKey && !e.metaKey) {
            dispatch({ type: 'SET_MULTI_SELECT_STATES', payload: [] });
        }

        if (!isLinkInteraction) {
            dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STATE', id: stateId, contextId: node.id } });
        }

        if (e.shiftKey) {
            startLinking(e, stateId);
            return;
        }

        if (!linkingState && !modifyingTransition) {
            startNodeDrag(e, stateId, fsm.states[stateId].position);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, type: 'CANVAS' | 'NODE' | 'TRANSITION', targetId?: string) => {
        e.preventDefault(); e.stopPropagation();
        const pos = getLocalCoordinates(e.clientX, e.clientY);
        setContextMenu({ x: pos.x, y: pos.y, type, targetId });
    };

    if (!fsm) return <div className="empty-state">Missing Data</div>;

    // 计算框选区域样式
    const boxSelectStyle = boxSelectRect ? {
        position: 'absolute' as const,
        left: Math.min(boxSelectRect.startX, boxSelectRect.endX),
        top: Math.min(boxSelectRect.startY, boxSelectRect.endY),
        width: Math.abs(boxSelectRect.endX - boxSelectRect.startX),
        height: Math.abs(boxSelectRect.endY - boxSelectRect.startY),
        border: '1px dashed var(--accent-color)',
        backgroundColor: 'rgba(79, 193, 255, 0.1)',
        pointerEvents: 'none' as const,
        zIndex: 50
    } : null;

    return (
        <div ref={canvasRef} className="canvas-grid"
            style={{
                width: '100%', height: '100%', position: 'relative', overflow: 'auto',
                backgroundColor: '#121212',
                cursor: isPanningActive ? 'grabbing' : (linkingState || modifyingTransition ? 'crosshair' : (boxSelectRect ? 'crosshair' : 'default'))
            }}
            onMouseDown={handleCanvasMouseDown}
            onContextMenu={(e) => handleContextMenu(e, 'CANVAS')}
        >
            {/* Info Overlay - 使用 fixed 高度防止内容变化导致布局偏移 */}
            <div style={{ position: 'sticky', top: 20, left: 20, zIndex: 100, pointerEvents: 'none', height: 0, overflow: 'visible' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', display: 'inline-block' }}>
                    <div style={{ fontSize: '10px', color: '#888' }}>FSM EDITOR</div>
                    <div style={{ fontSize: '14px', color: '#eee', fontWeight: 600 }}>{node.name}</div>
                    {multiSelectIds.length > 0 && (
                        <div style={{ fontSize: '10px', color: 'var(--accent-color)', marginTop: '4px' }}>
                            {multiSelectIds.length} node{multiSelectIds.length > 1 ? 's' : ''} selected
                        </div>
                    )}
                    {isLineCuttingMode && (
                        <div style={{ fontSize: '10px', color: '#ff6b6b', marginTop: '4px' }}>
                            ✂ Line cutting mode (Ctrl+Click)
                        </div>
                    )}
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div ref={menuRef}
                    style={{ position: 'absolute', top: contextMenu.y, left: contextMenu.x, zIndex: 9999, backgroundColor: '#252526', border: '1px solid #444', minWidth: '140px' }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {contextMenu.type === 'CANVAS' && <div className="ctx-item" onClick={() => { dispatch({ type: 'ADD_STATE', payload: { fsmId: fsm.id, state: { id: `state-${Date.now()}`, name: 'New State', position: { x: contextMenu.x, y: contextMenu.y }, onEnterScriptIds: [], onExitScriptIds: [], onUpdateScriptIds: [], transitionIds: [] } } }); setContextMenu(null); }}>+ Add State</div>}
                    {contextMenu.type === 'NODE' && (
                        <>
                            {fsm.initialStateId !== contextMenu.targetId && <div className="ctx-item" onClick={() => { dispatch({ type: 'UPDATE_FSM', payload: { fsmId: fsm.id, data: { initialStateId: contextMenu.targetId } } }); setContextMenu(null); }}>🏁 Set Initial</div>}
                            <div className="ctx-item" onClick={(e) => { startLinking({ clientX: contextMenu.x + contentRef.current!.getBoundingClientRect().left, clientY: contextMenu.y + contentRef.current!.getBoundingClientRect().top } as any, contextMenu.targetId!); setContextMenu(null); }}>🔗 Link</div>
                            <div className="ctx-item danger" onClick={() => { dispatch({ type: 'DELETE_STATE', payload: { fsmId: fsm.id, stateId: contextMenu.targetId! } }); setContextMenu(null); }}>🗑 Delete</div>
                        </>
                    )}
                    {contextMenu.type === 'TRANSITION' && <div className="ctx-item danger" onClick={() => { dispatch({ type: 'DELETE_TRANSITION', payload: { fsmId: fsm.id, transitionId: contextMenu.targetId! } }); setContextMenu(null); }}>🗑 Delete</div>}
                </div>
            )}

            <div ref={contentRef} style={{ position: 'relative', minWidth: `${CANVAS_SIZE}px`, minHeight: `${CANVAS_SIZE}px` }}>
                {/* 框选区域 */}
                {boxSelectStyle && <div style={boxSelectStyle} />}

                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}>
                    <defs>
                        <marker id="arrow-normal" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#666" /></marker>
                        <marker id="arrow-selected" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="var(--accent-color)" /></marker>
                        <marker id="arrow-context" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="var(--accent-warning)" /></marker>
                        <marker id="arrow-temp" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#888" fillOpacity="0.8" /></marker>
                    </defs>

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

                    {/* 3. Cutting Line Visual (Ctrl+拖拽切线) */}
                    {cuttingLine && (
                        <line
                            x1={cuttingLine.start.x}
                            y1={cuttingLine.start.y}
                            x2={cuttingLine.end.x}
                            y2={cuttingLine.end.y}
                            stroke="#ff6b6b"
                            strokeWidth="2"
                            strokeDasharray="6,4"
                            style={{ pointerEvents: 'none' }}
                        />
                    )}
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
                        />
                    );
                })}

                {/* 4. Snap Points Overlay */}
                {(linkingState || modifyingTransition) && activeSnapPoint && (
                    <div style={{
                        position: 'absolute', left: activeSnapPoint.x, top: activeSnapPoint.y,
                        width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--accent-color)',
                        transform: 'translate(-50%, -50%)', zIndex: 35, pointerEvents: 'none'
                    }} />
                )}

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
                        onContextMenu={(e) => handleContextMenu(e, 'NODE', state.id)}
                    />
                ))}
            </div>
            <style>{` .ctx-item { padding: 8px 12px; font-size: 13px; cursor: pointer; color: #eee; } .ctx-item:hover { background: #3e3e42; } .ctx-item.danger { color: #ff6b6b; } .handle { position: absolute; width: 12px; height: 12px; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255,255,255,0.5); border-radius: 50%; transform: translate(-50%, -50%); cursor: grab; opacity: 0; transition: opacity 0.2s, background 0.2s; } .handle:hover { opacity: 1; background: var(--accent-color); border-color: #fff; } `}</style>
        </div>
    );
};