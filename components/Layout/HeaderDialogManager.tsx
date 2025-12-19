/**
 * components/Layout/HeaderDialogManager.tsx
 * Header 弹窗统一管理器 - 负责渲染和管理所有 Header 相关弹窗
 * 
 * 管理的弹窗：
 * - NewProjectDialog: 新建工程
 * - ProjectSettingsDialog: 项目设置
 * - ConfirmSaveDialog: 保存确认
 */

import React from 'react';
import { ProjectMeta } from '../../types/project';
import { NewProjectDialog } from './NewProjectDialog';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';
import { ConfirmSaveDialog } from './ConfirmSaveDialog';

// ========== 弹窗状态类型 ==========
export type HeaderDialogState =
    | { type: 'none' }
    | { type: 'new-project' }
    | { type: 'settings' }
    | { type: 'confirm-save'; nextAction: 'new' | 'load' };

// ========== 事件回调类型 ==========
export interface HeaderDialogCallbacks {
    onCreateProject: (name: string, description: string) => void;
    onSaveSettings: (updates: Partial<ProjectMeta>) => void;
    onConfirmSave: () => void;
    onConfirmDiscard: () => void;
    onClose: () => void;
}

interface HeaderDialogManagerProps {
    dialog: HeaderDialogState;
    projectMeta: ProjectMeta;
    callbacks: HeaderDialogCallbacks;
}

export const HeaderDialogManager: React.FC<HeaderDialogManagerProps> = ({
    dialog,
    projectMeta,
    callbacks
}) => {
    switch (dialog.type) {
        case 'new-project':
            return (
                <NewProjectDialog
                    onConfirm={callbacks.onCreateProject}
                    onCancel={callbacks.onClose}
                />
            );

        case 'settings':
            return (
                <ProjectSettingsDialog
                    meta={projectMeta}
                    onSave={callbacks.onSaveSettings}
                    onCancel={callbacks.onClose}
                />
            );

        case 'confirm-save':
            return (
                <ConfirmSaveDialog
                    nextAction={dialog.nextAction === 'new' ? 'create a new project' : 'load another project'}
                    onSave={callbacks.onConfirmSave}
                    onDiscard={callbacks.onConfirmDiscard}
                    onCancel={callbacks.onClose}
                />
            );

        default:
            return null;
    }
};

export default HeaderDialogManager;
