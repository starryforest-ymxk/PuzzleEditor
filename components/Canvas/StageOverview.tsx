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
import { useEditorState, useEditorDispatch } from '../../store/context';
import { PuzzleNode } from '../../types/puzzleNode';
import { StageId } from '../../types/common';
import { Folder, Box, FileCode, Plus } from 'lucide-react';
import { createDefaultStage } from '../../utils/stageTreeUtils';
import { createNodeWithStateMachine, getMaxDisplayOrder } from '../../utils/puzzleNodeUtils';

interface StageOverviewProps {
    stageId: string;
}

export const StageOverview: React.FC<StageOverviewProps> = ({ stageId }) => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();

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

    // ========== 事件处理：选择 ==========

    const handleStageClick = (e: React.MouseEvent) => {
        // Select Stage when clicking background
        if (e.target === e.currentTarget) {
            dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: stageId } });
        }
    };

    const handleCardClick = (e: React.MouseEvent, type: 'STAGE' | 'NODE', id: string) => {
        e.stopPropagation();
        dispatch({ type: 'SELECT_OBJECT', payload: { type, id } });
    };

    const handleNodeDoubleClick = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        dispatch({ type: 'NAVIGATE_TO', payload: { nodeId } });
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: nodeId } });
    };

    const handleStageDoubleClick = (e: React.MouseEvent, targetStageId: string) => {
        e.stopPropagation();
        dispatch({ type: 'NAVIGATE_TO', payload: { stageId: targetStageId, nodeId: null } });
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: targetStageId } });
    };

    // ========== 事件处理：创建 ==========

    /** 创建子 Stage */
    const handleCreateSubStage = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const newStage = createDefaultStage(stageId as StageId);
        dispatch({ type: 'ADD_STAGE', payload: { parentId: stageId as StageId, stage: newStage } });
        dispatch({ type: 'SET_STAGE_EXPANDED', payload: { id: stageId, expanded: true } });
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: newStage.id } });
    }, [stageId, dispatch]);

    /** 创建 PuzzleNode */
    const handleCreateNode = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

        // 获取最大 displayOrder
        const maxOrder = getMaxDisplayOrder(project.nodes, stageId as StageId);

        // 创建新节点和状态机
        const { node, stateMachine } = createNodeWithStateMachine(
            stageId as StageId,
            'New Node',
            maxOrder + 1
        );

        dispatch({
            type: 'ADD_PUZZLE_NODE',
            payload: { stageId: stageId as StageId, node, stateMachine }
        });
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: node.id } });
    }, [stageId, project.nodes, dispatch]);

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
                gap: '4px',
                padding: '4px 10px',
                fontSize: '11px',
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
                    {renderCreateButton('Create Node', handleCreateNode)}
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
        </div>
    );
};

