/**
 * components/Layout/MessageStackPanel.tsx
 * 消息堆栈面板 - 从 Header 抽离的独立组件
 * 
 * 功能：
 * - 显示消息列表（按时间倒序）
 * - 支持清空所有消息
 * - 点击外部自动关闭
 */

import React, { useEffect, useRef } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';

interface MessageStackPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const MessageStackPanel: React.FC<MessageStackPanelProps> = ({
    isOpen,
    onClose
}) => {
    const { ui } = useEditorState();
    const dispatch = useEditorDispatch();
    const panelRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭面板
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // 忽略点击消息按钮本身
            if (target.closest('[data-messages-button]')) return;
            // 忽略点击面板内部
            if (panelRef.current?.contains(target)) return;
            onClose();
        };

        // 延迟添加监听，避免同一次点击触发关闭
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // 按时间倒序排列消息
    const sortedMessages = [...ui.messages].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // 清空并关闭
    const handleClearAll = () => {
        dispatch({ type: 'CLEAR_MESSAGES' });
        onClose();
    };

    return (
        <div ref={panelRef} className="message-stack-dropdown">
            <div className="message-stack-header">
                <span>Message Stack</span>
                <button className="btn-ghost" onClick={handleClearAll}>
                    Clear All
                </button>
            </div>

            {sortedMessages.length === 0 ? (
                <div className="message-empty">No active messages</div>
            ) : (
                sortedMessages.map(msg => (
                    <div key={msg.id} className={`message-item ${msg.level}`}>
                        <div className="message-meta">
                            <span className={`message-level ${msg.level}`}>{msg.level}</span>
                            <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="message-text">{msg.text}</div>
                    </div>
                ))
            )}
        </div>
    );
};

export default MessageStackPanel;
