/**
 * components/Inspector/VariableInspector.tsx
 * 变量属性检查器组件
 * 从 Inspector.tsx 拆分而来，负责展示 Variable 属性
 */

import React from 'react';
import { useEditorState } from '../../store/context';
import type { VariableDefinition } from '../../types/blackboard';
import type { StageNode } from '../../types/stage';
import type { PuzzleNode } from '../../types/puzzleNode';

interface VariableInspectorProps {
    variableId: string;
    readOnly?: boolean;
}

export const VariableInspector: React.FC<VariableInspectorProps> = ({ variableId, readOnly = false }) => {
    const { project } = useEditorState();

    // 在全局变量中查找
    let variable: VariableDefinition | undefined = project.blackboard.globalVariables[variableId];
    let variableScope: 'Global' | 'Stage' | 'Node' = 'Global';
    let scopeOwnerName = '';
    let scopeOwnerId = '';

    // 如果全局未找到，在 Stage 中查找
    if (!variable) {
        for (const stage of Object.values<StageNode>(project.stageTree.stages)) {
            if (stage.localVariables && stage.localVariables[variableId]) {
                variable = stage.localVariables[variableId];
                variableScope = 'Stage';
                scopeOwnerName = stage.name;
                scopeOwnerId = stage.id;
                break;
            }
        }
    }

    // 如果 Stage 未找到，在 Node 中查找
    if (!variable) {
        for (const node of Object.values<PuzzleNode>(project.nodes)) {
            if (node.localVariables && node.localVariables[variableId]) {
                variable = node.localVariables[variableId];
                variableScope = 'Node';
                scopeOwnerName = node.name;
                scopeOwnerId = node.id;
                break;
            }
        }
    }

    if (!variable) return <div className="empty-state">Variable not found</div>;

    const scopeColor = variableScope === 'Global' ? '#4fc3f7' : variableScope === 'Stage' ? '#4fc1ff' : '#ce9178';
    const scopeLabel = variableScope === 'Global' ? 'Global Variable' : variableScope === 'Stage' ? 'Stage Local Variable' : 'Node Local Variable';

    return (
        <div>
            {/* Variable Header */}
            <div style={{ padding: '16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42' }}>
                <div style={{ fontSize: '10px', color: scopeColor, marginBottom: '4px', letterSpacing: '1px' }}>{scopeLabel.toUpperCase()}</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{variable.name}</div>
            </div>

            {/* Basic Info Section */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Info</div>
                <div className="prop-row">
                    <div className="prop-label">Key</div>
                    <div className="prop-value monospace">{variable.key}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Type</div>
                    <div className="prop-value monospace">{variable.type}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">Default Value</div>
                    <div className="prop-value monospace">{String(variable.defaultValue)}</div>
                </div>
                <div className="prop-row">
                    <div className="prop-label">State</div>
                    <div className="prop-value">{variable.state}</div>
                </div>
                {variable.description && (
                    <div className="prop-row">
                        <div className="prop-label">Description</div>
                        <div className="prop-value">{variable.description}</div>
                    </div>
                )}
            </div>

            {/* Scope Section (for local variables) */}
            {variableScope !== 'Global' && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scope</div>
                    <div className="prop-row">
                        <div className="prop-label">Owner Type</div>
                        <div className="prop-value" style={{ color: scopeColor }}>{variableScope}</div>
                    </div>
                    <div className="prop-row">
                        <div className="prop-label">Owner Name</div>
                        <div className="prop-value">{scopeOwnerName}</div>
                    </div>
                </div>
            )}

            {/* References Section (Placeholder) */}
            <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>References</div>
                <div style={{ padding: '12px', background: '#1a1a1a', borderRadius: '4px', border: '1px dashed #444', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Reference tracking coming soon</div>
                    <div style={{ fontSize: '10px', color: '#666' }}>This area will show where this variable is used (conditions, parameter modifiers, script bindings, etc.)</div>
                </div>
            </div>
        </div>
    );
};

