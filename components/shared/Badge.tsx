import React from 'react';
import './ui.css';

interface Props {
  text: string;
  color: string;
  background?: string;
  width?: number;
  compact?: boolean;
}
// 徽章的尺寸、描边与截断规则统一维护，语义色由调用方从 uiTokens 获取。
export const Badge: React.FC<Props> = ({ text, color, background, width, compact = false }) => (
  <span
    className={`ui-badge ${compact ? 'ui-badge--compact' : ''}`}
    style={{ color, borderColor: color, background, width }}
  >
    {text}
  </span>
);
