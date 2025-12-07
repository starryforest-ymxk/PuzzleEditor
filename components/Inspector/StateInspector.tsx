import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';

interface Props {
    fsmId: string;
    stateId: string;
}

export const StateInspector = ({ fsmId, stateId }: Props) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();

    const fsm = project.stateMachines[fsmId];
    const state = fsm ? fsm.states[stateId] : null;

    if (!state) return <div className="empty-state">State not found</div>;

    const handleChange = (field: string, value: any) => {
        dispatch({
            type: 'UPDATE_STATE',
            payload: {
                fsmId,
                stateId: state.id,
                data: { [field]: value }
            }
        });
    };

    const isInitial = fsm.initialStateId === state.id;

    const handleSetInitial = () => {
        dispatch({
            type: 'UPDATE_FSM',
            payload: {
                fsmId,
                data: { initialStateId: state.id }
            }
        });
    };

    return (
        <div>
            <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
                <div style={{ fontSize: '10px', color: '#4fc1ff', marginBottom: '4px' }}>FSM STATE</div>
                <input 
                    type="text" 
                    value={state.name} 
                    onChange={(e) => handleChange('name', e.target.value)}
                    style={{ background: '#222', border: '1px solid #444', color: '#fff', fontSize: '14px', fontWeight: 600, width: '100%', padding: '4px', marginBottom: '8px' }}
                />
                
                {isInitial ? (
                    <div style={{ 
                        fontSize: '11px', color: '#4fc1ff', border: '1px solid #1e3a5f', background: 'rgba(79, 193, 255, 0.1)',
                        padding: '4px 8px', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <span style={{ marginRight: '6px' }}>▶</span> Initial State
                    </div>
                ) : (
                    <button 
                        onClick={handleSetInitial}
                        style={{ 
                            background: '#333', border: '1px solid #555', color: '#ccc',
                            fontSize: '11px', padding: '4px 8px', borderRadius: '3px', cursor: 'pointer',
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#444'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#333'}
                    >
                        Set as Initial State
                    </button>
                )}
            </div>
            
            <div className="prop-row">
                <div className="prop-label">ID</div>
                <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{state.id}</div>
            </div>

            <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2a2a' }}>
                <div style={{ color: '#888', marginBottom: '4px', fontSize: '11px' }}>Description</div>
                <textarea 
                    value={state.description || ''} 
                    onChange={(e) => handleChange('description', e.target.value)}
                    style={{ background: '#222', border: '1px solid #444', color: '#ccc', width: '100%', height: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                />
            </div>
            
            <div className="panel-header" style={{ marginTop: '16px' }}>Transitions</div>
            {state.transitionIds.length === 0 ? (
                <div style={{padding: '8px 16px', fontSize: '12px', color: '#666'}}>No transitions from here.</div>
            ) : (
                <div style={{ padding: '8px 16px', fontSize: '12px', color: '#888' }}>
                    {state.transitionIds.length} outgoing transitions.
                    <br/>Select a transition arrow on canvas to edit.
                </div>
            )}
        </div>
    );
};