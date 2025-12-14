/**
 * components/Inspector/PresentationGraphInspector.tsx
 * 演出图属性检查器组件
 * 
 * 职责：
 * - 展示和编辑演出图的基本属性（名称、描述）
 * - 支持删除操作（有节点时弹窗确认）
 * - 显示演出图被引用的位置
 * 
 * 注意：演出图没有 Draft/Implemented/MarkedForDelete 状态
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import type { PresentationGraph } from '../../types/presentation';
import type { MessageLevel } from '../../store/types';
import { Trash2, ExternalLink, Layers } from 'lucide-react';
import { findPresentationGraphReferences } from '../../utils/validation/presentationGraphReferences';
import type { ReferenceNavigationContext } from '../../utils/validation/globalVariableReferences';
import { ConfirmDialog } from './ConfirmDialog';

// ========== Props 类型定义 ==========
interface PresentationGraphInspectorProps {
    graphId: string;
    readOnly?: boolean;
}

// ========== 主组件 ==========
export const PresentationGraphInspector: React.FC<PresentationGraphInspectorProps> = ({ graphId, readOnly = false }) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();

    const graph = project.presentationGraphs[graphId];
    if (!graph) return <div className="empty-state">Presentation Graph not found</div>;

    const nodeCount = Object.keys(graph.nodes || {}).length;

    // ========== 确认对话框状态 ==========
    const [confirmDialog, setConfirmDialog] = useState<{
        title: string;
        message: string;
    } | null>(null);

    // ========== 引用计算 ==========
    const references = useMemo(() => {
        return findPresentationGraphReferences(project, graphId);
    }, [project, graphId]);

    // ========== 消息推送 ==========
    const pushMessage = (level: MessageLevel, text: string) => {
        dispatch({
            type: 'ADD_MESSAGE',
            payload: { id: `msg-${Date.now()}`, level, text, timestamp: new Date().toISOString() }
        });
    };

    // ========== 更新演出图属性 ==========
    const handleUpdate = useCallback((updates: Partial<PresentationGraph>) => {
        if (!readOnly) {
            dispatch({ type: 'UPDATE_PRESENTATION_GRAPH', payload: { graphId, data: updates } });
        }
    }, [readOnly, dispatch, graphId]);

    // ========== 删除逻辑 ==========

    /**
     * 执行删除操作
     */
    const applyDelete = () => {
        dispatch({ type: 'DELETE_PRESENTATION_GRAPH', payload: { graphId } });
        pushMessage(
            references.length > 0 ? 'warning' : 'info',
            `Deleted presentation graph "${graph.name}".`
        );
        setConfirmDialog(null);
    };

    /**
     * 删除按钮点击处理
     * 如果有节点则弹窗确认
     */
    const handleDelete = () => {
        if (readOnly) return;

        // 有节点：弹窗确认
        if (nodeCount > 0) {
            setConfirmDialog({
                title: 'Delete Presentation Graph',
                message: `Graph "${graph.name}" contains ${nodeCount} node(s). Are you sure you want to delete it?`
            });
            return;
        }

        // 无节点：直接删除
        applyDelete();
    };

    /**
     * 确认对话框确认按钮处理
     */
    const handleConfirmDelete = () => {
        if (!confirmDialog) return;
        applyDelete();
    };

    // ========== 点击引用项导航 ==========
    const handleReferenceClick = useCallback((navContext?: ReferenceNavigationContext) => {
        if (!navContext) return;

        const { targetType, nodeId, stateId, transitionId } = navContext;

        switch (targetType) {
            case 'STATE':
                if (nodeId && stateId) {
                    const node = project.nodes[nodeId];
                    if (node) {
                        dispatch({ type: 'NAVIGATE_TO', payload: { stageId: node.stageId, nodeId, graphId: null } });
                        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STATE', id: stateId, contextId: nodeId } });
                    }
                }
                break;

            case 'TRANSITION':
                if (nodeId && transitionId) {
                    const node = project.nodes[nodeId];
                    if (node) {
                        dispatch({ type: 'NAVIGATE_TO', payload: { stageId: node.stageId, nodeId, graphId: null } });
                        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'TRANSITION', id: transitionId, contextId: nodeId } });
                    }
                }
                break;
        }
    }, [project.nodes, dispatch]);

    // ========== 双击打开演出图编辑器 ==========
    const handleOpenGraph = () => {
        dispatch({ type: 'NAVIGATE_TO', payload: { graphId } });
    };

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Graph Header - 演出图头部区域 */}
                <div className="inspector-header-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div className="inspector-type-label" style={{ color: '#c586c0' }}>
                            <Layers size={12} style={{ marginRight: '4px' }} />
                            PRESENTATION GRAPH
                        </div>
                        {/* 操作按钮 */}
                        {!readOnly && (
                            <button
                                className="btn-icon btn-icon--danger"
                                onClick={handleDelete}
                                title="Delete this graph"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                    {!readOnly ? (
                        <input
                            type="text"
                            className="inspector-name-input"
                            value={graph.name}
                            onChange={(e) => handleUpdate({ name: e.target.value })}
                        />
                    ) : (
                        <div className="inspector-name-input" style={{ background: 'transparent', border: 'none' }}>
                            {graph.name}
                        </div>
                    )}
                </div>

                {/* Basic Info Section - 基本信息区块 */}
                <div className="inspector-section inspector-basic-info">
                    <div className="inspector-section-title">Basic Info</div>

                    {/* ID（只读） */}
                    <div className="prop-row">
                        <div className="prop-label">ID</div>
                        <div className="prop-value monospace" style={{ color: '#666' }}>{graph.id}</div>
                    </div>

                    {/* Node Count */}
                    <div className="prop-row">
                        <div className="prop-label">Nodes</div>
                        <div className="prop-value">
                            <span style={{ color: 'var(--accent-color)' }}>{nodeCount}</span>
                        </div>
                    </div>

                    {/* Start Node */}
                    <div className="prop-row">
                        <div className="prop-label">Start Node</div>
                        <div className="prop-value">
                            {graph.startNodeId ? (
                                <span style={{ color: '#4fc1ff', fontFamily: 'monospace' }}>
                                    {graph.nodes?.[graph.startNodeId]?.name || graph.startNodeId}
                                </span>
                            ) : (
                                <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>None</span>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="inspector-description-block">
                        <div className="inspector-description-label">Description</div>
                        {!readOnly ? (
                            <textarea
                                className="inspector-textarea"
                                value={graph.description || ''}
                                onChange={(e) => handleUpdate({ description: e.target.value })}
                                placeholder="No description."
                            />
                        ) : (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5, fontStyle: 'italic' }}>
                                {graph.description || 'No description.'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Open Editor Button */}
                <div className="inspector-section">
                    <button
                        className="btn-primary"
                        onClick={handleOpenGraph}
                        style={{ width: '100%' }}
                    >
                        Open in Editor
                    </button>
                </div>

                {/* References Section - 引用追踪区块 */}
                <div className="inspector-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div className="inspector-section-title">
                        References ({references.length})
                    </div>
                    {references.length > 0 ? (
                        <div style={{
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            flex: 1,
                            overflowY: 'auto'
                        }}>
                            {references.map((ref, idx) => (
                                <div
                                    key={idx}
                                    className={ref.navContext ? 'inspector-reference-item inspector-reference-item--clickable' : 'inspector-reference-item'}
                                    style={{
                                        padding: '4px 0',
                                        borderBottom: idx < references.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                                        cursor: ref.navContext ? 'pointer' : 'default',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                    onClick={() => handleReferenceClick(ref.navContext)}
                                    title={ref.navContext ? 'Click to navigate to this reference' : undefined}
                                >
                                    <span style={{ flex: 1 }}>{ref.location}</span>
                                    {ref.navContext && (
                                        <ExternalLink size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="inspector-reference-placeholder">
                            <div className="inspector-reference-placeholder__desc">
                                No references found in this project.
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirm Dialog - 确认对话框 */}
            {confirmDialog && (
                <ConfirmDialog
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    confirmText="Delete"
                    onCancel={() => setConfirmDialog(null)}
                    onConfirm={handleConfirmDelete}
                />
            )}
        </>
    );
};
