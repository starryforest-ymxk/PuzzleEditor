/**
 * components/Inspector/localVariable/LocalVariableCard.tsx
 * 局部变量卡片组件
 * 
 * 职责：
 * - 显示和编辑单个局部变量的属性
 * - 支持名称、类型、默认值、描述的编辑
 * - 处理删除/恢复操作
 * 
 * UI风格：
 * - 使用统一的 CSS 类名，避免内联样式
 * - 与 StateInspector 等组件风格保持一致
 */

import React from 'react';
import { VariableDefinition } from '../../../types/blackboard';
import type { VariableType } from '../../../types/common';
import { VariableValueInput } from './VariableValueInput';
import { X, RotateCcw, Trash2 } from 'lucide-react';

// ========== Props 类型定义 ==========
interface LocalVariableCardProps {
    variable: VariableDefinition;
    canMutate: boolean;
    readOnly: boolean;
    referenceCount: number;
    error?: string;
    onUpdate: (field: keyof VariableDefinition, value: any) => void;
    onDelete: () => void;
    onRestore: () => void;
    onNumberBlur: (raw: any) => void;
}

// ========== 工具函数 ==========

/**
 * 获取变量类型对应的颜色类名
 */
const getTypeClassName = (type: string): string => {
    return `var-type--${type}`;
};

/**
 * 获取变量类型对应的颜色值（用于 select 元素动态着色）
 */
const getTypeColor = (type: string): string => {
    const colorMap: Record<string, string> = {
        'boolean': '#60a5fa',
        'integer': '#a3e635',
        'float': '#2dd4bf',
        'string': '#fbbf24'
    };
    return colorMap[type] || 'var(--text-primary)';
};

// ========== 主组件 ==========
export const LocalVariableCard: React.FC<LocalVariableCardProps> = ({
    variable,
    canMutate,
    readOnly,
    referenceCount,
    error,
    onUpdate,
    onDelete,
    onRestore,
    onNumberBlur
}) => {
    const isMarkedForDelete = variable.state === 'MarkedForDelete';

    return (
        <div className={`local-variable-card ${isMarkedForDelete ? 'local-variable-card--deleted' : ''}`}>
            {/* Header: 名称 + 操作按钮 */}
            <div className="local-variable-card__header">
                <div style={{ flex: 1, minWidth: 0 }}>
                    {canMutate && !isMarkedForDelete ? (
                        <input
                            className="local-variable-card__name-input"
                            value={variable.name}
                            onChange={(e) => onUpdate('name', e.target.value)}
                            disabled={readOnly || !canMutate || isMarkedForDelete}
                            placeholder="Variable name"
                        />
                    ) : (
                        <span className="local-variable-card__name-static">
                            {variable.name}
                        </span>
                    )}
                </div>

                {/* 操作按钮 */}
                {canMutate && (
                    <div className="local-variable-card__actions">
                        {isMarkedForDelete ? (
                            <>
                                <button
                                    onClick={onRestore}
                                    className="btn-xs-restore"
                                    title="Restore to Implemented state"
                                >
                                    <RotateCcw size={10} style={{ marginRight: '2px' }} />
                                    Restore
                                </button>
                                <button
                                    onClick={onDelete}
                                    className="btn-xs-delete"
                                    title="Permanently delete this variable"
                                >
                                    <Trash2 size={10} style={{ marginRight: '2px' }} />
                                    Delete
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={onDelete}
                                className="btn-icon btn-icon--danger"
                                title="Delete variable"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Meta: 状态 + 引用计数 */}
            <div className="local-variable-card__meta">
                <span>Status: {variable.state}</span>
                {referenceCount > 0 && (
                    <span className="local-variable-card__meta-warn">
                        {referenceCount} reference(s)
                    </span>
                )}
            </div>

            {/* Controls: 类型选择 + 值输入 */}
            <div className="local-variable-card__controls">
                <select
                    className="inspector-type-select"
                    value={variable.type}
                    onChange={(e) => onUpdate('type', e.target.value as VariableType)}
                    disabled={!canMutate || isMarkedForDelete}
                    style={{ color: getTypeColor(variable.type) }}
                >
                    <option value="boolean">boolean</option>
                    <option value="integer">integer</option>
                    <option value="float">float</option>
                    <option value="string">string</option>
                </select>

                <div className="local-variable-card__value-input">
                    <VariableValueInput
                        type={variable.type}
                        value={variable.value}
                        disabled={!canMutate || isMarkedForDelete}
                        canMutate={canMutate}
                        onChange={(val) => onUpdate('value', val)}
                        onNumberBlur={onNumberBlur}
                    />
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="local-variable-card__error">{error}</div>
            )}

            {/* Description */}
            <div className="local-variable-card__description">
                {canMutate && !isMarkedForDelete ? (
                    <textarea
                        className="local-variable-card__description-input"
                        value={variable.description || ''}
                        onChange={(e) => onUpdate('description', e.target.value)}
                        disabled={!canMutate || isMarkedForDelete}
                        placeholder="Description (optional)"
                    />
                ) : (
                    <div className="local-variable-card__description-static">
                        {variable.description || 'No description'}
                    </div>
                )}
            </div>
        </div>
    );
};
