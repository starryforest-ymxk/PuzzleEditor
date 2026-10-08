import type {
  ResourceState,
  VariableScope,
  VariableType,
  ScriptCategory,
} from '../../types/common';
import type { CSSProperties } from 'react';

// 控件允许通过语义变量指定颜色；禁止在业务层复制完整输入框样式。
export type ControlStyle = CSSProperties & {
  '--control-color'?: string;
  '--control-border'?: string;
};

// 语义颜色只能在这里映射；具体色值由 theme.css 单独维护。
export const variableTypeColor = (type: VariableType | string): string =>
  `var(--variable-${['boolean', 'integer', 'float', 'string'].includes(type) ? type : 'unknown'})`;

export const variableScopeColor = (scope: VariableScope): string => `var(--scope-${scope})`;
export const scriptCategoryColor = (category: ScriptCategory): string =>
  `var(--resource-${category.toLowerCase()})`;

export const resourceStateColor = (state: ResourceState): { bg: string; color: string } => ({
  bg: `var(--state-${state}-bg)`,
  color: `var(--state-${state})`,
});

export const uiColors = {
  bg: 'var(--bg-color)',
  bgInput: 'var(--panel-bg)',
  border: 'var(--border-color)',
  accent: 'var(--accent-color)',
  text: 'var(--text-primary)',
  textDim: 'var(--text-secondary)',
  hover: 'var(--panel-header-bg)',
  selected: 'var(--selection-bg)',
} as const;
