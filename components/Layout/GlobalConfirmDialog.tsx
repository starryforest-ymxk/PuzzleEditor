import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ConfirmDialog } from '../Inspector/ConfirmDialog';

const GlobalConfirmDialog: React.FC = () => {
    const { ui } = useEditorState();
    const dispatch = useEditorDispatch();
    const { isOpen, title, message, confirmAction, danger } = ui.confirmDialog;

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (confirmAction) {
            dispatch(confirmAction);
        }
        dispatch({ type: 'SET_CONFIRM_DIALOG', payload: { isOpen: false } });
    };

    const handleCancel = () => {
        dispatch({ type: 'SET_CONFIRM_DIALOG', payload: { isOpen: false } });
    };

    return (
        <ConfirmDialog
            title={title || 'Confirm'}
            message={message || 'Are you sure?'}
            confirmText={danger ? 'Delete' : 'Confirm'}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            references={ui.confirmDialog.references}
        />
    );
};

export default GlobalConfirmDialog;
