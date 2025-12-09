
import React, { useMemo } from 'react';
import { ConditionExpression } from '../../types/stateMachine';
import { VariableScope } from '../../types/common';
import { VariableDefinition } from '../../types/blackboard';
import { ScriptDefinition } from '../../types/manifest';
import { ResourceSelect } from './ResourceSelect';

interface Props {
    condition: ConditionExpression;
    onChange?: (newCondition: ConditionExpression) => void;
    depth?: number;
    variables?: VariableDefinition[]; // visible variables
    conditionScripts?: ScriptDefinition[]; // optional custom condition scripts
}

// Visual styles for different logic blocks
const BLOCK_STYLES = {
    AND: { borderLeft: '3px solid #4caf50', bg: 'rgba(76, 175, 80, 0.1)' },
    OR: { borderLeft: '3px solid #ff9800', bg: 'rgba(255, 152, 0, 0.1)' },
    NOT: { borderLeft: '3px solid #f44336', bg: 'rgba(244, 67, 54, 0.1)' },
    COMPARISON: { borderLeft: '3px solid #2196f3', bg: 'rgba(33, 150, 243, 0.1)' },
    DEFAULT: { borderLeft: '3px solid #9e9e9e', bg: 'rgba(158, 158, 158, 0.1)' }
};

export const ConditionEditor = ({ condition, onChange, depth = 0, variables = [], conditionScripts = [] }: Props) => {
  // Simplified options for selecting types
  const TYPES = ['AND', 'OR', 'NOT', 'COMPARISON', 'LITERAL', 'VARIABLE_REF', 'SCRIPT_REF'];
  const OPERATORS = ['==', '!=', '>', '<', '>=', '<='];
  const SCOPES: VariableScope[] = ['Global', 'StageLocal', 'NodeLocal', 'Temporary'];

    const handleChangeType = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newType = e.target.value as any;
      if (!onChange) return;
      
      // Reset structure based on new type，保留已有 children/operand 以免丢数据
      const base: Partial<ConditionExpression> = { type: newType };
      if (newType === 'AND' || newType === 'OR') {
          base.children = condition.children && condition.children.length > 0
            ? condition.children
            : [
                condition.left || { type: 'LITERAL', value: true },
                condition.right || { type: 'LITERAL', value: true }
              ];
      } else if (newType === 'COMPARISON') {
          base.operator = condition.operator || '==';
          base.left = condition.left || { type: 'VARIABLE_REF', variableId: '', variableScope: 'NodeLocal' };
          base.right = condition.right || { type: 'LITERAL', value: '' };
      } else if (newType === 'NOT') {
          base.operand = condition.operand || { type: 'LITERAL', value: true };
      } else if (newType === 'LITERAL') {
          base.value = condition.value ?? false;
      } else if (newType === 'VARIABLE_REF') {
          base.variableId = condition.variableId || '';
          base.variableScope = condition.variableScope || 'NodeLocal';
      } else if (newType === 'SCRIPT_REF') {
          base.scriptId = condition.scriptId || '';
      }
      onChange(base as ConditionExpression);
  };

    const style = BLOCK_STYLES[condition.type as keyof typeof BLOCK_STYLES] || BLOCK_STYLES.DEFAULT;

    const selectedVar = useMemo(() => variables.find(v => v.id === condition.variableId), [variables, condition.variableId]);

  return (
    <div style={{ 
        marginLeft: depth > 0 ? '12px' : '0', 
        marginTop: '4px',
        padding: '6px 8px',
        backgroundColor: style.bg,
        borderLeft: style.borderLeft,
        borderRadius: '0 4px 4px 0',
        fontSize: '12px',
        position: 'relative'
    }}>
        <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select 
                value={condition.type} 
                onChange={handleChangeType}
                disabled={!onChange}
                style={{ background: '#222', color: '#eee', border: '1px solid #444', fontSize: '11px', padding: '2px' }}
            >
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {condition.type === 'COMPARISON' && (
                <select 
                    value={condition.operator}
                    onChange={(e) => onChange && onChange({ ...condition, operator: e.target.value as any })}
                    disabled={!onChange}
                    style={{ background: '#000', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '11px' }}
                >
                    {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
            )}

                        {condition.type === 'LITERAL' && (
                                (() => {
                                    const inputType = selectedVar && (selectedVar.type === 'integer' || selectedVar.type === 'float') ? 'number'
                                        : selectedVar?.type === 'boolean' ? 'checkbox'
                                        : 'text';
                                    if (inputType === 'checkbox') {
                                        return (
                                            <input
                                                type="checkbox"
                                                checked={!!condition.value}
                                                onChange={(e) => onChange && onChange({ ...condition, value: e.target.checked })}
                                                disabled={!onChange}
                                            />
                                        );
                                    }
                                    return (
                                        <input 
                                                type={inputType}
                                                value={condition.value ?? ''}
                                                onChange={(e) => {
                                                    const val = inputType === 'number' ? Number(e.target.value) : e.target.value;
                                                    onChange && onChange({ ...condition, value: val });
                                                }}
                                                disabled={!onChange}
                                                style={{ background: '#333', border: 'none', color: '#ce9178', width: '80px', fontSize: '11px' }}
                                        />
                                    );
                                })()
                        )}

                        {condition.type === 'VARIABLE_REF' && (
                    <>
                        <ResourceSelect
                                value={condition.variableId || ''}
                                onChange={(val) => onChange && onChange({ ...condition, variableId: val })}
                                options={variables.map(v => ({ id: v.id, name: `${v.name} (${v.scope})`, state: v.state }))}
                                placeholder="Select variable"
                                style={{ minWidth: 180 }}
                        />
                        <select
                                value={condition.variableScope || 'NodeLocal'}
                                onChange={(e) => onChange && onChange({ ...condition, variableScope: e.target.value as VariableScope })}
                                disabled={!onChange}
                                style={{ background: '#111', color: '#fff', border: '1px solid #333', fontSize: '11px' }}
                        >
                                {SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </>
            )}

            {condition.type === 'SCRIPT_REF' && (
                <ResourceSelect
                        value={condition.scriptId || ''}
                        onChange={(val) => onChange && onChange({ ...condition, scriptId: val })}
                        options={conditionScripts.map(s => ({ id: s.id, name: s.name, state: s.state }))}
                        placeholder="Select condition script"
                        style={{ minWidth: 180 }}
                />
            )}
        </div>

                {selectedVar?.state === 'MarkedForDelete' && (
                    <div style={{ color: '#f66', fontSize: '11px', marginTop: '4px' }}>Variable is marked for delete; please choose another.</div>
                )}

        {/* Recursive Children */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {(condition.type === 'AND' || condition.type === 'OR') && (
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {(condition.children && condition.children.length > 0
                                            ? condition.children
                                            : (condition.left && condition.right ? [condition.left, condition.right] : [])
                                        )
                                            .map((child, idx) => (
                                                <div key={idx} style={{ position: 'relative', paddingRight: '28px' }}>
                                                    <ConditionEditor
                                                        condition={child}
                                                        onChange={(newSub) => {
                                                            if (!onChange) return;
                                                            const nextChildren = [...(condition.children || [])];
                                                            if (nextChildren.length === 0 && condition.left && condition.right) {
                                                                nextChildren.push(condition.left, condition.right);
                                                            }
                                                            nextChildren[idx] = newSub;
                                                            onChange({ ...condition, children: nextChildren });
                                                        }}
                                                        depth={depth + 1}
                                                        variables={variables}
                                                        conditionScripts={conditionScripts}
                                                    />
                                                    {onChange && (
                                                        <button
                                                            onClick={() => {
                                                                const nextChildren = [...(condition.children || [])];
                                                                nextChildren.splice(idx, 1);
                                                                onChange({ ...condition, children: nextChildren });
                                                            }}
                                                            style={{ position: 'absolute', top: 4, right: 0, background: '#3a3a3a', border: '1px solid #555', color: '#ff6b6b', cursor: 'pointer', fontSize: '10px', padding: '2px 4px' }}
                                                        >Delete</button>
                                                    )}
                                                </div>
                                            ))}
                                        {onChange && (
                                            <button
                                                onClick={() => {
                                                    const nextChildren = [...(condition.children || [])];
                                                    nextChildren.push({ type: 'LITERAL', value: true });
                                                    onChange({ ...condition, children: nextChildren });
                                                }}
                                                style={{ alignSelf: 'flex-start', background: '#2e7d32', color: '#fff', border: 'none', padding: '4px 6px', fontSize: '11px', cursor: 'pointer' }}
                                            >+ Add Child</button>
                                        )}
                                    </div>
                        )}

                        {(condition.type === 'COMPARISON') && (
                                 <div>
                                        <div style={{ fontSize: '9px', color: '#666', marginBottom: '2px' }}>LEFT / EXPRESSION</div>
                                        <ConditionEditor 
                                                condition={condition.left || { type: 'LITERAL', value: true }} 
                                                onChange={(newSub) => onChange && onChange({ ...condition, left: newSub })} 
                                                depth={depth + 1} 
                                                variables={variables}
                                                conditionScripts={conditionScripts}
                                        />
                                </div>
                        )}

            {condition.type === 'NOT' && (
                <div>
                    <div style={{ fontSize: '9px', color: '#666', marginBottom: '2px' }}>OPERAND</div>
                    <ConditionEditor
                        condition={condition.operand || { type: 'LITERAL', value: true }}
                        onChange={(newSub) => onChange && onChange({ ...condition, operand: newSub })}
                        depth={depth + 1}
                    />
                </div>
            )}

            {(condition.type === 'COMPARISON') && (
                <div>
                     <div style={{ fontSize: '9px', color: '#666', marginBottom: '2px' }}>RIGHT</div>
                     <ConditionEditor 
                        condition={condition.right || { type: 'LITERAL', value: true }} 
                        onChange={(newSub) => onChange && onChange({ ...condition, right: newSub })} 
                        depth={depth + 1} 
                        variables={variables}
                        conditionScripts={conditionScripts}
                    />
                </div>
            )}
        </div>
    </div>
  );
};
