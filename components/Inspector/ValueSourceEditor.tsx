import React from 'react';
import { ValueSource, VariableScope, VariableType } from '../../types/common';
import { VariableDefinition } from '../../types/blackboard';
import { ResourceSelect } from './ResourceSelect';

interface Props {
  source: ValueSource;
  onChange: (src: ValueSource) => void;
  variables: VariableDefinition[];
  valueType?: VariableType; // Optional: hint for constant input type
}

// Value source editor: choose constant or variable reference; blocks soft-deleted vars
export const ValueSourceEditor: React.FC<Props> = ({ source, onChange, variables, valueType }) => {
  const type = source?.type || 'Constant';

  const renderConstantInput = () => {
    if (valueType === 'boolean') {
      return (
        <input
          type="checkbox"
          checked={!!(source.type === 'Constant' ? source.value : false)}
          onChange={(e) => onChange({ type: 'Constant', value: e.target.checked })}
        />
      );
    }

    const isNumber = valueType === 'integer' || valueType === 'float';
    return (
      <input
        type={isNumber ? 'number' : 'text'}
        step={valueType === 'float' ? '0.1' : undefined}
        value={source.type === 'Constant' ? source.value ?? '' : ''}
        onChange={(e) => {
          const raw = e.target.value;
          const val = isNumber ? Number(raw) : raw;
          onChange({ type: 'Constant', value: val });
        }}
        style={{ background: '#1e1e1e', color: '#e0e0e0', border: '1px solid #333', padding: '4px', fontSize: '12px', flex: 1 }}
      />
    );
  };
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <select
        value={type}
        onChange={(e) => {
          const nextType = e.target.value as ValueSource['type'];
          if (nextType === 'Constant') onChange({ type: 'Constant', value: '' });
          else onChange({ type: 'VariableRef', variableId: '', scope: 'Global' });
        }}
        style={{ background: '#222', color: '#eee', border: '1px solid #444', padding: '2px 4px', fontSize: '12px' }}
      >
        <option value="Constant">Constant</option>
        <option value="VariableRef">Variable Reference</option>
      </select>

      {type === 'Constant' && renderConstantInput()}

      {type === 'VariableRef' && (
        <>
          <ResourceSelect
            value={source.type === 'VariableRef' ? source.variableId : ''}
            onChange={(val) => onChange({ type: 'VariableRef', variableId: val, scope: source.type === 'VariableRef' ? source.scope : 'Global' })}
            options={variables.map(v => ({ id: v.id, name: `${v.name} (${v.scope})`, state: v.state }))}
            placeholder="Select variable"
            style={{ minWidth: 180 }}
            warnOnMarkedDelete
          />
          <select
            value={source.type === 'VariableRef' ? source.scope : 'Global'}
            onChange={(e) => onChange({ type: 'VariableRef', variableId: source.type === 'VariableRef' ? source.variableId : '', scope: e.target.value as VariableScope })}
            style={{ background: '#111', color: '#fff', border: '1px solid #333', fontSize: '12px' }}
          >
            <option value="Global">Global</option>
            <option value="StageLocal">StageLocal</option>
            <option value="NodeLocal">NodeLocal</option>
            <option value="Temporary">Temporary</option>
          </select>
        </>
      )}
    </div>
  );
};
