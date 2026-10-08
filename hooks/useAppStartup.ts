import { useEffect, useRef } from 'react';
import { isElectron, loadPreferences } from '../platform/electron';
import { useEditorDispatch, useProjectSession } from '../store/context';

/** 启动恢复使用初始化时的令牌，不覆盖等待期间发生的手动项目操作。 */
export const useAppStartup = () => {
    const session = useProjectSession();
    const dispatch = useEditorDispatch();
    const initialized = useRef(false);
    useEffect(() => {
        if (!isElectron() || initialized.current) return;
        initialized.current = true;
        const token = session.captureStartup();
        const initialize = async () => {
            try {
                const result = await loadPreferences();
                if (!result.success || !result.data) throw new Error(result.error || 'Preferences unavailable');
                const prefs = result.data;
                if (prefs.translation) dispatch({ type: 'UPDATE_TRANSLATION_SETTINGS', payload: prefs.translation });
                if (prefs.autoSave) dispatch({ type: 'UPDATE_AUTO_SAVE_SETTINGS', payload: {
                    enabled: !!prefs.autoSave.enabled, intervalMinutes: Math.max(1, Number(prefs.autoSave.intervalMinutes || 1))
                } });
                if (prefs.messageFilters) dispatch({ type: 'UPDATE_MESSAGE_FILTERS', payload: prefs.messageFilters });
                if (prefs.restoreLastProject && prefs.lastProjectPath) await session.restoreProject(prefs.lastProjectPath, token);
            } catch (error) { session.pushMessage('error', 'Startup failed: ' + String(error)); }
            finally { dispatch({ type: 'SET_PREFERENCES_LOADED', payload: true }); }
        };
        void initialize();
    }, [dispatch, session]);
};
