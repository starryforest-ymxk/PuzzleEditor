/**
 * components/Inspector/EventInspector.tsx
 * 事件属性检查器组件
 * 
 * 职责：
 * - 展示和编辑事件的基本属性（名称、key、描述）
 * - 支持删除操作（与变量/脚本删除逻辑一致）
 * - 显示事件引用位置并支持导航
 * 
 * UI风格：
 * - 与 VariableInspector/ScriptInspector 保持一致的 Inspector 布局
 * - 使用统一的 CSS 类名和样式
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import type { EventDefinition } from '../../types/blackboard';
import { findEventReferences } from '../../utils/validation/eventReferences';
import { ReferenceListSection } from './ReferenceListSection';
import { ResourceActionButtons } from './ResourceActionButtons';
import { useDeleteHandler } from '../../hooks/useDeleteHandler';
import { InspectorWarning } from './InspectorInfo';
import { AssetNameAutoFillButton } from './AssetNameAutoFillButton';
import { useInspectorNameFields } from '../../hooks/useInspectorNameFields';

// ========== Props 类型定义 ==========
interface EventInspectorProps {
    eventId: string;
    readOnly?: boolean;
}

// ========== 主组件 ==========
export const EventInspector: React.FC<EventInspectorProps> = ({ eventId, readOnly = false }) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();

    const event = project.blackboard.events[eventId];

    const isMarkedForDelete = event?.state === 'MarkedForDelete';

    // 统一删除逻辑 Hook
    const { deleteEvent, restoreResource } = useDeleteHandler();

    // ========== 更新事件属性 ==========
    const handleUpdate = useCallback((updates: Partial<EventDefinition>) => {
        if (!readOnly && !isMarkedForDelete) {
            dispatch({ type: 'UPDATE_EVENT', payload: { id: eventId, data: updates } });
        }
    }, [readOnly, isMarkedForDelete, dispatch, eventId]);

    // ========== 本地编辑状态 ==========
    const [localDescription, setLocalDescription] = useState(event?.description || '');

    // 统一名称编辑 Hook（不允许空名称）
    const {
        localName, setLocalName,
        localAssetName, setLocalAssetName,
        handleNameBlur, handleAssetNameBlur, triggerAutoTranslate
    } = useInspectorNameFields({
        entity: event || null,
        onUpdate: handleUpdate,
        allowEmptyName: false,
    });

    // ========== 同步 description 本地状态 ==========
    React.useEffect(() => {
        setLocalDescription(event?.description || '');
    }, [event?.description]);

    const handleDescriptionBlur = () => {
        if (localDescription !== (event?.description || '')) {
            handleUpdate({ description: localDescription });
        }
    };

    // ========== 引用计算 ==========
    const references = useMemo(() => {
        return findEventReferences(project, eventId);
    }, [project, eventId]);

    if (!event) return <div className="empty-state">Event not found</div>;

    // ========== 删除逻辑（委托给 useDeleteHandler 统一处理） ==========

    /**
     * 删除按钮点击处理
     * 委托给 useDeleteHandler.deleteEvent，统一处理状态检查、引用检查和确认弹窗
     */
    const handleDelete = () => {
        if (readOnly) return;
        deleteEvent(eventId);
    };

    /**
     * 恢复按钮点击处理
     * 将 MarkedForDelete 状态恢复为 Implemented
     */
    const handleRestore = () => {
        if (readOnly || event.state !== 'MarkedForDelete') return;
        restoreResource('EVENT', eventId, event.name);
    };

    // 获取删除按钮提示文案
    const getDeleteTooltip = (): string => {
        if (event.state === 'Draft') return 'Delete';
        if (event.state === 'Implemented') return 'Mark for Delete';
        return 'Apply Delete';
    };

    // 是否可编辑（MarkedForDelete 状态下不可编辑）
    const canEdit = !readOnly && !isMarkedForDelete;



    return (
        <>
            <div style={{ opacity: isMarkedForDelete ? 0.7 : 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Event Header - 事件头部区域 */}
                <div className="inspector-header-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div className="inspector-type-label" style={{ color: '#dcdcaa' }}>EVENT</div>
                        {/* 操作按钮 */}
                        {!readOnly && (
                            <ResourceActionButtons
                                isMarkedForDelete={isMarkedForDelete}
                                onDelete={handleDelete}
                                onRestore={handleRestore}
                                resourceLabel="event"
                                deleteTooltip={getDeleteTooltip()}
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
                            {event.name}
                        </div>
                    )}
                </div>

                {/* Basic Info Section - 基本信息区块 */}
                <div className="inspector-section inspector-basic-info">
                    <div className="inspector-section-title">Basic Info</div>

                    {/* ID（只读） */}
                    <div className="prop-row">
                        <div className="prop-label">ID</div>
                        <div className="prop-value monospace" style={{ color: '#666' }}>{event.id}</div>
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
                                    placeholder={event.id}
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
                                {localAssetName || event.id}
                            </div>
                        )}
                    </div>

                    {/* Asset Name Warning */}
                    {!event.assetName && (
                        <InspectorWarning message="Asset Name not set. Using ID as default." />
                    )}

                    {/* State */}
                    <div className="prop-row">
                        <div className="prop-label">State</div>
                        <div className="prop-value">
                            {event.state}
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
                                value={localDescription}
                                onChange={(e) => setLocalDescription(e.target.value)}
                                onBlur={handleDescriptionBlur}
                                placeholder="No description."
                            />
                        ) : (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5, fontStyle: 'italic' }}>
                                {event.description || 'No description.'}
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