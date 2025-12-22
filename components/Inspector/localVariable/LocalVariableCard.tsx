/**
 * components/Inspector/localVariable/LocalVariableCard.tsx
 * 局部变量卡片组件
 * 
 * 职责：
 * - 显示和编辑单个局部变量的属性
 * - 支持名称、类型、默认值、描述的编辑
 * - 处理删除/恢复操作
 * - 支持展开/收起引用详情
 * - 支持点击引用跳转到对应编辑器位置
 * 
 * UI风格：
 * - 使用统一的 CSS 类名，避免内联样式
 * - 与 StateInspector 等组件风格保持一致
 */

import React, { useState, useEffect } from 'react';
import { VariableDefinition } from '../../../types/blackboard';
import type { VariableType } from '../../../types/common';
import { VariableValueInput } from './VariableValueInput';
import { X, RotateCcw, Trash2, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import type { VariableReferenceInfo, ReferenceNavigationContext } from '../../../utils/validation/globalVariableReferences';
import { isValidAssetName } from '../../../utils/assetNameValidation';
import { AssetNameAutoFillButton } from '../AssetNameAutoFillButton';
import { InspectorWarning } from '../InspectorInfo';

// ========== Props 类型定义 ==========
interface LocalVariableCardProps {
    variable: VariableDefinition;
    canMutate: boolean;
    readOnly: boolean;
    referenceCount: number;
    /** 引用位置列表，用于展开详情 - 现在支持完整的引用信息 */
    references?: VariableReferenceInfo[];
    error?: string;
    onUpdate: (field: keyof VariableDefinition, value: any) => void;
    onDelete: () => void;
    onRestore: () => void;
    onNumberBlur: (raw: any) => void;
    /** 双击回调 */
    onDoubleClick?: () => void;
    /** 点击引用跳转的回调 */
    onReferenceClick?: (navContext: ReferenceNavigationContext) => void;
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
    references = [],
    error,
    onUpdate,
    onDelete,
    onRestore,
    onNumberBlur,
    onDoubleClick,
    onReferenceClick
}) => {
    const isMarkedForDelete = variable.state === 'MarkedForDelete';
    // 引用详情展开/收起状态
    const [showReferences, setShowReferences] = useState(false);

    // ========== 本地编辑状态（用于失焦校验） ==========
    const [localName, setLocalName] = useState(variable.name);
    const [localAssetName, setLocalAssetName] = useState(variable.assetName || '');

    // 同步外部状态变化
    useEffect(() => {
        setLocalName(variable.name);
        setLocalAssetName(variable.assetName || '');
    }, [variable.name, variable.assetName]);

    // 名称失焦校验
    const handleNameBlur = () => {
        const trimmed = localName.trim();
        if (!trimmed) {
            setLocalName(variable.name);
        } else if (trimmed !== variable.name) {
            onUpdate('name', trimmed);
        }
    };

    // 资产名失焦校验
    const handleAssetNameBlur = () => {
        const trimmed = localAssetName.trim();
        if (!isValidAssetName(trimmed)) {
            setLocalAssetName(variable.assetName || '');
        } else if (trimmed !== (variable.assetName || '')) {
            onUpdate('assetName', trimmed || undefined);
        }
    };

    return (
        <div
            className={`local-variable-card ${isMarkedForDelete ? 'local-variable-card--deleted' : ''}`}
            onDoubleClick={onDoubleClick}
        >
            {/* Header: 名称 + 操作按钮 */}
            <div className="local-variable-card__header">
                <div style={{ flex: 1, minWidth: 0 }}>
                    {canMutate && !isMarkedForDelete ? (
                        <input
                            className="local-variable-card__name-input"
                            value={localName}
                            onChange={(e) => setLocalName(e.target.value)}
                            onBlur={handleNameBlur}
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



            {/* Meta: 状态 + 引用计数（可点击展开） */}
            <div className="local-variable-card__meta">
                <span>Status: {variable.state}</span>
                {referenceCount > 0 && (
                    <button
                        className="local-variable-card__ref-toggle"
                        onClick={() => setShowReferences(!showReferences)}
                        title={showReferences ? 'Hide references' : 'Show references'}
                    >
                        {showReferences ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span>{referenceCount} reference(s)</span>
                    </button>
                )}
            </div>

            {/* 引用详情展开区域 */}
            {showReferences && referenceCount > 0 && (
                <div className="local-variable-card__references">
                    <div className="local-variable-card__references-title">Referenced in:</div>
                    <div className="local-variable-card__references-list">
                        {references.length > 0 ? (
                            references.map((ref, idx) => (
                                <div
                                    key={idx}
                                    className={`local-variable-card__references-item ${ref.navContext ? 'local-variable-card__references-item--clickable' : ''}`}
                                    onClick={() => ref.navContext && onReferenceClick?.(ref.navContext)}
                                    title={ref.navContext ? 'Click to navigate to this reference' : undefined}
                                >
                                    <span>{ref.location}</span>
                                    {ref.navContext && (
                                        <ExternalLink size={10} style={{ opacity: 0.6, marginLeft: '4px', flexShrink: 0 }} />
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="local-variable-card__references-item">
                                {referenceCount} reference(s) found
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Controls Area: Asset Name & Value Editing 
                Layout: 
                [ Asset Name Label ] [ Asset Name Input ]
                [ Type Select      ] [ Value Input      ]
            */}
            <div className="local-variable-card__controls-area">

                {/* Row 1: Asset Name */}
                <div className="local-variable-card__control-row">
                    {/* Label aligned with Select */}
                    <div className="local-variable-card__label">
                        Asset Name
                    </div>
                    {/* Input aligned with Value Input */}
                    <div className="local-variable-card__input-wrapper">
                        {canMutate && !isMarkedForDelete ? (
                            <input
                                type="text"
                                className="local-variable-card__asset-input"
                                value={localAssetName}
                                onChange={(e) => setLocalAssetName(e.target.value)}
                                onBlur={handleAssetNameBlur}
                                placeholder={variable.id}
                            />
                        ) : (
                            <span
                                className="local-variable-card__asset-input"
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: localAssetName ? 'var(--text-primary)' : '#666',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0'
                                }}
                            >
                                {localAssetName || variable.id}
                            </span>
                        )}
                    </div>
                    {/* 自动填充按钮 - 放在 input-wrapper 外部，保持对齐 */}
                    {canMutate && !isMarkedForDelete && (
                        <AssetNameAutoFillButton
                            sourceName={localName}
                            onFill={(value) => {
                                setLocalAssetName(value);
                                onUpdate('assetName', value);
                            }}
                        />
                    )}
                </div>

                {/* Warning Row (Full Width) */}
                {!variable.assetName && (
                    <div className="local-variable-card__warning-row">
                        <InspectorWarning
                            message="Asset Name not set. Using ID as default."
                            style={{
                                margin: 0,
                                padding: '6px 8px',
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                borderRadius: '3px'
                            }}
                        />
                    </div>
                )}

                {/* Row 2: Type & Value */}
                <div className="local-variable-card__control-row">
                    <select
                        className="inspector-type-select"
                        value={variable.type}
                        onChange={(e) => onUpdate('type', e.target.value as VariableType)}
                        disabled={!canMutate || isMarkedForDelete}
                        style={{
                            width: '85px',
                            flexShrink: 0,
                            color: getTypeColor(variable.type),
                            minWidth: 0 // Override global min-width
                        }}
                    >
                        <option value="boolean">boolean</option>
                        <option value="integer">integer</option>
                        <option value="float">float</option>
                        <option value="string">string</option>
                    </select>

                    <div className="local-variable-card__input-wrapper">
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
