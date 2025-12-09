import React, { useMemo } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ScriptParamEditor } from './ScriptParamEditor';
import { ParameterBinding } from '../../types/common';
import { VariableDefinition } from '../../types/blackboard';
import { collectVisibleVariables } from '../../utils/variableScope';

interface Props {
    graphId: string;
    nodeId: string;
}

export const PresentationNodeInspector = ({ graphId, nodeId }: Props) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();

    const graph = project.presentationGraphs[graphId];
    const node = graph ? graph.nodes[nodeId] : null;

    // 尝试推断图的作用域上下文：优先找到引用该 graph 的 Stage / Node
    const resolvedScope = useMemo(() => {
        let stageId: string | null = null;
        let nodeIdCtx: string | null = null;

        // 1) Stage onEnter/onExit
        Object.values(project.stageTree.stages).some(s => {
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
            const nodeEntries = Object.values(project.nodes);
            for (const n of nodeEntries) {
                const fsm = project.stateMachines[n.stateMachineId];
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
            handleChange('scriptId', undefined);
            handleChange('parameters', []);
            handleChange('duration', node.duration ?? 1);
        } else if (nextType === 'ScriptCall') {
            handleChange('type', 'ScriptCall');
            handleChange('duration', undefined);
            handleChange('parameters', node.parameters || []);
        } else {
            handleChange('type', nextType);
            handleChange('scriptId', undefined);
            handleChange('parameters', []);
            handleChange('duration', undefined);
        }
    };

    const bindings: ParameterBinding[] = node.parameters || [];
    const handleParamChange = (nextBindings: ParameterBinding[]) => {
        handleChange('parameters', nextBindings);
    };

    const scriptList = Object.values(project.scripts.scripts || {});
    const selectedScriptDef = node.scriptId ? scriptList.find(s => s.id === node.scriptId) : null;

    // 依据推断到的作用域收集可见变量，并过滤已标记删除
    const visibleVars: VariableDefinition[] = useMemo(() => {
        const vars = collectVisibleVariables(
            { project, ui: { selection: { type: 'NONE', id: null }, multiSelectStateIds: [] }, history: { past: [], future: [] } } as any,
            resolvedScope.stageId,
            resolvedScope.nodeId
        );
        return vars.all.filter(v => v.state !== 'MarkedForDelete');
    }, [project, resolvedScope]);

    return (
        <div>
            <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
                <div style={{ fontSize: '10px', color: '#c586c0', marginBottom: '4px' }}>ACTION NODE</div>
                <input 
                    type="text" 
                    value={node.name} 
                    onChange={(e) => handleChange('name', e.target.value)}
                    style={{ background: '#222', border: '1px solid #444', color: '#fff', fontSize: '14px', fontWeight: 600, width: '100%', padding: '4px' }}
                />
            </div>
            
            <div className="prop-row">
                <div className="prop-label">Type</div>
                 <select 
                    value={node.type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    style={{ background: '#222', color: '#ccc', border: '1px solid #444', padding: '2px', width: '100%' }}
                >
                    <option value="ScriptCall">ScriptCall</option>
                    <option value="Wait">Wait</option>
                    <option value="Branch">Branch</option>
                    <option value="Parallel">Parallel</option>
                </select>
            </div>

            {/* Script Selection Logic */}
            {node.type === 'ScriptCall' && (
                <>
                    <div className="prop-row">
                        <div className="prop-label">Script</div>
                        <select 
                            value={node.scriptId || ''}
                            onChange={(e) => handleChange('scriptId', e.target.value)}
                            style={{ background: '#222', color: '#ccc', border: '1px solid #444', padding: '2px', width: '100%' }}
                        >
                            <option value="">-- Select Script --</option>
                            {scriptList.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="panel-header" style={{ marginTop: '16px' }}>Parameters</div>
                    {selectedScriptDef ? (
                        <ScriptParamEditor 
                            scriptDef={selectedScriptDef}
                            bindings={bindings}
                            onChange={handleParamChange}
                            variables={visibleVars}
                        />
                    ) : (
                        <div style={{ padding: '16px', color: '#666', fontSize: '12px' }}>
                            Select a script to configure parameters.
                        </div>
                    )}
                </>
            )}

            {node.type === 'Wait' && (
                 <div className="prop-row">
                    <div className="prop-label">Duration (s)</div>
                    <input 
                        type="number" step="0.1"
                        value={node.duration ?? 1}
                        onChange={(e) => handleChange('duration', parseFloat(e.target.value))}
                        style={{ background: '#222', border: '1px solid #444', color: '#ccc', width: '100%' }}
                    />
                 </div>
            )}
        </div>
    );
};
