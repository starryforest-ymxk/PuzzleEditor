/** 删除确认保留引用预览；默认取消焦点和基础交互统一由 Dialog 维护。 */
import React from 'react';
import { Dialog, DialogButton } from '../shared/Dialog';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  references?: string[];
}
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  references,
}) => (
  <Dialog
    title={title}
    tone="danger"
    onClose={onCancel}
    footer={
      <>
        <DialogButton onClick={onCancel}>{cancelText}</DialogButton>
        <DialogButton variant="danger" onClick={onConfirm}>
          {confirmText}
        </DialogButton>
      </>
    }
  >
    <p className="dialog-message">{message}</p>
    {!!references?.length && (
      <div className="dialog-card dialog-references" style={{ marginTop: 16, marginBottom: 0 }}>
        <div className="dialog-help">References Found ({references.length}):</div>
        {references.map((reference, index) => (
          <div key={index}>• {reference}</div>
        ))}
      </div>
    )}
  </Dialog>
);
export default ConfirmDialog;
