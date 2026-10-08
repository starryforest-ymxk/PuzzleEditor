import type { ControlStyle } from '../../shared/uiTokens';
/**
 * conditionStyles.ts - 条件编辑器样式常量
 * 集中管理 Condition Builder 相关的视觉样式
 */

import React from 'react';

/**
 * 不同逻辑块类型的视觉样式 - 工业复古主题
 */
export const BLOCK_STYLES = {
  And: {
    borderLeft: '4px solid #4ade80', // Green-400
    bg: 'rgba(74, 222, 128, 0.05)',
    labelColor: '#4ade80',
    labelBg: 'rgba(74, 222, 128, 0.12)',
  },
  Or: {
    borderLeft: '4px solid #f97316', // Orange-500
    bg: 'rgba(249, 115, 22, 0.05)',
    labelColor: 'var(--accent-color)',
    labelBg: 'rgba(249, 115, 22, 0.12)',
  },
  Not: {
    borderLeft: '4px solid #ef4444', // Red-500
    bg: 'rgba(239, 68, 68, 0.05)',
    labelColor: 'var(--accent-error)',
    labelBg: 'rgba(239, 68, 68, 0.12)',
  },
  Comparison: {
    borderLeft: '4px solid #3b82f6', // Blue-500
    bg: 'rgba(59, 130, 246, 0.05)',
    labelColor: '#3b82f6',
    labelBg: 'rgba(59, 130, 246, 0.12)',
  },
  ScriptRef: {
    borderLeft: '4px solid #a855f7', // Purple-500
    bg: 'rgba(168, 85, 247, 0.05)',
    labelColor: '#a855f7',
    labelBg: 'rgba(168, 85, 247, 0.12)',
  },
  DEFAULT: {
    borderLeft: '4px solid #71717a', // Zinc-500
    bg: 'rgba(113, 113, 122, 0.05)',
    labelColor: 'var(--text-secondary)',
    labelBg: 'rgba(113, 113, 122, 0.12)',
  },
} as const;

export type BlockStyleKey = keyof typeof BLOCK_STYLES;

/**
 * 样式对象接口
 */
export interface BlockStyle {
  borderLeft: string;
  bg: string;
  labelColor: string;
  labelBg: string;
}

/**
 * 获取条件类型对应的样式
 */
export const getBlockStyle = (type: string): BlockStyle => {
  // 1. 尝试直接匹配
  const exactMatch = BLOCK_STYLES[type as BlockStyleKey];
  if (exactMatch) return exactMatch;

  // 2. 尝试 PascalCase 转换 (兼容旧数据 and -> And)
  if (type && type.length > 0) {
    const normalized = (type.charAt(0).toUpperCase() +
      type.slice(1).toLowerCase()) as BlockStyleKey;
    const normalizedMatch = BLOCK_STYLES[normalized];
    if (normalizedMatch) return normalizedMatch;
  }

  // 3. 默认样式
  return BLOCK_STYLES.DEFAULT;
};

/**
 * 通用颜色常量
 */
export const COLORS = {
  // 背景色
  bgPrimary: 'var(--condition-bg)',
  bgSecondary: 'var(--panel-bg)',
  bgTertiary: 'var(--bg-color)',

  // 边框色
  borderPrimary: 'var(--panel-header-bg)',
  borderSecondary: 'var(--border-color)',

  // 文字色
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-dim)',
  textDisabled: 'var(--border-color)',

  // 强调色
  accent: 'var(--accent-color)',
  danger: 'var(--accent-error)',

  // 透明层
  overlayBg: 'rgba(0,0,0,0.55)',
  highlightBg: 'rgba(255,255,255,0.05)',
} as const;

/**
 * 通用按钮样式
 */
export const buttonStyles = {
  // 删除按钮基础样式
  deleteButton: {
    background: 'transparent',
    border: 'none',
    color: COLORS.textMuted,
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: 1,
    padding: '4px',
    transition: 'color 0.2s',
  } as React.CSSProperties,

  // 拖拽手柄样式
  dragHandle: {
    color: COLORS.textDisabled,
    fontSize: '12px',
    userSelect: 'none' as const,
  } as React.CSSProperties,
};

/**
 * 条件行容器样式
 */
export const conditionRowStyle = (style: BlockStyle): React.CSSProperties => ({
  padding: '8px 12px',
  backgroundColor: style.bg,
  borderLeft: style.borderLeft,
  borderRadius: '0 4px 4px 0',
  fontSize: '12px',
  position: 'relative',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
});

/**
 * 类型标签 Chip 样式
 */
export const typeChipStyle = (style: BlockStyle): React.CSSProperties => ({
  fontSize: '10px',
  fontWeight: 700,
  color: style.labelColor,
  background: style.labelBg,
  padding: '2px 6px',
  borderRadius: '3px',
  letterSpacing: '0.5px',
});

/**
 * 类型选择下拉框样式 (合并了 Chip 的视觉风格)
 */
/**
 * 标准输入控件高度 (与 LogicModeButton 视觉对齐)
 */
export const INPUT_HEIGHT = 26;

/**
 * 行间距（控件行之间的垂直间隔）
 */
export const ROW_GAP = 8;

/**
 * 类型选择下拉框样式 (合并了 Chip 的视觉风格)
 */
export const typeSelectStyle = (style: BlockStyle): ControlStyle => ({
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  height: INPUT_HEIGHT,
  cursor: 'pointer',
  textAlign: 'left',
  textAlignLast: 'left',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0,
  maxWidth: '100%',
  backgroundImage: 'none',
  '--control-color': style.labelColor,
  '--control-border': style.labelColor,
});

/**
 * 下拉选择器基础样式
 */
export const selectStyle: React.CSSProperties = { cursor: 'pointer' };

/**
 * 操作符选择器样式
 */
export const operatorSelectStyle: ControlStyle = {
  cursor: 'pointer',
  '--control-color': COLORS.accent,
};
