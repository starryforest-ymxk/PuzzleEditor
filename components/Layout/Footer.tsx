/**
 * components/Layout/Footer.tsx
 * 底部状态栏
 */

import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { validateProject } from '../../utils/validation/validator';
import { CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

export const Footer = () => {
    const { ui, project } = useEditorState();
    const dispatch = useEditorDispatch();

    const handleValidate = () => {
        const results = validateProject(project);
        dispatch({ type: 'SET_VALIDATION_RESULTS', payload: results });
        dispatch({ type: 'SET_SHOW_VALIDATION_PANEL', payload: true });
    };

    const errorCount = ui.validationResults.filter(r => r.level === 'error').length;
    const warningCount = ui.validationResults.filter(r => r.level === 'warning').length;

    return (
        <div style={{
            height: '24px',
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            justifyContent: 'space-between'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span>Ready</span>

                <div
                    onClick={() => dispatch({ type: 'SET_SHOW_VALIDATION_PANEL', payload: !ui.showValidationPanel })}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        color: errorCount > 0 ? 'var(--accent-error)' : (warningCount > 0 ? 'var(--accent-warning)' : 'var(--text-secondary)')
                    }}
                >
                    {errorCount > 0 ? <AlertCircle size={12} /> : (warningCount > 0 ? <AlertTriangle size={12} /> : <CheckCircle size={12} />)}
                    <span>
                        {errorCount} Errors, {warningCount} Warnings
                    </span>
                </div>
            </div>

            <button
                onClick={handleValidate}
                style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-tertiary)'
                }}
            >
                V Check
            </button>
        </div>
    );
};
