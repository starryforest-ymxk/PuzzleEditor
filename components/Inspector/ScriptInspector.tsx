/**
 * components/Inspector/ScriptInspector.tsx
 * 脚本属性检查器组件
 * 从 Inspector.tsx 拆分而来，负责展示 Script 属性
 */

import React from 'react';
import { useEditorState } from '../../store/context';

interface ScriptInspectorProps {
    scriptId: string;
    readOnly?: boolean;
}

// 脚本类别颜色映射
const categoryColors: Record<string, string> = {
    Performance: '#c586c0',
    Lifecycle: '#4fc1ff',
    Condition: '#dcdcaa',
    Trigger: '#ce9178'
};

// Script category labels
const categoryLabels: Record<string, string> = {
    Performance: 'Performance Script',
    Lifecycle: 'Lifecycle Script',
    Condition: 'Condition Script',
    Trigger: 'Trigger Script'
};

export const ScriptInspector: React.FC<ScriptInspectorProps> = ({ scriptId, readOnly = false }) => {
    const { project } = useEditorState();

    const script = project.scripts.scripts[scriptId];
    if (!script) return <div className="empty-state">Script not found</div>;

    const categoryColor = categoryColors[script.category] || '#c586c0';
    const categoryLabel = categoryLabels[script.category] || script.category;

    return (
        <div>
            {/* Script Header */}
            <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
                <div style={{ fontSize: '10px', color: categoryColor, marginBottom: '4px', letterSpacing: '1px' }}>{categoryLabel.toUpperCase()}</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{script.name}</div>
            </div>

            {/* Basic Info Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</div>
                <div className="prop-row">
                    <div className="prop-label">Key</div>
                    <div className="prop-value monospace">{script.key}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Category</div>
                    <div className="prop-value" style={{ color: categoryColor }}>{categoryLabel}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">State</div>
                    <div className="prop-value">{script.state}</div>
                </div>
                {script.description && (
                    <div className="prop-row">
                        <div className="prop-label">Description</div>
                        <div className="prop-value">{script.description}</div>
                    </div>
                )}
            </div>

            {/* References Section (Placeholder) */}
            <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>References</div>
                <div style={{ padding: '12px', background: '#1a1a1a', borderRadius: '4px', border: '1px dashed #444', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Reference tracking coming soon</div>
                    <div style={{ fontSize: '10px', color: '#666' }}>This area will show where this script is used (presentation bindings, event listeners, lifecycle bindings, etc.)</div>
                </div>
            </div>
        </div>
    );
};

