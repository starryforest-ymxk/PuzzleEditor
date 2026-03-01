/**
 * components/Inspector/ScriptInspector.tsx
 * 脚本属性检查器组件
 * 
 * 职责：
 * - 展示和编辑脚本的基本属性（名称、key、类别、描述）
 * - 支持删除操作（与变量删除逻辑一致）
 * - 显示脚本引用位置并支持导航
 * 
 * UI风格：
 * - 与 VariableInspector 保持一致的 Inspector 布局
 * - 使用统一的 CSS 类名和样式
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import type { ScriptDefinition } from '../../types/manifest';
import type { ScriptCategory } from '../../types/common';
import { findScriptReferences } from '../../utils/validation/scriptReferences';
import { ReferenceListSection } from './ReferenceListSection';
import { ResourceActionButtons } from './ResourceActionButtons';

import { InspectorWarning } from './InspectorInfo';
import { AssetNameAutoFillButton } from './AssetNameAutoFillButton';
import { useDeleteHandler } from '../../hooks/useDeleteHandler';
import { useInspectorNameFields } from '../../hooks/useInspectorNameFields';

// ========== Props 类型定义 ==========
interface ScriptInspectorProps {
    scriptId: string;
    readOnly?: boolean;
}

// ========== 常量定义 ==========

// 脚本类别颜色映射
const categoryColors: Record<ScriptCategory, string> = {
    Performance: '#c586c0',
    Lifecycle: '#4fc1ff',
    Condition: '#dcdcaa',
    Trigger: '#ce9178'
};

// 脚本类别标签映射
const categoryLabels: Record<ScriptCategory, string> = {
    Performance: 'PERFORMANCE SCRIPT',
    Lifecycle: 'LIFECYCLE SCRIPT',
    Condition: 'CONDITION SCRIPT',
    Trigger: 'TRIGGER SCRIPT'
};

// ========== 主组件 ==========
export const ScriptInspector: React.FC<ScriptInspectorProps> = ({ scriptId, readOnly = false }) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();

    const script = project.scripts.scripts[scriptId];

    const categoryColor = script ? categoryColors[script.category] || '#c586c0' : '#c586c0';
    const categoryLabel = script ? categoryLabels[script.category] || script.category.toUpperCase() : '';
    const isMarkedForDelete = script?.state === 'MarkedForDelete';

    // ========== 更新脚本属性 ==========
    const handleUpdate = useCallback((updates: Partial<ScriptDefinition>) => {
        if (!readOnly && !isMarkedForDelete) {
            dispatch({ type: 'UPDATE_SCRIPT', payload: { id: scriptId, data: updates } });
        }
    }, [readOnly, isMarkedForDelete, dispatch, scriptId]);

    // ========== 本地编辑状态（用于失焦校验） ==========
    const [localDescription, setLocalDescription] = useState(script?.description || '');

    // 统一名称编辑 Hook（不允许空名称）
    const {
        localName, setLocalName,
        localAssetName, setLocalAssetName,
        handleNameBlur, handleAssetNameBlur, triggerAutoTranslate
    } = useInspectorNameFields({
        entity: script || null,
        onUpdate: handleUpdate,
        allowEmptyName: false,
    });

    // ========== 删除逻辑 (使用 unified hook，必须在条件 return 之前) ==========
    const { deleteScript, restoreResource } = useDeleteHandler();

    // ========== 引用计算 ==========
    const references = useMemo(() => {
        return findScriptReferences(project, scriptId);
    }, [project, scriptId]);

    const referenceLocations = useMemo(() => references.map(r => r.location), [references]);

    // ========== 同步 description 本地状态 ==========
    React.useEffect(() => {
        setLocalDescription(script?.description || '');
    }, [script?.description]);

    const handleDescriptionBlur = () => {
        if (localDescription !== (script?.description || '')) {
            handleUpdate({ description: localDescription });
        }
    };

    if (!script) return <div className="empty-state">Script not found</div>;

    // ========== 删除逻辑（与 VariableInspector 一致） ==========

    /**
     * 删除按钮点击处理
     */
    const handleDelete = () => {
        if (readOnly) return;
        deleteScript(scriptId);
    };

    /**
     * 恢复按钮点击处理
     * 将 MarkedForDelete 状态恢复为 Implemented
     */
    const handleRestore = () => {
        if (readOnly || script.state !== 'MarkedForDelete') return;
        restoreResource('SCRIPT', scriptId, script.name);
    };

    // 是否可编辑（MarkedForDelete 状态下不可编辑）
    const canEdit = !readOnly && !isMarkedForDelete;



    return (
        <>
            <div style={{ opacity: isMarkedForDelete ? 0.7 : 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Script Header - 脚本头部区域 */}
                <div className="inspector-header-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div className="inspector-type-label" style={{ color: categoryColor }}>
                            {categoryLabel}
                        </div>
                        {/* 操作按钮 */}
                        {!readOnly && (
                            <ResourceActionButtons
                                isMarkedForDelete={isMarkedForDelete}
                                onDelete={handleDelete}
                                onRestore={handleRestore}
                                resourceLabel="script"
                            />
                        )}
                    </div>
                    {!readOnly ? (
                        <input
                            type="text"
                            className="inspector-name-input"
                            value={localName}
                            onChange={(e) => setLocalName(e.target.value)}
                            onBlur={handleNameBlur}
                            disabled={isMarkedForDelete}
                        />
                    ) : (
                        <div className="inspector-name-input" style={{ background: 'transparent', border: 'none' }}>
                            {script.name}
                        </div>
                    )}
                </div>

                {/* Basic Info Section - 基本信息区块 */}
                <div className="inspector-section inspector-basic-info">
                    <div className="inspector-section-title">Basic Info</div>

                    {/* ID（只读） */}
                    <div className="prop-row">
                        <div className="prop-label">ID</div>
                        <div className="prop-value monospace" style={{ color: '#666' }}>{script.id}</div>
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
                                    placeholder={script.id}
                                    style={{ flex: 1, minWidth: 0 }}
                                />
                                <AssetNameAutoFillButton
                                    sourceName={script.name}
                                    onFill={(value) => {
                                        setLocalAssetName(value);
                                        handleUpdate({ assetName: value });
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="prop-value monospace" style={{ color: localAssetName ? 'var(--text-primary)' : '#666' }}>
                                {localAssetName || script.id}
                            </div>
                        )}
                    </div>

                    {/* Asset Name Warning */}
                    {!script.assetName && (
                        <InspectorWarning message="Asset Name not set. Using ID as default." />
                    )}

                    {/* Category（只读，创建后不可改） */}
                    <div className="prop-row">
                        <div className="prop-label">Category</div>
                        <div className="prop-value" style={{ color: categoryColor }}>
                            {script.category}
                        </div>
                    </div>

                    {/* Lifecycle Type（仅 Lifecycle 类型显示） */}
                    {script.lifecycleType && (
                        <div className="prop-row">
                            <div className="prop-label">Lifecycle</div>
                            <div className="prop-value" style={{ color: '#dcdcaa' }}>
                                {script.lifecycleType}
                            </div>
                        </div>
                    )}

                    {/* State */}
                    <div className="prop-row">
                        <div className="prop-label">State</div>
                        <div className="prop-value">
                            {script.state}
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
                        {!readOnly ? (
                            <textarea
                                className="inspector-textarea"
                                value={localDescription}
                                onChange={(e) => setLocalDescription(e.target.value)}
                                onBlur={handleDescriptionBlur}
                                placeholder="No description."
                                disabled={isMarkedForDelete}
                            />
                        ) : (
                            <div className="prop-value" style={{ fontStyle: 'italic' }}>
                                {script.description || '—'}
                            </div>
                        )}
                    </div>
                </div>

                {/* References Section - 引用追踪区块 */}
                <ReferenceListSection references={references} />
            </div>


        </>
    );
};