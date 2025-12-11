/**
 * components/Blackboard/SectionHeader.tsx
 * 可折叠分区头部组件 - 用于 Blackboard 面板中的分区展开/折叠控制
 */

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

// ========== 组件 Props ==========

interface SectionHeaderProps {
    /** 分区标题 */
    title: string;
    /** 分区内项目数量 */
    count: number;
    /** 是否展开 */
    expanded: boolean;
    /** 点击切换展开/折叠的回调 */
    onToggle: () => void;
    /** 层级 (default: 1) */
    level?: number;
}

// ========== 组件 ==========

/**
 * 可折叠分区头部组件
 * 显示分区标题、项目数量，支持点击展开/折叠
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
    title,
    count,
    expanded,
    onToggle,
    level = 1
}) => {
    const isChild = level > 1;

    return (
        <div
            onClick={onToggle}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                cursor: 'pointer',
                background: isChild ? 'var(--panel-bg)' : 'var(--panel-header-bg)',
                borderBottom: isChild ? 'none' : '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '4px', // Reduced margin for tighter tree feel
                marginTop: isChild ? '0' : '4px',
                userSelect: 'none',
            }}
        >
            {/* 左侧：展开图标 + 标题 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                }}>
                    {title}
                </span>
            </div>

            {/* 右侧：数量徽章 */}
            <span style={{
                fontSize: '10px',
                color: 'var(--text-dim)',
                background: isChild ? 'var(--bg-color-hover)' : 'var(--bg-color)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)'
            }}>
                {count}
            </span>
        </div>
    );
};

export default SectionHeader;
