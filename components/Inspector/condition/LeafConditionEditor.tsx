/**
 * LeafConditionEditor.tsx - 叶子条件编辑器
 * 用于编辑叶子条件（Comparison / ScriptRef / VariableRef / Literal）
 */

import React, { useEffect, useMemo } from 'react';
import { ConditionExpression } from '../../../types/stateMachine';
import { VariableDefinition } from '../../../types/blackboard';
import { ScriptDefinition } from '../../../types/manifest';
import { ValueSource, VariableType } from '../../../types/common';
import { ResourceSelect, ResourceDetailsCard } from '../ResourceSelect';
import { VariableSelector } from '../VariableSelector';
import { ValueSourceEditor } from '../ValueSourceEditor';
import {
    BLOCK_STYLES,
    getBlockStyle,
    conditionRowStyle,
    typeChipStyle,
    typeSelectStyle,
    selectStyle,
    operatorSelectStyle,
    buttonStyles,
    COLORS,
    INPUT_HEIGHT,
    ROW_GAP
} from './conditionStyles';
import { InspectorError } from '../InspectorInfo';
import { filterActiveResources } from '../../../utils/resourceFilters';

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

    // 预处理 Comparison 类型：若 left/right/operator 缺失，填充默认值
    useEffect(() => {
        if (!onChange) return;
        if (condition.type !== 'Comparison') return;

        const needLeft = !condition.left;
        const needRight = !condition.right;
        const needOperator = !condition.operator;

        if (needLeft || needRight || needOperator) {
            onChange({
                type: 'Comparison',
                operator: condition.operator || '==',
                left: condition.left || { type: 'VariableRef', variableId: '', scope: 'NodeLocal' },
                right: condition.right || { type: 'Constant', value: '' }
            });
        }
    }, [condition, onChange]);

    // 过滤可用变量（排除已标记删除的）
    const availableVars = useMemo(
        () => filterActiveResources(variables),
        [variables]
    );

    // 获取左侧选中的变量，用于类型过滤操作符
    const selectedLeftVar = useMemo(() => {
        if (condition.type === 'Comparison' && condition.left?.type === 'VariableRef') {
            return variables.find(v => v.id === condition.left?.variableId);
        }
        return undefined;
    }, [condition, variables]);

    // 根据变量类型过滤可用的比较操作符
    const comparisonOperators = useMemo(() => {
        const varType = selectedLeftVar?.type;
        if (varType === 'boolean' || varType === 'string') {
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
        if (condition.type !== 'ScriptRef' || !condition.scriptId) {
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
            case 'Comparison':
                onChange({
                    type: 'Comparison',
                    operator: '==',
                    left: { type: 'VariableRef', variableId: '', scope: 'NodeLocal' },
                    right: { type: 'Constant', value: '' }
                });
                break;
            case 'ScriptRef':
                onChange({ type: 'ScriptRef', scriptId: '' });
                break;
            case 'Literal':
                // Literal (Always True/False)
                onChange({ type: 'Literal', value: true });
                break;
        }
    };

    // 渲染变量状态警告
    const renderVariableWarning = (variableId?: string) => {
        const state = checkVariableState(variableId);
        if (!state.missing && !state.marked) return null;
        return (
            <InspectorError
                message={state.missing ? 'Variable unavailable' : 'Variable is marked for delete'}
                style={{ marginTop: '4px', marginBottom: 0 }}
            />
        );
    };

    return (
        <div style={conditionRowStyle(style)}>
            {/* Header Row: Handle + Type + Inline Content + Delete */}
            <div style={{ display: 'flex', alignItems: 'center', gap: `${ROW_GAP}px`, width: '100%', flexWrap: 'nowrap', minWidth: 0, overflow: 'visible' }}>
                {/* 拖拽手柄（仅非根级显示） */}
                {showDragHandle && (
                    <span
                        draggable={!!onDragStart}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        style={{
                            ...buttonStyles.dragHandle,
                            cursor: onDragStart ? 'grab' : 'default',
                            flexShrink: 0
                        }}
                    >⋮⋮</span>
                )}

                {/* 类型选择器 (合并了显示标记) */}
                <div style={{ position: 'relative', display: 'inline-block', minWidth: 0, flexShrink: 1, maxWidth: '100%', verticalAlign: 'middle' }}>
                    <select
                        value={condition.type}
                        onChange={(e) => handleTypeChange(e.target.value)}
                        disabled={!onChange}
                        style={{ ...typeSelectStyle(style), width: '100%' }}
                    >
                        <option value="Comparison">Compare</option>
                        <option value="ScriptRef">Script</option>
                        <option value="Literal">Literal</option>
                    </select>
                    <span
                        aria-hidden
                        style={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: style.labelColor,
                            fontSize: '10px',
                            pointerEvents: 'none',
                            userSelect: 'none'
                        }}
                    >
                        ▼
                    </span>
                </div>

                {/* ScriptRef 类型：脚本选择器 (Inline) */}
                {condition.type === 'ScriptRef' && (
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <ResourceSelect
                            value={condition.scriptId || ''}
                            onChange={(val) => onChange && onChange({ ...condition, scriptId: val })}
                            options={conditionScripts.map(s => ({
                                id: s.id,
                                name: s.name,
                                state: s.state,
                                key: s.key,
                                category: s.category,
                                description: s.description
                            }))}
                            placeholder="Select condition script"
                            showDetails={false}
                            style={{ width: '100%' }}
                            height={INPUT_HEIGHT}
                        />
                    </div>
                )}

                {/* Literal 类型：布尔值切换 (Inline) */}
                {condition.type === 'Literal' && (
                    <select
                        value={condition.value ? 'true' : 'false'}
                        onChange={(e) => onChange && onChange({ ...condition, value: e.target.value === 'true' })}
                        disabled={!onChange}
                        style={{
                            ...selectStyle,
                            color: '#ce9178',
                            flex: 1,
                            minWidth: 0,
                            height: INPUT_HEIGHT,
                            padding: '0 6px',
                            lineHeight: `${INPUT_HEIGHT - 2}px`,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <option value="true">Always True</option>
                        <option value="false">Always False</option>
                    </select>
                )}

                {/* 删除按钮 (Always Layout Right) */}
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

            {/* ScriptRef 错误提示 */}
            {condition.type === 'ScriptRef' && (scriptState.missing || scriptState.marked) && (
                <InspectorError
                    message={scriptState.missing ? 'Script unavailable' : 'Script is marked for delete'}
                    style={{ marginTop: `${ROW_GAP}px`, marginBottom: 0 }}
                />
            )}

            {/* ScriptRef 详细信息显示 */}
            {condition.type === 'ScriptRef' && condition.scriptId && (() => {
                const selectedScript = conditionScripts.find(s => s.id === condition.scriptId);
                if (!selectedScript) return null;
                return (
                    <div style={{ marginTop: `${ROW_GAP}px` }}>
                        <ResourceDetailsCard resource={{
                            id: selectedScript.id,
                            name: selectedScript.name,
                            state: selectedScript.state,
                            key: selectedScript.key,
                            category: selectedScript.category,
                            description: selectedScript.description
                        }} />
                    </div>
                );
            })()}

            {/* Comparison 类型：独立的主体块 */}
            {condition.type === 'Comparison' && (
                <ComparisonEditor
                    condition={condition}
                    onChange={onChange}
                    availableVars={availableVars}
                    selectedLeftVar={selectedLeftVar}
                    comparisonOperators={comparisonOperators}
                    renderVariableWarning={renderVariableWarning}
                />
            )}
        </div>
    );
};

/**
* 比较条件编辑器 - 内部子组件
* 处理 Comparison 类型的左值、操作符、右值编辑
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
    if (condition.type !== 'Comparison') return null;
    // Defensive check
    if (!condition.left || !condition.right) return null;

    const handleRightChange = (src: ValueSource) => {
        if (!onChange) return;
        onChange({
            ...condition,
            right: src
        });
    };

    // 根据左侧变量类型计算允许的右侧变量类型
    const varType = selectedLeftVar?.type;
    const allowedRightTypes: VariableType[] = varType
        ? (varType === 'boolean' ? ['boolean']
            : varType === 'string' ? ['string', 'integer', 'float', 'boolean']
                : varType === 'integer' || varType === 'float' ? ['integer', 'float']
                    : [varType])
        : ['boolean', 'integer', 'float', 'string'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${ROW_GAP}px`, width: '100%', marginTop: `${ROW_GAP}px` }}>
            {/* 左侧变量选择器 */}
            <div style={{ width: '100%' }}>
                <VariableSelector
                    value={condition.left?.type === 'VariableRef' ? condition.left.variableId : ''}
                    variables={availableVars}
                    onChange={(val, scope) => {
                        if (!onChange) return;
                        onChange({
                            ...condition,
                            left: {
                                type: 'VariableRef',
                                variableId: val,
                                scope: scope || 'NodeLocal'
                            }
                        });
                    }}
                    placeholder="Select left variable"
                    height={INPUT_HEIGHT}
                />
                {condition.left?.type === 'VariableRef' && renderVariableWarning(condition.left.variableId)}
            </div>

            {/* 操作符 + 右值编辑器 */}
            <ValueSourceEditor
                source={condition.right}
                onChange={handleRightChange}
                variables={availableVars.filter(v => allowedRightTypes.includes(v.type))}
                valueType={varType}
                allowedTypes={allowedRightTypes}
                height={INPUT_HEIGHT}
                prefixElement={
                    <select
                        value={condition.operator || '=='}
                        onChange={(e) => onChange && onChange({ ...condition, operator: e.target.value as any })}
                        disabled={!onChange}
                        style={{
                            background: '#27272a',
                            color: '#e4e4e7',
                            border: '1px solid #52525b',
                            padding: '4px 8px',
                            fontSize: '12px',
                            borderRadius: '4px',
                            flex: 1,
                            minWidth: 0,
                            height: INPUT_HEIGHT,
                            outline: 'none',
                            fontFamily: 'Inter, sans-serif',
                            lineHeight: `${INPUT_HEIGHT - 2}px`
                        }}
                    >
                        {comparisonOperators.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                }
            />
        </div>
    );
};
