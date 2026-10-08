/** 项目元信息与导出配置继续由 Session 保存，统一使用共享表单弹窗。 */
import React, { useState, useRef, useEffect, useId } from 'react';
import { FolderOpen } from 'lucide-react';
import { ProjectMeta } from '../../types/project';
import { isElectron, openDirectoryDialog } from '@/platform/electron';
import type { SaveResult } from '../../services/projectSession';
import { Dialog, DialogButton } from '../shared/Dialog';

interface ProjectSettingsDialogProps {
  meta: ProjectMeta;
  onSave: (updates: Partial<ProjectMeta>) => Promise<SaveResult>;
  onCancel: () => void;
}
export const ProjectSettingsDialog: React.FC<ProjectSettingsDialogProps> = ({
  meta,
  onSave,
  onCancel,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(meta.name);
  const [description, setDescription] = useState(meta.description || '');
  const [version, setVersion] = useState(meta.version);
  const [exportPath, setExportPath] = useState(meta.exportPath || '');
  const [exportFileName, setExportFileName] = useState(meta.exportFileName || '');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    setName(meta.name);
    setDescription(meta.description || '');
    setVersion(meta.version);
    setExportPath(meta.exportPath || '');
    setExportFileName(meta.exportFileName || '');
  }, [meta]);

  const handleSubmit = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await onSave({
        name: name.trim(),
        description: description.trim(),
        version: version.trim() || '1.0.0',
        exportPath: exportPath.trim() || undefined,
        exportFileName: exportFileName.trim() || undefined,
      });
      if (result.status === 'failed') setError(result.error);
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(false);
    }
  };
  const handleSelectExportPath = async () => {
    try {
      const result = await openDirectoryDialog();
      if (result && !result.canceled && result.filePath) setExportPath(result.filePath);
    } catch (error) {
      setError(String(error));
    }
  };
  const formatDate = (value: string) => (value ? new Date(value).toLocaleString() : '-');

  return (
    <Dialog
      title="Project Settings"
      size="form"
      busy={busy}
      onClose={onCancel}
      initialFocusRef={nameInputRef}
      selectInitial
      onShortcut={(event) => {
        if (event.key === 'Enter' && event.ctrlKey) {
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
            {busy ? 'Saving...' : 'Save Changes'}
          </DialogButton>
        </>
      }
    >
      <div className="dialog-card" style={{ fontSize: 12 }}>
        <div>
          ID: <span style={{ fontFamily: 'monospace' }}>{meta.id || '-'}</span>
        </div>
        <div>Created: {formatDate(meta.createdAt)}</div>
        <div>Updated: {formatDate(meta.updatedAt)}</div>
      </div>
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
        <label className="dialog-label" htmlFor={`${id}-version`}>
          Version
        </label>
        <input
          id={`${id}-version`}
          className="dialog-input ui-control"
          style={{ width: 120 }}
          value={version}
          onChange={(event) => setVersion(event.target.value)}
          placeholder="1.0.0"
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
          <label className="dialog-label" htmlFor={`${id}-export-path`}>
            Export Path
          </label>
          <div className="dialog-row">
            <input
              id={`${id}-export-path`}
              className="dialog-input ui-control"
              value={exportPath}
              onChange={(event) => setExportPath(event.target.value)}
              placeholder="Use default export directory"
            />
            <DialogButton
              onClick={handleSelectExportPath}
              title="Browse"
              aria-label="Browse export directory"
            >
              <FolderOpen size={16} />
            </DialogButton>
          </div>
          <p className="dialog-help">
            Leave empty to use default export directory from Preferences
          </p>
        </div>
      )}
      <div className="dialog-field">
        <label className="dialog-label" htmlFor={`${id}-export-name`}>
          Export File Name
        </label>
        <input
          id={`${id}-export-name`}
          className="dialog-input ui-control"
          value={exportFileName}
          onChange={(event) => setExportFileName(event.target.value)}
          placeholder={`${name || 'project'}.export`}
        />
        <p className="dialog-help">Leave empty to use default: {'<project_name>.export.json'}</p>
      </div>
      <p className="dialog-help">Saving settings also saves all current project changes.</p>
      {error && (
        <p role="alert" className="dialog-notice dialog-error">
          {error}
        </p>
      )}
    </Dialog>
  );
};
export default ProjectSettingsDialog;
