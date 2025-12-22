/**
 * components/Inspector/NodeInspector.tsx
 * PuzzleNode 节点属性检查器组件
 * 从 Inspector.tsx 拆分而来，负责展示和编辑 PuzzleNode 属性
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { LocalVariableEditor } from './LocalVariableEditor';
import { EventListenersEditor } from './EventListenersEditor';
import { ResourceSelect } from './ResourceSelect';
import { collectVisibleVariables } from '../../utils/variableScope';
import { getStageNodeIds } from '../../utils/stageTreeUtils';
import type { ScriptDefinition } from '../../types/manifest';
import type { EventDefinition } from '../../types/blackboard';
import type { PuzzleNode } from '../../types/puzzleNode';
import { ConfirmDialog } from './ConfirmDialog';
import { InspectorWarning } from './InspectorInfo';
import { Trash2 } from 'lucide-react';

interface NodeInspectorProps {
    nodeId: string;
    readOnly?: boolean;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({ nodeId, readOnly = false }) => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();

    // 删除确认弹窗状态
    const [deleteConfirm, setDeleteConfirm] = useState<{ nodeName: string; stageName?: string; siblingCount: number } | null>(null);

    // 本地编辑状态（用于失焦校验）
    const [localAssetName, setLocalAssetName] = useState('');


    // 预先获取脚本、事件选项
    const scriptDefs = project.scripts.scripts || {};
    const scriptOptions = Object.values<ScriptDefinition>(scriptDefs).map(s => ({ id: s.id, name: s.name, state: s.state, description: s.description }));
    const lifecycleScriptOptions = Object.values<ScriptDefinition>(scriptDefs)
        .filter(s => s.category === 'Lifecycle' && (!s.lifecycleType || s.lifecycleType === 'Node'))
        .map(s => ({
            id: s.id,
            name: s.name,
            state: s.state,
            category: s.category,
            description: s.description
        }));
    const eventOptions = Object.values<EventDefinition>(project.blackboard.events || {}).map(e => ({
        id: e.id,
        name: e.name,
        state: e.state,
        description: e.description
    }));

    const node = project.nodes[nodeId];
    if (!node) return <div className="empty-state">Node not found</div>;

    const stage = project.stageTree.stages[node.stageId];

    // 统计当前 Stage 下的节点数量（用于删除确认逻辑）
    const stageNodeIds = useMemo(() => getStageNodeIds(project.nodes, node.stageId), [project.nodes, node.stageId]);
    const stageNodeCount = stageNodeIds.length;

    // 节点字段更新帮助函数
    const updateNode = useCallback((partial: Partial<PuzzleNode>) => {
        if (readOnly) return;
        dispatch({ type: 'UPDATE_NODE', payload: { nodeId: node.id, data: partial } });
    }, [dispatch, node.id, readOnly]);

    // 同步本地状态
    React.useEffect(() => {
        setLocalAssetName(node.assetName || '');
    }, [node.assetName]);

    // AssetName 失焦校验
    const handleAssetNameBlur = () => {
        const trimmed = localAssetName.trim();
        if (trimmed !== (node.assetName || '')) {
            updateNode({ assetName: trimmed || undefined });
        }
    };

    // 请求删除节点；统一弹窗确认，避免首个节点被直接删除
    const handleRequestDelete = useCallback(() => {
        if (readOnly) return;
        setDeleteConfirm({ nodeName: node.name, stageName: stage?.name, siblingCount: stageNodeCount - 1 });
    }, [node.name, stage?.name, stageNodeCount, readOnly]);

    const handleConfirmDelete = useCallback(() => {
        dispatch({ type: 'DELETE_PUZZLE_NODE', payload: { nodeId: node.id } });
        setDeleteConfirm(null);
    }, [dispatch, node.id]);

    // 计算当前可见变量
    const visibleVars = collectVisibleVariables(
        { project, ui: { selection: ui.selection, multiSelectStateIds: [] }, history: { past: [], future: [] } } as any,
        node.stageId,
        node.id
    ).all.filter(v => v.state !== 'MarkedForDelete');

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
                        onClick={handleRequestDelete}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        title="Delete Puzzle Node"
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
                            value={node.name}
                            onChange={(e) => updateNode({ name: e.target.value })}
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
                        <input
                            type="text"
                            className="search-input"
                            value={localAssetName}
                            onChange={(e) => setLocalAssetName(e.target.value)}
                            onBlur={handleAssetNameBlur}
                            placeholder={node.id}
                            style={{ fontFamily: 'monospace' }}
                        />
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

            {deleteConfirm && (
                <ConfirmDialog
                    title="Delete Puzzle Node"
                    message={`Are you sure you want to delete "${deleteConfirm.nodeName}"? This will also remove its state machine. This action cannot be undone.`}
                    references={[
                        deleteConfirm.stageName ? `Stage: ${deleteConfirm.stageName}` : '',
                        deleteConfirm.siblingCount > 0 ? `${deleteConfirm.siblingCount} other node(s) in this stage` : ''
                    ].filter(Boolean)}
                    confirmText="Delete"
                    cancelText="Cancel"
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setDeleteConfirm(null)}
                />
            )}
        </div>
    );
};
