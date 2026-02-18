/**
 * hooks/usePushMessage.ts
 * 全局消息推送 Hook
 *
 * 职责：
 * 统一封装 ADD_MESSAGE dispatch 逻辑，避免在多个组件中重复定义 pushMessage 函数。
 * ID 生成包含随机后缀，防止快速连续操作时的 ID 冲突。
 */

import { useCallback } from 'react';
import { useEditorDispatch } from '../store/context';
import type { MessageLevel } from '../store/types';

/**
 * 返回一个 pushMessage 函数，用于向全局消息堆栈推送消息
 * @returns (level: MessageLevel, text: string) => void
 */
export function usePushMessage() {
    const dispatch = useEditorDispatch();

    // 生成唯一 ID：时间戳 + 随机后缀，避免并发冲突
    return useCallback((level: MessageLevel, text: string) => {
        const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        dispatch({
            type: 'ADD_MESSAGE',
            payload: { id, level, text, timestamp: new Date().toISOString() }
        });
    }, [dispatch]);
}
