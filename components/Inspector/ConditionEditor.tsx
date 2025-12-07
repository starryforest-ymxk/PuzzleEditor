
import React from 'react';
import { ConditionExpression } from '../../types/stateMachine';
import { useEditorState } from '../../store/context';

interface Props {
  condition: ConditionExpression;
  onChange?: (newCondition: ConditionExpression) => void;
  depth?: number;
}

// Visual styles for different logic blocks
const BLOCK_STYLES = {
    AND: { borderLeft: '3px solid #4caf50', bg: 'rgba(76, 175, 80, 0.1)' },
    OR: { borderLeft: '3px solid #ff9800', bg: 'rgba(255, 152, 0, 0.1)' },
    NOT: { borderLeft: '3px solid #f44336', bg: 'rgba(244, 67, 54, 0.1)' },
    COMPARISON: { borderLeft: '3px solid #2196f3', bg: 'rgba(33, 150, 243, 0.1)' },
    DEFAULT: { borderLeft: '3px solid #9e9e9e', bg: 'rgba(158, 158, 158, 0.1)' }
};

export const ConditionEditor = ({ condition, onChange, depth = 0 }: Props) => {
  // Simplified options for selecting types
  const TYPES = ['AND', 'OR', 'NOT', 'COMPARISON', 'LITERAL', 'VARIABLE_REF'];
  const OPERATORS = ['==', '!=', '>', '<', '>=', '<='];

  const handleChangeType = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newType = e.target.value as any;
      if (!onChange) return;
      
      // Reset structure based on new type
      const base: Partial<ConditionExpression> = { type: newType };
      if (newType === 'AND' || newType === 'OR' || newType === 'COMPARISON') {
          base.left = condition.left || { type: 'LITERAL', value: true };
          base.right = condition.right || { type: 'LITERAL', value: true };
          if(newType === 'COMPARISON') base.operator = '==';
      } else if (newType === 'NOT') {
          base.left = condition.left || { type: 'LITERAL', value: true };
      } else if (newType === 'LITERAL') {
          base.value = false;
      } else if (newType === 'VARIABLE_REF') {
          base.variableId = '';
      }
      onChange(base as ConditionExpression);
  };

  const style = BLOCK_STYLES[condition.type as keyof typeof BLOCK_STYLES] || BLOCK_STYLES.DEFAULT;

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
                <input 
                    type="text" 
                    value={String(condition.value)}
                    onChange={(e) => onChange && onChange({ ...condition, value: e.target.value })}
                    disabled={!onChange}
                    style={{ background: '#333', border: 'none', color: '#ce9178', width: '60px', fontSize: '11px' }}
                />
            )}

            {condition.type === 'VARIABLE_REF' && (
                <input 
                    type="text" 
                    placeholder="var_id"
                    value={condition.variableId || ''}
                    onChange={(e) => onChange && onChange({ ...condition, variableId: e.target.value })}
                    disabled={!onChange}
                    style={{ background: '#2d2d2d', border: '1px solid #444', color: '#9cdcfe', width: '80px', fontSize: '11px' }}
                />
            )}
        </div>

        {/* Recursive Children */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {(condition.type === 'AND' || condition.type === 'OR' || condition.type === 'NOT' || condition.type === 'COMPARISON') && (
                 <div>
                    <div style={{ fontSize: '9px', color: '#666', marginBottom: '2px' }}>LEFT / EXPRESSION</div>
                    <ConditionEditor 
                        condition={condition.left!} 
                        onChange={(newSub) => onChange && onChange({ ...condition, left: newSub })}
                        depth={depth + 1} 
                    />
                </div>
            )}
            
            {(condition.type === 'AND' || condition.type === 'OR' || condition.type === 'COMPARISON') && (
                <div>
                     <div style={{ fontSize: '9px', color: '#666', marginBottom: '2px' }}>RIGHT</div>
                     <ConditionEditor 
                        condition={condition.right!} 
                        onChange={(newSub) => onChange && onChange({ ...condition, right: newSub })}
                        depth={depth + 1} 
                    />
                </div>
            )}
        </div>
    </div>
  );
};
