import React from 'react';
import { ValueSource, VariableType } from '../../types/common';
import { VariableDefinition } from '../../types/blackboard';
import { VariableSelector } from './VariableSelector';

interface Props {
  source: ValueSource;
  onChange: (src: ValueSource) => void;
  variables: VariableDefinition[];
  valueType?: VariableType; // Optional: hint for constant input type
  prefixElement?: React.ReactNode;
  allowedTypes?: VariableType[]; // 允许的来源变量类型
}

// Value source editor: choose constant or variable reference; blocks soft-deleted vars
export const ValueSourceEditor: React.FC<Props> = ({ source, onChange, variables, valueType, prefixElement, allowedTypes }) => {
  const type = source?.type || 'Constant';

  const renderConstantInput = () => {
    if (valueType === 'boolean') {
      const current = source.type === 'Constant' ? `${source.value === true || source.value === 'true'}` : 'false';
      return (
        <select
          value={current}
          onChange={(e) => onChange({ type: 'Constant', value: e.target.value === 'true' })}
          style={{
            background: '#27272a', // Zinc-800
            color: '#e4e4e7',      // Zinc-200
            border: '1px solid #52525b', // Zinc-600
            padding: '4px 8px',
            fontSize: '12px',
            height: 30,
            boxSizing: 'border-box',
            lineHeight: '18px', // vertically centered text
            borderRadius: '4px',
            outline: 'none',
            fontFamily: 'IBM Plex Mono, monospace', // For values
            width: '100%'
          }}
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
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
          if (isNumber) {
            if (raw === '') {
              onChange({ type: 'Constant', value: '' });
              return;
            }
            const num = valueType === 'integer' ? parseInt(raw, 10) : parseFloat(raw);
            if (Number.isNaN(num)) return; // 简单校验，非法输入不更新
            onChange({ type: 'Constant', value: num });
            return;
          }
          onChange({ type: 'Constant', value: raw });
        }}
        style={{
          background: '#27272a',
          color: '#e4e4e7',
          border: '1px solid #52525b',
          padding: '4px 8px',
          fontSize: '12px',
          flex: 1,
          height: 30,
          boxSizing: 'border-box',
          borderRadius: '4px',
          outline: 'none',
          fontFamily: isNumber ? 'IBM Plex Mono, monospace' : 'Inter, sans-serif',
          width: '100%'
        }}
        placeholder="Constant Value"
      />
    );
  };

  const renderTypeSelect = () => (
    <select
      value={type}
      onChange={(e) => {
        const nextType = e.target.value as ValueSource['type'];
        if (nextType === 'Constant') onChange({ type: 'Constant', value: '' });
        else onChange({ type: 'VariableRef', variableId: '', scope: 'Global' });
      }}
      style={{
        background: '#27272a',
        color: '#e4e4e7',
        border: '1px solid #52525b',
        padding: '4px 8px',
        fontSize: '12px',
        height: 30,
        boxSizing: 'border-box',
        borderRadius: '4px',
        outline: 'none',
        fontFamily: 'Inter, sans-serif',
        flex: prefixElement ? 1 : undefined,
        minWidth: 0,
      }}
    >
      <option value="Constant">Constant</option>
      <option value="VariableRef">Variable Ref</option>
    </select>
  );

  if (prefixElement) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {/* Row 1: Prefix + Type Select */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
          {prefixElement}
          {renderTypeSelect()}
        </div>

        {/* Row 2: Input */}
        <div style={{ display: 'flex', width: '100%' }}>
          {type === 'Constant' && renderConstantInput()}
          {type === 'VariableRef' && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
              <VariableSelector
                value={source.type === 'VariableRef' ? source.variableId : ''}
                onChange={(id, scope) => {
                  onChange({ type: 'VariableRef', variableId: id, scope: scope });
                }}
                variables={variables}
                placeholder="Select variable"
                allowedTypes={allowedTypes}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      {renderTypeSelect()}

      {type === 'Constant' && renderConstantInput()}

      {type === 'VariableRef' && (
        <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          <VariableSelector
            value={source.type === 'VariableRef' ? source.variableId : ''}
            onChange={(id, scope) => {
              onChange({ type: 'VariableRef', variableId: id, scope: scope });
            }}
            variables={variables}
            placeholder="Select variable"
            allowedTypes={allowedTypes}
          />
        </div>
      )}
    </div>
  );
};
