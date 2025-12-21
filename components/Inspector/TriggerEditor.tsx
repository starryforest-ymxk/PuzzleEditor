import React from 'react';
import { TriggerConfig } from '../../types/stateMachine';
import { ResourceSelect, ResourceOption } from './ResourceSelect';
import { InspectorError } from './InspectorInfo';

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
        <div className={`trigger-editor-container${readOnly ? ' is-readonly' : ''}`}>
            <div className="trigger-list">
                {triggers.map((t, idx) => (
                    <div key={idx} className="trigger-card">
                        <div className="trigger-header">
                            <div className="trigger-header-left">
                                <span className="trigger-type-label">Type</span>
                                <select
                                    value={t.type}
                                    onChange={(e) => handleTypeChange(idx, e.target.value as TriggerConfig['type'])}
                                    className="trigger-type-select"
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
                    <InspectorError message="At least one trigger is required." />
                )}

                <button
                    className="btn-add-ghost trigger-add-btn"
                    onClick={handleAddTrigger}
                    disabled={readOnly}
                >
                    + Add Trigger
                </button>
            </div>
        </div>
    );
};
