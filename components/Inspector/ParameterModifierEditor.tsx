import React from 'react';
import { ParameterModifier } from '../../types/common';
import { VariableDefinition } from '../../types/blackboard';
import { ResourceSelect } from './ResourceSelect';
import { ValueSourceEditor } from './ValueSourceEditor';

interface Props {
  modifier: ParameterModifier;
  onChange: (pm: ParameterModifier) => void;
  variables: VariableDefinition[];
}

/**
 * 参数修改器编辑器：统一的 UI，复用变量选择和 ValueSource 编辑
 */
export const ParameterModifierEditor: React.FC<Props> = ({ modifier, onChange, variables }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <ResourceSelect
          value={modifier.targetVariableId}
          onChange={(val) => onChange({ ...modifier, targetVariableId: val })}
          options={variables.map(v => ({ id: v.id, name: `${v.name} (${v.scope})`, state: v.state }))}
          placeholder="选择目标变量"
          style={{ minWidth: 180 }}
          warnOnMarkedDelete
        />
        <select
          value={modifier.targetScope}
          onChange={(e) => onChange({ ...modifier, targetScope: e.target.value as any })}
          style={{ background: '#111', color: '#fff', border: '1px solid #333', fontSize: '12px' }}
        >
          <option value="Global">Global</option>
          <option value="StageLocal">StageLocal</option>
          <option value="NodeLocal">NodeLocal</option>
          <option value="Temporary">Temporary</option>
        </select>
        <select
          value={modifier.operation}
          onChange={(e) => onChange({ ...modifier, operation: e.target.value as any })}
          style={{ background: '#222', color: '#eee', border: '1px solid #444', padding: '2px 4px', fontSize: '12px' }}
        >
          <option value="Set">Set</option>
          <option value="Add">Add</option>
          <option value="Subtract">Subtract</option>
          <option value="CopyFromVar">CopyFromVar</option>
        </select>
      </div>
      <div>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Source</div>
        <ValueSourceEditor
          source={modifier.source}
          onChange={(v) => onChange({ ...modifier, source: v })}
          variables={variables}
        />
      </div>
    </div>
  );
};
