/**
 * components/Inspector/EventListenersEditor.tsx
 * Event listener editor for Stage/Node/State
 * Supports two actions:
 * - InvokeScript
 * - ModifyParameter
 */

import React from 'react';
import { EventListener, ParameterModifier } from '../../types/common';
import { VariableDefinition } from '../../types/blackboard';
import { ResourceSelect, ResourceOption } from './ResourceSelect';

interface Props {
  listeners: EventListener[];
  onChange: (listeners: EventListener[]) => void;
  eventOptions: ResourceOption[];
  scriptOptions: ResourceOption[];
  variables: VariableDefinition[];
}

// Event listener editor component: add/remove listeners and configure actions
export const EventListenersEditor: React.FC<Props> = ({
  listeners,
  onChange,
  eventOptions,
  scriptOptions,
  variables
}) => {
  // Add listener
  const handleAdd = () => {
    const newListener: EventListener = {
      eventId: '' as any,
      action: { type: 'InvokeScript', scriptId: '' as any }
    };
    onChange([...listeners, newListener]);
  };

  // Delete listener
  const handleDelete = (index: number) => {
    onChange(listeners.filter((_, i) => i !== index));
  };

  // Update listener
  const handleUpdate = (index: number, updates: Partial<EventListener>) => {
    const newListeners = [...listeners];
    newListeners[index] = { ...newListeners[index], ...updates };
    onChange(newListeners);
  };

  // Update action type
  const handleActionTypeChange = (index: number, type: 'InvokeScript' | 'ModifyParameter') => {
    const listener = listeners[index];
    if (type === 'InvokeScript') {
      handleUpdate(index, { action: { type: 'InvokeScript', scriptId: '' as any } });
    } else {
      handleUpdate(index, {
        action: {
          type: 'ModifyParameter',
          modifier: { targetVariableId: '', targetScope: 'Global', operation: 'Set', source: { type: 'Constant', value: '' } }
        }
      });
    }
  };

  return (
    <div style={{ padding: '8px' }}>
      {listeners.length === 0 ? (
        <div style={{ color: '#666', fontSize: '11px', padding: '8px', textAlign: 'center' }}>
          No event listeners
        </div>
      ) : (
        listeners.map((listener, index) => (
          <div
            key={index}
            style={{
              padding: '12px',
              marginBottom: '8px',
              background: '#1e1e1e',
              borderRadius: '4px',
              border: '1px solid #333'
            }}
          >
            {/* Event select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#888', minWidth: '40px' }}>Event:</span>
              <ResourceSelect
                options={eventOptions}
                value={listener.eventId}
                onChange={(val) => handleUpdate(index, { eventId: val })}
                placeholder="Select event"
                warnOnMarkedDelete
              />
              <button
                onClick={() => handleDelete(index)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '0 4px'
                }}
              >
                ×
              </button>
            </div>

            {/* Action type */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#888', minWidth: '40px' }}>Action:</span>
              <select
                value={listener.action.type}
                onChange={(e) => handleActionTypeChange(index, e.target.value as 'InvokeScript' | 'ModifyParameter')}
                style={{
                  background: '#222',
                  color: '#eee',
                  border: '1px solid #444',
                  padding: '4px 8px',
                  fontSize: '11px',
                  borderRadius: '3px'
                }}
              >
                <option value="InvokeScript">Invoke Script</option>
                <option value="ModifyParameter">Modify Parameter</option>
              </select>
            </div>

            {/* InvokeScript: no script selection needed, auto-triggers lifecycle callback */}
            {listener.action.type === 'InvokeScript' && (
              <div style={{ fontSize: '11px', color: '#888', padding: '4px 0', marginLeft: '48px' }}>
                Triggers the lifecycle script's OnEventInvoke callback
              </div>
            )}

            {/* Parameter modifier (placeholder) */}
            {listener.action.type === 'ModifyParameter' && (
              <div style={{ fontSize: '11px', color: '#888', padding: '4px' }}>
                Parameter modifier configuration (TODO)
              </div>
            )}
          </div>
        ))
      )}

      {/* Add button */}
      <div style={{ textAlign: 'center', marginTop: '8px' }}>
        <button
          onClick={handleAdd}
          style={{
            background: '#2e7d32',
            color: '#fff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          + Add Listener
        </button>
      </div>
    </div>
  );
};
