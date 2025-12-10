/**
 * components/Inspector/EventInspector.tsx
 * 事件属性检查器组件
 * 从 Inspector.tsx 拆分而来，负责展示 Event 属性
 */

import React from 'react';
import { useEditorState } from '../../store/context';

interface EventInspectorProps {
    eventId: string;
    readOnly?: boolean;
}

export const EventInspector: React.FC<EventInspectorProps> = ({ eventId, readOnly = false }) => {
    const { project } = useEditorState();

    const event = project.blackboard.events[eventId];
    if (!event) return <div className="empty-state">Event not found</div>;

    return (
        <div>
            {/* Event Header */}
            <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
                <div style={{ fontSize: '10px', color: '#dcdcaa', marginBottom: '4px', letterSpacing: '1px' }}>EVENT</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{event.name}</div>
            </div>

            {/* Basic Info Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</div>
                <div className="prop-row">
                    <div className="prop-label">Key</div>
                    <div className="prop-value monospace">{event.key}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">State</div>
                    <div className="prop-value">{event.state}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Description</div>
                    <div className="prop-value">{event.description || '-'}</div>
                </div>
            </div>

            {/* References Section (Placeholder) */}
            <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>References</div>
                <div style={{ padding: '12px', background: '#1a1a1a', borderRadius: '4px', border: '1px dashed #444', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Reference tracking coming soon</div>
                    <div style={{ fontSize: '10px', color: '#666' }}>This area will show where this event is listened to (Stage, State, Node event listeners, etc.)</div>
                </div>
            </div>
        </div>
    );
};

