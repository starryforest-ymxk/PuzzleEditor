/**
 * components/Explorer/StageExplorer.tsx
 * 阶段树浏览与编辑组件
 * 
 * 功能：
 * - 树形结构展示 Stage 层级
 * - 支持展开/折叠、选择、右键菜单
 * - 支持拖拽排序（使用 useStageDrag hook）
 * - 支持内联重命名
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ChevronRight, ChevronDown, Folder, Flag, Box, FolderPlus, FilePlus, Trash2, Edit3 } from 'lucide-react';
import { createDefaultStage } from '../../utils/stageTreeUtils';
import { StageId } from '../../types/common';
import { useStageDrag } from '../../hooks/useStageDrag';
import { useDeleteHandler } from '../../hooks/useDeleteHandler';
import { navigateAndSelect } from '../../utils/referenceNavigation';

// ========== 类型定义 ==========

/** 上下文菜单状态 */
interface ContextMenuState {
    x: number;
    y: number;
    stageId: string | null;  // null 表示空白区域菜单
}

// ========== 组件实现 ==========

export const StageExplorer: React.FC = () => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();
    const { deleteStage } = useDeleteHandler();

    // ========== 状态管理 ==========

    // 右键菜单状态
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    // 内联编辑状态
    const [editingStageId, setEditingStageId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState<string>('');
    // 编辑输入框引用
    const editInputRef = useRef<HTMLInputElement>(null);
    // Stage 树容器引用：用于限定拖拽空白区域“最后节点”计算范围（避免被 Nodes 列表等 .tree-node 干扰）
    const stageTreeContainerRef = useRef<HTMLDivElement>(null);

    /**
     * 数据驱动计算“最后一个可见节点”（与 renderTreeNode 的 DFS 顺序保持一致）。
     * 目的：让底部空白区域的档位计算不依赖 DOM 查询，更稳定也更易测试。
     */
    const lastVisibleStageId = React.useMemo<StageId | null>(() => {
        const rootId = project.stageTree.rootId;
        if (!rootId) return null;

        let last: StageId | null = null;

        const visit = (stageId: StageId) => {
            const stage = project.stageTree.stages[stageId];
            if (!stage) return;
            last = stageId;
            const hasChildren = stage.childrenIds.length > 0;
            const isExpanded = ui.stageExpanded[stageId] ?? stage.isExpanded ?? false;
            if (hasChildren && isExpanded) {
                stage.childrenIds.forEach(childId => visit(childId as StageId));
            }
        };

        visit(rootId as StageId);
        return last;
    }, [project.stageTree, ui.stageExpanded]);

    // 使用拖拽 Hook
    const {
        dragState,
        createNodeDragHandlers,
        emptyAreaHandlers,
        isDragging,
        getDropClass,
        getDropEdge
    } = useStageDrag(project.stageTree, dispatch, stageTreeContainerRef, lastVisibleStageId);

    // ========== 副作用 ==========

    // 关闭右键菜单 - 点击外部时关闭
    useEffect(() => {
        if (!contextMenu) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('.canvas-context-menu')) {
                return;
            }
            setContextMenu(null);
        };

        // 延迟添加监听器，避免同一次点击触发关闭
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
        if (editingStageId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingStageId]);

    // ========== 事件处理：选择与展开 ==========

    /** 选择 Stage */
    const handleSelect = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        navigateAndSelect(dispatch,
            { stageId: id, nodeId: null, graphId: null },
            { type: 'STAGE', id }
        );
    }, [dispatch]);

    /** 展开/折叠 Stage */
    const handleToggle = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        dispatch({ type: 'TOGGLE_STAGE_EXPAND', payload: { id } });
    }, [dispatch]);

    // ========== 事件处理：右键菜单 ==========

    /** 节点右键菜单 */
    const handleContextMenu = useCallback((e: React.MouseEvent, stageId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, stageId });
    }, []);

    /** 空白区域右键菜单 */
    const handleEmptyAreaContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        if (target.closest('.tree-node')) {
            return;
        }
        if (project.stageTree.rootId) {
            setContextMenu({ x: e.clientX, y: e.clientY, stageId: null });
        }
    }, [project.stageTree.rootId]);

    // ========== 事件处理：创建 Stage ==========

    /** 创建子 Stage */
    const handleCreateChildStage = useCallback(() => {
        if (!contextMenu) return;
        const parentId = (contextMenu.stageId || project.stageTree.rootId) as StageId;
        const existingStageIds = Object.keys(project.stageTree.stages);
        const newStage = createDefaultStage(parentId, existingStageIds);

        dispatch({ type: 'ADD_STAGE', payload: { parentId, stage: newStage } });
        dispatch({ type: 'SET_STAGE_EXPANDED', payload: { id: parentId, expanded: true } });
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: newStage.id } });
        dispatch({ type: 'NAVIGATE_TO', payload: { stageId: newStage.id, nodeId: null, graphId: null } });
        setContextMenu(null);
    }, [contextMenu, project.stageTree.rootId, dispatch]);

    /** 创建同级 Stage */
    const handleCreateSiblingStage = useCallback(() => {
        if (!contextMenu?.stageId) return;
        const stage = project.stageTree.stages[contextMenu.stageId];
        if (!stage?.parentId) return;

        const parentId = stage.parentId as StageId;
        const existingStageIds = Object.keys(project.stageTree.stages);
        const newStage = createDefaultStage(parentId, existingStageIds);

        dispatch({
            type: 'ADD_STAGE',
            payload: { parentId, afterStageId: contextMenu.stageId, stage: newStage }
        });
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: newStage.id } });
        dispatch({ type: 'NAVIGATE_TO', payload: { stageId: newStage.id, nodeId: null, graphId: null } });
        setContextMenu(null);
    }, [contextMenu, project.stageTree.stages, dispatch]);

    // ========== 事件处理：重命名 ==========

    /** 开始重命名 */
    const handleStartRename = useCallback(() => {
        if (!contextMenu?.stageId) return;
        const stage = project.stageTree.stages[contextMenu.stageId];
        if (stage) {
            setEditingStageId(contextMenu.stageId);
            setEditingName(stage.name);
        }
        setContextMenu(null);
    }, [contextMenu, project.stageTree.stages]);

    /** 确认重命名 */
    const handleConfirmRename = useCallback(() => {
        if (!editingStageId || !editingName.trim()) {
            setEditingStageId(null);
            return;
        }
        dispatch({
            type: 'UPDATE_STAGE',
            payload: { stageId: editingStageId as StageId, data: { name: editingName.trim() } }
        });
        setEditingStageId(null);
    }, [editingStageId, editingName, dispatch]);

    /** 取消重命名 */
    const handleCancelRename = useCallback(() => {
        setEditingStageId(null);
        setEditingName('');
    }, []);

    /** 双击开始编辑 */
    const handleDoubleClick = useCallback((stageId: string, stageName: string) => {
        setEditingStageId(stageId);
        setEditingName(stageName);
    }, []);

    // ========== 事件处理：删除 ==========

    /** 请求删除 Stage */
    /** 请求删除 Stage */
    const handleRequestDelete = useCallback(() => {
        if (!contextMenu?.stageId) return;
        deleteStage(contextMenu.stageId);
        setContextMenu(null);
    }, [contextMenu, deleteStage]);

    // ========== 渲染：树节点 ==========

    const renderTreeNode = (stageId: string, depth = 0) => {
        const stage = project.stageTree.stages[stageId];
        if (!stage) return null;

        const isSelected = ui.currentStageId === stage.id;
        const hasChildren = stage.childrenIds.length > 0;
        const isExpanded = ui.stageExpanded[stage.id] ?? stage.isExpanded ?? false;
        const isEditing = editingStageId === stage.id;
        const nodeIsDragging = isDragging(stage.id);
        const dropClass = getDropClass(stage.id);
        const dropEdge = getDropEdge(stage.id);

        // 初始阶段判断：直接读取 isInitial 属性
        const isInitial = stage.isInitial ?? false;

        // 获取拖拽事件处理器
        const dragHandlers = createNodeDragHandlers(stage.id);

        return (
            <div key={stage.id}>
                <div
                    className={`tree-node ${isSelected ? 'selected' : ''} ${nodeIsDragging ? 'dragging' : ''} ${dropClass}`}
                    style={{ paddingLeft: `${depth * 16 + 8}px`, position: 'relative' }}
                    data-stage-id={stage.id}
                    data-drop-edge={dropEdge ?? undefined}
                    onClick={(e) => handleSelect(e, stage.id)}
                    onContextMenu={(e) => handleContextMenu(e, stage.id)}
                    onDoubleClick={() => !isEditing && handleDoubleClick(stage.id, stage.name)}
                    {...dragHandlers}
                >
                    {/* 展开/折叠图标 */}
                    <span
                        style={{
                            marginRight: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            cursor: hasChildren ? 'pointer' : 'default',
                            opacity: hasChildren ? 1 : 0.3,
                            color: 'var(--text-secondary)'
                        }}
                        onClick={(e) => hasChildren && handleToggle(e, stage.id)}
                    >
                        {hasChildren ? (
                            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                        ) : (
                            <div style={{ width: 14, height: 14 }} />
                        )}
                    </span>

                    {/* 类型图标 */}
                    <span style={{ marginRight: '6px', color: isSelected ? 'inherit' : 'var(--text-secondary)' }}>
                        {hasChildren ? <Folder size={14} /> : <Box size={14} />}
                    </span>

                    {/* 名称（可编辑） */}
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
                        <span style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontSize: '13px',
                            flex: 1
                        }}>
                            {stage.name}
                        </span>
                    )}

                    {/* 初始阶段标记 */}
                    {isInitial && !isEditing && (
                        <span
                            title="Initial Stage"
                            style={{
                                marginLeft: '6px',
                                color: 'var(--accent-color)',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <Flag size={12} fill="currentColor" />
                        </span>
                    )}
                </div>

                {/* 子节点 */}
                {hasChildren && isExpanded && (
                    <div>
                        {stage.childrenIds.map(childId => renderTreeNode(childId, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    // ========== 渲染：主组件 ==========

    if (!project.isLoaded) {
        return <div className="empty-state" style={{ padding: '12px 16px', fontSize: '12px', height: 'auto' }}>
            Open a project to view stages
        </div>;
    }

    return (
        <div
            ref={stageTreeContainerRef}
            style={{
                padding: '8px 0',
                flex: 1,
                minHeight: '50px',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box'
            }}
            onContextMenu={handleEmptyAreaContextMenu}
        >
            {/* 树节点列表 */}
            {project.stageTree.rootId ? (
                renderTreeNode(project.stageTree.rootId)
            ) : (
                <div className="empty-state">No Root Stage</div>
            )}

            {/* 底部空白区域（用于拖拽放置） */}
            <div
                style={{ flex: 1, minHeight: '40px', cursor: 'default', position: 'relative' }}
                title="Right-click to create a new stage"
                {...emptyAreaHandlers}
            >
                {/* Sticky Bottom 放置指示器（离散档位：用缩进表现目标父层级） */}
                {dragState.preview?.kind === 'empty' && (
                    <div
                        className={`sticky-drop-indicator ${dragState.preview.mode}`}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: `${dragState.preview.left}px`,
                            right: 0,
                            height: '2px',
                            backgroundColor: 'var(--accent-color)',
                            boxShadow: '0 0 4px var(--accent-color)',
                            pointerEvents: 'none'
                        }}
                    />
                )}
            </div>

            {/* 右键上下文菜单 */}
            {contextMenu && (
                <div
                    className="canvas-context-menu"
                    style={{
                        position: 'fixed',
                        left: contextMenu.x,
                        top: contextMenu.y,
                        zIndex: 1000
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {contextMenu.stageId === null ? (
                        // 空白区域菜单
                        <div className="menu-item" onClick={handleCreateChildStage}>
                            <FolderPlus size={14} style={{ marginRight: '8px' }} />
                            Create Stage
                        </div>
                    ) : (
                        // 节点菜单
                        <>
                            <div className="menu-item" onClick={handleCreateChildStage}>
                                <FolderPlus size={14} style={{ marginRight: '8px' }} />
                                Create Child Stage
                            </div>
                            {project.stageTree.stages[contextMenu.stageId]?.parentId && (
                                <>
                                    <div className="menu-item" onClick={handleCreateSiblingStage}>
                                        <FilePlus size={14} style={{ marginRight: '8px' }} />
                                        Create Sibling Stage
                                    </div>
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
                        </>
                    )}
                </div>
            )}


        </div>
    );
};
