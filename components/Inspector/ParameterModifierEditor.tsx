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
    if (targetType === 'boolean') return ['Set', 'Toggle'];
    if (targetType === 'integer' || targetType === 'float') return ['Set', 'Add', 'Subtract', 'Multiply', 'Divide'];
    if (targetType === 'string') return ['Set'];
    return ['Set'];
  }, [targetType]);

  useEffect(() => {
    if (!opOptions.includes(modifier.operation)) {
      onChange({ ...modifier, operation: opOptions[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opOptions.join(','), modifier.operation]);

  const validOperation = opOptions.includes(modifier.operation) ? modifier.operation : opOptions[0];

  // 根据目标变量类型计算允许的来源变量类型
  // 规则：
  // - String 目标：string, int, float, bool 都可以赋值
  // - Bool 目标：只有 bool 可以赋值
  // - Int/Float 目标：int 和 float 可以互换赋值/运算
  const allowedSourceTypes = useMemo((): VariableType[] => {
    if (!targetType) return ['boolean', 'integer', 'float', 'string', 'enum'];
    if (targetType === 'string') return ['string', 'integer', 'float', 'boolean', 'enum'];
    if (targetType === 'boolean') return ['boolean'];
    if (targetType === 'integer' || targetType === 'float') return ['integer', 'float'];
    return ['boolean', 'integer', 'float', 'string', 'enum'];
  }, [targetType]);

  const sourceVariables = useMemo(() => {
    if (!targetType) return availableVariables;
    return availableVariables.filter(v => allowedSourceTypes.includes(v.type));
  }, [availableVariables, targetType, allowedSourceTypes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      {/* 目标变量一行：内置筛选与搜索 */}
      <VariableSelector
        value={modifier.targetVariableId}
        variables={availableVariables}
        onChange={(id, scope) => onChange({ ...modifier, targetVariableId: id, targetScope: scope })}
        placeholder="Select target variable"
      />

      {/* 操作与来源：使用 ValueSourceEditor 的 prefixElement 以实现 2 行布局 */}
      {validOperation !== 'Toggle' ? (
        <ValueSourceEditor
          source={modifier.source}
          onChange={(v) => onChange({ ...modifier, source: v })}
          variables={sourceVariables}
          valueType={targetType}
          allowedTypes={allowedSourceTypes}
          prefixElement={
            <select
              value={validOperation}
              onChange={(e) => onChange({ ...modifier, operation: e.target.value as any })}
              style={{
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
              }}
            >
              {opOptions.map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          }
        />
      ) : (
        // Toggle 操作不需要来源，但为了保持一致性，显示一个占位的 Toggle 下拉框？或者只显示操作下拉框。
        // 根据需求，Toggle 只需要 Operation 即可。
        <select
          value={validOperation}
          onChange={(e) => onChange({ ...modifier, operation: e.target.value as any })}
          style={{
            background: '#27272a',
            color: '#e4e4e7',
            border: '1px solid #52525b',
            padding: '4px 8px',
            fontSize: '12px',
            borderRadius: '4px',
            width: '100%',
            height: 30,
            outline: 'none',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          {opOptions.map(op => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      )}
    </div>
  );
};
