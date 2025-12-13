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
  height?: number; // optional unified control height
  hideTypeSelect?: boolean; // 仅渲染值输入部分，不显示类型切换
}

// Value source editor: choose constant or variable reference; blocks soft-deleted vars
export const ValueSourceEditor: React.FC<Props> = ({ source, onChange, variables, valueType, prefixElement, allowedTypes, height = 30, hideTypeSelect = false }) => {
  const type = source?.type || 'Constant';

  const renderConstantInput = () => {
    if (valueType === 'boolean') {
      const current = source.type === 'Constant' ? `${source.value === true || source.value === 'true'}` : 'false';
      return (
        <select
          value={current}
          onChange={(e) => onChange({ type: 'Constant', value: e.target.value === 'true' })}
          style={{
            background: '#27272a',
            color: '#e4e4e7',
            border: '1px solid #52525b',
            padding: '0 8px',
            fontSize: '12px',
            height,
            boxSizing: 'border-box',
            lineHeight: `${height - 2}px`,
            borderRadius: '4px',
            outline: 'none',
            fontFamily: 'IBM Plex Mono, monospace',
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
          height,
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
        padding: '0 8px',
        fontSize: '12px',
        height,
        boxSizing: 'border-box',
        borderRadius: '4px',
        outline: 'none',
        fontFamily: 'Inter, sans-serif',
        lineHeight: `${height - 2}px`,
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
        {!hideTypeSelect && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
            {prefixElement}
            {renderTypeSelect()}
          </div>
        )}

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
                height={height}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (hideTypeSelect) {
    return (
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
              height={height}
            />
          </div>
        )}
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
            height={height}
          />
        </div>
      )}
    </div>
  );
};
