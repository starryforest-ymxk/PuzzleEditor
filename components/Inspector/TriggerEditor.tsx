import React from 'react';
import { TriggerConfig } from '../../types/stateMachine';
import { ResourceSelect, ResourceOption } from './ResourceSelect';

interface Props {
    triggers: TriggerConfig[];
    onChange: (triggers: TriggerConfig[]) => void;
    eventOptions: ResourceOption[];
    scriptOptions: ResourceOption[];
    readOnly?: boolean;
}

export const TriggerEditor: React.FC<Props> = ({
    triggers,
    onChange,
    eventOptions,
    scriptOptions,
    readOnly = false
}) => {
    const handleTriggerChange = (index: number, partial: Partial<TriggerConfig>) => {
        const next = [...triggers];
        next[index] = { ...next[index], ...partial } as TriggerConfig;
        onChange(next);
    };

    const handleAddTrigger = () => {
        // Default to 'Always' when adding
        const newTrigger: TriggerConfig = { type: 'Always' };
        onChange([...triggers, newTrigger]);
    };

    const handleRemoveTrigger = (index: number) => {
        const next = triggers.filter((_, i) => i !== index);
        onChange(next);
    };

    const handleTypeChange = (index: number, newType: TriggerConfig['type']) => {
        const base: TriggerConfig =
            newType === 'OnEvent'
                ? { type: 'OnEvent', eventId: '' }
                : newType === 'CustomScript'
                    ? { type: 'CustomScript', scriptId: '' }
                    : { type: 'Always' };
        handleTriggerChange(index, base);
    };

    return (
        <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {triggers.map((t, idx) => (
                    <div key={idx} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '8px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        position: 'relative'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', color: '#888' }}>Type</span>
                                <select
                                    value={t.type}
                                    onChange={(e) => handleTypeChange(idx, e.target.value as TriggerConfig['type'])}
                                    style={{
                                        background: '#222',
                                        color: '#eee',
                                        border: '1px solid #444',
                                        padding: '2px 4px',
                                        fontSize: '12px',
                                        borderRadius: '3px',
                                        outline: 'none'
                                    }}
                                >
                                    <option value="Always">Always</option>
                                    <option value="OnEvent">On Event</option>
                                    <option value="CustomScript">Custom Script</option>
                                </select>
                            </div>
                            <button
                                onClick={() => handleRemoveTrigger(idx)}
                                className="btn-remove-text"
                                title="Remove Trigger"
                            >
                                × Remove
                            </button>
                        </div>

                        {t.type === 'OnEvent' && (
                            <ResourceSelect
                                value={t.eventId || ''}
                                onChange={(val) => handleTriggerChange(idx, { eventId: val })}
                                options={eventOptions}
                                placeholder="Select event"
                                showDetails
                                onClear={t.eventId ? () => handleTriggerChange(idx, { eventId: '' }) : undefined}
                            />
                        )}

                        {t.type === 'CustomScript' && (
                            <ResourceSelect
                                value={t.scriptId || ''}
                                onChange={(val) => handleTriggerChange(idx, { scriptId: val })}
                                options={scriptOptions}
                                placeholder="Select trigger script"
                                showDetails
                                onClear={t.scriptId ? () => handleTriggerChange(idx, { scriptId: '' }) : undefined}
                            />
                        )}
                    </div>
                ))}

                {triggers.length === 0 && (
                    <div style={{
                        color: '#f97316',
                        fontSize: '11px',
                        padding: '12px',
                        textAlign: 'center',
                        background: 'rgba(249, 115, 22, 0.1)',
                        border: '1px solid rgba(249, 115, 22, 0.3)',
                        borderRadius: '4px',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    }}>
                        <span>⚠</span>
                        <span>Warning: At least one trigger is required.</span>
                    </div>
                )}

                <button
                    className="btn-ghost"
                    onClick={handleAddTrigger}
                    disabled={readOnly}
                    style={{
                        width: '100%',
                        justifyContent: 'center',
                        marginTop: '4px',
                        borderStyle: 'dashed',
                        opacity: 0.7
                    }}
                >
                    + Add Trigger
                </button>
            </div>
        </div>
    );
};
