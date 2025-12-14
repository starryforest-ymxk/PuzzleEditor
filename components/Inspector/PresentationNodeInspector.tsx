import React, { useMemo } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { PresentationBindingEditor } from './PresentationBindingEditor';
import { VariableDefinition } from '../../types/blackboard';
import { collectVisibleVariables } from '../../utils/variableScope';
import type { StageNode } from '../../types/stage';
import type { PuzzleNode } from '../../types/puzzleNode';
import type { StateMachine } from '../../types/stateMachine';
import type { ScriptDefinition } from '../../types/manifest';
import type { PresentationGraph } from '../../types/presentation';

interface Props {
    graphId: string;
    nodeId: string;
    readOnly?: boolean;
}

export const PresentationNodeInspector = ({ graphId, nodeId, readOnly = false }: Props) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();

    const graph = project.presentationGraphs[graphId];
    const node = graph ? graph.nodes[nodeId] : null;

    // 尝试推断图的作用域上下文：优先找到引用该 graph 的 Stage / Node
    const resolvedScope = useMemo(() => {
        let stageId: string | null = null;
        let nodeIdCtx: string | null = null;

        // 1) Stage onEnter/onExit
        Object.values<StageNode>(project.stageTree.stages).some(s => {
            const enterMatch = s.onEnterPresentation?.type === 'Graph' && s.onEnterPresentation.graphId === graphId;
            const exitMatch = s.onExitPresentation?.type === 'Graph' && s.onExitPresentation.graphId === graphId;
            if (enterMatch || exitMatch) {
                stageId = s.id;
                return true;
            }
            return false;
        });

        // 2) FSM states / transitions (通过所属 node 推断 stage)
        if (!stageId) {
            const nodeEntries = Object.values<PuzzleNode>(project.nodes);
            for (const n of nodeEntries) {
                const fsm = project.stateMachines[n.stateMachineId] as StateMachine | undefined;
                if (!fsm) continue;
                const hasState = Object.values(fsm.states).some(st => st.presentation?.type === 'Graph' && st.presentation.graphId === graphId);
                const hasTrans = Object.values(fsm.transitions).some(tr => tr.presentation?.type === 'Graph' && tr.presentation.graphId === graphId);
                if (hasState || hasTrans) {
                    nodeIdCtx = n.id;
                    stageId = n.stageId;
                    break;
                }
            }
        }

        return { stageId, nodeId: nodeIdCtx };
    }, [project, graphId]);

    if (!node) return <div className="empty-state">Node not found</div>;

    const handleChange = (field: string, value: any) => {
        dispatch({
            type: 'UPDATE_PRESENTATION_NODE',
            payload: {
                graphId,
                nodeId: node.id,
                data: { [field]: value }
            }
        });
    };

    const handleTypeChange = (nextType: string) => {
        if (nextType === 'Wait') {
            handleChange('type', 'Wait');
            handleChange('duration', node.duration ?? 1);
            handleChange('presentation', undefined);
        } else if (nextType === 'ScriptCall') {
            handleChange('type', 'ScriptCall');
            handleChange('duration', undefined);
        } else {
            handleChange('type', nextType);
            handleChange('duration', undefined);
            handleChange('presentation', undefined);
        }
    };

    const scriptList = Object.values<ScriptDefinition>(project.scripts.scripts || {});
    const performanceScriptList = scriptList.filter(s => s.category === 'Performance');

    // Presentation binding options
    const performanceScriptOptions = useMemo(() => performanceScriptList.map(s => ({ id: s.id, name: s.name, state: s.state, description: s.description })), [performanceScriptList]);
    const graphOptions = useMemo(() => Object.values<PresentationGraph>(project.presentationGraphs || {}).filter(g => g.id !== graphId).map(g => ({ id: g.id, name: g.name, state: 'Draft' as const, description: g.description })), [project.presentationGraphs, graphId]);
    const scriptDefs = project.scripts.scripts || {};

    // 依据推断到的作用域收集可见变量，并过滤已标记删除
    const visibleVars: VariableDefinition[] = useMemo(() => {
        const vars = collectVisibleVariables(
            { project, ui: { selection: { type: 'NONE', id: null }, multiSelectStateIds: [] }, history: { past: [], future: [] } } as any,
            resolvedScope.stageId,
            resolvedScope.nodeId
        );
        return vars.all.filter(v => v.state !== 'MarkedForDelete');
    }, [project, resolvedScope]);

    // Node type display name
    const typeDisplayName = node.type === 'ScriptCall' ? 'SCRIPT CALL' : node.type.toUpperCase();

    return (
        <div>
            {/* Node Header */}
            <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
                <div style={{ fontSize: '10px', color: '#c586c0', marginBottom: '4px', letterSpacing: '1px' }}>{typeDisplayName} NODE</div>
                <input
                    type="text"
                    value={node.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    disabled={readOnly}
                    style={{ background: '#222', border: '1px solid #444', color: '#fff', fontSize: '14px', fontWeight: 600, width: '100%', padding: '4px', opacity: readOnly ? 0.7 : 1 }}
                />
            </div>

            {/* Basic Info Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</div>
                <div className="prop-row">
                    <div className="prop-label">ID</div>
                    <div className="prop-value" style={{ fontFamily: 'monospace', color: '#666' }}>{node.id}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Type</div>
                    <select
                        value={node.type}
                        onChange={(e) => handleTypeChange(e.target.value)}
                        disabled={readOnly}
                        style={{ background: '#222', color: '#ccc', border: '1px solid #444', padding: '4px 8px', borderRadius: '3px', fontSize: '12px', opacity: readOnly ? 0.7 : 1 }}
                    >
                        <option value="ScriptCall">Script Call</option>
                        <option value="Wait">Wait</option>
                        <option value="Branch">Branch</option>
                        <option value="Parallel">Parallel</option>
                    </select>
                </div>
            </div>

            {/* Wait Node: Duration */}
            {node.type === 'Wait' && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Wait Configuration</div>
                    <div className="prop-row">
                        <div className="prop-label">Duration (s)</div>
                        <input
                            type="number"
                            step="0.1"
                            value={node.duration ?? 1}
                            onChange={(e) => handleChange('duration', parseFloat(e.target.value))}
                            disabled={readOnly}
                            style={{ background: '#222', border: '1px solid #444', color: '#ccc', width: '80px', padding: '4px', borderRadius: '3px', opacity: readOnly ? 0.7 : 1 }}
                        />
                    </div>
                </div>
            )}

            {/* ScriptCall Node: Presentation Binding */}
            {node.type === 'ScriptCall' && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Presentation Binding</div>
                    <div style={{ pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.6 : 1 }}>
                        <PresentationBindingEditor
                            binding={node.presentation}
                            onChange={(next) => handleChange('presentation', next)}
                            scriptDefs={scriptDefs}
                            scriptOptions={performanceScriptOptions}
                            graphOptions={graphOptions}
                            graphData={project.presentationGraphs}
                            variables={visibleVars}
                            title="Script / Graph"
                            onNavigateToGraph={(gid) => dispatch({ type: 'NAVIGATE_TO', payload: { graphId: gid } })}
                        />
                    </div>
                </div>
            )}

            {/* Branch / Parallel: Info placeholder */}
            {(node.type === 'Branch' || node.type === 'Parallel') && (
                <div style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Configuration</div>
                    <div style={{ color: '#666', fontSize: '12px', padding: '8px', textAlign: 'center' }}>
                        {node.type === 'Branch' ? 'Branch nodes use outgoing connections for control flow.' : 'Parallel nodes execute all child branches simultaneously.'}
                    </div>
                </div>
            )}
        </div>
    );
};
