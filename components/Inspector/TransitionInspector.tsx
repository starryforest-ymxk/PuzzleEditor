
import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ConditionEditor } from './ConditionEditor';

interface Props {
    fsmId: string;
    transitionId: string;
}

export const TransitionInspector = ({ fsmId, transitionId }: Props) => {
    const { project, manifest } = useEditorState();
    const dispatch = useEditorDispatch();

    const fsm = project.stateMachines[fsmId];
    const trans = fsm ? fsm.transitions[transitionId] : null;

    if (!trans || !fsm) return <div className="empty-state">Transition not found</div>;
    
    const fromState = fsm.states[trans.fromStateId];
    const toState = fsm.states[trans.toStateId];

    const handleChange = (field: string, value: any) => {
        dispatch({
            type: 'UPDATE_TRANSITION',
            payload: {
                fsmId: fsm.id,
                transitionId: trans.id,
                data: { [field]: value }
            }
        });
    };

    return (
        <div>
            <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
                <div style={{ fontSize: '10px', color: '#ff9800', marginBottom: '4px' }}>TRANSITION</div>
                <input 
                    type="text" 
                    value={trans.name} 
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Transition Name"
                    style={{ background: '#222', border: '1px solid #444', color: '#fff', fontSize: '14px', fontWeight: 600, width: '100%', padding: '4px' }}
                />
            </div>

            <div className="prop-row">
                <div className="prop-label">From</div>
                <div className="prop-value" style={{ color: '#aaa' }}>{fromState?.name || trans.fromStateId}</div>
            </div>
            <div className="prop-row">
                <div className="prop-label">To</div>
                <div className="prop-value" style={{ color: '#aaa' }}>{toState?.name || trans.toStateId}</div>
            </div>
            
            <div className="prop-row">
                <div className="prop-label">Trigger</div>
                {/* Trigger Selector from Manifest */}
                <select
                    value={trans.triggerId || ''}
                    onChange={(e) => handleChange('triggerId', e.target.value)}
                    style={{ width: '100%', background: '#222', color: '#eee', border: '1px solid #444', padding: '2px' }}
                >
                    <option value="">(None / Auto)</option>
                    {manifest.triggers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
            </div>

            <div className="prop-row">
                <div className="prop-label">Priority</div>
                <input 
                    type="number" 
                    value={trans.priority} 
                    onChange={(e) => handleChange('priority', parseInt(e.target.value))}
                    style={{ background: '#222', border: '1px solid #444', color: '#ccc', width: '60px' }}
                />
            </div>

            <div className="panel-header" style={{ marginTop: '16px' }}>Condition Logic</div>
            <div style={{ padding: '16px' }}>
                <ConditionEditor 
                    condition={trans.condition} 
                    onChange={(newCond) => handleChange('condition', newCond)}
                />
            </div>
        </div>
    );
};
