/**
 * components/Inspector/VariableInspector.tsx
 * 变量属性检查器组件
 * 
 * 职责：
 * - 展示全局变量和局部变量的详细属性
 * - 支持全局变量的编辑和删除操作
 * - 局部变量仅展示只读信息（编辑在 Node/Stage Inspector 中）
 * 
 * UI风格：
 * - 与 StateInspector 保持一致的 Inspector 布局
 * - 使用统一的 CSS 类名和样式
 * 
 * 编辑逻辑：
 * - 输入时不做额外校验，失焦时校验
 * - 如果不符合则回退到编辑前的数值
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import type { VariableDefinition } from '../../types/blackboard';
import type { VariableType } from '../../types/common';
import type { StageNode } from '../../types/stage';
import type { PuzzleNode } from '../../types/puzzleNode';
import { Trash2 } from 'lucide-react';

// ========== Props 类型定义 ==========
interface VariableInspectorProps {
    variableId: string;
    readOnly?: boolean;
}

// ========== 工具函数 ==========

/**
 * 获取变量类型对应的 CSS 类名
 */
const getTypeClassName = (type: VariableType): string => {
    return `var-type--${type}`;
};

/**
 * 获取变量类型对应的颜色值（用于 select 元素动态着色）
 */
const getTypeColor = (type: VariableType): string => {
    const colorMap: Record<string, string> = {
        'boolean': '#60a5fa',
        'integer': '#a3e635',
        'float': '#2dd4bf',
        'string': '#fbbf24'
    };
    return colorMap[type] || 'var(--text-primary)';
};

/**
 * 获取作用域对应的类型标签 CSS 类名
 */
const getScopeClassName = (scope: 'Global' | 'Stage' | 'Node'): string => {
    const map: Record<string, string> = {
        'Global': 'inspector-type-label--variable-global',
        'Stage': 'inspector-type-label--variable-stage',
        'Node': 'inspector-type-label--variable-node'
    };
    return map[scope] || '';
};

/**
 * 获取作用域显示标签
 */
const getScopeLabel = (scope: 'Global' | 'Stage' | 'Node'): string => {
    const map: Record<string, string> = {
        'Global': 'GLOBAL VARIABLE',
        'Stage': 'STAGE LOCAL VARIABLE',
        'Node': 'NODE LOCAL VARIABLE'
    };
    return map[scope] || 'VARIABLE';
};

// ========== 主组件 ==========
export const VariableInspector: React.FC<VariableInspectorProps> = ({ variableId, readOnly = false }) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();

    // 在全局变量中查找
    let variable: VariableDefinition | undefined = project.blackboard.globalVariables[variableId];
    let variableScope: 'Global' | 'Stage' | 'Node' = 'Global';
    let scopeOwnerName = '';

    // 如果全局未找到，在 Stage 中查找
    if (!variable) {
        for (const stage of Object.values<StageNode>(project.stageTree.stages)) {
            if (stage.localVariables && stage.localVariables[variableId]) {
                variable = stage.localVariables[variableId];
                variableScope = 'Stage';
                scopeOwnerName = stage.name;
                break;
            }
        }
    }

    // 如果 Stage 未找到，在 Node 中查找
    if (!variable) {
        for (const node of Object.values<PuzzleNode>(project.nodes)) {
            if (node.localVariables && node.localVariables[variableId]) {
                variable = node.localVariables[variableId];
                variableScope = 'Node';
                scopeOwnerName = node.name;
                break;
            }
        }
    }

    // 变量未找到的空状态
    if (!variable) {
        return <div className="empty-state">Variable not found</div>;
    }

    const isGlobal = variableScope === 'Global';
    const canEdit = isGlobal && !readOnly;

    // ========== 本地编辑状态（用于失焦校验） ==========
    const [localName, setLocalName] = useState(variable.name);
    const [localValue, setLocalValue] = useState<any>(variable.value);
    const [localDescription, setLocalDescription] = useState(variable.description || '');

    // 当 variable 变化时同步本地状态
    useEffect(() => {
        setLocalName(variable.name);
        setLocalValue(variable.value);
        setLocalDescription(variable.description || '');
    }, [variable.name, variable.value, variable.description]);

    // 更新变量属性（直接派发）
    const handleUpdate = useCallback((updates: Partial<VariableDefinition>) => {
        if (isGlobal) {
            dispatch({ type: 'UPDATE_GLOBAL_VARIABLE', payload: { id: variableId, data: updates } });
        }
    }, [isGlobal, dispatch, variableId]);

    // 删除变量（软删除）
    const handleDelete = () => {
        if (isGlobal) {
            dispatch({ type: 'SOFT_DELETE_GLOBAL_VARIABLE', payload: { id: variableId } });
        }
    };

    // ========== 失焦校验处理函数 ==========
    
    // 名称失焦：非空校验
    const handleNameBlur = () => {
        const trimmed = localName.trim();
        if (!trimmed) {
            // 回退到原值
            setLocalName(variable.name);
        } else if (trimmed !== variable.name) {
            handleUpdate({ name: trimmed });
        }
    };

    // 数值类型失焦：有效性校验
    const handleNumberBlur = () => {
        if (variable.type === 'integer') {
            const parsed = parseInt(String(localValue), 10);
            if (Number.isNaN(parsed)) {
                setLocalValue(variable.value);
            } else if (parsed !== variable.value) {
                handleUpdate({ value: parsed });
            }
        } else if (variable.type === 'float') {
            const parsed = parseFloat(String(localValue));
            if (Number.isNaN(parsed)) {
                setLocalValue(variable.value);
            } else if (parsed !== variable.value) {
                handleUpdate({ value: parsed });
            }
        }
    };

    // 字符串类型失焦
    const handleStringBlur = () => {
        if (localValue !== variable.value) {
            handleUpdate({ value: localValue });
        }
    };

    // 描述失焦
    const handleDescriptionBlur = () => {
        if (localDescription !== (variable.description || '')) {
            handleUpdate({ description: localDescription });
        }
    };

    // 渲染值输入控件（使用本地状态 + 失焦校验）
    const renderValueInput = () => {
        if (!canEdit) {
            return (
                <div className="prop-value monospace">
                    {String(variable.value)}
                </div>
            );
        }

        switch (variable.type) {
            case 'boolean':
                return (
                    <select
                        className="inspector-select monospace"
                        value={String(localValue)}
                        onChange={(e) => {
                            const val = e.target.value === 'true';
                            setLocalValue(val);
                            handleUpdate({ value: val });
                        }}
                    >
                        <option value="true">true</option>
                        <option value="false">false</option>
                    </select>
                );
            case 'integer':
                return (
                    <input
                        type="number"
                        className="inspector-input monospace"
                        value={localValue}
                        step="1"
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={handleNumberBlur}
                    />
                );
            case 'float':
                return (
                    <input
                        type="number"
                        className="inspector-input monospace"
                        value={localValue}
                        step="0.1"
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={handleNumberBlur}
                    />
                );
            default:
                return (
                    <input
                        type="text"
                        className="inspector-input monospace"
                        value={localValue as string}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={handleStringBlur}
                    />
                );
        }
    };

    // 获取删除按钮提示文案
    const getDeleteTooltip = (): string => {
        if (variable.state === 'Draft') return 'Delete';
        if (variable.state === 'Implemented') return 'Mark for Delete';
        return 'Apply Delete';
    };

    return (
        <div>
            {/* Variable Header - 变量头部区域 */}
            <div className="inspector-header-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div className={`inspector-type-label ${getScopeClassName(variableScope)}`}>
                        {getScopeLabel(variableScope)}
                    </div>
                    {canEdit && (
                        <button
                            className="btn-icon btn-icon--danger"
                            onClick={handleDelete}
                            title={getDeleteTooltip()}
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
                {canEdit ? (
                    <input
                        type="text"
                        className="inspector-name-input"
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        onBlur={handleNameBlur}
                    />
                ) : (
                    <div className="inspector-name-input" style={{ background: 'transparent', border: 'none' }}>
                        {variable.name}
                    </div>
                )}
            </div>

            {/* Basic Info Section - 基本信息区块 */}
            <div className="inspector-section inspector-basic-info">
                <div className="inspector-section-title">Basic Info</div>

                {/* ID（只读） */}
                <div className="prop-row">
                    <div className="prop-label">ID</div>
                    <div className="prop-value monospace" style={{ color: '#666' }}>{variable.id}</div>
                </div>

                {/* Type */}
                <div className="prop-row">
                    <div className="prop-label">Type</div>
                    {canEdit ? (
                        <select
                            className="inspector-type-select"
                            value={variable.type}
                            onChange={(e) => {
                                const newType = e.target.value as VariableType;
                                let newValue: any = variable.value;
                                // 切换类型时重置值
                                if (newType === 'boolean') newValue = false;
                                else if (newType === 'integer') newValue = 0;
                                else if (newType === 'float') newValue = 0.0;
                                else if (newType === 'string') newValue = '';
                                setLocalValue(newValue);
                                handleUpdate({ type: newType, value: newValue });
                            }}
                            style={{ color: getTypeColor(variable.type) }}
                        >
                            <option value="boolean">boolean</option>
                            <option value="integer">integer</option>
                            <option value="float">float</option>
                            <option value="string">string</option>
                        </select>
                    ) : (
                        <div className={`prop-value monospace ${getTypeClassName(variable.type)}`}>
                            {variable.type}
                        </div>
                    )}
                </div>

                {/* Value */}
                <div className="prop-row">
                    <div className="prop-label">Value</div>
                    {renderValueInput()}
                </div>

                {/* State */}
                <div className="prop-row">
                    <div className="prop-label">State</div>
                    <div className="prop-value">{variable.state}</div>
                </div>

                {/* Description */}
                <div className="inspector-description-block">
                    <div className="inspector-description-label">Description</div>
                    {canEdit ? (
                        <textarea
                            className="inspector-textarea"
                            value={localDescription}
                            onChange={(e) => setLocalDescription(e.target.value)}
                            onBlur={handleDescriptionBlur}
                            placeholder="No description."
                        />
                    ) : (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>
                            {variable.description || 'No description.'}
                        </div>
                    )}
                </div>
            </div>

            {/* Scope Section - 作用域区块（仅局部变量显示） */}
            {variableScope !== 'Global' && (
                <div className="inspector-section">
                    <div className="inspector-section-title">Scope</div>
                    <div className="prop-row">
                        <div className="prop-label">Owner Type</div>
                        <div className={`prop-value ${getScopeClassName(variableScope)}`} style={{ fontWeight: 500 }}>
                            {variableScope}
                        </div>
                    </div>
                    <div className="prop-row">
                        <div className="prop-label">Owner Name</div>
                        <div className="prop-value">{scopeOwnerName}</div>
                    </div>
                </div>
            )}

            {/* References Section - 引用追踪区块 */}
            <div className="inspector-section">
                <div className="inspector-section-title">References</div>
                <div className="inspector-reference-placeholder">
                    <div className="inspector-reference-placeholder__title">
                        Reference tracking coming soon
                    </div>
                    <div className="inspector-reference-placeholder__desc">
                        This area will show where this variable is used
                        (conditions, parameter modifiers, script bindings, etc.)
                    </div>
                </div>
            </div>
        </div>
    );
};