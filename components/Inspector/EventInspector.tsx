/**
 * components/Inspector/EventInspector.tsx
 * 事件属性检查器组件
 * 
 * 职责：
 * - 展示和编辑事件的基本属性（名称、key、描述）
 * - 支持删除操作
 * 
 * UI风格：
 * - 与 StateInspector 保持一致的 Inspector 布局
 * - 使用统一的 CSS 类名和样式
 */

import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import type { EventDefinition } from '../../types/blackboard';
import { Trash2 } from 'lucide-react';

// ========== Props 类型定义 ==========
interface EventInspectorProps {
    eventId: string;
    readOnly?: boolean;
}

// ========== 主组件 ==========
export const EventInspector: React.FC<EventInspectorProps> = ({ eventId, readOnly = false }) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();

    const event = project.blackboard.events[eventId];
    if (!event) return <div className="empty-state">Event not found</div>;

    // 更新事件属性
    const handleUpdate = (updates: Partial<EventDefinition>) => {
        if (!readOnly) {
            dispatch({ type: 'UPDATE_EVENT', payload: { id: eventId, data: updates } });
        }
    };

    // 删除事件（软删除）
    const handleDelete = () => {
        if (!readOnly) {
            dispatch({ type: 'SOFT_DELETE_EVENT', payload: { id: eventId } });
        }
    };

    // 获取删除按钮提示文案
    const getDeleteTooltip = (): string => {
        if (event.state === 'Draft') return 'Delete';
        if (event.state === 'Implemented') return 'Mark for Delete';
        return 'Apply Delete';
    };

    return (
        <div>
            {/* Event Header - 事件头部区域 */}
            <div className="inspector-header-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div className="inspector-type-label" style={{ color: '#dcdcaa' }}>EVENT</div>
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
                        value={event.name}
                        onChange={(e) => handleUpdate({ name: e.target.value })}
                    />
                ) : (
                    <div className="inspector-name-input" style={{ background: 'transparent', border: 'none' }}>
                        {event.name}
                    </div>
                )}
            </div>

            {/* Basic Info Section - 基本信息区块 */}
            <div className="inspector-section inspector-basic-info">
                <div className="inspector-section-title">Basic Info</div>

                {/* ID（只读） */}
                <div className="prop-row">
                    <div className="prop-label">ID</div>
                    <div className="prop-value monospace" style={{ color: '#666' }}>{event.id}</div>
                </div>

                {/* State */}
                <div className="prop-row">
                    <div className="prop-label">State</div>
                    <div className="prop-value">{event.state}</div>
                </div>

                {/* Description */}
                <div className="inspector-description-block">
                    <div className="inspector-description-label">Description</div>
                    {!readOnly ? (
                        <textarea
                            className="inspector-textarea"
                            value={event.description || ''}
                            onChange={(e) => handleUpdate({ description: e.target.value })}
                            placeholder="No description."
                        />
                    ) : (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>
                            {event.description || 'No description.'}
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
                        This area will show where this event is listened to
                        (Stage, State, Node event listeners, etc.)
                    </div>
                </div>
            </div>
        </div>
    );
};