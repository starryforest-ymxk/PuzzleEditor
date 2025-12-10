import React, { useRef, useState } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { normalizeProjectForStore } from '../../utils/projectNormalizer';
import { ExportManifest } from '../../types/project';
import { UiMessage } from '../../store/types';

export const Header = () => {
  const { project, ui } = useEditorState();
  const dispatch = useEditorDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMessages, setShowMessages] = useState(false);

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

  const pushMessage = (level: UiMessage['level'], text: string) => {
    dispatch({
      type: 'ADD_MESSAGE',
      payload: { id: `msg-${Date.now()}`, level, text, timestamp: new Date().toISOString() }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 读取后传给一致的归一化逻辑，保证新工程导入不闭画布
    dispatch({ type: 'INIT_START' });

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const normalized = normalizeProjectForStore(parsed as any);

        dispatch({
          type: 'INIT_SUCCESS',
          payload: {
            stageTree: normalized.project.stageTree,
            nodes: normalized.project.nodes,
            stateMachines: normalized.project.stateMachines,
            presentationGraphs: normalized.project.presentationGraphs,
            blackboard: normalized.project.blackboard,
            meta: normalized.project.meta,
            scripts: normalized.project.scripts,
            triggers: normalized.project.triggers
          }
        });

        pushMessage('info', 'Local JSON import successful');

        // 跳转到新项目的根 Stage 以确保可立即浏览
        if (normalized.project.stageTree.rootId) {
          dispatch({
            type: 'NAVIGATE_TO',
            payload: { stageId: normalized.project.stageTree.rootId, nodeId: null, graphId: null }
          });
        }
      } catch (err) {
        console.error('Failed to parse JSON:', err);
        dispatch({ type: 'INIT_ERROR', payload: { message: 'JSON import failed' } });
        pushMessage('error', 'JSON import failed');
      }
    };
    reader.readAsText(file);
    // Reset input to allow loading same file again
    e.target.value = '';
  };

  const renderMessagesPanel = () => {
    if (!showMessages) return null;

    // Sort messages: newest first
    const sortedMessages = [...ui.messages].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return (
      <div className="message-stack-dropdown">
        <div className="message-stack-header">
          <span>Message Stack</span>
          <button className="btn-ghost" onClick={() => dispatch({ type: 'CLEAR_MESSAGES' })}>Clear All</button>
        </div>

        {sortedMessages.length === 0 ? (
          <div className="message-empty">No active messages</div>
        ) : (
          sortedMessages.map(msg => (
            <div key={msg.id} className={`message-item ${msg.level}`}>
              <div className="message-meta">
                <span className={`message-level ${msg.level}`}>{msg.level}</span>
                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="message-text">{msg.text}</div>
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="app-header" style={{ position: 'relative' }}>
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
        <span style={{ fontSize: '20px', marginRight: '10px' }}>⚙</span>
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
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
        <button
          className="btn-ghost"
          onClick={() => setShowMessages(!showMessages)}
          style={{ position: 'relative' }}
        >
          Messages {ui.messages.length > 0 && <span style={{ marginLeft: 6, color: 'var(--accent-color)', fontWeight: 700 }}>({ui.messages.length})</span>}
        </button>
      </div>

      {renderMessagesPanel()}
    </div>
  );
};
