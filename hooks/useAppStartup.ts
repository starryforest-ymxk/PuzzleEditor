import { useEffect, useRef } from 'react';
import { isElectron, loadPreferences, readProject, updateRecentProject } from '@/src/electron/api';
import { useProjectActions } from './useProjectActions';
import { useEditorDispatch } from '../store/context';

/**
 * Hook to handle application startup logic
 * - Restores last opened project if 'restoreLastProject' preference is enabled
 */
export const useAppStartup = () => {
    const { loadProjectFromString, pushMessage } = useProjectActions();
    const dispatch = useEditorDispatch();
    const initialized = useRef(false);

    useEffect(() => {
        if (!isElectron() || initialized.current) return;

        const initApp = async () => {
            initialized.current = true;

            try {
                // Load preferences
                const prefsResult = await loadPreferences();
                if (!prefsResult.success || !prefsResult.data) {
                    console.warn('Failed to load preferences on startup');
                    return;
                }


                const prefs = prefsResult.data;

                // Restore translation settings if available
                if (prefs.translation) {
                    dispatch({
                        type: 'UPDATE_TRANSLATION_SETTINGS',
                        payload: prefs.translation
                    });
                    console.log('Restored translation settings from preferences');
                }

                // Restore auto-save settings if available
                if (prefs.autoSave) {
                    dispatch({
                        type: 'UPDATE_AUTO_SAVE_SETTINGS',
                        payload: {
                            enabled: !!prefs.autoSave.enabled,
                            intervalMinutes: Math.max(1, Number(prefs.autoSave.intervalMinutes || 1))
                        }
                    });
                }

                // Restore message filters if available
                if (prefs.messageFilters) {
                    dispatch({
                        type: 'UPDATE_MESSAGE_FILTERS',
                        payload: prefs.messageFilters
                    });
                }

                // Check if we should restore the last project
                if (prefs.restoreLastProject && prefs.lastProjectPath) {
                    const path = prefs.lastProjectPath;

                    // Try to read the project file
                    const projectResult = await readProject(path);

                    if (projectResult.success && projectResult.data) {
                        try {
                            // Load the project into the editor
                            console.log(`DEBUG: Restoring project from ${path}`);

                            const projectData = JSON.parse(projectResult.data);
                            const projectName = projectData?.project?.meta?.name || 'Unknown Project';

                            // 更新最近打开时间
                            await updateRecentProject(path, projectName);

                            loadProjectFromString(projectResult.data, path);
                        } catch (e) {
                            console.error('Failed to parse last project file', e);
                            pushMessage('error', 'Failed to restore last session: Invalid file format');
                        }
                    } else {
                        // 文件可能丢失或无法读取，向用户显示警告
                        console.warn(`Could not restore last project at ${path}:`, projectResult.error);
                        pushMessage('warning', `Could not restore last project: ${projectResult.error || 'File not found'}`);
                    }
                }
            } catch (error) {
                console.error('Error during app startup:', error);
            }
        };

        initApp();
    }, [loadProjectFromString, pushMessage]);
};
