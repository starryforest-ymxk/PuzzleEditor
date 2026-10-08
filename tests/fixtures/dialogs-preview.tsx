/** 独立手测夹具：只模拟偏好 IPC，绝不访问用户偏好或项目文件。 */
import React, { useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { PreferencePanel } from '../../components/Layout/PreferencePanel';
import { ConfirmDialog } from '../../components/Inspector/ConfirmDialog';
import { StateContext, DispatchContext } from '../../store/context';
import { createEditorStore } from '../../store/editorStore';
import { createEditorFixture } from './editor';
import type { ElectronAPI, UserPreferences } from '../../electron/types';
import '../../styles.css';

let preferences: UserPreferences = {
  projectsDirectory: 'C:/DialogVerification/Projects',
  exportDirectory: 'C:/DialogVerification/Exports',
  restoreLastProject: false,
  lastProjectPath: null,
  recentProjects: [],
  translation: { provider: 'local', autoTranslate: false },
  autoSave: { enabled: false, intervalMinutes: 1 },
};
const bridge: Pick<ElectronAPI, 'loadPreferences' | 'savePreferences' | 'openDirectoryDialog'> = {
  loadPreferences: async () => ({ success: true, data: structuredClone(preferences) }),
  savePreferences: async (value) => {
    preferences = structuredClone(value);
    return { success: true };
  },
  openDirectoryDialog: async () => ({ canceled: false, filePath: 'C:/DialogVerification/Chosen' }),
};
window.electronAPI = bridge as ElectronAPI;
const store = createEditorStore(createEditorFixture());
function Preview() {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [mode, setMode] = useState<'preferences' | 'delete' | null>(null);
  const [result, setResult] = useState('No action yet');
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={store.dispatch}>
        <main style={{ padding: 24 }}>
          <h1>Dialog Verification Fixture</h1>
          <p>Isolated fixture. Preference IPC is simulated; no user files are accessed.</p>
          <button onClick={() => setMode('preferences')}>Open Preferences</button>{' '}
          <button onClick={() => setMode('delete')}>Open Delete Confirmation</button>
          <p role="status">{result}</p>
          <p>
            Auto Save: {String(state.settings.autoSave.enabled)} /{' '}
            {state.settings.autoSave.intervalMinutes} minutes
          </p>
          {mode === 'preferences' && (
            <PreferencePanel
              onClose={() => {
                setMode(null);
                setResult('Preferences closed');
              }}
            />
          )}
          {mode === 'delete' && (
            <ConfirmDialog
              title="Delete Variable"
              message="Delete this variable and its references?"
              confirmText="Delete"
              references={['Stage / Test Stage / Unlock Condition']}
              onCancel={() => {
                setMode(null);
                setResult('Delete cancelled');
              }}
              onConfirm={() => {
                setMode(null);
                setResult('Delete confirmed');
              }}
            />
          )}
        </main>
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
