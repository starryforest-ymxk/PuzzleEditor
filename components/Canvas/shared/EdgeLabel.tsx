import React from 'react';
import { Vector2 } from '../../../types/common';
import '../../shared/ui.css';

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  position: Vector2;
  selected: boolean;
  contextTarget: boolean;
  hasError?: boolean;
}

// 标签外观只维护一份；路径、锚点和端点手柄继续由画布业务组件计算。
export const EdgeLabel: React.FC<Props> = ({
  position,
  selected,
  contextTarget,
  hasError = false,
  children,
  ...props
}) => (
  <div
    {...props}
    className="ui-edge-label"
    data-tone={hasError ? 'error' : contextTarget ? 'warning' : selected ? 'selected' : 'default'}
    style={{ left: position.x, top: position.y }}
  >
    {hasError && <span>⚠</span>}
    {children}
  </div>
);
