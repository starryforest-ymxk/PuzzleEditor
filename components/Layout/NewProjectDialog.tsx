/** 新建项目保留 Session 结果处理，外观与焦点统一使用 Dialog。 */
import React, { useState, useRef, useEffect, useId } from 'react';
import { FolderOpen } from 'lucide-react';
import { isElectron, loadPreferences, openDirectoryDialog } from '@/platform/electron';
import type { SessionResult } from '../../services/projectSession';
import { Dialog, DialogButton } from '../shared/Dialog';

interface NewProjectDialogProps {
  onConfirm: (name: string, description: string, location: string) => Promise<SessionResult>;
  onCancel: () => void;
}
export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({ onConfirm, onCancel }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('New Project');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [defaultLocation, setDefaultLocation] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    let active = true;
    if (isElectron())
      void loadPreferences()
        .then((result) => {
          if (active && result.success && result.data)
            setDefaultLocation(result.data.projectsDirectory);
        })
        .catch((error) => {
          if (active) setError(String(error));
        });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await onConfirm(
        name.trim(),
        description.trim(),
        location.trim() || defaultLocation,
      );
      if (result.status === 'failed') setError(result.error);
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(false);
    }
  };
  const handleSelectLocation = async () => {
    try {
      const result = await openDirectoryDialog();
      if (result && !result.canceled && result.filePath) setLocation(result.filePath);
    } catch (error) {
      setError(String(error));
    }
  };

  return (
    <Dialog
      title="Create New Project"
      size="form"
      busy={busy}
      onClose={onCancel}
      initialFocusRef={nameInputRef}
      selectInitial
      onShortcut={(event) => {
        // 描述中的 Enter 保持换行，名称与目录保留 Enter 创建。
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          void handleSubmit();
        }
      }}
      footer={
        <>
          <DialogButton disabled={busy} onClick={onCancel}>
            Cancel
          </DialogButton>
          <DialogButton variant="primary" disabled={busy || !name.trim()} onClick={handleSubmit}>
            {busy ? 'Creating...' : 'Create Project'}
          </DialogButton>
        </>
      }
    >
      <div className="dialog-field">
        <label className="dialog-label" htmlFor={`${id}-name`}>
          Project Name *
        </label>
        <input
          id={`${id}-name`}
          className="dialog-input ui-control"
          ref={nameInputRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="dialog-field">
        <label className="dialog-label" htmlFor={`${id}-description`}>
          Description
        </label>
        <textarea
          id={`${id}-description`}
          className="dialog-input ui-control"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Enter project description"
        />
      </div>
      {isElectron() && (
        <div className="dialog-field">
          <label className="dialog-label" htmlFor={`${id}-location`}>
            Location
          </label>
          <div className="dialog-row">
            <input
              id={`${id}-location`}
              className="dialog-input ui-control"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder={defaultLocation || 'Use default projects directory'}
            />
            <DialogButton
              onClick={handleSelectLocation}
              title="Browse"
              aria-label="Browse project location"
            >
              <FolderOpen size={16} />
            </DialogButton>
          </div>
          <p className="dialog-help">Leave empty to use default: {defaultLocation || 'Not set'}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="dialog-notice dialog-error">
          {error}
        </p>
      )}
    </Dialog>
  );
};
export default NewProjectDialog;
