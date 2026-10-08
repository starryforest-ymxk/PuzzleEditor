/**
 * components/Layout/ValidationPanel.tsx
 * 校验结果面板
 */

import React, { useMemo } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import type { ValidationResult } from '../../types/validation';
import { validationNavigation } from '../../store/navigation/validationNavigation';
import { useProjectActions } from '../../hooks/useProjectActions';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

interface ValidationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({ isOpen, onClose }) => {
  const { ui, project } = useEditorState();
  const dispatch = useEditorDispatch();
  const { validateProject } = useProjectActions();
  const results = ui.validationResults;

  const groupedResults = useMemo(() => {
    return {
      error: results.filter((r) => r.level === 'error'),
      warning: results.filter((r) => r.level === 'warning'),
      hint: results.filter((r) => r.level === 'hint'),
    };
  }, [results]);

  if (!isOpen) return null;

  const handleNavigate = (result: ValidationResult) => {
    validationNavigation(project, result).forEach(dispatch);
  };

  return (
    <div
      className="validation-panel"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '200px',
        background: 'var(--bg-color)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        boxShadow: '0 -4px 12px rgba(0,0,0,0.2)',
      }}
    >
      <div
        className="validation-header"
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: 600 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--accent-error)',
            }}
          >
            <X size={14} /> {groupedResults.error.length} Errors
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--accent-warning)',
            }}
          >
            <AlertTriangle size={14} /> {groupedResults.warning.length} Warnings
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={validateProject} className="btn-ghost">
            Recheck
          </button>
          <button onClick={onClose} className="btn-icon" aria-label="Close validation panel">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="validation-content" style={{ flex: 1, overflowY: 'auto' }}>
        {results.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)' }}>
            No validation issues found.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <tbody>
              {results.map((res, idx) => (
                <TableItem key={idx} result={res} onNavigate={() => handleNavigate(res)} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const TableItem: React.FC<{ result: ValidationResult; onNavigate: () => void }> = ({
  result,
  onNavigate,
}) => {
  return (
    <tr
      style={{
        borderBottom: '1px solid var(--border-secondary)',
        cursor: 'pointer',
        // hover effect managed by css usually, imply style here
      }}
      onClick={onNavigate}
      className="validation-row"
    >
      <td style={{ padding: '6px 12px', width: '24px' }}>
        {result.level === 'error' && <AlertCircle size={14} color="var(--accent-error)" />}
        {result.level === 'warning' && <AlertTriangle size={14} color="var(--accent-warning)" />}
        {result.level === 'hint' && <Info size={14} color="var(--text-primary)" />}
      </td>
      <td style={{ padding: '6px 12px', color: 'var(--text-primary)' }}>{result.message}</td>
      <td style={{ padding: '6px 12px', color: 'var(--text-secondary)', textAlign: 'right' }}>
        {result.location}
      </td>
    </tr>
  );
};
