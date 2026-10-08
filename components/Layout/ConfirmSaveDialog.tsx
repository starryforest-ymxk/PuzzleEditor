/** 未保存确认只负责业务文案与选择，焦点和外观由共享弹窗维护。 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogButton } from '../shared/Dialog';

interface ConfirmSaveDialogProps {
  busy?: boolean;
  message?: string;
  desktop?: boolean;
  nextAction: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}
export const ConfirmSaveDialog: React.FC<ConfirmSaveDialogProps> = ({
  nextAction,
  onSave,
  onDiscard,
  onCancel,
  busy = false,
  message,
  desktop = true,
}) => {
  const closing = nextAction === 'close the editor';
  return (
    <Dialog
      title={busy ? 'Please wait' : 'Unsaved Changes'}
      tone="warning"
      icon={<AlertTriangle size={16} />}
      busy={busy}
      onClose={onCancel}
      footer={
        <>
          <DialogButton onClick={onCancel} disabled={busy}>
            Cancel
          </DialogButton>
          <DialogButton variant="danger-outline" onClick={onDiscard} disabled={busy}>
            {closing ? 'Discard & Close' : 'Discard'}
          </DialogButton>
          <DialogButton variant="success" onClick={onSave} disabled={busy}>
            {busy
              ? 'Working...'
              : desktop
                ? closing
                  ? 'Save & Close'
                  : 'Save & Continue'
                : 'Download Copy'}
          </DialogButton>
        </>
      }
    >
      <p className="dialog-message">
        {busy
          ? closing
            ? 'Finishing the project operation before closing. Please wait.'
            : 'Finishing the project operation. Your current project is kept until it completes.'
          : `You have unsaved changes. What would you like to do before you ${nextAction}?`}
      </p>
      {!desktop && !busy && (
        <p>
          Downloading a copy keeps the unsaved status. Choose Discard to continue after keeping your
          copy.
        </p>
      )}
      {message && (
        <p role="alert" className="dialog-notice">
          {message}
        </p>
      )}
    </Dialog>
  );
};
export default ConfirmSaveDialog;
