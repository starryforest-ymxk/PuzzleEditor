import React, { useState, useRef, useEffect } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { PresentationGraph } from '../../types/presentation';
import * as Geom from '../../utils/geometry';
import { useCanvasNavigation } from '../../hooks/useCanvasNavigation';
import { generateResourceId } from '../../utils/resourceIdGenerator';

interface Props {
  graph: PresentationGraph;
  ownerNodeId?: string | null;
  readOnly?: boolean;
}

export const PresentationCanvas = ({ graph, ownerNodeId, readOnly = false }: Props) => {
  const { ui } = useEditorState();
  const dispatch = useEditorDispatch();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Navigation
  const { isPanningActive, handleMouseDown: handlePanMouseDown } = useCanvasNavigation({ canvasRef });

  // Interactions
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [linkingFromId, setLinkingFromId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'CANVAS' | 'NODE'; targetId?: string; } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
        if (contextMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    window.addEventListener('mousedown', handleGlobalMouseDown, { capture: true });
    return () => window.removeEventListener('mousedown', handleGlobalMouseDown, { capture: true });
  }, [contextMenu]);

  const getCanvasCoordinates = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left + canvasRef.current.scrollLeft, y: e.clientY - rect.top + canvasRef.current.scrollTop };
  };

  const getNodePosition = (nodeId: string) => {
      const node = graph.nodes[nodeId];
      if (!node) return { x: 0, y: 0 };
      if (draggingNodeId === nodeId) return { x: mousePos.x - dragOffset.x, y: mousePos.y - dragOffset.y };
      return node.position;
  };

  // Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
      if (handlePanMouseDown(e)) return;
      // Deselect if background click, ONLY ON LEFT CLICK (button 0)
      if (e.button === 0 && ownerNodeId) {
          dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_GRAPH', id: graph.id, contextId: ownerNodeId }});
      }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (readOnly) {
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_NODE', id: nodeId, contextId: graph.id } });
        return;
    }
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_NODE', id: nodeId, contextId: graph.id } });
    const pos = getCanvasCoordinates(e);
    const node = graph.nodes[nodeId];
    setDraggingNodeId(nodeId);
    setDragOffset({ x: pos.x - node.position.x, y: pos.y - node.position.y });
    setMousePos(pos);
  };

  const handlePortMouseDown = (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation(); e.preventDefault();
      if (e.button !== 0) return;
      if (readOnly) return;
      setLinkingFromId(nodeId);
      setMousePos(getCanvasCoordinates(e));
  };

  const handleMouseUp = (e: React.MouseEvent, targetNodeId?: string) => {
      if (!readOnly && linkingFromId && targetNodeId && linkingFromId !== targetNodeId) {
          e.stopPropagation();
          dispatch({ type: 'LINK_PRESENTATION_NODES', payload: { graphId: graph.id, fromNodeId: linkingFromId, toNodeId: targetNodeId } });
      }
      if (!readOnly && draggingNodeId) {
          dispatch({ type: 'UPDATE_PRESENTATION_NODE', payload: { graphId: graph.id, nodeId: draggingNodeId, data: { position: { x: mousePos.x - dragOffset.x, y: mousePos.y - dragOffset.y } } } });
      }
      setDraggingNodeId(null);
      setLinkingFromId(null);
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'CANVAS' | 'NODE', targetId?: string) => {
      e.preventDefault(); e.stopPropagation();
      if (readOnly) return;
      const pos = getCanvasCoordinates(e);
      setContextMenu({ x: pos.x, y: pos.y, type, targetId });
  };

  const handleAddNode = (type: string) => {
      if (!contextMenu) return;
      if (readOnly) return;
      // 使用"资源类型_计数器"格式生成 ID
      const existingIds = Object.keys(graph.nodes);
      const nodeId = generateResourceId('PNODE', existingIds);
      dispatch({ type: 'ADD_PRESENTATION_NODE', payload: { graphId: graph.id, node: { id: nodeId, name: `New ${type}`, type: type as any, position: { x: contextMenu.x, y: contextMenu.y }, nextIds: [] } } });
      setContextMenu(null);
  };

  return (
    <div ref={canvasRef} className="canvas-grid"
        style={{ width: '100%', height: '100%', position: 'relative', overflow: 'auto', backgroundColor: '#151515', cursor: isPanningActive ? 'grabbing' : (draggingNodeId ? 'grabbing' : (linkingFromId ? 'crosshair' : 'default')) }}
        onMouseDown={handleMouseDown} onMouseMove={(e) => setMousePos(getCanvasCoordinates(e))} onMouseUp={(e) => handleMouseUp(e)} onContextMenu={(e) => handleContextMenu(e, 'CANVAS')}
    >
        {/* Info */}
        <div style={{ position: 'sticky', top: 20, left: 20, zIndex: 100, pointerEvents: 'none' }}>
             <div style={{ backgroundColor: 'rgba(30,30,30,0.8)', padding: '12px', borderRadius: '4px', border: '1px solid #444' }}>
                <div style={{ fontSize: '10px', color: '#c586c0' }}>PRESENTATION EDITOR</div>
                <div style={{ fontSize: '16px', color: '#eee', fontWeight: 600 }}>{graph.name}</div>
                {ownerNodeId && <button onClick={() => dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: ownerNodeId } })} style={{ pointerEvents: 'auto', marginTop: 8, background: 'transparent', border: '1px solid #666', color: '#ccc', padding: '4px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>Back to Node</button>}
            </div>
        </div>

        {contextMenu && !readOnly && (
            <div ref={menuRef} style={{ position: 'absolute', top: contextMenu.y, left: contextMenu.x, zIndex: 9999, backgroundColor: '#252526', border: '1px solid #454545', padding: '4px 0', minWidth: '140px' }} onClick={(e) => e.stopPropagation()}>
                {contextMenu.type === 'CANVAS' ? (
                    ['ScriptCall', 'Wait', 'Branch'].map(t => <div key={t} onClick={() => handleAddNode(t)} className="ctx-item">+ {t} Node</div>)
                ) : (
                    <div onClick={() => { dispatch({ type: 'DELETE_PRESENTATION_NODE', payload: { graphId: graph.id, nodeId: contextMenu.targetId! } }); setContextMenu(null); }} className="ctx-item danger">Delete Node</div>
                )}
            </div>
        )}

        <div style={{ position: 'relative', minWidth: '2000px', minHeight: '2000px' }}>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
                <defs><marker id="arrow-pres" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4 z" fill="#888" /></marker></defs>
                {/* Connections */}
                {Object.values(graph.nodes).map(node => node.nextIds.map(nextId => {
                     const nextNode = graph.nodes[nextId];
                     if (!nextNode) return null;
                     const pos = getNodePosition(node.id);
                     const nextPos = getNodePosition(nextId);
                     const path = `M ${pos.x + Geom.NODE_WIDTH} ${pos.y + Geom.NODE_HEIGHT/2} C ${(pos.x+Geom.NODE_WIDTH+nextPos.x)/2} ${pos.y+Geom.NODE_HEIGHT/2}, ${(pos.x+Geom.NODE_WIDTH+nextPos.x)/2} ${nextPos.y+Geom.NODE_HEIGHT/2}, ${nextPos.x} ${nextPos.y+Geom.NODE_HEIGHT/2}`;
                     return <path key={`${node.id}-${nextId}`} d={path} stroke="#888" strokeWidth="2" fill="none" markerEnd="url(#arrow-pres)" strokeDasharray="4 2" />;
                }))}
                {linkingFromId && <line x1={getNodePosition(linkingFromId).x + Geom.NODE_WIDTH} y1={getNodePosition(linkingFromId).y + Geom.NODE_HEIGHT/2} x2={mousePos.x} y2={mousePos.y} stroke="#666" strokeWidth="2" strokeDasharray="4 2" />}
            </svg>

            {Object.values(graph.nodes).map(node => {
                const isSelected = ui.selection.type === 'PRESENTATION_NODE' && ui.selection.id === node.id;
                const isContextTarget = contextMenu?.type === 'NODE' && contextMenu?.targetId === node.id;
                
                const pos = getNodePosition(node.id);
                const borderColor = node.type === 'ScriptCall' ? '#c586c0' : (node.type === 'Wait' ? '#ce9178' : '#555');
                const icon = node.type === 'ScriptCall' ? '>' : (node.type === 'Wait' ? 'W' : 'O');

                return (
                    <div key={node.id} onMouseDown={(e) => handleNodeMouseDown(e, node.id)} onMouseUp={(e) => handleMouseUp(e, node.id)} onContextMenu={(e) => handleContextMenu(e, 'NODE', node.id)}
                        style={{ 
                            position: 'absolute', left: pos.x, top: pos.y, width: Geom.NODE_WIDTH, height: Geom.NODE_HEIGHT, 
                            backgroundColor: '#252526', 
                            border: `1px solid ${isSelected ? '#fff' : borderColor}`, borderLeft: `4px solid ${borderColor}`, borderRadius: '4px', 
                            boxShadow: isContextTarget ? '0 0 0 2px var(--accent-warning)' : (isSelected ? '0 0 0 2px #555' : '0 2px 4px rgba(0,0,0,0.3)'), 
                            display: 'flex', alignItems: 'center', padding: '0 12px', cursor: 'grab', color: '#ccc', zIndex: 10 
                        }}>
                        <span style={{ marginRight: '8px', color: borderColor, fontSize: '14px' }}>{icon}</span>
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>{node.name}</span>
                        <div onMouseDown={(e) => handlePortMouseDown(e, node.id)} style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, borderRadius: '50%', background: '#777', cursor: 'crosshair', border: '1px solid #333' }} />
                    </div>
                );
            })}
        </div>
    </div>
  );
};
