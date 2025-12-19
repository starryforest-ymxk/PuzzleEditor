import { useEffect, useRef } from 'react';
import { isElectron, loadPreferences, readProject } from '@/src/electron/api';
import { useProjectActions } from './useProjectActions';

/**
 * Hook to handle application startup logic
 * - Restores last opened project if 'restoreLastProject' preference is enabled
 */
export const useAppStartup = () => {
    const { loadProjectFromString, pushMessage } = useProjectActions();
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

                // Check if we should restore the last project
                if (prefs.restoreLastProject && prefs.lastProjectPath) {
                    const path = prefs.lastProjectPath;

                    // Try to read the project file
                    const projectResult = await readProject(path);

                    if (projectResult.success && projectResult.data) {
                        try {
                            // Load the project into the editor
                            console.log(`DEBUG: Restoring project from ${path}`);
                            // console.log(`DEBUG: Content preview:`, projectResult.data.substring(0, 50));

                            loadProjectFromString(projectResult.data, path);
                        } catch (e) {
                            console.error('Failed to parse last project file', e);
                            pushMessage('error', 'Failed to restore last session: Invalid file format');
                        }
                    } else {
                        // File might be missing or unreadable
                        console.warn(`Could not restore last project at ${path}:`, projectResult.error);
                        // Optional: Notify user, or just fail silently to default empty project
                        // pushMessage('warning', 'Could not restore last project: File not found');
                    }
                }
            } catch (error) {
                console.error('Error during app startup:', error);
            }
        };

        initApp();
    }, [loadProjectFromString, pushMessage]);
};
