/**
 * LeafConditionEditor.tsx - 叶子条件编辑器
 * 用于编辑叶子条件（COMPARISON / SCRIPT_REF / VARIABLE_REF / LITERAL）
 */

import React, { useMemo } from 'react';
import { ConditionExpression } from '../../../types/stateMachine';
import { VariableDefinition } from '../../../types/blackboard';
import { ScriptDefinition } from '../../../types/manifest';
import { ValueSource, VariableType } from '../../../types/common';
import { ResourceSelect } from '../ResourceSelect';
import { VariableSelector } from '../VariableSelector';
import { ValueSourceEditor } from '../ValueSourceEditor';
import {
    BLOCK_STYLES,
    getBlockStyle,
    conditionRowStyle,
    typeChipStyle,
    selectStyle,
    operatorSelectStyle,
    buttonStyles,
    COLORS
} from './conditionStyles';

interface LeafConditionEditorProps {
    condition: ConditionExpression;
    onChange?: (newCondition: ConditionExpression) => void;
    onRemove?: () => void;
    showDragHandle?: boolean;           // 是否显示拖拽手柄
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
    variables: VariableDefinition[];
    conditionScripts: ScriptDefinition[];
}

// 所有可用的比较操作符
const OPERATORS_ALL = ['==', '!=', '>', '<', '>=', '<='];

/**
 * 叶子条件编辑器组件
 * 支持四种条件类型：比较、脚本引用、变量引用、字面量
 */
export const LeafConditionEditor: React.FC<LeafConditionEditorProps> = ({
    condition,
    onChange,
    onRemove,
    showDragHandle,
    onDragStart,
    onDragEnd,
    variables,
    conditionScripts
}) => {
    const style = getBlockStyle(condition.type);

    // 过滤可用变量（排除已标记删除的）
    const availableVars = useMemo(
        () => variables.filter(v => v.state !== 'MarkedForDelete'),
        [variables]
    );

    // VARIABLE_REF 类型条件只能选择布尔类型变量
    const booleanVars = useMemo(
        () => availableVars.filter(v => v.type === 'boolean'),
        [availableVars]
    );

    // 获取左侧选中的变量，用于类型过滤操作符
    const selectedLeftVar = useMemo(() => {
        if (condition.type === 'COMPARISON' && condition.left?.type === 'VARIABLE_REF') {
            return variables.find(v => v.id === condition.left?.variableId);
        }
        return undefined;
    }, [condition, variables]);

    // 根据变量类型过滤可用的比较操作符
    const comparisonOperators = useMemo(() => {
        const varType = selectedLeftVar?.type;
        if (varType === 'boolean' || varType === 'string' || varType === 'enum') {
            return ['==', '!='];
        }
        return OPERATORS_ALL;
    }, [selectedLeftVar?.type]);

    // 检查变量状态（缺失/软删除）
    const checkVariableState = (variableId?: string) => {
        if (!variableId) return { missing: false, marked: false };
        const matched = variables.find(v => v.id === variableId);
        return {
            missing: !matched,
            marked: matched?.state === 'MarkedForDelete'
        };
    };

    // 检查脚本状态
    const scriptState = useMemo(() => {
        if (condition.type !== 'SCRIPT_REF' || !condition.scriptId) {
            return { missing: false, marked: false };
        }
        const matched = conditionScripts.find(s => s.id === condition.scriptId);
        return {
            missing: !matched,
            marked: matched?.state === 'MarkedForDelete'
        };
    }, [condition, conditionScripts]);

    // 处理条件类型切换
    const handleTypeChange = (newType: string) => {
        if (!onChange) return;

        switch (newType) {
            case 'COMPARISON':
                onChange({
                    type: 'COMPARISON',
                    operator: '==',
                    left: { type: 'VARIABLE_REF', variableId: '', variableScope: 'NodeLocal' },
                    right: { type: 'LITERAL', value: '' }
                });
                break;
            case 'SCRIPT_REF':
                onChange({ type: 'SCRIPT_REF', scriptId: '' });
                break;
            case 'VARIABLE_REF':
                onChange({ type: 'VARIABLE_REF', variableId: '', variableScope: 'NodeLocal' });
                break;
            case 'LITERAL':
                // LITERAL 现在与空态解耦，可以使用 true 或 false
                onChange({ type: 'LITERAL', value: true });
                break;
        }
    };

    // 渲染变量状态警告
    const renderVariableWarning = (variableId?: string) => {
        const state = checkVariableState(variableId);
        if (!state.missing && !state.marked) return null;
        return (
            <div style={{ color: COLORS.danger, fontSize: '11px', marginTop: '4px' }}>
                {state.missing ? 'Variable unavailable' : 'Variable is marked for delete'}
            </div>
        );
    };

    return (
        <div style={conditionRowStyle(style)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* 拖拽手柄（仅非根级显示） */}
                {showDragHandle && (
                    <span
                        draggable={!!onDragStart}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        style={{
                            ...buttonStyles.dragHandle,
                            cursor: onDragStart ? 'grab' : 'default'
                        }}
                    >⋮⋮</span>
                )}

                {/* 类型标签 Chip */}
                <span style={typeChipStyle(style)}>
                    {condition.type === 'COMPARISON' ? 'COMPARE' :
                        condition.type === 'SCRIPT_REF' ? 'SCRIPT' : condition.type}
                </span>

                {/* 类型选择器 */}
                <select
                    value={condition.type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    disabled={!onChange}
                    style={selectStyle}
                >
                    <option value="COMPARISON">Compare</option>
                    <option value="SCRIPT_REF">Script</option>
                    <option value="VARIABLE_REF">Variable</option>
                    <option value="LITERAL">Literal</option>
                </select>

                {/* COMPARISON 类型：左操作数 + 操作符 + 右操作数 */}
                {condition.type === 'COMPARISON' && (
                    <ComparisonEditor
                        condition={condition}
                        onChange={onChange}
                        availableVars={availableVars}
                        selectedLeftVar={selectedLeftVar}
                        comparisonOperators={comparisonOperators}
                        renderVariableWarning={renderVariableWarning}
                    />
                )}

                {/* SCRIPT_REF 类型：脚本选择器 */}
                {condition.type === 'SCRIPT_REF' && (
                    <div style={{ flex: 1, minWidth: '180px' }}>
                        <ResourceSelect
                            value={condition.scriptId || ''}
                            onChange={(val) => onChange && onChange({ ...condition, scriptId: val })}
                            options={conditionScripts.map(s => ({ id: s.id, name: s.name, state: s.state }))}
                            placeholder="Select condition script"
                            style={{ width: '100%' }}
                        />
                        {(scriptState.missing || scriptState.marked) && (
                            <div style={{ color: COLORS.danger, fontSize: '11px', marginTop: '4px' }}>
                                {scriptState.missing ? 'Script unavailable' : 'Script is marked for delete'}
                            </div>
                        )}
                    </div>
                )}

                {/* VARIABLE_REF 类型：布尔变量选择器 */}
                {condition.type === 'VARIABLE_REF' && (
                    <div style={{ flex: 1, minWidth: '180px' }}>
                        <VariableSelector
                            value={condition.variableId || ''}
                            variables={booleanVars}
                            allowedTypes={['boolean']}
                            onChange={(val, scope) => {
                                if (!onChange) return;
                                onChange({
                                    ...condition,
                                    variableId: val,
                                    variableScope: scope || condition.variableScope || 'NodeLocal'
                                });
                            }}
                            placeholder="Select variable"
                        />
                        {renderVariableWarning(condition.variableId)}
                    </div>
                )}

                {/* LITERAL 类型：布尔值切换 */}
                {condition.type === 'LITERAL' && (
                    <select
                        value={condition.value === true ? 'true' : 'false'}
                        onChange={(e) => onChange && onChange({ ...condition, value: e.target.value === 'true' })}
                        disabled={!onChange}
                        style={{
                            ...selectStyle,
                            color: '#ce9178'
                        }}
                    >
                        <option value="true">Always True</option>
                        <option value="false">Always False</option>
                    </select>
                )}

                {/* 删除按钮 */}
                {onRemove && (
                    <button
                        onClick={onRemove}
                        title="Remove Condition"
                        style={{
                            ...buttonStyles.deleteButton,
                            marginLeft: 'auto'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = COLORS.danger}
                        onMouseLeave={(e) => e.currentTarget.style.color = COLORS.textMuted}
                    >
                        ×
                    </button>
                )}
            </div>
        </div>
    );
};

/**
 * 比较条件编辑器 - 内部子组件
 * 处理 COMPARISON 类型的左值、操作符、右值编辑
 */
interface ComparisonEditorProps {
    condition: ConditionExpression;
    onChange?: (newCondition: ConditionExpression) => void;
    availableVars: VariableDefinition[];
    selectedLeftVar?: VariableDefinition;
    comparisonOperators: string[];
    renderVariableWarning: (variableId?: string) => React.ReactNode;
}

const ComparisonEditor: React.FC<ComparisonEditorProps> = ({
    condition,
    onChange,
    availableVars,
    selectedLeftVar,
    comparisonOperators,
    renderVariableWarning
}) => {
    if (condition.type !== 'COMPARISON') return null;

    // 将 ConditionExpression 转换为 ValueSource
    const rightAsValueSource = (): ValueSource => {
        if (condition.right?.type === 'VARIABLE_REF') {
            return {
                type: 'VariableRef',
                variableId: condition.right.variableId || '',
                scope: condition.right.variableScope || 'NodeLocal'
            };
        }
        return {
            type: 'Constant',
            value: condition.right?.value ?? ''
        };
    };

    // 将 ValueSource 转换回 ConditionExpression
    const handleRightChange = (src: ValueSource) => {
        if (!onChange) return;
        if (src.type === 'VariableRef') {
            onChange({
                ...condition,
                right: {
                    type: 'VARIABLE_REF',
                    variableId: src.variableId,
                    variableScope: src.scope || 'NodeLocal'
                }
            });
        } else {
            onChange({
                ...condition,
                right: { type: 'LITERAL', value: src.value }
            });
        }
    };

    // 根据左侧变量类型计算允许的右侧变量类型
    const varType = selectedLeftVar?.type;
    const allowedRightTypes: VariableType[] = varType
        ? (varType === 'boolean' ? ['boolean']
            : varType === 'string' ? ['string', 'integer', 'float', 'boolean', 'enum']
                : varType === 'integer' || varType === 'float' ? ['integer', 'float']
                    : [varType])
        : ['boolean', 'integer', 'float', 'string', 'enum'];

    return (
        <>
            {/* 左侧变量选择器 */}
            <div style={{ flex: 1, minWidth: '140px' }}>
                <VariableSelector
                    value={condition.left?.variableId || ''}
                    variables={availableVars}
                    onChange={(val, scope) => {
                        if (!onChange || !condition.left) return;
                        onChange({
                            ...condition,
                            left: {
                                ...condition.left,
                                type: 'VARIABLE_REF',
                                variableId: val,
                                variableScope: scope || 'NodeLocal'
                            }
                        });
                    }}
                    placeholder="Select variable"
                />
                {condition.left?.type === 'VARIABLE_REF' && renderVariableWarning(condition.left?.variableId)}
            </div>

            {/* 操作符选择器 */}
            <select
                value={condition.operator || '=='}
                onChange={(e) => onChange && onChange({ ...condition, operator: e.target.value as any })}
                disabled={!onChange}
                style={operatorSelectStyle}
            >
                {comparisonOperators.map(op => <option key={op} value={op}>{op}</option>)}
            </select>

            {/* 右值编辑器 - 支持常量或变量 */}
            <div style={{ flex: 1, minWidth: '120px' }}>
                <ValueSourceEditor
                    source={rightAsValueSource()}
                    onChange={handleRightChange}
                    variables={availableVars.filter(v => allowedRightTypes.includes(v.type))}
                    valueType={varType}
                    allowedTypes={allowedRightTypes}
                />
            </div>
        </>
    );
};
