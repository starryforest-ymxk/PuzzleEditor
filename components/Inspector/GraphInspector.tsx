/**
 * components/Inspector/GraphInspector.tsx
 * 演出图属性检查器组件
 * 从 Inspector.tsx 拆分而来，负责展示 PresentationGraph 属性
 */

import React from 'react';
import { useEditorState } from '../../store/context';

interface GraphInspectorProps {
    graphId: string;
    readOnly?: boolean;
}

export const GraphInspector: React.FC<GraphInspectorProps> = ({ graphId, readOnly = false }) => {
    const { project } = useEditorState();

    const graph = project.presentationGraphs[graphId];
    if (!graph) return <div className="empty-state">Presentation graph not found</div>;

    const nodeCount = Object.keys(graph.nodes || {}).length;
    const startNode = graph.startNodeId ? graph.nodes[graph.startNodeId] : null;

    return (
        <div>
            {/* Presentation Graph Header */}
            <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
                <div style={{ fontSize: '10px', color: '#c586c0', marginBottom: '4px', letterSpacing: '1px' }}>PRESENTATION GRAPH</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{graph.name}</div>
            </div>

            {/* Basic Info Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</div>
                <div className="prop-row">
                    <div className="prop-label">ID</div>
                    <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{graph.id}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Nodes</div>
                    <div className="prop-value" style={{ color: 'var(--accent-color)' }}>{nodeCount}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Start Node</div>
                    <div className="prop-value" style={{ color: '#4fc1ff' }}>{startNode ? startNode.name : '-'}</div>
                </div>
            </div>

            {/* Nodes Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nodes</div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {Object.values(graph.nodes).length === 0 ? (
                        <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>No nodes</div>
                    ) : (
                        Object.values(graph.nodes).map((node: any) => (
                            <div key={node.id} style={{ padding: '8px', marginBottom: '6px', background: '#1f1f1f', borderRadius: '4px', borderLeft: '3px solid #c586c0' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{node.name}</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>{node.type}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* References Section (Placeholder) */}
            <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>References</div>
                <div style={{ padding: '12px', background: '#1a1a1a', borderRadius: '4px', border: '1px dashed #444', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Reference tracking coming soon</div>
                    <div style={{ fontSize: '10px', color: '#666' }}>This area will show where this graph is used (Stage enter/exit, State/Transition presentations, nested calls, etc.)</div>
                </div>
            </div>
        </div>
    );
};

