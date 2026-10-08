/**
 * components/Layout/HeaderDialogManager.tsx
 * Header 弹窗统一管理器 - 负责渲染和管理所有 Header 相关弹窗
 *
 * 管理的弹窗：
 * - NewProjectDialog: 新建工程
 * - ProjectSettingsDialog: 项目设置
 * - PreferencePanel: 用户偏好设置
 * 保存确认由共享项目会话状态驱动，Header 单独展示。
 */

import React from 'react';
import { ProjectMeta } from '../../types/project';
import { NewProjectDialog } from './NewProjectDialog';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';
import { PreferencePanel } from './PreferencePanel';
import type { SaveResult, SessionResult } from '../../services/projectSession';

// ========== 弹窗状态类型 ==========
export type HeaderDialogState =
  { type: 'none' } | { type: 'new-project' } | { type: 'settings' } | { type: 'preferences' };

// ========== 事件回调类型 ==========
export interface HeaderDialogCallbacks {
  onCreateProject: (name: string, description: string, location: string) => Promise<SessionResult>;
  onSaveSettings: (updates: Partial<ProjectMeta>) => Promise<SaveResult>;
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
  callbacks,
}) => {
  switch (dialog.type) {
    case 'new-project':
      return (
        <NewProjectDialog onConfirm={callbacks.onCreateProject} onCancel={callbacks.onClose} />
      );

    case 'settings':
      return (
        <ProjectSettingsDialog
          meta={projectMeta}
          onSave={callbacks.onSaveSettings}
          onCancel={callbacks.onClose}
        />
      );

    case 'preferences':
      return <PreferencePanel onClose={callbacks.onClose} />;

    default:
      return null;
  }
};

export default HeaderDialogManager;
