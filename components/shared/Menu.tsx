import { useLayerDismissal } from './useLayerDismissal';
import React, { useRef } from 'react';
import './ui.css';

interface MenuSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
  consumeOutside?: boolean;
  submenu?: boolean;
  boundaryRef?: React.RefObject<HTMLDivElement | null>;
}

// 菜单只负责外壳和关闭/键盘交互；定位坐标及业务动作由调用方提供。
export const MenuSurface: React.FC<MenuSurfaceProps> = ({
  children,
  onClose,
  consumeOutside = false,
  submenu = false,
  boundaryRef,
  className = '',
  onKeyDown,
  ...props
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayerDismissal({ layerRef: ref, boundaryRef, onClose, enabled: !submenu, consumeOutside });

  return (
    <div
      {...props}
      ref={ref}
      role="menu"
      className={`ui-menu canvas-context-menu ${className}`}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
          return;
        // 仅遍历当前层，避免方向键误进入子菜单或禁用项。
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
        ).filter(
          (item) =>
            item.closest('[role="menu"]') === event.currentTarget &&
            item.getAttribute('aria-disabled') !== 'true',
        );
        if (!items.length) return;
        event.preventDefault();
        event.stopPropagation();
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : index < 0
                ? event.key === 'ArrowUp'
                  ? items.length - 1
                  : 0
                : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
        items[next].focus();
      }}
    >
      {children}
    </div>
  );
};

interface MenuItemProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'button' | 'div';
  danger?: boolean;
  disabled?: boolean;
}
export const MenuItem: React.FC<MenuItemProps> = ({
  as = 'button',
  danger = false,
  disabled = false,
  className = '',
  onClick,
  onKeyDown,
  ...props
}) => {
  const Element = as;
  return (
    <Element
      {...props}
      {...(as === 'button' ? { type: 'button' as const, disabled } : {})}
      role="menuitem"
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className={`ui-menu-item ${danger ? 'ui-menu-item--danger' : ''} ${className}`}
      onClick={(event) => {
        if (!disabled) onClick?.(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          as === 'div' &&
          !disabled &&
          !event.defaultPrevented &&
          event.target === event.currentTarget &&
          ['Enter', ' '].includes(event.key)
        ) {
          event.preventDefault();
          event.currentTarget.click();
        }
      }}
    />
  );
};

export const MenuSeparator: React.FC = () => <div className="ui-menu-separator" role="separator" />;
