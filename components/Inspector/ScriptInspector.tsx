/**
 * components/Inspector/ScriptInspector.tsx
 * 脚本属性检查器组件
 * 
 * 职责：
 * - 展示和编辑脚本的基本属性（名称、key、类别、描述）
 * - 支持删除操作
 * 
 * UI风格：
 * - 与 StateInspector 保持一致的 Inspector 布局
 * - 使用统一的 CSS 类名和样式
 */

import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import type { ScriptDefinition } from '../../types/manifest';
import type { ScriptCategory } from '../../types/common';
import { Trash2 } from 'lucide-react';

// ========== Props 类型定义 ==========
interface ScriptInspectorProps {
    scriptId: string;
    readOnly?: boolean;
}

// ========== 常量定义 ==========

// 脚本类别颜色映射
const categoryColors: Record<ScriptCategory, string> = {
    Performance: '#c586c0',
    Lifecycle: '#4fc1ff',
    Condition: '#dcdcaa',
    Trigger: '#ce9178'
};

// 脚本类别标签映射
const categoryLabels: Record<ScriptCategory, string> = {
    Performance: 'PERFORMANCE SCRIPT',
    Lifecycle: 'LIFECYCLE SCRIPT',
    Condition: 'CONDITION SCRIPT',
    Trigger: 'TRIGGER SCRIPT'
};

// ========== 主组件 ==========
export const ScriptInspector: React.FC<ScriptInspectorProps> = ({ scriptId, readOnly = false }) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();

    const script = project.scripts.scripts[scriptId];
    if (!script) return <div className="empty-state">Script not found</div>;

    const categoryColor = categoryColors[script.category] || '#c586c0';
    const categoryLabel = categoryLabels[script.category] || script.category.toUpperCase();

    // 更新脚本属性
    const handleUpdate = (updates: Partial<ScriptDefinition>) => {
        if (!readOnly) {
            dispatch({ type: 'UPDATE_SCRIPT', payload: { id: scriptId, data: updates } });
        }
    };

    // 删除脚本（软删除）
    const handleDelete = () => {
        if (!readOnly) {
            dispatch({ type: 'SOFT_DELETE_SCRIPT', payload: { id: scriptId } });
        }
    };

    // 获取删除按钮提示文案
    const getDeleteTooltip = (): string => {
        if (script.state === 'Draft') return 'Delete';
        if (script.state === 'Implemented') return 'Mark for Delete';
        return 'Apply Delete';
    };

    return (
        <div>
            {/* Script Header - 脚本头部区域 */}
            <div className="inspector-header-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div className="inspector-type-label" style={{ color: categoryColor }}>
                        {categoryLabel}
                    </div>
                    {!readOnly && (
                        <button 
                            className="btn-icon btn-icon--danger"
                            onClick={handleDelete} 
                            title={getDeleteTooltip()}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
                {!readOnly ? (
                    <input
                        type="text"
                        className="inspector-name-input"
                        value={script.name}
                        onChange={(e) => handleUpdate({ name: e.target.value })}
                    />
                ) : (
                    <div className="inspector-name-input" style={{ background: 'transparent', border: 'none' }}>
                        {script.name}
                    </div>
                )}
            </div>

            {/* Basic Info Section - 基本信息区块 */}
            <div className="inspector-section inspector-basic-info">
                <div className="inspector-section-title">Basic Info</div>

                {/* ID（只读） */}
                <div className="prop-row">
                    <div className="prop-label">ID</div>
                    <div className="prop-value monospace" style={{ color: '#666' }}>{script.id}</div>
                </div>

                {/* Category */}
                <div className="prop-row">
                    <div className="prop-label">Category</div>
                    {!readOnly ? (
                        <select
                            className="inspector-select"
                            style={{ color: categoryColor }}
                            value={script.category}
                            onChange={(e) => handleUpdate({ category: e.target.value as ScriptCategory })}
                        >
                            <option value="Performance">Performance</option>
                            <option value="Lifecycle">Lifecycle</option>
                            <option value="Condition">Condition</option>
                            <option value="Trigger">Trigger</option>
                        </select>
                    ) : (
                        <div className="prop-value" style={{ color: categoryColor }}>
                            {script.category}
                        </div>
                    )}
                </div>

                {/* State */}
                <div className="prop-row">
                    <div className="prop-label">State</div>
                    <div className="prop-value">{script.state}</div>
                </div>

                {/* Description */}
                <div className="inspector-description-block">
                    <div className="inspector-description-label">Description</div>
                    {!readOnly ? (
                        <textarea
                            className="inspector-textarea"
                            value={script.description || ''}
                            onChange={(e) => handleUpdate({ description: e.target.value })}
                            placeholder="No description."
                        />
                    ) : (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>
                            {script.description || 'No description.'}
                        </div>
                    )}
                </div>
            </div>

            {/* References Section - 引用追踪区块 */}
            <div className="inspector-section">
                <div className="inspector-section-title">References</div>
                <div className="inspector-reference-placeholder">
                    <div className="inspector-reference-placeholder__title">
                        Reference tracking coming soon
                    </div>
                    <div className="inspector-reference-placeholder__desc">
                        This area will show where this script is used
                        (presentation bindings, event listeners, lifecycle bindings, etc.)
                    </div>
                </div>
            </div>
        </div>
    );
};