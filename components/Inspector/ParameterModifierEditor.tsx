import React, { useMemo, useEffect } from 'react';
import { ParameterModifier } from '../../types/common';
import { VariableDefinition } from '../../types/blackboard';
import { ValueSourceEditor } from './ValueSourceEditor';
import { VariableSelector } from './VariableSelector';
import { filterActiveResources } from '../../utils/resourceFilters';
import { modifierOperations, modifierSourceTypes } from '../../utils/parameterCompatibility';

interface Props {
  modifier: ParameterModifier;
  onChange: (pm: ParameterModifier) => void;
  variables: VariableDefinition[];
}

/**
 * 参数修改器编辑器：使用抽离的变量选择器，保持单行布局与类型安全
 */
export const ParameterModifierEditor: React.FC<Props> = ({ modifier, onChange, variables }) => {
  const availableVariables = useMemo(() => filterActiveResources(variables), [variables]);

  const selectedVar = useMemo(
    () => availableVariables.find((v) => v.id === modifier.targetVariableId),
    [availableVariables, modifier.targetVariableId],
  );

  const targetType = selectedVar?.type;

  // 根据目标变量类型限定可用操作
  const opOptions = useMemo(() => modifierOperations(targetType), [targetType]);

  useEffect(() => {
    if (!opOptions.includes(modifier.operation)) {
      onChange({ ...modifier, operation: opOptions[0] });
    }
  }, [opOptions, modifier, onChange]);

  const validOperation = opOptions.includes(modifier.operation) ? modifier.operation : opOptions[0];

  // Toggle 操作不需要来源值
  const needsSource = validOperation !== 'Toggle';

  // 根据目标变量类型计算允许的来源变量类型
  // 规则：
  // - String 目标：string, int, float, bool 都可以赋值
  // - Bool 目标：只有 bool 可以赋值
  // - Int/Float 目标：int 和 float 可以互换赋值/运算
  const allowedSourceTypes = useMemo(() => modifierSourceTypes(targetType), [targetType]);

  const sourceVariables = useMemo(() => {
    if (!targetType) return availableVariables;
    return availableVariables.filter((v) => allowedSourceTypes.includes(v.type));
  }, [availableVariables, targetType, allowedSourceTypes]);

  // 操作选择器样式
  const selectStyle = { flex: 1, minWidth: 0, height: 30 };

  // 操作选择器组件
  const operationSelect = (
    <select
      className="ui-control"
      value={validOperation}
      onChange={(e) =>
        onChange({ ...modifier, operation: e.target.value as ParameterModifier['operation'] })
      }
      style={selectStyle}
    >
      {opOptions.map((op) => (
        <option key={op} value={op}>
          {op}
        </option>
      ))}
    </select>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      {/* 目标变量一行：内置筛选与搜索 */}
      <VariableSelector
        value={modifier.targetVariableId}
        variables={availableVariables}
        onChange={(id, scope) =>
          onChange({ ...modifier, targetVariableId: id, targetScope: scope })
        }
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
          <span
            style={{ color: '#a1a1aa', fontSize: '12px', alignSelf: 'center', fontStyle: 'italic' }}
          >
            (inverts current value)
          </span>
        </div>
      )}
    </div>
  );
};
