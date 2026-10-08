import '../shared/ui.css';
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
  compact?: boolean;
}

// 提示外观统一由 ui.css 管理，调用方仅指定语义等级与布局。
export const InspectorInfo: React.FC<InspectorInfoProps> = ({
  level,
  message,
  showIcon = true,
  style,
  className = '',
  compact = false,
}) => (
  <div
    className={'ui-notice ' + (compact ? 'ui-notice--compact ' : '') + className}
    data-level={level}
    style={style}
  >
    {showIcon && <span>{level === 'info' ? 'ℹ' : level === 'warning' ? '⚠' : '✕'}</span>}
    <span>{message}</span>
  </div>
);

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
