
import React, { useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StageExplorer } from '../Explorer/StageExplorer';
import { NodeList } from '../Explorer/NodeList';
import { Inspector } from '../Inspector/Inspector';
import { Canvas } from '../Canvas/Canvas';
import { useEditorDispatch } from '../../store/context';

export const MainLayout = () => {
  const dispatch = useEditorDispatch();

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for modifier key (Ctrl on Windows/Linux, Cmd on Mac)
      const isModifier = e.ctrlKey || e.metaKey;

      if (isModifier && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          dispatch({ type: 'REDO' });
        } else {
          dispatch({ type: 'UNDO' });
        }
      } else if (isModifier && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header />
      
      <div className="app-body">
        {/* Left Sidebar: Structure */}
        <Sidebar title="Explorer" position="left">
           {/* Split view: Top 60% Stage Tree, Bottom 40% Node List */}
           <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: '0 0 60%', overflowY: 'auto', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ padding: '8px 16px', fontSize: '10px', color: '#666', fontWeight: 600 }}>STAGES</div>
                  <StageExplorer />
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ padding: '8px 16px', fontSize: '10px', color: '#666', fontWeight: 600 }}>NODES</div>
                  <NodeList />
              </div>
           </div>
        </Sidebar>

        {/* Center: Canvas */}
        <Canvas />

        {/* Right Sidebar: Properties */}
        <Sidebar title="Inspector" position="right">
          <Inspector />
        </Sidebar>
      </div>
    </div>
  );
};
