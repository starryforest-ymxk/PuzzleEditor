import { useEffect } from 'react';
import { useProjectSession } from '../store/context';
import { isElectron, onProjectFileChanged } from '../platform/electron';

/** 监听只转交事件；路径、会话检查和读取顺序统一由协调器管理。 */
export const useFileWatcher = () => {
    const session = useProjectSession();
    useEffect(() => {
        if (!isElectron()) return;
        return onProjectFileChanged(event => {
            if (event.type === 'change') void session.syncExternal(event.path);
        });
    }, [session]);
};
