/**
 * components/Inspector/NodeInspector.tsx
 * PuzzleNode 节点属性检查器组件
 * 从 Inspector.tsx 拆分而来，负责展示和编辑 PuzzleNode 属性
 */

import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { LocalVariableEditor } from './LocalVariableEditor';
import { EventListenersEditor } from './EventListenersEditor';
import { ResourceSelect } from './ResourceSelect';
import { collectVisibleVariables } from '../../utils/variableScope';
import type { ScriptDefinition } from '../../types/manifest';
import type { EventDefinition } from '../../types/blackboard';

interface NodeInspectorProps {
    nodeId: string;
    readOnly?: boolean;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({ nodeId, readOnly = false }) => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();

    // 预先获取脚本、事件选项
    const scriptDefs = project.scripts.scripts || {};
    const scriptOptions = Object.values<ScriptDefinition>(scriptDefs).map(s => ({ id: s.id, name: s.name, state: s.state, description: s.description }));
    const lifecycleScriptOptions = Object.values<ScriptDefinition>(scriptDefs)
        .filter(s => s.category === 'Lifecycle' && (!s.lifecycleType || s.lifecycleType === 'Node'))
        .map(s => ({
            id: s.id,
            name: s.name,
            state: s.state,
            category: s.category,
            description: s.description
        }));
    const eventOptions = Object.values<EventDefinition>(project.blackboard.events || {}).map(e => ({
        id: e.id,
        name: e.name,
        state: e.state,
        description: e.description
    }));

    const node = project.nodes[nodeId];
    if (!node) return <div className="empty-state">Node not found</div>;

    // 计算当前可见变量
    const visibleVars = collectVisibleVariables(
        { project, ui: { selection: ui.selection, multiSelectStateIds: [] }, history: { past: [], future: [] } } as any,
        node.stageId,
        node.id
    ).all.filter(v => v.state !== 'MarkedForDelete');

    return (
        <div>
            {/* Node Header */}
            <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
                <div style={{ fontSize: '10px', color: '#ce9178', marginBottom: '4px', letterSpacing: '1px' }}>PUZZLE NODE</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{node.name}</div>
            </div>

            {/* Basic Info Section */}
            <div className="inspector-basic-info" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</div>
                <div className="prop-row">
                    <div className="prop-label">ID</div>
                    <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{node.id}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Type</div>
                    <div className="prop-value">{node.type || 'Default'}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Description</div>
                    <div className="prop-value">{node.description || 'No description'}</div>
                </div>
            </div>

            {/* Lifecycle Script Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lifecycle Script</div>
                <div className="inspector-row" style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <ResourceSelect
                        options={lifecycleScriptOptions}
                        value={node.lifecycleScriptId || ''}
                        onChange={(val) => dispatch({ type: 'UPDATE_NODE', payload: { nodeId: node.id, data: { lifecycleScriptId: val || undefined } } })}
                        placeholder="Select lifecycle script"
                        warnOnMarkedDelete
                        disabled={readOnly}
                        showDetails
                        onClear={node.lifecycleScriptId ? () => dispatch({ type: 'UPDATE_NODE', payload: { nodeId: node.id, data: { lifecycleScriptId: undefined } } }) : undefined}
                    />
                </div>
            </div>

            {/* Event Listeners Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Event Listeners</div>
                <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <EventListenersEditor
                        listeners={node.eventListeners || []}
                        onChange={(next) => dispatch({ type: 'UPDATE_NODE', payload: { nodeId: node.id, data: { eventListeners: next } } })}
                        eventOptions={eventOptions}
                        scriptOptions={scriptOptions}
                        variables={visibleVars}
                    />
                </div>
            </div>

            {/* Local Variables Section */}
            <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Local Variables</div>
                <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <LocalVariableEditor
                        variables={node.localVariables}
                        ownerType="node"
                        ownerId={node.id}
                        readOnly={readOnly}
                    />
                </div>
            </div>
        </div>
    );
};
