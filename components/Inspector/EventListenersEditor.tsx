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
import { ParameterModifierEditor } from './ParameterModifierEditor';

interface Props {
  listeners: EventListener[];
  onChange: (listeners: EventListener[]) => void;
  eventOptions: ResourceOption[];
  scriptOptions: ResourceOption[];
  variables: VariableDefinition[];
}

// 事件监听编辑器：支持添加/删除监听并配置动作
export const EventListenersEditor: React.FC<Props> = ({
  listeners,
  onChange,
  eventOptions,
  scriptOptions,
  variables
}) => {
  // 新增监听
  const handleAdd = () => {
    const newListener: EventListener = {
      eventId: '' as any,
      action: { type: 'InvokeScript' }
    };
    onChange([...listeners, newListener]);
  };

  // 删除监听
  const handleDelete = (index: number) => {
    onChange(listeners.filter((_, i) => i !== index));
  };

  // 更新监听
  const handleUpdate = (index: number, updates: Partial<EventListener>) => {
    const newListeners = [...listeners];
    newListeners[index] = { ...newListeners[index], ...updates };
    onChange(newListeners);
  };

  // 切换动作类型
  const handleActionTypeChange = (index: number, type: 'InvokeScript' | 'ModifyParameter') => {
    const listener = listeners[index];
    if (type === 'InvokeScript') {
      handleUpdate(index, { action: { type: 'InvokeScript' } });
    } else {
      handleUpdate(index, {
        action: {
          type: 'ModifyParameter',
          modifiers: []
        }
      });
    }
  };

  // 添加一个新的修改器
  const handleAddModifier = (listenerIndex: number) => {
    const listener = listeners[listenerIndex];
    if (listener.action.type !== 'ModifyParameter') return;

    const newModifier: ParameterModifier = {
      targetVariableId: '',
      targetScope: 'Global',
      operation: 'Set',
      source: { type: 'Constant', value: '' }
    };

    handleUpdate(listenerIndex, {
      action: {
        ...listener.action,
        modifiers: [...listener.action.modifiers, newModifier]
      }
    });
  };

  // 更新修改器
  const handleUpdateModifier = (listenerIndex: number, modifierIndex: number, newModifier: ParameterModifier) => {
    const listener = listeners[listenerIndex];
    if (listener.action.type !== 'ModifyParameter') return;

    const newModifiers = [...listener.action.modifiers];
    newModifiers[modifierIndex] = newModifier;

    handleUpdate(listenerIndex, {
      action: {
        ...listener.action,
        modifiers: newModifiers
      }
    });
  };

  // 删除修改器
  const handleDeleteModifier = (listenerIndex: number, modifierIndex: number) => {
    const listener = listeners[listenerIndex];
    if (listener.action.type !== 'ModifyParameter') return;

    handleUpdate(listenerIndex, {
      action: {
        ...listener.action,
        modifiers: listener.action.modifiers.filter((_, i) => i !== modifierIndex)
      }
    });
  };

  return (
    <div style={{ padding: '0 0 8px 0', width: '100%', display: 'flex', flexDirection: 'column' }}>
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
              border: '1px solid #333',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Event select */}
            <div className="inspector-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'nowrap' }}>
              <span style={{ fontSize: '11px', color: '#888', minWidth: '48px', flexShrink: 0 }}>Event</span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
                <ResourceSelect
                  options={eventOptions}
                  value={listener.eventId}
                  onChange={(val) => handleUpdate(index, { eventId: val })}
                  placeholder="Select event"
                  warnOnMarkedDelete
                  style={{ width: '100%' }}
                />
              </div>
              <button
                onClick={() => handleDelete(index)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '0 4px',
                  flexShrink: 0
                }}
              >
                ×
              </button>
            </div>

            {/* Action type */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'nowrap' }}>
              <span style={{ fontSize: '11px', color: '#888', minWidth: '48px', flexShrink: 0 }}>Action</span>
              <select
                value={listener.action.type}
                onChange={(e) => handleActionTypeChange(index, e.target.value as 'InvokeScript' | 'ModifyParameter')}
                style={{
                  background: '#27272a', // Zinc-800
                  color: '#e4e4e7',      // Zinc-200
                  border: '1px solid #52525b', // Zinc-600
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  flex: 1,
                  minWidth: 0,
                  height: 30, // Reference height
                  boxSizing: 'border-box',
                  lineHeight: '18px',
                  outline: 'none',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <option value="InvokeScript">Invoke Script</option>
                <option value="ModifyParameter">Modify Parameter</option>
              </select>
            </div>

            {/* InvokeScript: 触发生命周期脚本 OnEventInvoke，无需选择脚本 */}
            {listener.action.type === 'InvokeScript' && (
              <div style={{ fontSize: '11px', color: '#888', padding: '4px 0 0 0' }}>
                Triggers the lifecycle script OnEventInvoke of the current state.
              </div>
            )}

            {/* ModifyParameter: 允许配置多个参数修改器 */}
            {listener.action.type === 'ModifyParameter' && (
              <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', width: '100%', gap: '8px' }}>
                {listener.action.modifiers.map((modifier, mIdx) => (
                  <div key={mIdx} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '8px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleDeleteModifier(index, mIdx)}
                        className="btn-remove-text"
                        title="Remove Modifier"
                      >
                        × Remove
                      </button>
                    </div>
                    <ParameterModifierEditor
                      modifier={modifier}
                      onChange={(pm) => handleUpdateModifier(index, mIdx, pm)}
                      variables={variables}
                    />
                  </div>
                ))}

                <button
                  className="btn-add-ghost"
                  onClick={() => handleAddModifier(index)}
                  style={{ marginTop: '4px' }}
                >
                  + Add Parameter Modifier
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {/* Add button */}
      <div style={{ textAlign: 'center', marginTop: '8px', padding: 0 }}>
        <button
          className="btn-add-ghost"
          onClick={handleAdd}
          style={{ width: '100%' }}
        >
          + Add Listener
        </button>
      </div>
    </div>
  );
};
