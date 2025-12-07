
import React from 'react';
import { useEditorState } from '../../store/context';

export const Header = () => {
  const { project } = useEditorState();

  return (
    <div className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', color: 'var(--accent-color)' }}>
        <span style={{ fontSize: '18px', marginRight: '8px' }}>❖</span>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Puzzle Editor</span>
      </div>
      
      <div style={{ width: '1px', height: '16px', background: '#444', margin: '0 16px' }}></div>

      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Milestone 1: Core UI
      </div>

      <div style={{ flex: 1 }}></div>

      {project.isLoaded && (
        <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>Project:</span>
          <span style={{ fontWeight: 500 }}>{project.meta.name}</span>
          <span style={{ margin: '0 8px', color: '#444' }}>|</span>
          <span style={{ color: 'var(--text-secondary)' }}>v{project.meta.version}</span>
        </div>
      )}
    </div>
  );
};
