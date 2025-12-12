// @ts-nocheck
import React, { useRef, useState, useEffect } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import * as Geom from '../../utils/geometry';
import { useCanvasNavigation } from '../../hooks/useCanvasNavigation';
import { useGraphInteraction } from '../../hooks/useGraphInteraction';
import { StateNode } from './Elements/StateNode';
import { ConnectionLine, ConnectionControls } from './Elements/ConnectionLine';
import { CanvasContextMenu } from './Elements/CanvasContextMenu';
import { CanvasInfoOverlay, BoxSelectOverlay, SnapPointsLayer, CuttingLineOverlay, ShortcutPanel } from './Elements/CanvasOverlays';
import { ConnectionArrowMarkers } from './Elements/TempConnectionLine';
const CANVAS_SIZE = 4000;
export const StateMachineCanvas = ({ node, readOnly = false }) => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();
    const canvasRef = useRef(null);
    const contentRef = useRef(null);
    const lastNodeIdRef = useRef(null);
    // 剪线模式开关（按下 Ctrl 提示开启剪线）
    const [isLineCuttingMode, setIsLineCuttingMode] = useState(false);
    // 快捷键帮助面板开关
    const [showShortcuts, setShowShortcuts] = useState(true);
    // 剪线拖拽状态：记录起点/终点与前一帧位置
    const [cuttingLine, setCuttingLine] = useState(null);
    const cuttingPrevPos = useRef(null);
    const cutTransitionsSet = useRef(new Set()); // 记录已剪断的连线ID
    // 将选中动作延迟到鼠标抬起，保证同一帧内交互顺序一致
    const pendingStateSelect = useRef(null);
    const pendingCanvasSelect = useRef(false);
    const isBoxSelecting = useRef(false);
    const blankClickStart = useRef(null);
    // 记录节点点击的起点，用于判断是否为拖拽，拖拽中不改变选中
    const dragStartPos = useRef(null);
    const dragMoved = useRef(false);
    const DRAG_THRESHOLD = 4; // 鼠标移动超过该像素视为拖拽
    // 1. Navigation Logic
    const { isPanningActive, handleMouseDown: handlePanMouseDown } = useCanvasNavigation({ canvasRef });
    // 2. Utils
    const getLocalCoordinates = (clientX, clientY) => {
        if (!contentRef.current)
            return { x: 0, y: 0 };
        const rect = contentRef.current.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const fsm = project.stateMachines[node.stateMachineId];
    const multiSelectIds = ui.multiSelectStateIds || [];
    // 进入状态机画布时，默认选中当前 PuzzleNode，满足“下钻后默认选中节点”需求
    useEffect(() => {
        if (lastNodeIdRef.current !== node.id) {
            lastNodeIdRef.current = node.id;
            dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: node.id } });
        }
    }, [node.id, dispatch]);
    // 3. Interaction Logic (Hook)
    const { draggingNodeId, linkingState, modifyingTransition, activeSnapPoint, snapPoints, mousePos, boxSelectRect, isDraggingMultiple, startNodeDrag, startMultiNodeDrag, startLinking, startModifyingTransition, startBoxSelect, getNodeDisplayPosition } = useGraphInteraction({
        getNodes: () => fsm?.states || {},
        getContentOffset: getLocalCoordinates,
        onNodeMove: (id, pos) => dispatch({ type: 'UPDATE_STATE', payload: { fsmId: fsm.id, stateId: id, data: { position: pos } } }),
        onMultiNodeMove: (nodeIds, delta) => {
            // 批量更新所有已选节点的位置
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
            if (Object.values(fsm.transitions).some((t) => t.fromStateId === sourceId && t.toStateId === targetId))
                return;
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
            const data = {};
            if (handle === 'target') {
                data.toStateId = targetId;
                data.toSide = side;
            }
            else {
                data.fromStateId = targetId;
                data.fromSide = side;
            }
            if (!side) {
                const staticId = handle === 'target' ? trans.fromStateId : trans.toStateId;
                const staticPos = fsm.states[staticId].position;
                const movingPos = fsm.states[targetId].position;
                const autoSide = Geom.getClosestSide(movingPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, staticPos);
                if (handle === 'target')
                    data.toSide = autoSide;
                else
                    data.fromSide = autoSide;
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
    // 4. Context Menu State（右键菜单的开关与目标）
    const [contextMenu, setContextMenu] = useState(null);
    // Keyboard Delete（支持多选批量删除）+ Ctrl 剪线提示
    useEffect(() => {
        const handleKeyDown = (e) => {
            const target = e.target;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
                return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (readOnly)
                    return;
                if (multiSelectIds.length > 0) {
                    multiSelectIds.forEach(stateId => {
                        dispatch({ type: 'DELETE_STATE', payload: { fsmId: fsm.id, stateId } });
                    });
                    dispatch({ type: 'SET_MULTI_SELECT_STATES', payload: [] });
                    return;
                }
                if (ui.selection.type === 'STATE' && ui.selection.contextId === node.id && ui.selection.id) {
                    dispatch({ type: 'DELETE_STATE', payload: { fsmId: fsm.id, stateId: ui.selection.id } });
                }
                else if (ui.selection.type === 'TRANSITION' && ui.selection.contextId === node.id && ui.selection.id) {
                    dispatch({ type: 'DELETE_TRANSITION', payload: { fsmId: fsm.id, transitionId: ui.selection.id } });
                }
            }
            if (e.key === 'Escape') {
                dispatch({ type: 'SET_MULTI_SELECT_STATES', payload: [] });
            }
        };
        const handleKeyDown2 = (e) => {
            if (readOnly)
                return;
            if (e.key === 'Control')
                setIsLineCuttingMode(true);
        };
        const handleKeyUp = (e) => {
            if (e.key === 'Control')
                setIsLineCuttingMode(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keydown', handleKeyDown2);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keydown', handleKeyDown2);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [ui.selection, fsm?.id, node.id, multiSelectIds, readOnly]);
    // Handlers
    const handleCanvasMouseDown = (e) => {
        pendingCanvasSelect.current = false;
        if (handlePanMouseDown(e))
            return;
        if (e.button !== 0)
            return;
        if (e.button !== 0)
            return;
        if (readOnly) {
            // 鍙厑璁告閫夛紙濡傛灉鏄负浜嗘煡鐪嬫鏌ワ級鎴栬€呭钩绉?            // ReadOnly usually implies simpler interaction.
            // If we allow box selecting to see multi-inspector, keep it.
            // But disable cutting line.
        }
        else {
            if (linkingState || modifyingTransition)
                return;
        }
        if (readOnly) {
            // In ReadOnly, prevent cutting mode.
            // Allow Pan (handled above) and Box Select.
        }
        else {
            // Ctrl+宸﹂敭鎷栧姩寮€濮嬪垏绾挎ā寮?            if (e.ctrlKey || e.metaKey) {
            const pos = getLocalCoordinates(e.clientX, e.clientY);
            setCuttingLine({ start: pos, end: pos });
            cuttingPrevPos.current = pos;
            cutTransitionsSet.current = new Set(); // 閲嶇疆宸插垏鏂褰?                return;
        }
    };
    const rect = contentRef.current?.getBoundingClientRect();
    const isInsideContent = rect ? (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) : true;
    // 宸﹂敭鐐瑰嚮绌虹櫧鍖哄煙寮€濮嬫閫夛紝閫変腑寤惰繜鍒?mouseup锛涙閫夎繃绋嬩笉搴旇Е鍙戠┖鐧介€変腑
    pendingCanvasSelect.current = false;
    isBoxSelecting.current = true;
    blankClickStart.current = isInsideContent ? { x: e.clientX, y: e.clientY } : null;
    startBoxSelect(e);
};
const handleCanvasMouseUp = (e) => {
    if (e.button !== 0)
        return;
    // 鍒囩嚎鎴栧叾浠栦氦浜掓椂涓嶈Е鍙戠┖鐧介€変腑
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
    // 浠呭綋鎸変笅鏃跺湪绌虹櫧鍖哄煙锛堟湭璧版閫夛級锛屾姮璧蜂粛鍦ㄧ┖鐧藉尯鍩熶笖绉诲姩鏋佸皬锛屾墠瑙嗕负绌虹櫧鐐瑰嚮鐢ㄤ簬鍙栨秷閫変腑
    if (blankClickStart.current) {
        const dx = Math.abs(e.clientX - blankClickStart.current.x);
        const dy = Math.abs(e.clientY - blankClickStart.current.y);
        const CLICK_THRESHOLD = 3;
        if (dx <= CLICK_THRESHOLD && dy <= CLICK_THRESHOLD) {
            // 绌虹櫧鐐瑰嚮锛氬洖鍒板綋鍓嶈妭鐐逛笂涓嬫枃锛屾竻闄ょ姸鎬?杩炵嚎閫変腑锛屼繚鎸佺敾甯冨彲瑙?                dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: node.id } });
        }
        blankClickStart.current = null;
    }
};
// Ctrl 拖拽剪线的鼠标移动处理
useEffect(() => {
    if (!cuttingLine)
        return;
    const handleMouseMove = (e) => {
        const pos = getLocalCoordinates(e.clientX, e.clientY);
        setCuttingLine(prev => prev ? { ...prev, end: pos } : null);
        // 记录连线交点，先收集待删除的 transition
        if (cuttingPrevPos.current && fsm) {
            const prevPos = cuttingPrevPos.current;
            Object.values(fsm.transitions).forEach((trans) => {
                if (cutTransitionsSet.current.has(trans.id))
                    return;
                const fromState = fsm.states[trans.fromStateId];
                const toState = fsm.states[trans.toStateId];
                if (!fromState || !toState)
                    return;
                const fromPos = getNodeDisplayPosition(trans.fromStateId, fromState.position);
                const toPos = getNodeDisplayPosition(trans.toStateId, toState.position);
                const fromSide = trans.fromSide || Geom.getClosestSide(fromPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, toPos);
                const toSide = trans.toSide || Geom.getClosestSide(toPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, fromPos);
                const curveStart = Geom.getNodeAnchor(fromPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, fromSide);
                const curveEnd = Geom.getNodeAnchor(toPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, toSide);
                if (Geom.doesLineIntersectBezier(prevPos, pos, curveStart, curveEnd, fromSide, toSide)) {
                    cutTransitionsSet.current.add(trans.id);
                }
            });
        }
        cuttingPrevPos.current = pos;
    };
    const handleMouseUp = () => {
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
}, [cuttingLine, fsm, dispatch, getNodeDisplayPosition]);
const handleStateMouseDown = (e, stateId) => {
    e.stopPropagation();
    if (e.button !== 0)
        return;
    const isLinkInteraction = !readOnly && (e.shiftKey || Boolean(linkingState) || Boolean(modifyingTransition));
    // 鍏堟竻绌烘湰娆″彲鑳界殑寤惰繜閫変腑璁板綍
    pendingStateSelect.current = null;
    dragMoved.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    // 濡傛灉鐐瑰嚮鐨勬槸澶氶€変腑鐨勮妭鐐癸紝寮€濮嬪鑺傜偣鎷栨嫿 (浠呴潪鍙)
    if (multiSelectIds.includes(stateId) && !isLinkInteraction && !readOnly) {
        startMultiNodeDrag(e, multiSelectIds);
        return;
    }
    // 娓呴櫎澶氶€夛紙闄ら潪鎸変綇Ctrl娣诲姞鍒板閫夛級
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
    }
    else if (readOnly) {
        pendingStateSelect.current = stateId;
    }
    // 闈炶繛绾挎垨鎷栨嫿鐨勫崟鍑婚€変腑鍦?mouseup 瑙﹀彂
    if (!isLinkInteraction && !pendingStateSelect.current) {
        pendingStateSelect.current = stateId;
    }
};
const handleStateMouseUp = (e, stateId) => {
    e.stopPropagation();
    if (e.button !== 0)
        return;
    if (pendingStateSelect.current === stateId && !linkingState && !modifyingTransition && !dragMoved.current) {
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STATE', id: stateId, contextId: node.id } });
    }
    pendingStateSelect.current = null;
    dragStartPos.current = null;
    dragMoved.current = false;
};
// 鐩戝惉鍏ㄥ眬榧犳爣绉诲姩浠ュ垽瀹氭嫋鎷借窛绂伙紝鎷栨嫿鏃朵笉瑙﹀彂閫変腑
useEffect(() => {
    const handleMove = (e) => {
        if (!pendingStateSelect.current || !dragStartPos.current)
            return;
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
const handleContextMenu = (e, type, targetId) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly)
        return;
    const pos = getLocalCoordinates(e.clientX, e.clientY);
    setContextMenu({ x: pos.x, y: pos.y, type, targetId });
};
if (!fsm)
    return <div className="empty-state">Missing Data</div>;
return (<div ref={canvasRef} className="canvas-grid" style={{
        width: '100%', height: '100%', position: 'relative', overflow: 'auto',
        backgroundColor: '#18181b',
        cursor: isPanningActive ? 'grabbing' : (linkingState || modifyingTransition ? 'crosshair' : (boxSelectRect ? 'crosshair' : 'default'))
    }} onMouseDown={handleCanvasMouseDown} onMouseUp={handleCanvasMouseUp} onContextMenu={(e) => handleContextMenu(e, 'CANVAS')}>
            {/* Info overlay */}
            <CanvasInfoOverlay nodeName={node.name} multiSelectCount={multiSelectIds.length} isLineCuttingMode={isLineCuttingMode} isLinkMode={Boolean(linkingState)} isPanMode={isPanningActive}/>
            <ShortcutPanel visible={showShortcuts} onToggle={() => setShowShortcuts(v => !v)}/>

            {/* 鍙抽敭鑿滃崟 */}
            {contextMenu && (<CanvasContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} onAddState={(x, y) => dispatch({
            type: 'ADD_STATE',
            payload: {
                fsmId: fsm.id,
                state: { id: `state-${Date.now()}`, name: 'New State', position: { x, y }, eventListeners: [] }
            }
        })} onSetInitial={(stateId) => dispatch({
            type: 'UPDATE_FSM',
            payload: { fsmId: fsm.id, data: { initialStateId: stateId } }
        })} onStartLink={(stateId, x, y) => startLinking({ clientX: x, clientY: y }, stateId)} onDeleteState={(stateId) => dispatch({
            type: 'DELETE_STATE',
            payload: { fsmId: fsm.id, stateId }
        })} onDeleteTransition={(transitionId) => dispatch({
            type: 'DELETE_TRANSITION',
            payload: { fsmId: fsm.id, transitionId }
        })} isInitialState={contextMenu.type === 'NODE' && fsm.initialStateId === contextMenu.targetId} contentRef={contentRef}/>)}

            <div ref={contentRef} style={{ position: 'relative', minWidth: `${CANVAS_SIZE}px`, minHeight: `${CANVAS_SIZE}px` }}>
                {/* 妗嗛€夊尯鍩?*/}
                <BoxSelectOverlay rect={boxSelectRect}/>

                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}>
                    {/* 绠ご鏍囪瀹氫箟 */}
                    <ConnectionArrowMarkers />

                    {/* 1. Existing Connections */}
                    {Object.values(fsm.transitions).map((trans) => {
        const isModifying = modifyingTransition?.id === trans.id;
        const fromPos = getNodeDisplayPosition(trans.fromStateId, fsm.states[trans.fromStateId]?.position || { x: 0, y: 0 });
        const toPos = getNodeDisplayPosition(trans.toStateId, fsm.states[trans.toStateId]?.position || { x: 0, y: 0 });
        return (<ConnectionLine key={trans.id} transition={trans} fromState={fsm.states[trans.fromStateId]} toState={fsm.states[trans.toStateId]} isSelected={ui.selection.type === 'TRANSITION' && ui.selection.id === trans.id} isContextTarget={contextMenu?.type === 'TRANSITION' && contextMenu?.targetId === trans.id} isModifying={isModifying} fromPos={fromPos} toPos={toPos} onSelect={(e, id) => dispatch({ type: 'SELECT_OBJECT', payload: { type: 'TRANSITION', id, contextId: node.id } })} onContextMenu={(e, id) => handleContextMenu(e, 'TRANSITION', id)} onHandleDown={(e, id, type) => {
                e.stopPropagation();
                startModifyingTransition(e, id, type);
            }} onCut={(e, id) => {
                dispatch({ type: 'DELETE_TRANSITION', payload: { fsmId: fsm.id, transitionId: id } });
            }}/>);
    })}

                    {/* 2. Temporary / Dragging Line */}
                    {(linkingState || modifyingTransition) && (() => {
        const mouseOrSnap = activeSnapPoint ? { x: activeSnapPoint.x, y: activeSnapPoint.y } : mousePos;
        let p1 = mouseOrSnap;
        let p2 = mouseOrSnap;
        let sSide = 'right';
        let eSide = 'left';
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
            }
            else {
                const destPos = getNodeDisplayPosition(trans.toStateId, fsm.states[trans.toStateId].position);
                eSide = trans.toSide || Geom.getClosestSide(destPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, mouseOrSnap);
                p2 = Geom.getNodeAnchor(destPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, eSide);
                p1 = mouseOrSnap;
                sSide = activeSnapPoint ? activeSnapPoint.side : Geom.getClosestSide({ x: p1.x - Geom.STATE_WIDTH / 2, y: p1.y - Geom.STATE_ESTIMATED_HEIGHT / 2 }, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, p2);
            }
        }
        return <path d={Geom.getBezierPathData(p1, p2, sSide, eSide)} fill="none" stroke="#888" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrow-temp)"/>;
    })()}

                    {/* 3. 鍒囩嚎瑙嗚 (Ctrl+鎷栨嫿) */}
                    <CuttingLineOverlay line={cuttingLine}/>
                </svg>

                {/* 3. HTML Controls for Connections (Labels & Handles) */}
                {Object.values(fsm.transitions).map((trans) => {
        if (modifyingTransition?.id === trans.id)
            return null;
        const fromPos = getNodeDisplayPosition(trans.fromStateId, fsm.states[trans.fromStateId]?.position);
        const toPos = getNodeDisplayPosition(trans.toStateId, fsm.states[trans.toStateId]?.position);
        return (<ConnectionControls key={`ctrl-${trans.id}`} transition={trans} fromPos={fromPos} toPos={toPos} isSelected={ui.selection.type === 'TRANSITION' && ui.selection.id === trans.id} isContextTarget={contextMenu?.type === 'TRANSITION' && contextMenu?.targetId === trans.id} onSelect={(e, id) => dispatch({ type: 'SELECT_OBJECT', payload: { type: 'TRANSITION', id, contextId: node.id } })} onContextMenu={(e, id) => handleContextMenu(e, 'TRANSITION', id)} onHandleDown={(e, id, type) => {
                e.stopPropagation();
                startModifyingTransition(e, id, type);
            }} readOnly={readOnly}/>);
    })}

                {/* 4. 鍚搁檮鐐规彁绀哄眰锛氳繛绾?璋冩暣鏃跺睍绀烘墍鏈夐敋鐐?*/}
                <SnapPointsLayer snapPoints={snapPoints} activeSnapPoint={activeSnapPoint} visible={Boolean(linkingState || modifyingTransition)}/>

                {/* 5. State Nodes */}
                {Object.values(fsm.states).map((state) => (<StateNode key={state.id} state={state} position={getNodeDisplayPosition(state.id, state.position)} isSelected={ui.selection.type === 'STATE' && ui.selection.id === state.id} isMultiSelected={multiSelectIds.includes(state.id)} isInitial={fsm.initialStateId === state.id} isContextTarget={contextMenu?.type === 'NODE' && contextMenu?.targetId === state.id} onMouseDown={handleStateMouseDown} onMouseUp={handleStateMouseUp} onContextMenu={(e) => handleContextMenu(e, 'NODE', state.id)} readOnly={readOnly}/>))}
            </div>
            <style>{` .ctx-item { padding: 8px 12px; font-size: 13px; cursor: pointer; color: #eee; } .ctx-item:hover { background: #3e3e42; } .ctx-item.danger { color: #ff6b6b; } .handle { position: absolute; width: 12px; height: 12px; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255,255,255,0.5); border-radius: 50%; transform: translate(-50%, -50%); cursor: grab; opacity: 0; transition: opacity 0.2s, background 0.2s; } .handle:hover { opacity: 1; background: var(--accent-color); border-color: #fff; } `}</style>
        </div>);
;
