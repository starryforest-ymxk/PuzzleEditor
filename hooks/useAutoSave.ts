import { useEffect, useRef } from 'react';
import { isElectron } from '@/src/electron/api';
import { useEditorState } from '../store/context';
import { useProjectActions } from './useProjectActions';

/**
 * 自动保存 Hook
 * - 仅在 Electron 环境生效
 * - 仅在项目已加载且存在未保存修改时触发
 * - 使用单飞锁避免并发写入
 */
export const useAutoSave = () => {
    const { project, ui, runtime, settings } = useEditorState();
    const { saveProject } = useProjectActions();
    const savingRef = useRef(false);

    useEffect(() => {
        if (!isElectron()) return;
        if (!settings.autoSave.enabled) return;

        // 保护：自动保存最小间隔为 1 分钟
        const intervalMinutes = Math.max(1, Number(settings.autoSave.intervalMinutes || 1));
        const intervalMs = intervalMinutes * 60 * 1000;

        const timerId = window.setInterval(async () => {
            // 只有在项目已加载、存在文件路径且有脏数据时才执行自动保存
            if (!project.isLoaded || !runtime.currentProjectPath || !ui.isDirty) {
                return;
            }

            // 单飞保护，避免慢盘情况下重叠写入
            if (savingRef.current) {
                return;
            }

            savingRef.current = true;
            try {
                await saveProject({ silent: true });
            } finally {
                savingRef.current = false;
            }
        }, intervalMs);

        return () => {
            window.clearInterval(timerId);
        };
    }, [
        project.isLoaded,
        runtime.currentProjectPath,
        ui.isDirty,
        settings.autoSave.enabled,
        settings.autoSave.intervalMinutes,
        saveProject
    ]);
};

export default useAutoSave;
