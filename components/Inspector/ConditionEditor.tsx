
import React, { useMemo } from 'react';
import { ConditionExpression } from '../../types/stateMachine';
import { VariableScope, VariableType } from '../../types/common';
import { VariableDefinition } from '../../types/blackboard';
import { ScriptDefinition } from '../../types/manifest';
import { ResourceSelect } from './ResourceSelect';
import { VariableSelector } from './VariableSelector';

interface Props {
    condition: ConditionExpression;
    onChange?: (newCondition: ConditionExpression) => void;
    depth?: number;
    variables?: VariableDefinition[]; // visible variables
    conditionScripts?: ScriptDefinition[]; // optional custom condition scripts
}

// Visual styles for different logic blocks - Industrial Retro Theme
const BLOCK_STYLES = {
    AND: {
        borderLeft: '4px solid #4ade80', // Green-400
        bg: 'rgba(74, 222, 128, 0.05)',
        labelColor: '#4ade80'
    },
    OR: {
        borderLeft: '4px solid #f97316', // Orange-500
        bg: 'rgba(249, 115, 22, 0.05)',
        labelColor: '#f97316'
    },
    NOT: {
        borderLeft: '4px solid #ef4444', // Red-500
        bg: 'rgba(239, 68, 68, 0.05)',
        labelColor: '#ef4444'
    },
    COMPARISON: {
        borderLeft: '4px solid #3b82f6', // Blue-500
        bg: 'rgba(59, 130, 246, 0.05)',
        labelColor: '#3b82f6'
    },
    DEFAULT: {
        borderLeft: '4px solid #71717a', // Zinc-500
        bg: 'rgba(113, 113, 122, 0.05)',
        labelColor: '#a1a1aa'
    }
};

export const ConditionEditor = ({ condition, onChange, depth = 0, variables = [], conditionScripts = [] }: Props) => {
    // Simplified options for selecting types
    const TYPES = ['AND', 'OR', 'NOT', 'COMPARISON', 'LITERAL', 'VARIABLE_REF', 'SCRIPT_REF'];
    const OPERATORS_ALL = ['==', '!=', '>', '<', '>=', '<='];
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
    const availableVars = useMemo(() => variables.filter(v => v.state !== 'MarkedForDelete'), [variables]);

    // 根据已选变量类型限制可用操作符；布尔/字符串仅支持相等比较，数值支持全套（保持类型匹配）
    const comparisonOperators = useMemo(() => {
        const varType: VariableType | undefined = selectedVar?.type;
        if (varType === 'boolean' || varType === 'string' || varType === 'enum') return ['==', '!='];
        if (varType === 'integer' || varType === 'float') return OPERATORS_ALL;
        return OPERATORS_ALL;
    }, [selectedVar?.type]);

    return (
        <div style={{
            marginLeft: depth > 0 ? '16px' : '0',
            marginTop: '8px',
            padding: '8px 12px',
            backgroundColor: style.bg,
            borderLeft: style.borderLeft,
            borderRadius: '0 4px 4px 0',
            fontSize: '12px',
            position: 'relative',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
        }}>
            <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: style.labelColor,
                    minWidth: '24px',
                    letterSpacing: '0.5px'
                }}>
                    {condition.type}
                </span>

                <select
                    value={condition.type}
                    onChange={handleChangeType}
                    disabled={!onChange}
                    style={{
                        background: '#27272a',
                        color: '#e4e4e7',
                        border: '1px solid #52525b',
                        borderRadius: '4px',
                        fontSize: '11px',
                        padding: '4px 6px',
                        outline: 'none',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                {condition.type === 'COMPARISON' && (
                    <select
                        value={condition.operator}
                        onChange={(e) => onChange && onChange({ ...condition, operator: e.target.value as any })}
                        disabled={!onChange}
                        style={{
                            background: '#18181b',
                            color: '#f97316',
                            border: '1px solid #52525b',
                            borderRadius: '4px',
                            fontSize: '12px',
                            padding: '4px 8px',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        {comparisonOperators.map(op => <option key={op} value={op}>{op}</option>)}
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
                                    style={{
                                        width: '16px',
                                        height: '16px',
                                        accentColor: '#f97316',
                                        cursor: 'pointer'
                                    }}
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
                                placeholder="Value"
                                style={{
                                    background: '#27272a',
                                    border: '1px solid #52525b',
                                    color: '#ce9178',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    width: '100px',
                                    outline: 'none'
                                }}
                            />
                        );
                    })()
                )}

                {condition.type === 'VARIABLE_REF' && (
                    <div style={{ flex: 1, minWidth: '220px' }}>
                        <VariableSelector
                            value={condition.variableId || ''}
                            variables={availableVars}
                            onChange={(val, scope) => {
                                if (!onChange) return;
                                // 自动同步作用域
                                onChange({
                                    ...condition,
                                    variableId: val,
                                    variableScope: scope || condition.variableScope || 'NodeLocal'
                                });
                            }}
                            placeholder="Select variable"
                        />
                    </div>
                )}

                {condition.type === 'SCRIPT_REF' && (
                    <div style={{ flex: 1, minWidth: '180px' }}>
                        <ResourceSelect
                            value={condition.scriptId || ''}
                            onChange={(val) => onChange && onChange({ ...condition, scriptId: val })}
                            options={conditionScripts.map(s => ({ id: s.id, name: s.name, state: s.state }))}
                            placeholder="Select condition script"
                            style={{ width: '100%' }}
                        />
                    </div>
                )}
            </div>

            {selectedVar?.state === 'MarkedForDelete' && (
                <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⚠</span> Variable is marked for delete
                </div>
            )}
            {!selectedVar && condition.type === 'VARIABLE_REF' && (
                <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⚠</span> Variable not found
                </div>
            )}

            {/* Recursive Children */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' }}>
                {(condition.type === 'AND' || condition.type === 'OR') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(condition.children && condition.children.length > 0
                            ? condition.children
                            : (condition.left && condition.right ? [condition.left, condition.right] : [])
                        )
                            .map((child, idx) => (
                                <div key={idx} style={{ position: 'relative' }}>
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
                                            title="Remove Condition"
                                            style={{
                                                position: 'absolute',
                                                top: '12px',
                                                right: '8px',
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#71717a',
                                                cursor: 'pointer',
                                                fontSize: '18px',
                                                lineHeight: 1,
                                                padding: '4px',
                                                transition: 'color 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = '#71717a'}
                                        >
                                            ×
                                        </button>
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
                                className="btn-ghost"
                                style={{
                                    alignSelf: 'flex-start',
                                    marginLeft: '16px',
                                    fontSize: '11px',
                                    borderStyle: 'dashed',
                                    opacity: 0.7
                                }}
                            >
                                + Add Condition
                            </button>
                        )}
                    </div>
                )}

                {(condition.type === 'COMPARISON') && (
                    <div style={{ paddingLeft: '8px' }}>
                        <div style={{ fontSize: '9px', color: '#71717a', fontWeight: 600, marginBottom: '2px', letterSpacing: '0.5px' }}>LEFT / EXPRESSION</div>
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
                    <div style={{ paddingLeft: '8px' }}>
                        <div style={{ fontSize: '9px', color: '#71717a', fontWeight: 600, marginBottom: '2px', letterSpacing: '0.5px' }}>OPERAND</div>
                        <ConditionEditor
                            condition={condition.operand || { type: 'LITERAL', value: true }}
                            onChange={(newSub) => onChange && onChange({ ...condition, operand: newSub })}
                            depth={depth + 1}
                            variables={variables}
                            conditionScripts={conditionScripts}
                        />
                    </div>
                )}

                {(condition.type === 'COMPARISON') && (
                    <div style={{ paddingLeft: '8px' }}>
                        <div style={{ fontSize: '9px', color: '#71717a', fontWeight: 600, marginBottom: '2px', letterSpacing: '0.5px' }}>RIGHT</div>
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
