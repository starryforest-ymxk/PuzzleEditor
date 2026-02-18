/**
 * components/Inspector/NodeInspector.tsx
 * PuzzleNode 节点属性检查器组件
 * 从 Inspector.tsx 拆分而来，负责展示和编辑 PuzzleNode 属性
 */

import React, { useCallback, useMemo } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { LocalVariableEditor } from './LocalVariableEditor';
import { EventListenersEditor } from './EventListenersEditor';
import { ResourceSelect } from './ResourceSelect';
import { collectVisibleVariables } from '../../utils/variableScope';
import type { PuzzleNode } from '../../types/puzzleNode';
import { buildEventOptions, buildScriptOptions, buildScriptOptionsByCategory } from '../../utils/resourceOptions';
import { InspectorWarning } from './InspectorInfo';
import { AssetNameAutoFillButton } from './AssetNameAutoFillButton';
import { Trash2 } from 'lucide-react';
import { filterActiveResources } from '../../utils/resourceFilters';
import { useDeleteHandler } from '../../hooks/useDeleteHandler';
import { useInspectorNameFields } from '../../hooks/useInspectorNameFields';

interface NodeInspectorProps {
    nodeId: string;
    readOnly?: boolean;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({ nodeId, readOnly = false }) => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();
    const { deleteNode } = useDeleteHandler();

    // 预先获取脚本、事件选项
    const scriptDefs = project.scripts.scripts || {};
    const scriptOptions = buildScriptOptions(scriptDefs);
    const lifecycleScriptOptions = buildScriptOptionsByCategory(scriptDefs, 'Lifecycle', 'Node');
    const eventOptions = buildEventOptions(project.blackboard.events || {});

    const node = project.nodes[nodeId];

    // 节点字段更新帮助函数
    const updateNode = useCallback((partial: Partial<PuzzleNode>) => {
        if (readOnly) return;
        dispatch({ type: 'UPDATE_NODE', payload: { nodeId, data: partial } });
    }, [dispatch, nodeId, readOnly]);

    // 统一名称编辑 Hook（允许空名称）
    const {
        localName, setLocalName,
        localAssetName, setLocalAssetName,
        handleNameBlur, handleAssetNameBlur, triggerAutoTranslate
    } = useInspectorNameFields({
        entity: node || null,
        onUpdate: updateNode,
        allowEmptyName: true,
    });

    if (!node) return <div className="empty-state">Node not found</div>;

    // 请求删除节点：统一委托给全局删除逻辑和全局确认弹窗
    const handleRequestDelete = useCallback(() => {
        if (readOnly) return;
        deleteNode(node.id);
    }, [readOnly, deleteNode, node.id]);

    // 计算当前可见变量
    const visibleVars = filterActiveResources(collectVisibleVariables(
        { project, ui: { selection: ui.selection, multiSelectStateIds: [] }, history: { past: [], future: [] } } as any,
        node.stageId,
        node.id
    ).all);

    return (
        <div>
            {/* Header */}
            <div className="inspector-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div className="entity-type">PUZZLE NODE</div>
                    <div className="entity-name">{node.name}</div>
                </div>
                {!readOnly && (
                    <button
                        className="btn-icon btn-icon--danger"
                        onClick={handleRequestDelete}
                        disabled={ui.view === 'EDITOR' && ui.currentNodeId === node.id}
                        style={{
                            opacity: (ui.view === 'EDITOR' && ui.currentNodeId === node.id) ? 0.5 : 1,
                            cursor: (ui.view === 'EDITOR' && ui.currentNodeId === node.id) ? 'not-allowed' : 'pointer'
                        }}
                        title={(ui.view === 'EDITOR' && ui.currentNodeId === node.id)
                            ? "Cannot delete node while editing FSM"
                            : "Delete Puzzle Node"}
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            {/* Basic Info Section */}
            <div className="inspector-section inspector-basic-info">
                <div className="section-title">Basic Info</div>
                <div className="prop-row">
                    <div className="prop-label">ID</div>
                    <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{node.id}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Name</div>
                    {readOnly ? (
                        <div className="prop-value">{node.name}</div>
                    ) : (
                        <input
                            type="text"
                            className="search-input"
                            value={localName}
                            onChange={(e) => setLocalName(e.target.value)}
                            onBlur={handleNameBlur}
                            placeholder="Node name"
                        />
                    )}
                </div>
                <div className="prop-row">
                    <div className="prop-label">Asset Name</div>
                    {readOnly ? (
                        <div className="prop-value" style={{ fontFamily: 'monospace', color: node.assetName ? undefined : '#999' }}>
                            {node.assetName || node.id}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '6px', flex: 1, minWidth: 0 }}>
                            <input
                                type="text"
                                className="search-input"
                                value={localAssetName}
                                onChange={(e) => setLocalAssetName(e.target.value)}
                                onBlur={handleAssetNameBlur}
                                placeholder={node.id}
                                style={{ fontFamily: 'monospace', flex: 1, minWidth: 0 }}
                            />
                            <AssetNameAutoFillButton
                                sourceName={node.name}
                                onFill={(value) => {
                                    setLocalAssetName(value);
                                    updateNode({ assetName: value });
                                }}
                            />
                        </div>
                    )}
                </div>
                {!node.assetName && (
                    <InspectorWarning message="Asset Name not set. Using ID as default." />
                )}
                <div className="prop-row">
                    <div className="prop-label">Description</div>
                    {readOnly ? (
                        <div className="prop-value">{node.description || 'No description'}</div>
                    ) : (
                        <textarea
                            className="search-input"
                            value={node.description || ''}
                            onChange={(e) => updateNode({ description: e.target.value })}
                            placeholder="Node description"
                            rows={2}
                            style={{ resize: 'vertical', minHeight: '40px' }}
                        />
                    )}
                </div>
            </div>

            {/* Lifecycle Script Section */}
            <div className="inspector-section">
                <div className="section-title">Lifecycle Script</div>
                <div className={readOnly ? 'inspector-section--readonly inspector-row' : 'inspector-row'} style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <ResourceSelect
                        options={lifecycleScriptOptions}
                        value={node.lifecycleScriptId || ''}
                        onChange={(val) => updateNode({ lifecycleScriptId: val || undefined })}
                        placeholder="Select lifecycle script"
                        warnOnMarkedDelete
                        disabled={readOnly}
                        showDetails
                        onClear={node.lifecycleScriptId ? () => updateNode({ lifecycleScriptId: undefined }) : undefined}
                    />
                </div>
            </div>

            {/* Event Listeners Section */}
            <div className="inspector-section">
                <div className="section-title">Event Listeners</div>
                <div className={readOnly ? 'inspector-section--readonly' : ''} style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <EventListenersEditor
                        listeners={node.eventListeners || []}
                        onChange={(next) => updateNode({ eventListeners: next })}
                        eventOptions={eventOptions}
                        scriptOptions={scriptOptions}
                        variables={visibleVars}
                    />
                </div>
            </div>

            {/* Local Variables Section */}
            <div className="inspector-section" style={{ borderBottom: 'none' }}>
                <div className="section-title">Local Variables</div>
                <div className={readOnly ? 'inspector-section--readonly' : ''} style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <LocalVariableEditor
                        variables={node.localVariables}
                        ownerType="node"
                        ownerId={node.id}
                        readOnly={readOnly}
                    />
                </div>
            </div>
        </div>
    );
};
