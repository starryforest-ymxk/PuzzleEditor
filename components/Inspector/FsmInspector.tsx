/**
 * components/Inspector/FsmInspector.tsx
 * 状态机属性检查器组件
 * 从 Inspector.tsx 拆分而来，负责展示 StateMachine 属性
 */

import React from 'react';
import { useEditorState } from '../../store/context';
import type { PuzzleNode } from '../../types/puzzleNode';

interface FsmInspectorProps {
    fsmId: string;
    readOnly?: boolean;
}

export const FsmInspector: React.FC<FsmInspectorProps> = ({ fsmId, readOnly = false }) => {
    const { project } = useEditorState();

    const fsm = project.stateMachines[fsmId];
    if (!fsm) return <div className="empty-state">State machine not found</div>;

    const stateCount = Object.keys(fsm.states || {}).length;
    const transitionCount = Object.keys(fsm.transitions || {}).length;
    const initialState = fsm.initialStateId ? fsm.states[fsm.initialStateId] : null;

    // 查找所属的 Puzzle Node
    const ownerNode = Object.values<PuzzleNode>(project.nodes).find(n => n.stateMachineId === fsm.id);

    return (
        <div>
            {/* FSM Header */}
            <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
                <div style={{ fontSize: '10px', color: '#4fc1ff', marginBottom: '4px', letterSpacing: '1px' }}>STATE MACHINE</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{fsm.name}</div>
            </div>

            {/* Basic Info Section */}
            <div className="inspector-section inspector-basic-info">
                <div className="inspector-section-title">Basic Info</div>
                <div className="prop-row">
                    <div className="prop-label">ID</div>
                    <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{fsm.id}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">States</div>
                    <div className="prop-value" style={{ color: 'var(--accent-color)' }}>{stateCount}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Transitions</div>
                    <div className="prop-value" style={{ color: 'var(--accent-warning)' }}>{transitionCount}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Initial State</div>
                    <div className="prop-value" style={{ color: '#4fc1ff' }}>{initialState ? initialState.name : '-'}</div>
                </div>
            </div>

            {/* Owner Section */}
            <div className="inspector-section inspector-basic-info">
                <div className="inspector-section-title">Owner Node</div>
                {ownerNode ? (
                    <>
                        <div className="prop-row">
                            <div className="prop-label">Puzzle Node</div>
                            <div className="prop-value" style={{ color: '#ce9178' }}>{ownerNode.name}</div>
                        </div>
                        <div className="prop-row">
                            <div className="prop-label">Node ID</div>
                            <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{ownerNode.id}</div>
                        </div>
                        {ownerNode.description && (
                            <div className="prop-row">
                                <div className="prop-label">Description</div>
                                <div className="prop-value" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                    {ownerNode.description}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>No owner node found</div>
                )}
            </div>

            {/* States Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>States</div>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {Object.values(fsm.states).length === 0 ? (
                        <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>No states</div>
                    ) : (
                        Object.values(fsm.states).map((state: any) => (
                            <div key={state.id} style={{ padding: '6px 8px', marginBottom: '4px', background: '#1f1f1f', borderRadius: '4px', borderLeft: state.id === fsm.initialStateId ? '3px solid #4fc1ff' : '3px solid #444' }}>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{state.name}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Transitions Section */}
            <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transitions</div>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {Object.values(fsm.transitions).length === 0 ? (
                        <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>No transitions</div>
                    ) : (
                        Object.values(fsm.transitions).map((trans: any) => {
                            const from = fsm.states[trans.fromStateId];
                            const to = fsm.states[trans.toStateId];
                            return (
                                <div key={trans.id} style={{ padding: '6px 8px', marginBottom: '4px', background: '#1f1f1f', borderRadius: '4px', borderLeft: '3px solid var(--accent-warning)' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        {from?.name || '?'} → {to?.name || '?'}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{trans.name}</div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

