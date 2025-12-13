import React from 'react';
import { VariableDefinition } from '../../../types/blackboard';
import type { VariableType } from '../../../types/common';
import { VariableValueInput } from './VariableValueInput';

interface LocalVariableCardProps {
    variable: VariableDefinition;
    canMutate: boolean;
    readOnly: boolean;
    referenceCount: number;
    error?: string;
    onUpdate: (field: keyof VariableDefinition, value: any) => void;
    onDelete: () => void;
    onNumberBlur: (raw: any) => void;
}

const getTypeColor = (type: string) => {
    switch (type) {
        case 'boolean': return '#569cd6';
        case 'integer': return '#b5cea8';
        case 'float': return '#4ec9b0';
        case 'string': return '#ce9178';
        default: return '#ccc';
    }
};

// 渲染单个局部变量卡片，解耦 UI 以便主编辑器聚焦业务逻辑
export const LocalVariableCard: React.FC<LocalVariableCardProps> = ({
    variable,
    canMutate,
    readOnly,
    referenceCount,
    error,
    onUpdate,
    onDelete,
    onNumberBlur
}) => {
    const isMarkedForDelete = variable.state === 'MarkedForDelete';
    return (
        <div className="blackboard-var-item" style={{ opacity: isMarkedForDelete ? 0.55 : 1 }}>
            <div className="blackboard-var-header">
                <div className="blackboard-var-info">
                    {canMutate ? (
                        <input
                            className="prop-value"
                            value={variable.name}
                            onChange={(e) => onUpdate('name', e.target.value)}
                            disabled={readOnly || !canMutate || isMarkedForDelete}
                            style={{ background: 'transparent', border: 'none', borderBottom: '1px dashed #444', color: '#ddd', width: '140px', minWidth: '100px' }}
                        />
                    ) : (
                        <span style={{ color: '#ddd', fontSize: '12px', fontWeight: 600 }}>{variable.name}</span>
                    )}

                    <div className="blackboard-var-meta">
                        <span style={{ color: '#666', fontSize: '10px' }}>Status: {variable.state}</span>
                        {referenceCount > 0 && (
                            <span style={{ color: '#f9a825', fontSize: '10px' }}>
                                {referenceCount} reference(s)
                            </span>
                        )}
                    </div>
                </div>

                {canMutate && (
                    <button
                        onClick={onDelete}
                        style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '14px', alignSelf: 'flex-start', padding: '0 0 0 8px' }}
                    >
                        &times;
                    </button>
                )}
            </div>

            <div className="inspector-row" style={{ gap: '8px', alignItems: 'center' }}>
                <select
                    value={variable.type}
                    onChange={(e) => onUpdate('type', e.target.value as VariableType)}
                    disabled={!canMutate || isMarkedForDelete}
                    style={{
                        fontSize: '9px', padding: '2px 4px', borderRadius: '3px',
                        background: '#222', border: `1px solid ${getTypeColor(variable.type)}`,
                        color: getTypeColor(variable.type), textTransform: 'uppercase'
                    }}
                >
                    <option value="string">String</option>
                    <option value="integer">Integer</option>
                    <option value="float">Float</option>
                    <option value="boolean">Boolean</option>
                </select>

                <div style={{ flex: 1 }}>
                    <VariableValueInput
                        type={variable.type}
                        value={variable.defaultValue}
                        disabled={!canMutate || isMarkedForDelete}
                        canMutate={canMutate}
                        onChange={(val) => onUpdate('defaultValue', val)}
                        onNumberBlur={onNumberBlur}
                    />
                </div>
            </div>
            {error && (
                <div style={{ color: '#f2777a', fontSize: '11px' }}>{error}</div>
            )}

            <div style={{ marginTop: '6px' }}>
                {canMutate ? (
                    <textarea
                        value={variable.description || ''}
                        onChange={(e) => onUpdate('description', e.target.value)}
                        disabled={!canMutate || isMarkedForDelete}
                        placeholder="Description"
                        style={{
                            width: '100%', minHeight: '32px', background: '#1e1e1e', border: '1px solid #333',
                            color: '#e0e0e0', fontSize: '11px', padding: '6px 8px', resize: 'vertical',
                            boxSizing: 'border-box', borderRadius: '4px'
                        }}
                    />
                ) : (
                    <div style={{ color: '#9ca3af', fontSize: '11px', lineHeight: 1.5 }}>
                        {variable.description || 'No description'}
                    </div>
                )}
            </div>
        </div>
    );
};
