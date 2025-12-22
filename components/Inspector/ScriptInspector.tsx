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
import type { MessageLevel } from '../../store/types';
import { Trash2, RotateCcw, ExternalLink } from 'lucide-react';
import { findScriptReferences } from '../../utils/validation/scriptReferences';
import type { ReferenceNavigationContext } from '../../utils/validation/globalVariableReferences';
import { ConfirmDialog } from './ConfirmDialog';
import { InspectorWarning } from './InspectorInfo';
import { isValidAssetName } from '../../utils/assetNameValidation';
import { AssetNameAutoFillButton } from './AssetNameAutoFillButton';

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

// ========== 确认对话框模式 ==========
type ConfirmMode = 'soft-delete' | 'hard-delete' | 'delete';

// ========== 主组件 ==========
export const ScriptInspector: React.FC<ScriptInspectorProps> = ({ scriptId, readOnly = false }) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();

    const script = project.scripts.scripts[scriptId];
    if (!script) return <div className="empty-state">Script not found</div>;

    const categoryColor = categoryColors[script.category] || '#c586c0';
    const categoryLabel = categoryLabels[script.category] || script.category.toUpperCase();
    const isMarkedForDelete = script.state === 'MarkedForDelete';

    // ========== 确认对话框状态 ==========
    const [confirmDialog, setConfirmDialog] = useState<{
        title: string;
        message: string;
        refs: string[];
        mode: ConfirmMode;
    } | null>(null);

    // ========== 本地编辑状态（用于失焦校验） ==========
    const [localName, setLocalName] = useState(script.name);
    const [localAssetName, setLocalAssetName] = useState(script.assetName || '');
    const [localDescription, setLocalDescription] = useState(script.description || '');

    // ========== 引用计算 ==========
    const references = useMemo(() => {
        return findScriptReferences(project, scriptId);
    }, [project, scriptId]);

    const referenceLocations = useMemo(() => references.map(r => r.location), [references]);

    // ========== 消息推送 ==========
    const pushMessage = (level: MessageLevel, text: string) => {
        dispatch({
            type: 'ADD_MESSAGE',
            payload: { id: `msg-${Date.now()}`, level, text, timestamp: new Date().toISOString() }
        });
    };

    // ========== 更新脚本属性 ==========
    const handleUpdate = useCallback((updates: Partial<ScriptDefinition>) => {
        if (!readOnly && !isMarkedForDelete) {
            dispatch({ type: 'UPDATE_SCRIPT', payload: { id: scriptId, data: updates } });
        }
    }, [readOnly, isMarkedForDelete, dispatch, scriptId]);

    // ========== 同步本地状态 ==========
    React.useEffect(() => {
        setLocalName(script.name);
        setLocalAssetName(script.assetName || '');
        setLocalDescription(script.description || '');
    }, [script.name, script.assetName, script.description]);

    // ========== 失焦校验处理函数 ==========
    const handleNameBlur = () => {
        const trimmed = localName.trim();
        if (!trimmed) {
            setLocalName(script.name);
        } else if (trimmed !== script.name) {
            handleUpdate({ name: trimmed });
        }
    };

    const handleAssetNameBlur = () => {
        const trimmed = localAssetName.trim();
        if (!isValidAssetName(trimmed)) {
            setLocalAssetName(script.assetName || '');
        } else if (trimmed !== (script.assetName || '')) {
            handleUpdate({ assetName: trimmed || undefined });
        }
    };

    const handleDescriptionBlur = () => {
        if (localDescription !== (script.description || '')) {
            handleUpdate({ description: localDescription });
        }
    };

    // ========== 删除逻辑（与 VariableInspector 一致） ==========

    /**
     * 执行删除操作
     * - soft-delete: Implemented -> MarkedForDelete
     * - hard-delete: MarkedForDelete -> 物理删除
     * - delete: Draft -> 物理删除
     */
    const applyDeleteAction = (mode: ConfirmMode) => {
        if (mode === 'hard-delete' || script.state === 'MarkedForDelete') {
            // 硬删除：直接物理删除
            dispatch({ type: 'APPLY_DELETE_SCRIPT', payload: { id: scriptId } });
            pushMessage(
                references.length > 0 ? 'warning' : 'info',
                `Permanently deleted script "${script.name}".`
            );
        } else if (mode === 'soft-delete' && script.state === 'Implemented') {
            // 软删除：标记为 MarkedForDelete
            dispatch({ type: 'SOFT_DELETE_SCRIPT', payload: { id: scriptId } });
            pushMessage('warning', `Marked script "${script.name}" for delete. Editing is now locked.`);
        } else {
            // Draft 状态直接删除
            dispatch({ type: 'APPLY_DELETE_SCRIPT', payload: { id: scriptId } });
            pushMessage(
                references.length > 0 ? 'warning' : 'info',
                `Deleted script "${script.name}".`
            );
        }

        setConfirmDialog(null);
    };

    /**
     * 删除按钮点击处理
     * 根据脚本状态和引用情况决定是否弹窗确认
     */
    const handleDelete = () => {
        if (readOnly) return;
        const hasRefs = references.length > 0;
        const preview = referenceLocations.slice(0, 5);

        // MarkedForDelete 状态：弹窗确认后硬删除
        if (script.state === 'MarkedForDelete') {
            setConfirmDialog({
                title: 'Apply Delete (Irreversible)',
                message: 'This script is already marked for delete. Applying delete will permanently remove it. This action cannot be undone.',
                refs: preview,
                mode: 'hard-delete'
            });
            return;
        }

        // 有引用：弹窗确认
        if (hasRefs) {
            const isImplemented = script.state === 'Implemented';
            setConfirmDialog({
                title: isImplemented ? 'Mark For Delete' : 'Confirm Delete',
                message: `Script "${script.name}" is referenced ${references.length} time(s). ${isImplemented ? 'It will be marked as "MarkedForDelete" and locked.' : 'Deleting it will require fixing those references manually.'}`,
                refs: preview,
                mode: isImplemented ? 'soft-delete' : 'delete'
            });
            return;
        }

        // 无引用 + Implemented：直接软删除（不弹窗）
        if (script.state === 'Implemented') {
            applyDeleteAction('soft-delete');
            return;
        }

        // 无引用 + Draft：直接删除（不弹窗）
        applyDeleteAction('delete');
    };

    /**
     * 恢复按钮点击处理
     * 将 MarkedForDelete 状态恢复为 Implemented
     */
    const handleRestore = () => {
        if (readOnly || script.state !== 'MarkedForDelete') return;
        dispatch({ type: 'UPDATE_SCRIPT', payload: { id: scriptId, data: { state: 'Implemented' } } });
        pushMessage('info', `Restored script "${script.name}" to Implemented state.`);
    };

    /**
     * 确认对话框确认按钮处理
     */
    const handleConfirmDelete = () => {
        if (!confirmDialog) return;
        applyDeleteAction(confirmDialog.mode);
    };

    // 确认按钮文案
    const confirmButtonLabel = confirmDialog?.mode === 'hard-delete'
        ? 'Apply Delete'
        : confirmDialog?.mode === 'soft-delete'
            ? 'Mark for Delete'
            : 'Delete';

    // 获取删除按钮提示文案
    const getDeleteTooltip = (): string => {
        if (script.state === 'Draft') return 'Delete';
        if (script.state === 'Implemented') return 'Mark for Delete';
        return 'Apply Delete';
    };

    // 是否可编辑（MarkedForDelete 状态下不可编辑）
    const canEdit = !readOnly && !isMarkedForDelete;

    // ========== 点击引用项导航 ==========
    const handleReferenceClick = useCallback((navContext?: ReferenceNavigationContext) => {
        if (!navContext) return;

        const { targetType, stageId, nodeId, stateId, transitionId, graphId, presentationNodeId } = navContext;

        switch (targetType) {
            case 'STAGE':
                // 导航到 Stage 并选中
                if (stageId) {
                    dispatch({ type: 'NAVIGATE_TO', payload: { stageId, nodeId: null, graphId: null } });
                    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: stageId } });
                }
                break;

            case 'NODE':
                if (nodeId) {
                    const node = project.nodes[nodeId];
                    if (node) {
                        dispatch({ type: 'NAVIGATE_TO', payload: { stageId: node.stageId, nodeId, graphId: null } });
                        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: nodeId, contextId: nodeId } });
                    }
                }
                break;

            case 'STATE':
                if (nodeId && stateId) {
                    const node = project.nodes[nodeId];
                    if (node) {
                        dispatch({ type: 'NAVIGATE_TO', payload: { stageId: node.stageId, nodeId, graphId: null } });
                        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STATE', id: stateId, contextId: nodeId } });
                    }
                }
                break;

            case 'TRANSITION':
                if (nodeId && transitionId) {
                    const node = project.nodes[nodeId];
                    if (node) {
                        dispatch({ type: 'NAVIGATE_TO', payload: { stageId: node.stageId, nodeId, graphId: null } });
                        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'TRANSITION', id: transitionId, contextId: nodeId } });
                    }
                }
                break;

            case 'PRESENTATION_GRAPH':
                if (graphId) {
                    dispatch({ type: 'NAVIGATE_TO', payload: { graphId } });
                    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_GRAPH', id: graphId } });
                }
                break;

            case 'PRESENTATION_NODE':
                if (graphId && presentationNodeId) {
                    dispatch({ type: 'NAVIGATE_TO', payload: { graphId } });
                    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_NODE', id: presentationNodeId, contextId: graphId } });
                }
                break;
        }
    }, [project.nodes, dispatch]);

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
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                {isMarkedForDelete ? (
                                    <>
                                        {/* MarkedForDelete 状态：显示 Restore 和 Delete 按钮 */}
                                        <button
                                            className="btn-xs-restore"
                                            onClick={handleRestore}
                                            title="Restore to Implemented state"
                                        >
                                            <RotateCcw size={10} style={{ marginRight: '2px' }} />
                                            Restore
                                        </button>
                                        <button
                                            className="btn-xs-delete"
                                            onClick={handleDelete}
                                            title="Permanently delete this script"
                                        >
                                            <Trash2 size={10} style={{ marginRight: '2px' }} />
                                            Delete
                                        </button>
                                    </>
                                ) : (
                                    // 非 MarkedForDelete 状态：显示删除按钮
                                    <button
                                        className="btn-icon btn-icon--danger"
                                        onClick={handleDelete}
                                        title={
                                            script.state === 'Draft'
                                                ? references.length > 0 ? "Delete (References exist)" : "Delete Draft"
                                                : "Delete (Mark for Deletion)"
                                        }
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
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
                <div className="inspector-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div className="inspector-section-title">
                        References ({references.length})
                    </div>
                    {references.length > 0 ? (
                        <div style={{
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            flex: 1,
                            overflowY: 'auto'
                        }}>
                            {references.map((ref, idx) => (
                                <div
                                    key={idx}
                                    className={ref.navContext ? 'inspector-reference-item inspector-reference-item--clickable' : 'inspector-reference-item'}
                                    style={{
                                        padding: '4px 0',
                                        borderBottom: idx < references.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                                        cursor: ref.navContext ? 'pointer' : 'default',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                    onClick={() => handleReferenceClick(ref.navContext)}
                                    title={ref.navContext ? 'Click to navigate to this reference' : undefined}
                                >
                                    <span style={{ flex: 1 }}>{ref.location}</span>
                                    {ref.navContext && (
                                        <ExternalLink size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="inspector-reference-placeholder">
                            <div className="inspector-reference-placeholder__desc">
                                No references found in this project.
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirm Dialog - 确认对话框 (放在 opacity 容器外，避免透明度问题) */}
            {confirmDialog && (
                <ConfirmDialog
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    confirmText={confirmButtonLabel}
                    references={confirmDialog.refs}
                    totalReferences={references.length}
                    onCancel={() => setConfirmDialog(null)}
                    onConfirm={handleConfirmDelete}
                />
            )}
        </>
    );
};