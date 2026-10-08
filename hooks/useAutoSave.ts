import { useEffect } from 'react';
import { useEditorState, useProjectSession } from '../store/context';
import { scheduleAutoSave } from '../services/autoSaveScheduler';

/** 稳定定时器调用共享队列，手动保存和持续编辑不会重置周期。 */
export const useAutoSave = () => {
    const { settings } = useEditorState();
    const session = useProjectSession();
    useEffect(() => {
        if (!settings.autoSave.enabled) return;
        return scheduleAutoSave(session.autoSave, settings.autoSave.intervalMinutes);
    }, [session, settings.autoSave.enabled, settings.autoSave.intervalMinutes]);
};
export default useAutoSave;
