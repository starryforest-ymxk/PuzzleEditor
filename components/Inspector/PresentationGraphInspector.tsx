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

import React, { useMemo, useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import type { PresentationGraph } from '../../types/presentation';
import { Trash2, Layers } from 'lucide-react';
import { findPresentationGraphReferences } from '../../utils/validation/presentationGraphReferences';
import { ReferenceListSection } from './ReferenceListSection';
import { useDeleteHandler } from '../../hooks/useDeleteHandler';

// ========== Props 类型定义 ==========
interface PresentationGraphInspectorProps {
    graphId: string;
    readOnly?: boolean;
}

// ========== 主组件 ==========
export const PresentationGraphInspector: React.FC<PresentationGraphInspectorProps> = ({ graphId, readOnly = false }) => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();

    const graph = project.presentationGraphs[graphId];

    const nodeCount = Object.keys(graph?.nodes || {}).length;

    // 统一删除逻辑 Hook
    const { deletePresentationGraph } = useDeleteHandler();

    // ========== 引用计算 ==========
    const references = useMemo(() => {
        return findPresentationGraphReferences(project, graphId);
    }, [project, graphId]);

    // ========== 更新演出图属性 ==========
    const handleUpdate = useCallback((updates: Partial<PresentationGraph>) => {
        if (!readOnly) {
            dispatch({ type: 'UPDATE_PRESENTATION_GRAPH', payload: { graphId, data: updates } });
        }
    }, [readOnly, dispatch, graphId]);

    // 所有 hooks 执行完毕后才能条件 return（React hooks 规则）
    if (!graph) return <div className="empty-state">Presentation Graph not found</div>;

    // ========== 删除逻辑（委托给 useDeleteHandler 统一处理） ==========

    /**
     * 删除按钮点击处理
     * 委托给 useDeleteHandler.deletePresentationGraph，统一处理引用检查和确认弹窗
     */
    const handleDelete = () => {
        if (readOnly) return;
        // 在编辑器中编辑当前图时不允许删除（与按钮 disabled 状态一致）
        if (ui.view === 'EDITOR' && ui.currentGraphId === graphId) return;
        deletePresentationGraph(graphId);
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
                        {/* 操作按钮 - 在演出图画布编辑模式下禁用当前正在编辑的演出图删除功能 */}
                        {!readOnly && (
                            <button
                                className="btn-icon btn-icon--danger"
                                onClick={handleDelete}
                                disabled={ui.view === 'EDITOR' && ui.currentGraphId === graphId}
                                style={{
                                    opacity: (ui.view === 'EDITOR' && ui.currentGraphId === graphId) ? 0.5 : 1,
                                    cursor: (ui.view === 'EDITOR' && ui.currentGraphId === graphId) ? 'not-allowed' : 'pointer'
                                }}
                                title={(ui.view === 'EDITOR' && ui.currentGraphId === graphId)
                                    ? "Cannot delete graph while editing"
                                    : "Delete this graph"}
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
                                <span style={{ color: '#c586c0', fontFamily: 'monospace' }}>
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

                {/* Nodes Section - 节点列表 */}
                <div className="inspector-section" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <div className="inspector-section-title">
                        Nodes ({nodeCount})
                    </div>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                        {nodeCount === 0 ? (
                            <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>No nodes</div>
                        ) : (
                            (Object.values(graph.nodes) as any[]).map((node) => (
                                <div
                                    key={node.id}
                                    style={{
                                        padding: '6px 8px',
                                        marginBottom: '4px',
                                        background: '#1f1f1f',
                                        borderRadius: '4px',
                                        borderLeft: node.id === graph.startNodeId ? '3px solid #c586c0' : '3px solid #444'
                                    }}
                                >
                                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{node.name}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{node.type}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* References Section - 引用追踪区块 */}
                <ReferenceListSection references={references} />
            </div>

        </>
    );
};
