/**
 * components/Blackboard/GraphCard.tsx
 * 演出图卡片组件 - 用于显示单个演出图的信息
 */

import React from 'react';
import { Layers } from 'lucide-react';
import { PresentationGraph } from '../../types/presentation';

// ========== 组件 Props ==========

interface GraphCardProps {
    /** 演出图数据 */
    graph: PresentationGraph;
    /** 是否被选中 */
    isSelected: boolean;
    /** 点击卡片的回调（选中） */
    onClick: () => void;
    /** 双击卡片的回调（打开编辑器） */
    onDoubleClick: () => void;
    /** 引用数量（可选） */
    referenceCount?: number;
}

// ========== 组件 ==========

/**
 * 演出图卡片组件
 * 显示演出图的名称、ID、节点数量和起始节点信息
 */
export const GraphCard: React.FC<GraphCardProps> = ({
    graph,
    isSelected,
    onClick,
    onDoubleClick,
    referenceCount
}) => {
    const nodeCount = Object.keys(graph.nodes || {}).length;

    return (
        <div
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            className={`overview-card ${isSelected ? 'selected' : ''}`}
            style={{
                cursor: 'pointer',
                marginBottom: '8px',
                height: 'auto',
                padding: '12px'
            }}
        >
            {/* 头部：图标 + 名称 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={14} style={{ color: '#c586c0' }} />
                    <span style={{
                        fontWeight: 600,
                        fontSize: '13px',
                        color: 'var(--text-primary)'
                    }}>
                        {graph.name}
                    </span>
                </div>
            </div>

            {/* ID */}
            <div style={{
                fontSize: '10px',
                color: 'var(--text-dim)',
                fontFamily: 'monospace',
                marginBottom: '6px'
            }}>
                {graph.id}
            </div>

            {/* 节点数量、起始节点和引用数量 */}
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', flexWrap: 'wrap' }}>
                <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Nodes: </span>
                    <span style={{ color: 'var(--accent-color)', fontFamily: 'monospace' }}>
                        {nodeCount}
                    </span>
                </div>
                {graph.startNodeId && (
                    <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Start: </span>
                        <span style={{ color: '#4fc1ff', fontFamily: 'monospace' }}>
                            {graph.nodes[graph.startNodeId]?.name || graph.startNodeId}
                        </span>
                    </div>
                )}
                {referenceCount !== undefined && (
                    <div>
                        <span style={{ color: 'var(--text-secondary)' }}>Refs: </span>
                        <span style={{ color: referenceCount > 0 ? '#60a5fa' : 'var(--text-dim)' }}>
                            {referenceCount}
                        </span>
                    </div>
                )}
            </div>

            {/* 描述信息 */}
            {graph.description && (
                <div style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #333',
                    fontSize: '11px',
                    color: '#9ca3af',
                    fontStyle: 'italic',
                    lineHeight: 1.4
                }}>
                    {graph.description}
                </div>
            )}
        </div>
    );
};

export default GraphCard;
