/**
 * components/Layout/MessageStackPanel.tsx
 * 消息堆栈面板 - 从 Header 抽离的独立组件
 * 
 * 功能：
 * - 显示消息列表（按时间倒序）
 * - 支持按等级筛选消息（info/warning/error）
 * - 支持清空所有消息
 * - 点击外部自动关闭
 */

import React, { useEffect, useRef, useState } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { MessageLevel } from '../../store/types';
import { Info, AlertTriangle, XCircle } from 'lucide-react';

export interface LevelFilters {
    info: boolean;
    warning: boolean;
    error: boolean;
}

interface MessageStackPanelProps {
    isOpen: boolean;
    onClose: () => void;
    levelFilters: LevelFilters;
    onToggleLevel: (level: MessageLevel) => void;
}

export const MessageStackPanel: React.FC<MessageStackPanelProps> = ({
    isOpen,
    onClose,
    levelFilters,
    onToggleLevel
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

    // 按时间倒序排列消息，并根据筛选条件过滤
    const sortedMessages = [...ui.messages]
        .filter(msg => levelFilters[msg.level])
        .sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

    // 清空并关闭
    const handleClearAll = () => {
        dispatch({ type: 'CLEAR_MESSAGES' });
        onClose();
    };

    // 计算各等级消息数量
    const counts = {
        info: ui.messages.filter(m => m.level === 'info').length,
        warning: ui.messages.filter(m => m.level === 'warning').length,
        error: ui.messages.filter(m => m.level === 'error').length
    };

    return (
        <div ref={panelRef} className="message-stack-dropdown">
            <div className="message-stack-header">
                <span>Message Stack</span>
                <button className="btn-ghost" onClick={handleClearAll}>
                    Clear All
                </button>
            </div>

            {/* 消息等级筛选器 */}
            <div style={{
                display: 'flex',
                gap: '8px',
                padding: '8px 16px',
                borderBottom: '1px solid var(--border-color)',
                background: 'rgba(0,0,0,0.2)'
            }}>
                {/* Info 开关 */}
                <button
                    onClick={() => onToggleLevel('info')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        background: levelFilters.info ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                        color: levelFilters.info ? 'var(--accent-success)' : 'var(--text-dim)',
                        border: `1px solid ${levelFilters.info ? 'var(--accent-success)' : 'var(--border-color)'}`,
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                    title={levelFilters.info ? 'Hide info messages' : 'Show info messages'}
                >
                    <Info size={12} />
                    Info ({counts.info})
                </button>

                {/* Warning 开关 */}
                <button
                    onClick={() => onToggleLevel('warning')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        background: levelFilters.warning ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                        color: levelFilters.warning ? 'var(--accent-warning)' : 'var(--text-dim)',
                        border: `1px solid ${levelFilters.warning ? 'var(--accent-warning)' : 'var(--border-color)'}`,
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                    title={levelFilters.warning ? 'Hide warning messages' : 'Show warning messages'}
                >
                    <AlertTriangle size={12} />
                    Warning ({counts.warning})
                </button>

                {/* Error 开关 */}
                <button
                    onClick={() => onToggleLevel('error')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        background: levelFilters.error ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                        color: levelFilters.error ? 'var(--accent-error)' : 'var(--text-dim)',
                        border: `1px solid ${levelFilters.error ? 'var(--accent-error)' : 'var(--border-color)'}`,
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                    }}
                    title={levelFilters.error ? 'Hide error messages' : 'Show error messages'}
                >
                    <XCircle size={12} />
                    Error ({counts.error})
                </button>
            </div>

            {sortedMessages.length === 0 ? (
                <div className="message-empty">
                    {ui.messages.length === 0
                        ? 'No active messages'
                        : 'No messages match current filters'}
                </div>
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

