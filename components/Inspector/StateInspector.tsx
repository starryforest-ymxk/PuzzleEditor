import React, { useMemo } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { collectVisibleVariables } from '../../utils/variableScope';
import { EventListener } from '../../types/common';
import { EventListenersEditor } from './EventListenersEditor';
import { ResourceSelect } from './ResourceSelect';
import type { PuzzleNode } from '../../types/puzzleNode';
import type { EventDefinition } from '../../types/blackboard';
import type { ScriptDefinition } from '../../types/manifest';
import { InspectorWarning } from './InspectorInfo';
import { AssetNameAutoFillButton } from './AssetNameAutoFillButton';
import { isValidAssetName } from '../../utils/assetNameValidation';
import { useAutoTranslateAssetName } from '../../hooks/useAutoTranslateAssetName';
import { Trash2 } from 'lucide-react';

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

    if (!state) return <div className="empty-state">State not found</div>;

    // 本地编辑状态（用于失焦校验）
    const [localAssetName, setLocalAssetName] = React.useState('');
    const [localName, setLocalName] = React.useState('');

    // 同步本地状态
    React.useEffect(() => {
        setLocalAssetName(state.assetName || '');
        setLocalName(state.name || '');
    }, [state.assetName, state.name]);

    // 自动翻译 Hook
    const triggerAutoTranslate = useAutoTranslateAssetName({
        currentAssetName: state.assetName,
        onAssetNameFill: (value) => {
            setLocalAssetName(value);
            handleChange('assetName', value);
        }
    });

    // Name 失焦处理
    const handleNameBlur = async () => {
        const trimmed = localName.trim();
        if (trimmed !== state.name) {
            handleChange('name', trimmed);
        }
        await triggerAutoTranslate(trimmed);
    };

    // AssetName 失焦校验
    const handleAssetNameBlur = () => {
        const trimmed = localAssetName.trim();
        if (!isValidAssetName(trimmed)) {
            // 校验失败，恢复原值
            setLocalAssetName(state.assetName || '');
            return;
        }
        if (trimmed !== (state.assetName || '')) {
            handleChange('assetName', trimmed || undefined);
        }
    };

    // 更新状态属性
    const handleChange = (field: string, value: any) => {
        dispatch({
            type: 'UPDATE_STATE',
            payload: {
                fsmId,
                stateId: state.id,
                data: { [field]: value }
            }
        });
    };

    const isInitial = fsm.initialStateId === state.id;

    // 获取所属节点和可见变量
    const owningNode = useMemo(() => Object.values<PuzzleNode>(project.nodes).find(n => n.stateMachineId === fsmId) || null, [project.nodes, fsmId]);
    const visibleVars = useMemo(() => {
        const vars = collectVisibleVariables(stateTree, owningNode?.stageId, owningNode?.id);
        return vars.all.filter(v => v.state !== 'MarkedForDelete');
    }, [stateTree, owningNode]);

    // 事件和脚本选项
    const eventOptions = useMemo(() => Object.values<EventDefinition>(project.blackboard.events).map(e => ({
        id: e.id,
        name: e.name,
        state: e.state,
        description: e.description
    })), [project.blackboard.events]);

    const scriptRecords = project.scripts.scripts;
    const scriptOptions = useMemo(() => Object.values<ScriptDefinition>(scriptRecords).map(s => ({
        id: s.id,
        name: s.name,
        state: s.state,
        description: s.description
    })), [scriptRecords]);

    const lifecycleScriptOptions = useMemo(() => Object.values<ScriptDefinition>(scriptRecords)
        .filter(s => s.category === 'Lifecycle' && (!s.lifecycleType || s.lifecycleType === 'State'))
        .map(s => ({
            id: s.id,
            name: s.name,
            state: s.state,
            category: s.category,
            description: s.description
        })), [scriptRecords]);

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
