import { useEffect } from 'react';
import { useEditorDispatch } from '../store/context';
import { isElectron, readProject, onProjectFileChanged } from '@/src/electron/api';
import { ProjectFile } from '../types/project';

/**
 * Hook: 监听外部文件变化并同步资源状态
 */
export const useFileWatcher = () => {
    const dispatch = useEditorDispatch();

    useEffect(() => {
        // 仅在 Electron 环境下生效
        if (!isElectron()) return;

        console.log('[useFileWatcher] Initializing file watcher listener');

        // 订阅文件变更事件
        const unsubscribe = onProjectFileChanged(async (event) => {
            if (event.type === 'change') {
                console.log('[useFileWatcher] File changed detected:', event.path);

                try {
                    // 读取最新文件内容
                    const result = await readProject(event.path);
                    if (result.success && result.data) {
                        // 解析项目文件
                        const projectFile = JSON.parse(result.data) as ProjectFile;

                        // 1. 同步资源状态 (仅合并状态字段)
                        dispatch({
                            type: 'SYNC_RESOURCE_STATES',
                            payload: projectFile.project
                        });

                        // 2. 添加日志消息 (Info 级别，静默提示)
                        dispatch({
                            type: 'ADD_MESSAGE',
                            payload: {
                                id: crypto.randomUUID(),
                                text: 'Project resources synchronized from external changes.',
                                level: 'info',
                                timestamp: Date.now()
                            }
                        });
                    } else {
                        console.error('[useFileWatcher] Failed to read project file:', result.error);
                    }
                } catch (error) {
                    console.error('[useFileWatcher] Error syncing project:', error);
                    dispatch({
                        type: 'ADD_MESSAGE',
                        payload: {
                            id: crypto.randomUUID(),
                            text: 'Failed to synchronize external changes.',
                            level: 'error',
                            timestamp: Date.now()
                        }
                    });
                }
            }
        });

        return () => {
            unsubscribe();
        };
    }, [dispatch]);
};
