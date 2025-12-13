/**
 * components/Inspector/InspectorInfo.tsx
 * Inspector 面板通用信息提示组件
 * 支持三种等级：info（蓝色）、warning（橙色）、error（红色）
 */

import React from 'react';

// ========== 类型定义 ==========

/** 提示等级类型 */
export type InfoLevel = 'info' | 'warning' | 'error';

interface InspectorInfoProps {
    /** 提示等级 */
    level: InfoLevel;
    /** 提示信息 */
    message: string;
    /** 是否显示图标，默认为 true */
    showIcon?: boolean;
    /** 自定义样式 */
    style?: React.CSSProperties;
    /** 自定义类名 */
    className?: string;
}

// ========== 样式配置 ==========

/** 根据等级获取对应的颜色配置 */
const getLevelStyles = (level: InfoLevel) => {
    switch (level) {
        case 'info':
            return {
                color: '#3b82f6',        // 蓝色文字
                bgColor: 'rgba(59, 130, 246, 0.1)',   // 蓝色背景
                borderColor: 'rgba(59, 130, 246, 0.3)',  // 蓝色边框
                icon: 'ℹ'  // 信息图标
            };
        case 'warning':
            return {
                color: '#f97316',        // 橙色文字
                bgColor: 'rgba(249, 115, 22, 0.1)',   // 橙色背景
                borderColor: 'rgba(249, 115, 22, 0.3)',  // 橙色边框
                icon: '⚠'  // 警告图标
            };
        case 'error':
            return {
                color: '#ef4444',        // 红色文字
                bgColor: 'rgba(239, 68, 68, 0.1)',   // 红色背景
                borderColor: 'rgba(239, 68, 68, 0.3)',  // 红色边框
                icon: '✕'  // 错误图标
            };
        default:
            return {
                color: '#888',
                bgColor: 'rgba(128, 128, 128, 0.1)',
                borderColor: 'rgba(128, 128, 128, 0.3)',
                icon: 'ℹ'
            };
    }
};

// ========== 组件实现 ==========

/**
 * Inspector 通用信息提示组件
 * 用于在 Inspector 面板中显示 info、warning 或 error 级别的提示信息
 */
export const InspectorInfo: React.FC<InspectorInfoProps> = ({
    level,
    message,
    showIcon = true,
    style,
    className
}) => {
    const levelStyles = getLevelStyles(level);

    return (
        <div
            className={className}
            style={{
                color: levelStyles.color,
                fontSize: '11px',
                padding: '12px',
                textAlign: 'center',
                background: levelStyles.bgColor,
                border: `1px solid ${levelStyles.borderColor}`,
                borderRadius: '4px',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                ...style
            }}
        >
            {showIcon && <span>{levelStyles.icon}</span>}
            <span>{message}</span>
        </div>
    );
};

// ========== 便捷组件 ==========

/** Info 级别提示（蓝色） */
export const InspectorInfoTip: React.FC<Omit<InspectorInfoProps, 'level'>> = (props) => (
    <InspectorInfo level="info" {...props} />
);

/** Warning 级别提示（橙色） */
export const InspectorWarning: React.FC<Omit<InspectorInfoProps, 'level'>> = (props) => (
    <InspectorInfo level="warning" {...props} />
);

/** Error 级别提示（红色） */
export const InspectorError: React.FC<Omit<InspectorInfoProps, 'level'>> = (props) => (
    <InspectorInfo level="error" {...props} />
);
