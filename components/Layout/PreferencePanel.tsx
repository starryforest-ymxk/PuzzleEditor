/** 用户偏好保留平台读写与 Store 同步，弹窗和表单外观统一共享。 */
import React, { useState, useEffect, useId } from 'react';
import { Settings, FolderOpen } from 'lucide-react';
import {
  isElectron,
  loadPreferences,
  savePreferences,
  openDirectoryDialog,
} from '@/platform/electron';
import type { UserPreferences } from '@/electron/types';
import { useEditorState, useEditorDispatch } from '../../store/context';
import type { TranslationProvider } from '../../types/settings';
import { OpenAIModelSelect } from './OpenAIModelSelect';
import { Dialog, DialogButton, DialogToggle } from '../shared/Dialog';

interface PreferencePanelProps {
  onClose: () => void;
}
export const PreferencePanel: React.FC<PreferencePanelProps> = ({ onClose }) => {
  const inElectron = isElectron();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useEditorState();
  const dispatch = useEditorDispatch();
  const id = useId();
  const [translationProvider, setTranslationProvider] = useState<TranslationProvider>(
    settings.translation.provider,
  );
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.translation.openaiApiKey || '');
  const [googleApiKey, setGoogleApiKey] = useState(settings.translation.googleApiKey || '');
  const [openaiModel, setOpenaiModel] = useState(
    settings.translation.openaiModel || 'gpt-3.5-turbo',
  );
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState(settings.translation.openaiBaseUrl || '');
  const [googleBaseUrl, setGoogleBaseUrl] = useState(settings.translation.googleBaseUrl || '');
  const [autoTranslate, setAutoTranslate] = useState(settings.translation.autoTranslate || false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(settings.autoSave.enabled);
  const [autoSaveIntervalMinutes, setAutoSaveIntervalMinutes] = useState(
    Math.max(1, settings.autoSave.intervalMinutes || 1),
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!inElectron) throw new Error('Preferences are only available in Electron mode');
        const result = await loadPreferences();
        if (!active) return;
        if (!result.success || !result.data)
          throw new Error(result.error || 'Failed to load preferences');
        setPreferences(result.data);
        const translation = result.data.translation;
        if (translation) {
          setTranslationProvider(translation.provider);
          setOpenaiApiKey(translation.openaiApiKey || '');
          setGoogleApiKey(translation.googleApiKey || '');
          setOpenaiModel(translation.openaiModel || 'gpt-3.5-turbo');
          setOpenaiBaseUrl(translation.openaiBaseUrl || '');
          setGoogleBaseUrl(translation.googleBaseUrl || '');
          setAutoTranslate(translation.autoTranslate || false);
        }
        if (result.data.autoSave) {
          setAutoSaveEnabled(!!result.data.autoSave.enabled);
          setAutoSaveIntervalMinutes(
            Math.max(1, Number(result.data.autoSave.intervalMinutes || 1)),
          );
        }
      } catch (error) {
        if (active) setError(String(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [inElectron]);

  const handleSave = async () => {
    if (saving || loading || !preferences) return;
    setSaving(true);
    setError(null);
    const translation = {
      provider: translationProvider,
      openaiApiKey: openaiApiKey.trim() || undefined,
      googleApiKey: googleApiKey.trim() || undefined,
      openaiModel: openaiModel.trim() || 'gpt-3.5-turbo',
      openaiBaseUrl: openaiBaseUrl.trim() || undefined,
      googleBaseUrl: googleBaseUrl.trim() || undefined,
      autoTranslate,
    };
    const autoSave = {
      enabled: autoSaveEnabled,
      intervalMinutes: Math.max(1, Number(autoSaveIntervalMinutes || 1)),
    };
    try {
      // 先确认持久化成功，再同步运行设置；失败时保留草稿，可修改后重试。
      const result = await savePreferences({ ...preferences, translation, autoSave });
      if (!result.success) {
        setError(result.error || 'Failed to save preferences');
        return;
      }
      dispatch({ type: 'UPDATE_TRANSLATION_SETTINGS', payload: translation });
      dispatch({ type: 'UPDATE_AUTO_SAVE_SETTINGS', payload: autoSave });
      onClose();
    } catch (error) {
      setError(String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectDirectory = async () => {
    try {
      const result = await openDirectoryDialog();
      if (result && !result.canceled && result.filePath)
        setPreferences((prev) => (prev ? { ...prev, projectsDirectory: result.filePath! } : null));
    } catch (error) {
      setError(String(error));
    }
  };
  return (
    <Dialog
      title="Preferences"
      size="form"
      icon={<Settings size={16} />}
      busy={saving}
      onClose={onClose}
      onShortcut={(event) => {
        if (event.ctrlKey && event.key === 'Enter') {
          event.preventDefault();
          void handleSave();
        }
      }}
      footer={
        <>
          <DialogButton onClick={onClose} disabled={saving}>
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            onClick={handleSave}
            disabled={saving || loading || !preferences}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </DialogButton>
        </>
      }
    >
      {loading && <p className="dialog-help">Loading preferences...</p>}
      {preferences && (
        <>
          <section className="dialog-card">
            <label className="dialog-card-title" htmlFor={`${id}-directory`}>
              Projects Directory
            </label>
            <p className="dialog-card-description">Default location for new projects</p>
            <div className="dialog-row">
              <input
                id={`${id}-directory`}
                className="dialog-input ui-control"
                value={preferences.projectsDirectory}
                onChange={(event) =>
                  setPreferences({ ...preferences, projectsDirectory: event.target.value })
                }
              />
              <DialogButton
                onClick={handleSelectDirectory}
                title="Browse"
                aria-label="Browse projects directory"
              >
                <FolderOpen size={16} />
              </DialogButton>
            </div>
          </section>
          <section className="dialog-card dialog-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="dialog-card-title">Restore Last Project</div>
              <p className="dialog-help">
                Automatically load the last opened project when starting
              </p>
            </div>
            <DialogToggle
              label="Restore Last Project"
              checked={preferences.restoreLastProject}
              onChange={() =>
                setPreferences({
                  ...preferences,
                  restoreLastProject: !preferences.restoreLastProject,
                })
              }
            />
          </section>
          <section className="dialog-card">
            <div
              className="dialog-row"
              style={{ justifyContent: 'space-between', marginBottom: 12 }}
            >
              <div>
                <div className="dialog-card-title">Auto Save</div>
                <p className="dialog-help">
                  Automatically save current project changes at interval
                </p>
              </div>
              <DialogToggle
                label="Auto Save"
                checked={autoSaveEnabled}
                onChange={() => setAutoSaveEnabled(!autoSaveEnabled)}
              />
            </div>
            <label className="dialog-label" htmlFor={`${id}-interval`}>
              Interval (minutes)
            </label>
            <input
              id={`${id}-interval`}
              className="dialog-input ui-control"
              type="number"
              min={1}
              step={1}
              value={autoSaveIntervalMinutes}
              disabled={!autoSaveEnabled}
              onChange={(event) => {
                const next = Number(event.target.value);
                setAutoSaveIntervalMinutes(
                  Number.isFinite(next) ? Math.max(1, Math.floor(next)) : 1,
                );
              }}
            />
            <p className="dialog-help">Default interval is 1 minute.</p>
          </section>
          <section className="dialog-card">
            <div className="dialog-card-title">Translation Service</div>
            <p className="dialog-card-description">
              Configure AssetName auto-fill translation provider
            </p>
            <div className="dialog-field">
              <label className="dialog-label" htmlFor={`${id}-provider`}>
                Provider
              </label>
              <select
                id={`${id}-provider`}
                className="dialog-input ui-control"
                value={translationProvider}
                onChange={(event) =>
                  setTranslationProvider(event.target.value as TranslationProvider)
                }
              >
                <option value="local">Local Dictionary (Offline)</option>
                <option value="openai">OpenAI (Recommended)</option>
                <option value="google">Google Translate</option>
              </select>
            </div>
            {translationProvider === 'openai' && (
              <>
                <div className="dialog-field">
                  <label className="dialog-label" htmlFor={`${id}-openai-key`}>
                    OpenAI API Key
                  </label>
                  <input
                    id={`${id}-openai-key`}
                    className="dialog-input ui-control"
                    type="password"
                    value={openaiApiKey}
                    onChange={(event) => setOpenaiApiKey(event.target.value)}
                    placeholder="sk-..."
                  />
                </div>
                <div className="dialog-field">
                  <label className="dialog-label" htmlFor={`${id}-model`}>
                    Model
                  </label>
                  <OpenAIModelSelect
                    id={`${id}-model`}
                    className="dialog-input"
                    value={openaiModel}
                    onChange={setOpenaiModel}
                  />
                </div>
                <div className="dialog-field">
                  <label className="dialog-label" htmlFor={`${id}-openai-url`}>
                    Service Endpoint (Optional)
                  </label>
                  <input
                    id={`${id}-openai-url`}
                    className="dialog-input ui-control"
                    value={openaiBaseUrl}
                    onChange={(event) => setOpenaiBaseUrl(event.target.value)}
                    placeholder="https://api.openai.com/v1/chat/completions"
                  />
                </div>
                <p className="dialog-help">
                  ⚠️ Note: API calls will incur costs. Service endpoint can be a custom proxy;
                  leaving this blank uses the default.
                </p>
              </>
            )}
            {translationProvider === 'google' && (
              <>
                <div className="dialog-field">
                  <label className="dialog-label" htmlFor={`${id}-google-key`}>
                    Google Cloud API Key
                  </label>
                  <input
                    id={`${id}-google-key`}
                    className="dialog-input ui-control"
                    type="password"
                    value={googleApiKey}
                    onChange={(event) => setGoogleApiKey(event.target.value)}
                    placeholder="AIza..."
                  />
                </div>
                <div className="dialog-field">
                  <label className="dialog-label" htmlFor={`${id}-google-url`}>
                    API Base URL (Optional)
                  </label>
                  <input
                    id={`${id}-google-url`}
                    className="dialog-input ui-control"
                    value={googleBaseUrl}
                    onChange={(event) => setGoogleBaseUrl(event.target.value)}
                    placeholder="https://translation.googleapis.com"
                  />
                </div>
                <p className="dialog-help">
                  ⚠️ Note: Requires Google Cloud Translation API; leaving this blank uses the
                  default and automatically appends "/language/translate/v2".
                </p>
              </>
            )}
            {translationProvider === 'local' && (
              <p className="dialog-help">✓ Works offline, 150+ game terms included.</p>
            )}
            <div className="dialog-row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
              <div>
                <div className="dialog-card-title">Auto Translate AssetName</div>
                <p className="dialog-help">
                  Automatically translate name to AssetName when editing completes
                </p>
              </div>
              <DialogToggle
                label="Auto Translate AssetName"
                checked={autoTranslate}
                onChange={() => setAutoTranslate(!autoTranslate)}
              />
            </div>
          </section>
        </>
      )}
      {error && (
        <p role="alert" className="dialog-notice dialog-error">
          {error}
        </p>
      )}
    </Dialog>
  );
};
export default PreferencePanel;
