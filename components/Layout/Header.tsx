import React, { useRef } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ExportManifest } from '../../types/project';

export const Header = () => {
  const { project, ui } = useEditorState();
  const dispatch = useEditorDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export project as JSON file
  const handleExport = () => {
    if (!project.isLoaded) return;

    const exportManifest: ExportManifest = {
      manifestVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      project: {
        meta: project.meta,
        blackboard: project.blackboard,
        scripts: project.scripts,
        triggers: project.triggers,
        stageTree: project.stageTree,
        nodes: project.nodes,
        stateMachines: project.stateMachines,
        presentationGraphs: project.presentationGraphs
      }
    };

    const jsonStr = JSON.stringify(exportManifest, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.meta.name || 'project'}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Load project from JSON file
  const handleLoad = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content) as ExportManifest;

        if (!parsed.manifestVersion || !parsed.project) {
          console.error('Invalid manifest format');
          return;
        }

        dispatch({
          type: 'INIT_SUCCESS',
          payload: {
            meta: parsed.project.meta,
            stageTree: parsed.project.stageTree,
            nodes: parsed.project.nodes,
            stateMachines: parsed.project.stateMachines || {},
            presentationGraphs: parsed.project.presentationGraphs || {},
            blackboard: parsed.project.blackboard,
            scripts: parsed.project.scripts,
            triggers: parsed.project.triggers
          }
        });
      } catch (err) {
        console.error('Failed to parse JSON:', err);
      }
    };
    reader.readAsText(file);
    // Reset input to allow loading same file again
    e.target.value = '';
  };

  return (
    <div className="app-header">
      {/* Hidden file input for loading */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 1. Brand / Logo */}
      <div style={{ display: 'flex', alignItems: 'center', color: 'var(--accent-color)', minWidth: '200px' }}>
        <span style={{ fontSize: '20px', marginRight: '10px' }}>❖</span>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontWeight: 700, letterSpacing: '0.5px', color: 'var(--text-primary)' }}>PUZZLE EDITOR</span>
          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px' }}>CORE SYSTEMS // P2</span>
        </div>
      </div>

      <div style={{ width: '2px', height: '24px', background: 'var(--border-color)', margin: '0 24px' }}></div>

      {/* 2. Project Info */}
      {project.isLoaded && (
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', minWidth: '150px' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>PROJECT</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {project.meta.name} <span style={{ opacity: 0.5, fontWeight: 400 }}>v{project.meta.version}</span>
          </div>
        </div>
      )}

      {/* 3. View Switcher (Center) */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{
          display: 'flex',
          background: 'var(--bg-color)',
          padding: '2px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)'
        }}>
          <button
            className={ui.view === 'EDITOR' ? 'btn-primary' : 'btn-ghost'}
            onClick={() => dispatch({ type: 'SWITCH_VIEW', payload: 'EDITOR' })}
            style={{ minWidth: '100px' }}
          >
            EDITOR
          </button>
          <div style={{ width: '2px' }}></div>
          <button
            className={ui.view === 'BLACKBOARD' ? 'btn-primary' : 'btn-ghost'}
            onClick={() => dispatch({ type: 'SWITCH_VIEW', payload: 'BLACKBOARD' })}
            style={{ minWidth: '100px' }}
          >
            BLACKBOARD
          </button>
        </div>
      </div>

      {/* 4. Global Actions (Right) */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn-ghost" onClick={handleLoad}>
          LOAD
        </button>
        <button
          className="btn-primary"
          style={{ background: 'var(--accent-success)', boxShadow: '0 2px 0 #15803d' }}
          onClick={handleExport}
          disabled={!project.isLoaded}
        >
          EXPORT JSON
        </button>
      </div>
    </div>
  );
};

