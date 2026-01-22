/**
 * components/Inspector/StageInspector.tsx
 * Stage 阶段属性检查器组件
 * 从 Inspector.tsx 拆分而来，负责展示和编辑 Stage 属性
 * 
 * P4-T02 更新：
 * - Name 和 Description 可编辑
 * - Local Variables 启用编辑功能
 * - 使用 UPDATE_STAGE action 替代整树更新
 */

import React, { useState, useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { StageNode } from '../../types/stage';
import { StageId, VariableId } from '../../types/common';
import { ScriptDefinition } from '../../types/manifest';
import { PresentationGraph } from '../../types/presentation';
import { EventDefinition, VariableDefinition } from '../../types/blackboard';
import { EventListenersEditor } from './EventListenersEditor';
import { PresentationBindingEditor } from './PresentationBindingEditor';
import { ConditionEditor } from './ConditionEditor';
import { TriggerEditor } from './TriggerEditor';
import { ResourceSelect } from './ResourceSelect';
import { LocalVariableEditor } from './LocalVariableEditor';
import { collectVisibleVariables } from '../../utils/variableScope';
import { hasStageContent } from '../../utils/stageTreeUtils';
import { isValidAssetName } from '../../utils/assetNameValidation';
import { InspectorWarning } from './InspectorInfo';
import { AssetNameAutoFillButton } from './AssetNameAutoFillButton';
import { useAutoTranslateAssetName } from '../../hooks/useAutoTranslateAssetName';
import { Trash2 } from 'lucide-react';
import { useDeleteHandler } from '../../hooks/useDeleteHandler';

interface StageInspectorProps {
    stageId: string;
    readOnly?: boolean;
}

export const StageInspector: React.FC<StageInspectorProps> = ({ stageId, readOnly = false }) => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();
    const { deleteStage } = useDeleteHandler();

    // 本地编辑状态（用于失焦校验）
    const [localAssetName, setLocalAssetName] = useState('');
    const [localName, setLocalName] = useState('');


    // 预先获取脚本、事件选项，避免条件分支中的 Hook 调用问题
    const scriptDefsMap: Record<string, ScriptDefinition> = project.scripts?.scripts ?? {};
    const scriptList = Object.values(scriptDefsMap);
    const scriptOptions = scriptList.map((s) => ({ id: s.id, name: s.name, state: s.state, description: s.description }));
    const performanceScriptOptions = scriptList
        .filter((s) => s.category === 'Performance')
        .map((s) => ({ id: s.id, name: s.name, state: s.state, description: s.description }));
    const lifecycleScriptOptions = scriptList
        .filter((s) => s.category === 'Lifecycle' && (!s.lifecycleType || s.lifecycleType === 'Stage'))
        .map((s) => ({
            id: s.id,
            name: s.name,
            state: s.state,
            category: s.category,
            description: s.description
        }));
    const triggerScriptOptions = scriptList
        .filter((s) => s.category === 'Trigger')
        .map((s) => ({ id: s.id, name: s.name, state: s.state, description: s.description }));
    const graphOptions = Object.values<PresentationGraph>(project.presentationGraphs).map((g) => ({ id: g.id, name: g.name, state: 'Draft' as any, description: g.description }));
    const eventOptions = Object.values<EventDefinition>(project.blackboard.events).map((e) => ({
        id: e.id,
        name: e.name,
        state: e.state,
        description: e.description
    }));

    const stage = project.stageTree.stages[stageId];
    if (!stage) return <div className="empty-state">Stage not found</div>;

    // 计算当前可见变量
    const visibleVars = collectVisibleVariables(
        { project, ui: { selection: ui.selection, multiSelectStateIds: [] }, history: { past: [], future: [] } } as any,
        stage.id,
        null
    ).all.filter(v => v.state !== 'MarkedForDelete');

    // 判定初始阶段：无父节点或为父节点首子
    const parent = stage.parentId ? project.stageTree.stages[stage.parentId] : null;
    const isInitialStage = !parent || (parent.childrenIds && parent.childrenIds[0] === stage.id);

    // 是否可删除（非根节点）
    const canDelete = !!stage.parentId;

    // 使用 UPDATE_STAGE action 更新 Stage 属性（更高效）
    const updateStage = useCallback((partial: Partial<StageNode>) => {
        if (readOnly) return;
        dispatch({
            type: 'UPDATE_STAGE',
            payload: { stageId: stageId as StageId, data: partial }
        });
    }, [readOnly, dispatch, stageId]);

    // 同步本地状态
    React.useEffect(() => {
        setLocalAssetName(stage.assetName || '');
        setLocalName(stage.name || '');
    }, [stage.assetName, stage.name]);

    // 自动翻译 Hook
    const triggerAutoTranslate = useAutoTranslateAssetName({
        currentAssetName: stage.assetName,
        onAssetNameFill: (value) => {
            setLocalAssetName(value);
            updateStage({ assetName: value });
        }
    });

    // Name 失焦处理：更新名称并触发自动翻译
    const handleNameBlur = async () => {
        const trimmed = localName.trim();
        if (trimmed !== stage.name) {
            updateStage({ name: trimmed });
        }
        await triggerAutoTranslate(trimmed);
    };

    // AssetName 失焦校验
    const handleAssetNameBlur = () => {
        const trimmed = localAssetName.trim();
        if (!isValidAssetName(trimmed)) {
            // 校验失败，恢复原值
            setLocalAssetName(stage.assetName || '');
            return;
        }
        if (trimmed !== (stage.assetName || '')) {
            updateStage({ assetName: trimmed || undefined });
        }
    };

    // 请求删除 Stage
    const handleRequestDelete = useCallback(() => {
        if (!canDelete || readOnly) return;
        deleteStage(stageId);
    }, [canDelete, readOnly, deleteStage, stageId]);

    // Stage 局部变量操作回调
    const handleAddVariable = useCallback((variable: VariableDefinition) => {
        if (readOnly) return;
        dispatch({
            type: 'ADD_STAGE_VARIABLE',
            payload: { stageId: stageId as StageId, variable }
        });
    }, [readOnly, dispatch, stageId]);

    const handleUpdateVariable = useCallback((varId: string, data: Partial<VariableDefinition>) => {
        if (readOnly) return;
        dispatch({
            type: 'UPDATE_STAGE_VARIABLE',
            payload: { stageId: stageId as StageId, varId: varId as VariableId, data }
        });
    }, [readOnly, dispatch, stageId]);

    const handleDeleteVariable = useCallback((varId: string) => {
        if (readOnly) return;
        dispatch({
            type: 'DELETE_STAGE_VARIABLE',
            payload: { stageId: stageId as StageId, varId: varId as VariableId }
        });
    }, [readOnly, dispatch, stageId]);

    return (
        <div>
            {/* Stage Header */}
            <div className="inspector-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div className="entity-type">STAGE</div>
                    <div className="entity-name">{stage.name}</div>
                </div>
                {/* 删除按钮 */}
                {canDelete && !readOnly && (
                    <button
                        className="btn-icon btn-icon--danger"
                        onClick={handleRequestDelete}
                        disabled={ui.view === 'EDITOR' && ui.currentNodeId && project.nodes[ui.currentNodeId]?.stageId === stageId}
                        style={{
                            opacity: (ui.view === 'EDITOR' && ui.currentNodeId && project.nodes[ui.currentNodeId]?.stageId === stageId) ? 0.5 : 1,
                            cursor: (ui.view === 'EDITOR' && ui.currentNodeId && project.nodes[ui.currentNodeId]?.stageId === stageId) ? 'not-allowed' : 'pointer'
                        }}
                        title={(ui.view === 'EDITOR' && ui.currentNodeId && project.nodes[ui.currentNodeId]?.stageId === stageId)
                            ? "Cannot delete stage while editing its content"
                            : "Delete Stage"}
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            {/* Basic Info Section - 可编辑 */}
            <div className="inspector-section inspector-basic-info">
                <div className="section-title">Basic Info</div>
                <div className="prop-row">
                    <div className="prop-label">ID</div>
                    <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{stage.id}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Name</div>
                    {readOnly ? (
                        <div className="prop-value">{stage.name}</div>
                    ) : (
                        <input
                            type="text"
                            className="search-input"
                            value={localName}
                            onChange={(e) => setLocalName(e.target.value)}
                            onBlur={handleNameBlur}
                            placeholder="Stage name"
                        />
                    )}
                </div>
                <div className="prop-row">
                    <div className="prop-label">Asset Name</div>
                    {readOnly ? (
                        <div className="prop-value" style={{ fontFamily: 'monospace', color: stage.assetName ? undefined : '#999' }}>
                            {stage.assetName || stage.id}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '6px', flex: 1, minWidth: 0 }}>
                            <input
                                type="text"
                                className="search-input"
                                value={localAssetName}
                                onChange={(e) => setLocalAssetName(e.target.value)}
                                onBlur={handleAssetNameBlur}
                                placeholder={stage.id}
                                style={{ fontFamily: 'monospace', flex: 1, minWidth: 0 }}
                            />
                            <AssetNameAutoFillButton
                                sourceName={stage.name}
                                onFill={(value) => {
                                    setLocalAssetName(value);
                                    updateStage({ assetName: value });
                                }}
                            />
                        </div>
                    )}
                </div>
                {!stage.assetName && (
                    <InspectorWarning message="Asset Name not set. Using ID as default." />
                )}
                <div className="prop-row">
                    <div className="prop-label">Description</div>
                    {readOnly ? (
                        <div className="prop-value">{stage.description || 'No description'}</div>
                    ) : (
                        <textarea
                            className="search-input"
                            value={stage.description || ''}
                            onChange={(e) => updateStage({ description: e.target.value })}
                            placeholder="Stage description"
                            rows={2}
                            style={{ resize: 'vertical', minHeight: '40px' }}
                        />
                    )}
                </div>
            </div>

            {/* Unlock Trigger Section */}
            <div className="inspector-section">
                <div className="section-title">Unlock Trigger</div>
                {isInitialStage ? (
                    <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                        Initial stage unlocks automatically
                    </div>
                ) : (
                    <div className={readOnly ? 'inspector-readonly-wrapper' : ''}>
                        <TriggerEditor
                            triggers={stage.unlockTriggers || []}
                            onChange={(next) => updateStage({ unlockTriggers: next })}
                            eventOptions={eventOptions}
                            scriptOptions={triggerScriptOptions}
                            readOnly={readOnly}
                        />
                    </div>
                )}
            </div>

            {/* Unlock Condition Section */}
            <div className="inspector-section">
                <div className="section-title">Unlock Condition</div>
                {isInitialStage ? (
                    <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                        Initial stage unlocks automatically
                    </div>
                ) : (
                    <div className={readOnly ? 'inspector-section--readonly' : ''}>
                        <ConditionEditor
                            condition={stage.unlockCondition}
                            onChange={readOnly ? undefined : (next) => updateStage({ unlockCondition: next })}
                            variables={visibleVars}
                            conditionScripts={scriptList.filter((s) => s.category === 'Condition')}
                        />
                    </div>
                )}
            </div>

            {/* Lifecycle Script Section */}
            <div className="inspector-section">
                <div className="section-title">Lifecycle Script</div>
                <div className={readOnly ? 'inspector-section--readonly inspector-row' : 'inspector-row'} style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <ResourceSelect
                        options={lifecycleScriptOptions}
                        value={stage.lifecycleScriptId || ''}
                        onChange={(val) => updateStage({ lifecycleScriptId: val || undefined })}
                        placeholder="Select lifecycle script"
                        warnOnMarkedDelete
                        disabled={readOnly}
                        showDetails
                        onClear={stage.lifecycleScriptId ? () => updateStage({ lifecycleScriptId: undefined }) : undefined}
                    />
                </div>
            </div>

            {/* Presentation Section */}
            <div className="inspector-section">
                <div className="section-title">Presentation</div>
                <div className={readOnly ? 'inspector-section--readonly' : ''} style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <div style={{ marginBottom: '12px' }}>
                        <PresentationBindingEditor
                            binding={stage.onEnterPresentation}
                            onChange={(next) => updateStage({ onEnterPresentation: next })}
                            scriptDefs={scriptDefsMap}
                            scriptOptions={performanceScriptOptions}
                            graphOptions={graphOptions}
                            graphData={project.presentationGraphs}
                            variables={visibleVars}
                            title="On Enter"
                            onNavigateToGraph={(graphId) => {
                                dispatch({ type: 'NAVIGATE_TO', payload: { graphId } });
                                dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_GRAPH', id: graphId } });
                            }}
                            readOnly={readOnly}
                        />
                    </div>
                    <div>
                        <PresentationBindingEditor
                            binding={stage.onExitPresentation}
                            onChange={(next) => updateStage({ onExitPresentation: next })}
                            scriptDefs={scriptDefsMap}
                            scriptOptions={performanceScriptOptions}
                            graphOptions={graphOptions}
                            graphData={project.presentationGraphs}
                            variables={visibleVars}
                            title="On Exit"
                            onNavigateToGraph={(graphId) => {
                                dispatch({ type: 'NAVIGATE_TO', payload: { graphId } });
                                dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_GRAPH', id: graphId } });
                            }}
                            readOnly={readOnly}
                        />
                    </div>
                </div>
            </div>

            {/* Event Listeners Section */}
            <div className="inspector-section">
                <div className="section-title">Event Listeners</div>
                <div className={readOnly ? 'inspector-section--readonly' : ''} style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <EventListenersEditor
                        listeners={stage.eventListeners || []}
                        onChange={readOnly ? () => { } : (next) => updateStage({ eventListeners: next })}
                        eventOptions={eventOptions}
                        scriptOptions={scriptOptions}
                        variables={visibleVars}
                    />
                </div>
            </div>

            {/* Local Variables Section - 启用编辑功能 */}
            <div className="inspector-section" style={{ borderBottom: 'none' }}>
                <div className="section-title">Local Variables</div>
                <LocalVariableEditor
                    variables={stage.localVariables || {}}
                    ownerType="stage"
                    ownerId={stage.id}
                    readOnly={readOnly}
                    onAddVariable={handleAddVariable}
                    onUpdateVariable={handleUpdateVariable}
                    onDeleteVariable={handleDeleteVariable}
                />
            </div>


        </div>
    );
};
