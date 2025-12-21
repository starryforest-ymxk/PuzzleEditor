/**
 * components/Explorer/NodeExplorer.tsx
 * 解谜节点列表浏览与编辑组件，布局与 StageExplorer 保持一致的结构化实现
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { PuzzleNode } from '../../types/puzzleNode';
import { FileCode, FilePlus, Edit3, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../Inspector/ConfirmDialog';
import { createNodeWithStateMachine, createTriggerNodeWithStateMachine, getMaxDisplayOrder, buildExistingIds } from '../../utils/puzzleNodeUtils';
import { StageId, PuzzleNodeId } from '../../types/common';
import { ChevronRight } from 'lucide-react';

/** 上下文菜单状态 */
interface ContextMenuState {
    x: number;
    y: number;
    nodeId: string | null; // null 表示空白区域菜单
}

/** 删除确认弹窗状态 */
interface DeleteConfirmState {
    nodeId: string;
    nodeName: string;
    stageName?: string;
    siblingCount?: number;
}

export const NodeExplorer: React.FC = () => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();

    // 右键菜单、编辑、删除状态
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState<string>('');
    const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
    const [dragNodeId, setDragNodeId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
    const [showCreateSubmenu, setShowCreateSubmenu] = useState(false);

    const editInputRef = useRef<HTMLInputElement>(null);
    const currentStageId = ui.currentStageId;

    // 按 displayOrder 排序当前 Stage 的节点
    const nodes: PuzzleNode[] = useMemo(() => {
        if (!currentStageId) return [];
        const stageNodes = (Object.values(project.nodes) as PuzzleNode[]).filter(node => node.stageId === currentStageId);
        return stageNodes.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    }, [project.nodes, currentStageId]);

    // 关闭右键菜单 - 点击外部时关闭
    useEffect(() => {
        if (!contextMenu) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('.canvas-context-menu')) return;
            setContextMenu(null);
        };

        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [contextMenu]);

    // 聚焦编辑输入框
    useEffect(() => {
        if (editingNodeId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingNodeId]);

    // ========== 事件：选择 ==========
    const handleSelectNode = useCallback((e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        dispatch({ type: 'NAVIGATE_TO', payload: { nodeId, graphId: null } });
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: nodeId } });
    }, [dispatch]);

    // ========== 事件：右键菜单 ==========
    const handleContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
    }, []);

    const handleEmptyAreaContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        if (target.closest('.tree-node')) return;
        if (currentStageId) {
            setContextMenu({ x: e.clientX, y: e.clientY, nodeId: null });
        }
    }, [currentStageId]);

    // ========== 事件：创建 ==========
    const handleCreateNode = useCallback((type: 'EMPTY' | 'TRIGGER' = 'EMPTY') => {
        if (!contextMenu || !currentStageId) return;
        const maxOrder = getMaxDisplayOrder(project.nodes, currentStageId as StageId);

        // 构建现有 ID 集合
        const existingIds = buildExistingIds(project.nodes, project.stateMachines);

        let result;
        if (type === 'TRIGGER') {
            result = createTriggerNodeWithStateMachine(currentStageId as StageId, existingIds, 'New Trigger Node', maxOrder + 1);
        } else {
            result = createNodeWithStateMachine(currentStageId as StageId, existingIds, 'New Empty Node', maxOrder + 1, false);
        }

        const { node, stateMachine } = result;

        dispatch({ type: 'ADD_PUZZLE_NODE', payload: { stageId: currentStageId as StageId, node, stateMachine } });
        // 仅选中节点以便 Inspector 展示，不切换到状态机画布
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: node.id } });
        setContextMenu(null);

        setTimeout(() => {
            setEditingNodeId(node.id);
            setEditingName(node.name);
        }, 50);
    }, [contextMenu, currentStageId, project.nodes, dispatch]);

    // ========== 事件：重命名 ==========
    const handleStartRename = useCallback(() => {
        if (!contextMenu?.nodeId) return;
        const node = project.nodes[contextMenu.nodeId];
        if (node) {
            setEditingNodeId(contextMenu.nodeId);
            setEditingName(node.name);
        }
        setContextMenu(null);
    }, [contextMenu, project.nodes]);

    const handleConfirmRename = useCallback(() => {
        if (!editingNodeId || !editingName.trim()) {
            setEditingNodeId(null);
            return;
        }
        dispatch({ type: 'UPDATE_NODE', payload: { nodeId: editingNodeId, data: { name: editingName.trim() } } });
        setEditingNodeId(null);
    }, [editingNodeId, editingName, dispatch]);

    const handleCancelRename = useCallback(() => {
        setEditingNodeId(null);
        setEditingName('');
    }, []);

    const handleDoubleClick = useCallback((e: React.MouseEvent, nodeId: string, nodeName: string) => {
        e.stopPropagation();
        setEditingNodeId(nodeId);
        setEditingName(nodeName);
    }, []);

    // ========== 事件：删除 ==========
    const handleRequestDelete = useCallback(() => {
        if (!contextMenu?.nodeId) return;
        const node = project.nodes[contextMenu.nodeId];
        if (!node) {
            setContextMenu(null);
            return;
        }

        const stage = project.stageTree.stages[node.stageId];
        const siblingCount = (Object.values(project.nodes) as PuzzleNode[]).filter(n => n.stageId === node.stageId && n.id !== node.id).length;

        setDeleteConfirm({
            nodeId: contextMenu.nodeId,
            nodeName: node.name,
            stageName: stage?.name,
            siblingCount
        });
        setContextMenu(null);
    }, [contextMenu, project.nodes, project.stageTree.stages]);

    const handleConfirmDelete = useCallback(() => {
        if (!deleteConfirm) return;
        dispatch({ type: 'DELETE_PUZZLE_NODE', payload: { nodeId: deleteConfirm.nodeId } });
        setDeleteConfirm(null);
    }, [deleteConfirm, dispatch]);

    const handleCancelDelete = useCallback(() => {
        setDeleteConfirm(null);
    }, []);

    // ========== 事件：拖拽排序 ==========
    const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
        setDragNodeId(nodeId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', nodeId);
    }, []);

    const handleDragEnd = useCallback(() => {
        setDragNodeId(null);
        setDropTargetId(null);
        setDropPosition(null);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, nodeId: string, rect: DOMRect) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (nodeId === dragNodeId) return;

        setDropTargetId(nodeId);
        const y = e.clientY - rect.top;
        const isTop = y < rect.height / 2;
        setDropPosition(isTop ? 'before' : 'after');
    }, [dragNodeId]);

    const handleDragLeave = useCallback(() => {
        setDropTargetId(null);
        setDropPosition(null);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!dragNodeId || !dropTargetId || !currentStageId) {
            handleDragEnd();
            return;
        }

        const currentNodeIds = nodes.map(n => n.id);
        const dragIndex = currentNodeIds.indexOf(dragNodeId);
        const dropIndex = currentNodeIds.indexOf(dropTargetId);
        if (dragIndex === -1 || dropIndex === -1) {
            handleDragEnd();
            return;
        }

        const newOrder = [...currentNodeIds];
        newOrder.splice(dragIndex, 1);
        const insertIndex = dropPosition === 'before' ? dropIndex : dropIndex + 1;
        const adjustedIndex = dragIndex < dropIndex ? insertIndex - 1 : insertIndex;
        newOrder.splice(adjustedIndex, 0, dragNodeId);

        dispatch({ type: 'REORDER_PUZZLE_NODES', payload: { stageId: currentStageId as StageId, nodeIds: newOrder as PuzzleNodeId[] } });
        handleDragEnd();
    }, [dragNodeId, dropTargetId, dropPosition, currentStageId, nodes, dispatch, handleDragEnd]);

    // ========== 渲染 ==========

    if (!currentStageId) {
        return (
            <div className="empty-state" style={{ padding: '12px 16px', fontSize: '12px', height: 'auto' }}>
                Select a Stage to view Nodes
            </div>
        );
    }

    const renderNodes = () => {
        if (nodes.length === 0) {
            return (
                <div className="empty-state" style={{ padding: '12px 16px', fontSize: '12px', height: 'auto' }}>
                    No Nodes in this Stage
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>Right-click to create a node</div>
                </div>
            );
        }

        return nodes.map(node => {
            const isSelected = ui.currentNodeId === node.id;
            const isEditing = editingNodeId === node.id;
            const isDragging = dragNodeId === node.id;
            const isDropTarget = dropTargetId === node.id;

            return (
                <div
                    key={node.id}
                    className={`tree-node ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
                    style={{
                        paddingLeft: '24px',
                        position: 'relative',
                        opacity: isDragging ? 0.5 : 1,
                        borderTop: isDropTarget && dropPosition === 'before' ? '2px solid var(--accent-color)' : undefined,
                        borderBottom: isDropTarget && dropPosition === 'after' ? '2px solid var(--accent-color)' : undefined
                    }}
                    onClick={(e) => handleSelectNode(e, node.id)}
                    onContextMenu={(e) => handleContextMenu(e, node.id)}
                    onDoubleClick={(e) => !isEditing && handleDoubleClick(e, node.id, node.name)}
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStart(e, node.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        handleDragOver(e, node.id, rect);
                    }}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <span style={{ marginRight: '8px', color: 'var(--text-secondary)', display: 'flex' }}>
                        <FileCode size={14} />
                    </span>

                    {isEditing ? (
                        <input
                            ref={editInputRef}
                            type="text"
                            className="tree-node-name-edit"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={handleConfirmRename}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmRename();
                                if (e.key === 'Escape') handleCancelRename();
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span style={{ fontSize: '13px' }}>{node.name}</span>
                    )}
                </div>
            );
        });
    };

    return (
        <div
            style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
            onContextMenu={handleEmptyAreaContextMenu}
        >
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 0' }}>
                {renderNodes()}
            </div>

            {contextMenu && (
                <div
                    className="canvas-context-menu"
                    style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000 }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {contextMenu.nodeId === null ? (
                        <div
                            className="menu-item"
                            onMouseEnter={() => setShowCreateSubmenu(true)}
                            onMouseLeave={() => setShowCreateSubmenu(false)}
                            style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <FilePlus size={14} style={{ marginRight: '8px' }} />
                                Create Node
                            </div>
                            <ChevronRight size={12} />

                            {showCreateSubmenu && (
                                <div
                                    className="canvas-context-menu"
                                    style={{
                                        position: 'absolute',
                                        left: '100%',
                                        top: 0,
                                        minWidth: '140px'
                                    }}
                                >
                                    <div className="menu-item" onClick={(e) => { e.stopPropagation(); handleCreateNode('EMPTY'); }}>
                                        Empty Node
                                    </div>
                                    <div className="menu-item" onClick={(e) => { e.stopPropagation(); handleCreateNode('TRIGGER'); }}>
                                        Trigger Node
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="menu-item" onClick={handleStartRename}>
                                <Edit3 size={14} style={{ marginRight: '8px' }} />
                                Rename
                            </div>
                            <div className="menu-divider" />
                            <div className="menu-item menu-item-danger" onClick={handleRequestDelete}>
                                <Trash2 size={14} style={{ marginRight: '8px' }} />
                                Delete
                            </div>
                        </>
                    )}
                </div>
            )}

            {deleteConfirm && (
                <ConfirmDialog
                    title="Delete Puzzle Node"
                    message={`Are you sure you want to delete "${deleteConfirm.nodeName}"? This will also delete its State Machine. This action cannot be undone.`}
                    references={[
                        deleteConfirm.stageName ? `Stage: ${deleteConfirm.stageName}` : '',
                        deleteConfirm.siblingCount && deleteConfirm.siblingCount > 0 ? `${deleteConfirm.siblingCount} other node(s) in this stage` : ''
                    ].filter(Boolean)}
                    confirmText="Delete"
                    cancelText="Cancel"
                    onConfirm={handleConfirmDelete}
                    onCancel={handleCancelDelete}
                />
            )}
        </div>
    );
};
