/**
 * components/Inspector/StageInspector.tsx
 * Stage 阶段属性检查器组件
 * 从 Inspector.tsx 拆分而来，负责展示和编辑 Stage 属性
 * 
 * 重构说明：
 * - 内联样式已替换为 CSS 类 (styles.css)
 */

import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { StageNode } from '../../types/stage';
import { EventListenersEditor } from './EventListenersEditor';
import { PresentationBindingEditor } from './PresentationBindingEditor';
import { ConditionEditor } from './ConditionEditor';
import { ResourceSelect } from './ResourceSelect';
import { collectVisibleVariables } from '../../utils/variableScope';

interface StageInspectorProps {
    stageId: string;
    readOnly?: boolean;
}

export const StageInspector: React.FC<StageInspectorProps> = ({ stageId, readOnly = false }) => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();

    // 预先获取脚本、事件选项，避免条件分支中的 Hook 调用问题
    const scriptDefs = project.scripts.scripts || {};
    const scriptOptions = Object.values(scriptDefs).map(s => ({ id: s.id, name: s.name, state: s.state }));
    const performanceScriptOptions = Object.values(scriptDefs)
        .filter(s => s.category === 'Performance')
        .map(s => ({ id: s.id, name: s.name, state: s.state }));
    const lifecycleScriptOptions = Object.values(scriptDefs)
        .filter(s => s.category === 'Lifecycle')
        .map(s => ({ id: s.id, name: s.name, state: s.state }));
    const graphOptions = Object.values(project.presentationGraphs || {}).map(g => ({ id: g.id, name: g.name, state: 'Draft' as any }));
    const eventOptions = Object.values(project.blackboard.events || {}).map(e => ({ id: e.id, name: e.name, state: e.state }));

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

    // 更新 Stage 的辅助函数
    const updateStage = (partial: Partial<StageNode>) => {
        if (readOnly) return; // 只读模式下不派发更新，避免误导
        dispatch({
            type: 'UPDATE_STAGE_TREE',
            payload: {
                ...project.stageTree,
                stages: {
                    ...project.stageTree.stages,
                    [stage.id]: { ...stage, ...partial }
                }
            }
        });
    };

    // 渲染局部变量列表
    const renderLocalVariables = () => {
        const vars = Object.values(stage.localVariables || {});
        if (vars.length === 0) {
            return <div style={{ padding: '12px 16px', color: '#666', fontSize: '12px' }}>No stage local variables</div>;
        }
        return (
            <div className="local-var-list">
                {vars.map(v => (
                    <div key={v.id} className="local-var-item">
                        <div className="local-var-item__header">
                            <div className="local-var-item__name">{v.name}</div>
                            <span className="local-var-item__key">{v.key}</span>
                        </div>
                        <div className="local-var-item__props">
                            <div>
                                <span className="label">Type: </span>
                                <span className="value">{v.type}</span>
                            </div>
                            <div>
                                <span className="label">Default: </span>
                                <span className="value">{String(v.defaultValue)}</span>
                            </div>
                            <div>
                                <span className="label">State: </span>
                                <span>{v.state}</span>
                            </div>
                        </div>
                        {v.description && (
                            <div style={{ fontSize: '11px', color: '#9ca3af' }}>{v.description}</div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div>
            {/* Stage Header */}
            <div className="inspector-header">
                <div className="entity-type">STAGE</div>
                <div className="entity-name">{stage.name}</div>
            </div>

            {/* Basic Info Section */}
            <div className="inspector-section">
                <div className="section-title">Basic Info</div>
                <div className="prop-row">
                    <div className="prop-label">ID</div>
                    <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{stage.id}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Description</div>
                    <div className="prop-value">{stage.description || 'No description'}</div>
                </div>
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
                            condition={stage.unlockCondition || { type: 'LITERAL', value: true }}
                            onChange={readOnly ? undefined : (next) => updateStage({ unlockCondition: next })}
                            variables={visibleVars}
                            conditionScripts={Object.values(scriptDefs).filter(s => s.category === 'Condition')}
                        />
                    </div>
                )}
            </div>

            {/* Lifecycle Script Section */}
            <div className="inspector-section">
                <div className="section-title">Lifecycle Script</div>
                <div className={readOnly ? 'inspector-section--readonly' : ''} style={{ display: 'flex', gap: '8px', alignItems: 'center', pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                    <ResourceSelect
                        options={lifecycleScriptOptions}
                        value={stage.lifecycleScriptId || ''}
                        onChange={(val) => updateStage({ lifecycleScriptId: val || undefined })}
                        placeholder="Select lifecycle script"
                        warnOnMarkedDelete
                        disabled={readOnly}
                    />
                    {stage.lifecycleScriptId && (
                        <button
                            className="btn-ghost"
                            onClick={() => updateStage({ lifecycleScriptId: undefined })}
                            disabled={readOnly}
                        >
                            Clear
                        </button>
                    )}
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
                            scriptDefs={scriptDefs}
                            scriptOptions={performanceScriptOptions}
                            graphOptions={graphOptions}
                            variables={visibleVars}
                            title="On Enter"
                            onNavigateToGraph={(graphId) => dispatch({ type: 'NAVIGATE_TO', payload: { graphId } })}
                            readOnly={readOnly}
                        />
                    </div>
                    <div>
                        <PresentationBindingEditor
                            binding={stage.onExitPresentation}
                            onChange={(next) => updateStage({ onExitPresentation: next })}
                            scriptDefs={scriptDefs}
                            scriptOptions={performanceScriptOptions}
                            graphOptions={graphOptions}
                            variables={visibleVars}
                            title="On Exit"
                            onNavigateToGraph={(graphId) => dispatch({ type: 'NAVIGATE_TO', payload: { graphId } })}
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
                        onChange={readOnly ? () => {} : (next) => updateStage({ eventListeners: next })}
                        eventOptions={eventOptions}
                        scriptOptions={scriptOptions}
                        variables={visibleVars}
                    />
                </div>
            </div>

            {/* Local Variables Section */}
            <div className="inspector-section" style={{ borderBottom: 'none' }}>
                <div className="section-title">Local Variables</div>
                {renderLocalVariables()}
            </div>
        </div>
    );
};

