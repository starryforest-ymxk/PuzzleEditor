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
        // 禁用原生按钮不执行自己的监听器，父行也必须拒绝其内部图标的冒泡。
        const action =
          event.target instanceof globalThis.Element && event.target.closest('.ui-menu-action');
        if (!disabled && !action) onClick?.(event);
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

// 将滚动限制在菜单列表内，外部定位桥接和底部动作不参与滚动。
export const MenuScrollArea: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...props
}) => <div {...props} className={`ui-menu-scroll-area ${className}`} />;

interface MenuItemTextProps {
  children: React.ReactNode;
  description?: React.ReactNode;
}

export const MenuItemText: React.FC<MenuItemTextProps> = ({ children, description }) => (
  <div className="ui-menu-item-text">
    <div className="ui-menu-item-text__label">{children}</div>
    {description != null && <div className="ui-menu-item-text__description">{description}</div>}
  </div>
);

interface MenuActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  danger?: boolean;
}

// 行尾动作独立于父行：删除/清理只触发自己的回调，不误打开对应项目。
export const MenuActionButton: React.FC<MenuActionButtonProps> = ({
  label,
  danger = false,
  className = '',
  onClick,
  ...props
}) => (
  <button
    {...props}
    type="button"
    aria-label={label}
    title={props.title ?? label}
    className={`ui-menu-action ${danger ? 'ui-menu-action--danger' : ''} ${className}`}
    onClick={(event) => {
      event.stopPropagation();
      if (!props.disabled) onClick?.(event);
    }}
  />
);
