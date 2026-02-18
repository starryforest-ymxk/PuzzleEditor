/**
 * components/Inspector/VariableInspector.tsx
 * 变量属性检查器组件
 * 
 * 职责：
 * - 展示全局变量和局部变量的详细属性
 * - 支持全局变量的编辑和删除操作
 * - 局部变量仅展示只读信息（编辑在 Node/Stage Inspector 中）
 * - 支持点击引用位置跳转到对应的编辑器界面
 * 
 * UI风格：
 * - 与 StateInspector 保持一致的 Inspector 布局
 * - 使用统一的 CSS 类名和样式
 * 
 * 编辑逻辑：
 * - 输入时不做额外校验，失焦时校验
 * - 如果不符合则回退到编辑前的数值
 * 
 * 删除逻辑（与 LocalVariableEditor 同步）：
 * - Draft 状态：无引用直接删除，有引用弹窗确认后删除
 * - Implemented 状态：无引用软删除（MarkedForDelete），有引用弹窗确认后软删除
 * - MarkedForDelete 状态：显示 Restore 和 Delete 按钮，Delete 需弹窗确认后硬删除
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import type { VariableDefinition } from '../../types/blackboard';
import type { VariableType } from '../../types/common';
import type { StageNode } from '../../types/stage';
import type { PuzzleNode } from '../../types/puzzleNode';
import { InspectorWarning } from './InspectorInfo';
import { ResourceActionButtons } from './ResourceActionButtons';
import { findGlobalVariableReferences, VariableReferenceInfo } from '../../utils/validation/globalVariableReferences';
import { ReferenceListSection } from './ReferenceListSection';
import { findNodeVariableReferences } from '../../utils/variableReferences';
import { findStageVariableReferences } from '../../utils/validation/stageVariableReferences';
import { AssetNameAutoFillButton } from './AssetNameAutoFillButton';
import { useDeleteHandler } from '../../hooks/useDeleteHandler';
import { useInspectorNameFields } from '../../hooks/useInspectorNameFields';

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
    let scopeOwnerId = ''; // 用于局部变量引用查找

    // 如果全局未找到，在 Stage 中查找
    if (!variable) {
        for (const stage of Object.values<StageNode>(project.stageTree.stages)) {
            if (stage.localVariables && stage.localVariables[variableId]) {
                variable = stage.localVariables[variableId];
                variableScope = 'Stage';
                scopeOwnerName = stage.name;
                scopeOwnerId = stage.id;
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
                scopeOwnerId = node.id;
                break;
            }
        }
    }

    // 变量未找到的空状态
    if (!variable) {
        return <div className="empty-state">Variable not found</div>;
    }

    const isGlobal = variableScope === 'Global';
    const isMarkedForDelete = variable.state === 'MarkedForDelete';
    // 全局变量可编辑，但 MarkedForDelete 状态下不可编辑
    const canEdit = isGlobal && !readOnly && !isMarkedForDelete;

    // ========== 本地编辑状态 ==========
    const [localValue, setLocalValue] = useState<any>(variable.value);
    const [localDescription, setLocalDescription] = useState(variable.description || '');

    // 更新变量属性（直接派发）
    const handleUpdate = useCallback((updates: Partial<VariableDefinition>) => {
        if (isGlobal && !isMarkedForDelete) {
            dispatch({ type: 'UPDATE_GLOBAL_VARIABLE', payload: { id: variableId, data: updates } });
        }
    }, [isGlobal, isMarkedForDelete, dispatch, variableId]);

    // 统一名称编辑 Hook（不允许空名称）
    const {
        localName, setLocalName,
        localAssetName, setLocalAssetName,
        handleNameBlur, handleAssetNameBlur, triggerAutoTranslate
    } = useInspectorNameFields({
        entity: variable,
        onUpdate: handleUpdate,
        allowEmptyName: false,
    });

    // ========== 变量引用检查（支持全局和局部变量） ==========
    const references = useMemo((): VariableReferenceInfo[] => {
        if (isGlobal) {
            // 全局变量引用检查
            return findGlobalVariableReferences(project, variableId);
        } else if (variableScope === 'Node' && scopeOwnerId) {
            // Node 局部变量引用检查
            return findNodeVariableReferences(project, scopeOwnerId, variableId);
        } else if (variableScope === 'Stage' && scopeOwnerId) {
            // Stage 局部变量引用检查
            return findStageVariableReferences(project, scopeOwnerId, variableId);
        }
        return [];
    }, [project, variableId, isGlobal, variableScope, scopeOwnerId]);

    const referenceLocations = useMemo(() => references.map(r => r.location), [references]);



    // 当 variable 变化时同步 localValue 和 localDescription
    useEffect(() => {
        setLocalValue(variable.value);
        setLocalDescription(variable.description || '');
    }, [variable.value, variable.description]);

    // ========== 删除逻辑（与 LocalVariableEditor 同步） ==========

    /**
     * 执行删除操作
     * - soft-delete: Implemented -> MarkedForDelete
     * - hard-delete: MarkedForDelete -> 物理删除
     * - delete: Draft -> 物理删除
     */
    // ========== 删除逻辑 (使用 unified hook) ==========
    const { deleteGlobalVariable, restoreResource } = useDeleteHandler();

    /**
     * 删除按钮点击处理
     */
    const handleDelete = () => {
        if (!isGlobal || readOnly) return;
        deleteGlobalVariable(variableId);
    };

    /**
     * 恢复按钮点击处理
     * 将 MarkedForDelete 状态恢复为 Implemented
     */
    const handleRestore = () => {
        if (!isGlobal || variable.state !== 'MarkedForDelete') return;
        restoreResource('GLOBAL_VARIABLE', variableId, variable.name);
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



    return (
        <>
            <div style={{ opacity: isMarkedForDelete ? 0.7 : 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Variable Header - 变量头部区域 */}
                <div className="inspector-header-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div className={`inspector-type-label ${getScopeClassName(variableScope)}`}>
                            {getScopeLabel(variableScope)}
                        </div>
                        {/* 全局变量操作按钮 */}
                        {isGlobal && !readOnly && (
                            <ResourceActionButtons
                                isMarkedForDelete={isMarkedForDelete}
                                onDelete={handleDelete}
                                onRestore={handleRestore}
                                resourceLabel="variable"
                            />
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

                    {/* Asset Name */}
                    <div className="prop-row">
                        <div className="prop-label">Asset Name</div>
                        {canEdit ? (
                            <div style={{ display: 'flex', gap: '6px', flex: 1, minWidth: 0 }}>
                                <input
                                    type="text"
                                    className="inspector-input monospace"
                                    value={localAssetName}
                                    onChange={(e) => setLocalAssetName(e.target.value)}
                                    onBlur={handleAssetNameBlur}
                                    placeholder={variable.id}
                                    style={{ flex: 1, minWidth: 0 }}
                                />
                                <AssetNameAutoFillButton
                                    sourceName={localName}
                                    onFill={(value) => {
                                        setLocalAssetName(value);
                                        handleUpdate({ assetName: value });
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="prop-value monospace" style={{ color: localAssetName ? 'var(--text-primary)' : '#666' }}>
                                {localAssetName || variable.id}
                            </div>
                        )}
                    </div>

                    {/* Asset Name Warning */}
                    {isGlobal && !variable.assetName && (
                        <InspectorWarning message="Asset Name not set. Using ID as default." />
                    )}

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
                            <div className="prop-value" style={{ color: getTypeColor(variable.type) }}>
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
                        <div className="prop-value">
                            {variable.state}
                            {isMarkedForDelete && (
                                <span style={{ color: '#f66', marginLeft: '4px', fontSize: '11px' }}>
                                    (locked)
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="inspector-description-block">
                        <div className="inspector-description-label">Description</div>
                        {canEdit ? (
                            <textarea
                                className="inspector-textarea"
                                rows={3}
                                value={localDescription}
                                onChange={(e) => setLocalDescription(e.target.value)}
                                onBlur={handleDescriptionBlur}
                            />
                        ) : (
                            <div className="prop-value" style={{ fontStyle: 'italic' }}>
                                {variable.description || '—'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Scope Section for Local Variables */}
                {variableScope !== 'Global' && (
                    <div className="inspector-section">
                        <div className="inspector-section-title">Scope</div>
                        <div className="prop-row">
                            <div className="prop-label">Owner Type</div>
                            <div className="prop-value">{variableScope}</div>
                        </div>
                        <div className="prop-row">
                            <div className="prop-label">Owner</div>
                            <div className="prop-value">{scopeOwnerName || '—'}</div>
                        </div>
                    </div>
                )}

                {/* References Section - 引用追踪区域 */}
                <ReferenceListSection
                    references={references}
                    emptyMessage={variableScope === 'Stage'
                        ? 'Reference tracking for Stage local variables is not yet supported.'
                        : 'No references found in this project.'
                    }
                />
            </div>


        </>
    );
};
