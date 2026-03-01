import React, { useMemo, useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { EventListener } from '../../types/common';
import { EventListenersEditor } from './EventListenersEditor';
import { ResourceSelect } from './ResourceSelect';
import { buildEventOptions, buildScriptOptions, buildScriptOptionsByCategory } from '../../utils/resourceOptions';
import { InspectorWarning } from './InspectorInfo';
import { AssetNameAutoFillButton } from './AssetNameAutoFillButton';
import { Trash2 } from 'lucide-react';
import { useInspectorNameFields } from '../../hooks/useInspectorNameFields';
import { useFsmVisibleVariables } from '../../hooks/useFsmVisibleVariables';

interface Props {
    fsmId: string;
    stateId: string;
    readOnly?: boolean;
}

/**
 * StateInspector - 状态节点属性检查器
 * 显示和编辑 FSM State 的属性：名称、描述、初始状态、生命周期脚本、事件监听器
 */
export const StateInspector = ({ fsmId, stateId, readOnly = false }: Props) => {
    const stateTree = useEditorState();
    const { project } = stateTree;
    const dispatch = useEditorDispatch();

    const fsm = project.stateMachines[fsmId];
    const state = fsm ? fsm.states[stateId] : null;

    // 更新状态属性
    const handleChange = useCallback((field: string, value: any) => {
        dispatch({
            type: 'UPDATE_STATE',
            payload: {
                fsmId,
                stateId,
                data: { [field]: value }
            }
        });
    }, [dispatch, fsmId, stateId]);

    // 统一名称编辑 Hook（允许空名称）
    const {
        localName, setLocalName,
        localAssetName, setLocalAssetName,
        handleNameBlur, handleAssetNameBlur, triggerAutoTranslate
    } = useInspectorNameFields({
        entity: state,
        onUpdate: (updates) => {
            Object.entries(updates).forEach(([key, val]) => handleChange(key, val));
        },
        allowEmptyName: true,
    });

    // 查找所属节点并收集可见变量（Hook 必须在条件返回前调用）
    const { visibleVars } = useFsmVisibleVariables(fsmId);



    const isInitial = fsm?.initialStateId === state?.id;

    // 事件和脚本选项
    const eventOptions = useMemo(() => buildEventOptions(project.blackboard.events), [project.blackboard.events]);

    const scriptRecords = project.scripts.scripts;
    const scriptOptions = useMemo(() => buildScriptOptions(scriptRecords), [scriptRecords]);

    const lifecycleScriptOptions = useMemo(() => buildScriptOptionsByCategory(scriptRecords, 'Lifecycle', 'State'), [scriptRecords]);

    // 所有 hooks 执行完毕后才能条件 return（React hooks 规则）
    if (!state || !fsm) return <div className="empty-state">State not found</div>;

    // 设置为初始状态
    const handleSetInitial = () => {
        dispatch({
            type: 'UPDATE_FSM',
            payload: {
                fsmId,
                data: { initialStateId: state.id }
            }
        });
    };

    // 删除状态
    const handleDelete = () => {
        if (readOnly) return;
        dispatch({
            type: 'DELETE_STATE',
            payload: { fsmId, stateId: state.id }
        });
    };

    return (
        <div>
            {/* State Header */}
            <div className="inspector-header-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div className="inspector-type-label inspector-type-label--state">FSM STATE</div>
                    {!readOnly && (
                        <button
                            className="btn-icon btn-icon--danger"
                            onClick={handleDelete}
                            title="Delete this state"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
                <input
                    type="text"
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                    onBlur={handleNameBlur}
                    disabled={readOnly}
                    className="inspector-name-input inspector-name-input--with-margin"
                />

                {isInitial ? (
                    <div className="inspector-initial-badge">
                        <span className="icon">▶</span> Initial State
                    </div>
                ) : (
                    !readOnly && (
                        <button onClick={handleSetInitial} className="inspector-set-initial-btn">
                            Set as Initial State
                        </button>
                    )
                )}
            </div>

            {/* Basic Info Section */}
            <div className="inspector-section inspector-basic-info">
                <div className="inspector-section-title">Basic Info</div>
                <div className="prop-row">
                    <div className="prop-label">ID</div>
                    <div className="prop-value inspector-value-monospace">{state.id}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Asset Name</div>
                    {readOnly ? (
                        <div className="prop-value" style={{ fontFamily: 'monospace', color: state.assetName ? undefined : '#999' }}>
                            {state.assetName || state.id}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '6px', flex: 1, minWidth: 0 }}>
                            <input
                                type="text"
                                className="inspector-input monospace"
                                value={localAssetName}
                                onChange={(e) => setLocalAssetName(e.target.value)}
                                onBlur={handleAssetNameBlur}
                                placeholder={state.id}
                                style={{ flex: 1, minWidth: 0 }}
                            />
                            <AssetNameAutoFillButton
                                sourceName={state.name}
                                onFill={(value) => {
                                    setLocalAssetName(value);
                                    handleChange('assetName', value);
                                }}
                            />
                        </div>
                    )}
                </div>
                {!state.assetName && (
                    <InspectorWarning message="Asset Name not set. Using ID as default." />
                )}
                <div className="inspector-description-block">
                    <div className="inspector-description-label">Description</div>
                    <textarea
                        value={state.description || ''}
                        onChange={(e) => handleChange('description', e.target.value)}
                        disabled={readOnly}
                        placeholder="No description."
                        className="inspector-textarea"
                    />
                </div>
            </div>

            {/* Lifecycle Script Section */}
            <div className="inspector-section">
                <div className="inspector-section-title">Lifecycle Script</div>
                <div className={`inspector-row ${readOnly ? 'inspector-readonly-wrapper' : ''}`}>
                    <ResourceSelect
                        options={lifecycleScriptOptions}
                        value={state.lifecycleScriptId || ''}
                        onChange={(val) => handleChange('lifecycleScriptId', val || undefined)}
                        placeholder="Select lifecycle script"
                        warnOnMarkedDelete
                        disabled={readOnly}
                        showDetails
                        onClear={state.lifecycleScriptId ? () => handleChange('lifecycleScriptId', undefined) : undefined}
                    />
                </div>
            </div>

            {/* Event Listeners Section */}
            <div className="inspector-section">
                <div className="inspector-section-title">Event Listeners</div>
                <div className={readOnly ? 'inspector-readonly-wrapper' : ''}>
                    <EventListenersEditor
                        listeners={state.eventListeners || []}
                        onChange={(next) => handleChange('eventListeners', next)}
                        eventOptions={eventOptions}
                        scriptOptions={scriptOptions}
                        variables={visibleVars}
                    />
                </div>
            </div>
        </div>
    );
};
