/**
 * components/Canvas/StageOverview.tsx
 * Stage 内容概览视图
 * 
 * 功能：
 * - 展示子 Stage 卡片和 PuzzleNode 卡片
 * - 支持创建子 Stage 和 PuzzleNode
 * - 单击选中，双击进入
 */

import React, { useCallback } from 'react';
import { createNodeWithStateMachine, createTriggerNodeWithStateMachine, getMaxDisplayOrder, buildExistingIds } from '../../utils/puzzleNodeUtils';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { PuzzleNode } from '../../types/puzzleNode';
import { StageId } from '../../types/common';
import { Folder, Box, FileCode, Plus, ChevronDown, ExternalLink, Trash2 } from 'lucide-react';
import { createDefaultStage } from '../../utils/stageTreeUtils';
import { useDeleteHandler } from '../../hooks/useDeleteHandler';
import { navigateAndSelect } from '../../utils/referenceNavigation';

interface StageOverviewProps {
    stageId: string;
}

interface NodeCreationMenuProps {
    onCreate: (type: 'EMPTY' | 'TRIGGER') => void;
}

const NodeCreationMenu: React.FC<NodeCreationMenuProps> = ({ onCreate }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const timeoutId = setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);
        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isOpen]);

    const active = isOpen || isHovered;

    return (
        <div style={{ position: 'relative' }} ref={menuRef}>
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    minWidth: '120px',
                    fontWeight: 500,
                    color: active ? 'white' : 'var(--accent-color)',
                    background: active ? 'var(--accent-color)' : 'transparent',
                    border: '1px solid var(--accent-color)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }}
            >
                <Plus size={12} />
                Create Node
                <ChevronDown size={12} />
            </button>

            {isOpen && (
                <div
                    className="canvas-context-menu"
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        marginTop: '4px',
                        minWidth: '140px',
                        zIndex: 100
                    }}
                >
                    <div className="menu-item" onClick={(e) => { onCreate('EMPTY'); setIsOpen(false); }}>
                        Empty Node
                    </div>
                    <div className="menu-item" onClick={(e) => { onCreate('TRIGGER'); setIsOpen(false); }}>
                        Trigger Node
                    </div>
                </div>
            )}
        </div>
    );
};

export const StageOverview: React.FC<StageOverviewProps> = ({ stageId }) => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();
    const { deleteNode, deleteStage } = useDeleteHandler();

    const stage = project.stageTree.stages[stageId];
    if (!stage) return <div className="empty-state">Stage not found</div>;

    // 1. Get Sub-Stages
    const subStages = stage.childrenIds
        .map(id => project.stageTree.stages[id])
        .filter(Boolean);

    // 2. Get Puzzle Nodes (sorted by displayOrder)
    const nodes = (Object.values(project.nodes) as PuzzleNode[])
        .filter(n => n.stageId === stageId)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

    // ========== 状态管理 ==========

    // 上下文菜单状态
    const [contextMenu, setContextMenu] = React.useState<{
        x: number;
        y: number;
        type: 'STAGE' | 'NODE';
        id: string;
    } | null>(null);

    // 关闭菜单
    React.useEffect(() => {
        if (!contextMenu) return;
        const handleClickOutside = () => setContextMenu(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [contextMenu]);

    // ========== 事件处理：选择 ==========

    const handleStageClick = (e: React.MouseEvent) => {
        // 点击空白区域（非卡片）时选中当前 Stage
        const target = e.target as HTMLElement;
        if (!target.closest('.overview-card')) {
            dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: stageId } });
        }
    };

    const handleCardClick = (e: React.MouseEvent, type: 'STAGE' | 'NODE', id: string) => {
        e.stopPropagation();
        dispatch({ type: 'SELECT_OBJECT', payload: { type, id } });
    };

    const handleCardContextMenu = (e: React.MouseEvent, type: 'STAGE' | 'NODE', id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            type,
            id
        });
    };

    const handleNodeDoubleClick = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        navigateAndSelect(dispatch, { nodeId }, { type: 'NODE', id: nodeId });
    };

    const handleStageDoubleClick = (e: React.MouseEvent, targetStageId: string) => {
        e.stopPropagation();
        navigateAndSelect(dispatch,
            { stageId: targetStageId, nodeId: null },
            { type: 'STAGE', id: targetStageId }
        );
    };

    // ========== 事件处理：创建 ==========

    /** 创建子 Stage */
    const handleCreateSubStage = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const existingStageIds = Object.keys(project.stageTree.stages);
        const newStage = createDefaultStage(stageId as StageId, existingStageIds);
        dispatch({ type: 'ADD_STAGE', payload: { parentId: stageId as StageId, stage: newStage } });
        dispatch({ type: 'SET_STAGE_EXPANDED', payload: { id: stageId, expanded: true } });
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: newStage.id } });
    }, [stageId, dispatch]);

    /** 创建 PuzzleNode */
    const handleCreateNode = useCallback((e: React.MouseEvent | null, type: 'EMPTY' | 'TRIGGER' = 'EMPTY') => {
        e?.stopPropagation();

        // 获取最大 displayOrder
        const maxOrder = getMaxDisplayOrder(project.nodes, stageId as StageId);

        // 构建现有 ID 集合
        const existingIds = buildExistingIds(project.nodes, project.stateMachines);

        let result;
        if (type === 'TRIGGER') {
            result = createTriggerNodeWithStateMachine(stageId as StageId, existingIds, 'New Trigger Node', maxOrder + 1);
        } else {
            result = createNodeWithStateMachine(stageId as StageId, existingIds, 'New Empty Node', maxOrder + 1, false);
        }

        const { node, stateMachine } = result;

        dispatch({
            type: 'ADD_PUZZLE_NODE',
            payload: { stageId: stageId as StageId, node, stateMachine }
        });
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: node.id } });
    }, [stageId, project.nodes, dispatch]);

    // ========== 事件处理：菜单操作 ==========

    const handleOpenItem = () => {
        if (!contextMenu) return;
        if (contextMenu.type === 'STAGE') {
            navigateAndSelect(dispatch,
                { stageId: contextMenu.id, nodeId: null },
                { type: 'STAGE', id: contextMenu.id }
            );
        } else {
            navigateAndSelect(dispatch,
                { nodeId: contextMenu.id },
                { type: 'NODE', id: contextMenu.id }
            );
        }
        setContextMenu(null);
    };

    const handleDeleteItem = () => {
        if (!contextMenu) return;

        if (contextMenu.type === 'STAGE') {
            // Stage 删除统一走全局删除流程与全局确认弹窗
            deleteStage(contextMenu.id);
        } else {
            // Node 删除统一走全局删除流程与全局确认弹窗
            deleteNode(contextMenu.id);
        }
        setContextMenu(null);
    };

    // ========== 渲染：卡片 ==========

    const renderCard = (
        id: string,
        name: string,
        type: 'STAGE' | 'NODE',
        description?: string,
        onDoubleClick?: (e: React.MouseEvent) => void
    ) => {
        const isSelected = ui.selection.type === type && ui.selection.id === id;

        return (
            <div
                key={id}
                className={`overview-card ${isSelected ? 'selected' : ''}`}
                style={{ height: '140px' }}
                onClick={(e) => handleCardClick(e, type, id)}
                onDoubleClick={onDoubleClick}
                onContextMenu={(e) => handleCardContextMenu(e, type, id)}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {type === 'STAGE' ? <Folder size={14} /> : <FileCode size={14} />}
                        {name}
                    </div>
                    <div style={{
                        fontSize: '10px',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-color)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)'
                    }}>
                        {type}
                    </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', lineHeight: '1.4' }}>
                    {description || 'No description provided.'}
                </div>

                <div style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '8px',
                    marginTop: 'auto',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px'
                }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{id.slice(0, 8)}...</span>
                    <span style={{ color: 'var(--accent-color)', fontWeight: 500, display: 'flex', alignItems: 'center', opacity: 0.8 }}>
                        {type === 'NODE' ? 'Open Node ->' : 'Open Stage ->'}
                    </span>
                </div>
            </div>
        );
    };

    // ========== 渲染：创建按钮 ==========

    const renderCreateButton = (label: string, onClick: (e: React.MouseEvent) => void) => (
        <button
            onClick={onClick}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '4px 10px',
                fontSize: '11px',
                minWidth: '120px',
                fontWeight: 500,
                color: 'var(--accent-color)',
                background: 'transparent',
                border: '1px solid var(--accent-color)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.background = 'var(--accent-color)';
                (e.target as HTMLButtonElement).style.color = 'white';
            }}
            onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.background = 'transparent';
                (e.target as HTMLButtonElement).style.color = 'var(--accent-color)';
            }}
        >
            <Plus size={12} />
            {label}
        </button>
    );

    return (
        <div
            className="canvas-grid"
            style={{
                position: 'relative',
                zIndex: 1,
                padding: '40px',
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                overflowY: 'auto',
                background: 'var(--bg-color)'
            }}
            onClick={handleStageClick}
        >
            {/* Header Section */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: 'var(--accent-color)' }}>
                    <Box size={16} />
                    <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>Stage Overview</span>
                </div>
                <h1 style={{ margin: '0 0 8px 0', fontWeight: 300, fontSize: '28px', color: 'var(--text-primary)' }}>
                    {stage.name}
                </h1>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '600px' }}>
                    {stage.description || 'No description provided for this stage.'}
                </div>
            </div>

            {/* Section: Sub-Stages */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                        Sub-Stages ({subStages.length})
                    </h3>
                    {renderCreateButton('Create Stage', handleCreateSubStage)}
                </div>
                {subStages.length > 0 ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                        gap: '16px'
                    }}>
                        {subStages.map(s => renderCard(s.id, s.name, 'STAGE', s.description, (e) => handleStageDoubleClick(e, s.id)))}
                    </div>
                ) : (
                    <div style={{
                        border: '2px dashed var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '24px',
                        textAlign: 'center',
                        color: 'var(--text-dim)',
                        backgroundColor: 'rgba(255,255,255,0.02)'
                    }}>
                        No sub-stages yet. Click "+ Create Stage" to add one.
                    </div>
                )}
            </div>

            {/* Section: Puzzle Nodes */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                        Puzzle Nodes ({nodes.length})
                    </h3>
                    <NodeCreationMenu onCreate={(type) => handleCreateNode(null as any, type)} />
                </div>
                {nodes.length > 0 ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                        gap: '16px'
                    }}>
                        {nodes.map(n => renderCard(n.id, n.name, 'NODE', n.description, (e) => handleNodeDoubleClick(e, n.id)))}
                    </div>
                ) : (
                    <div style={{
                        border: '2px dashed var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '24px',
                        textAlign: 'center',
                        color: 'var(--text-dim)',
                        backgroundColor: 'rgba(255,255,255,0.02)'
                    }}>
                        No puzzle nodes yet. Click "+ Create Node" to add one.
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="canvas-context-menu"
                    style={{
                        position: 'fixed',
                        left: contextMenu.x,
                        top: contextMenu.y,
                        zIndex: 1000,
                        minWidth: '120px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="menu-item" onClick={handleOpenItem}>
                        <ExternalLink size={14} style={{ marginRight: '8px' }} />
                        Open {contextMenu.type === 'STAGE' ? 'Stage' : 'Node'}
                    </div>
                    <div className="menu-divider" />
                    <div className="menu-item menu-item-danger" onClick={handleDeleteItem}>
                        <Trash2 size={14} style={{ marginRight: '8px' }} />
                        Delete
                    </div>
                </div>
            )}
        </div>
    );
};

