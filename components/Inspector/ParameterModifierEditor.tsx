import React, { useMemo, useEffect } from 'react';
import { ParameterModifier, VariableType } from '../../types/common';
import { VariableDefinition } from '../../types/blackboard';
import { ValueSourceEditor } from './ValueSourceEditor';
import { VariableSelector } from './VariableSelector';

interface Props {
  modifier: ParameterModifier;
  onChange: (pm: ParameterModifier) => void;
  variables: VariableDefinition[];
}

/**
 * 参数修改器编辑器：使用抽离的变量选择器，保持单行布局与类型安全
 */
export const ParameterModifierEditor: React.FC<Props> = ({ modifier, onChange, variables }) => {
  const availableVariables = useMemo(
    () => variables.filter(v => v.state !== 'MarkedForDelete'),
    [variables]
  );

  const selectedVar = useMemo(
    () => availableVariables.find(v => v.id === modifier.targetVariableId),
    [availableVariables, modifier.targetVariableId]
  );

  const targetType = selectedVar?.type;

  // 根据目标变量类型限定可用操作
  const opOptions = useMemo(() => {
    // 布尔类型支持：设置、反转（Toggle不需要来源值）
    if (targetType === 'boolean') return ['Set', 'Toggle'];
    // 数值类型支持：设置、加、减、乘、除运算
    if (targetType === 'integer' || targetType === 'float') return ['Set', 'Add', 'Subtract', 'Multiply', 'Divide'];
    return ['Set'];
  }, [targetType]);

  useEffect(() => {
    if (!opOptions.includes(modifier.operation)) {
      onChange({ ...modifier, operation: opOptions[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opOptions.join(','), modifier.operation]);

  const validOperation = opOptions.includes(modifier.operation) ? modifier.operation : opOptions[0];

  // Toggle 操作不需要来源值
  const needsSource = validOperation !== 'Toggle';

  // 根据目标变量类型计算允许的来源变量类型
  // 规则：
  // - String 目标：string, int, float, bool 都可以赋值
  // - Bool 目标：只有 bool 可以赋值
  // - Int/Float 目标：int 和 float 可以互换赋值/运算
  const allowedSourceTypes = useMemo((): VariableType[] => {
    if (!targetType) return ['boolean', 'integer', 'float', 'string'];
    if (targetType === 'string') return ['string', 'integer', 'float', 'boolean'];
    if (targetType === 'boolean') return ['boolean'];
    if (targetType === 'integer' || targetType === 'float') return ['integer', 'float'];
    return ['boolean', 'integer', 'float', 'string'];
  }, [targetType]);

  const sourceVariables = useMemo(() => {
    if (!targetType) return availableVariables;
    return availableVariables.filter(v => allowedSourceTypes.includes(v.type));
  }, [availableVariables, targetType, allowedSourceTypes]);

  // 操作选择器样式
  const selectStyle = {
    background: '#27272a',
    color: '#e4e4e7',
    border: '1px solid #52525b',
    padding: '4px 8px',
    fontSize: '12px',
    borderRadius: '4px',
    flex: 1,
    minWidth: 0,
    height: 30,
    outline: 'none',
    fontFamily: 'Inter, sans-serif'
  };

  // 操作选择器组件
  const operationSelect = (
    <select
      value={validOperation}
      onChange={(e) => onChange({ ...modifier, operation: e.target.value as any })}
      style={selectStyle}
    >
      {opOptions.map(op => (
        <option key={op} value={op}>{op}</option>
      ))}
    </select>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      {/* 目标变量一行：内置筛选与搜索 */}
      <VariableSelector
        value={modifier.targetVariableId}
        variables={availableVariables}
        onChange={(id, scope) => onChange({ ...modifier, targetVariableId: id, targetScope: scope })}
        placeholder="Select target variable"
      />

      {/* 操作与来源：Toggle 不需要来源值 */}
      {needsSource ? (
        <ValueSourceEditor
          source={modifier.source}
          onChange={(v) => onChange({ ...modifier, source: v })}
          variables={sourceVariables}
          valueType={targetType}
          allowedTypes={allowedSourceTypes}
          prefixElement={operationSelect}
        />
      ) : (
        <div style={{ display: 'flex', gap: '8px' }}>
          {operationSelect}
          <span style={{ color: '#a1a1aa', fontSize: '12px', alignSelf: 'center', fontStyle: 'italic' }}>
            (inverts current value)
          </span>
        </div>
      )}
    </div>
  );
};
