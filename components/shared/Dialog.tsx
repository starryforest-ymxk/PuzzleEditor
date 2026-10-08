import React, { useLayoutEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import './dialog.css';

interface DialogEntry {
  overlay: HTMLDivElement;
  panel: HTMLDivElement;
  focus: () => void;
}

// Portal 共用一个栈：嵌套保存确认必须独占键盘，下层表单草稿继续保留。
const dialogs: DialogEntry[] = [];
const backgroundInert = new Map<HTMLElement, boolean>();
const topDialog = () => dialogs[dialogs.length - 1];
function syncStack() {
  if (dialogs.length && !backgroundInert.size) {
    for (const element of document.body.children) {
      if (element instanceof HTMLElement && !element.classList.contains('dialog-overlay')) {
        backgroundInert.set(element, element.hasAttribute('inert'));
        element.setAttribute('inert', '');
      }
    }
  }
  dialogs.forEach((entry, index) => {
    const top = entry === topDialog();
    entry.overlay.toggleAttribute('inert', !top);
    entry.overlay.setAttribute('aria-hidden', String(!top));
    entry.panel.setAttribute('aria-modal', String(top));
    entry.overlay.style.zIndex = String(10000 + index);
  });
  if (!dialogs.length) {
    backgroundInert.forEach((inert, element) => {
      element.toggleAttribute('inert', inert);
    });
    backgroundInert.clear();
  }
}

function focusable(panel: HTMLElement) {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex]',
    ),
  )
    .filter(
      (element) =>
        element.tabIndex >= 0 &&
        !element.closest('[hidden], [inert]') &&
        getComputedStyle(element).display !== 'none' &&
        getComputedStyle(element).visibility !== 'hidden',
    )
    .sort((first, second) =>
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
}

interface DialogProps {
  title: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'warning' | 'danger';
  size?: 'confirm' | 'form';
  busy?: boolean;
  onClose: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  selectInitial?: boolean;
  onShortcut?: (event: React.KeyboardEvent) => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function Dialog({
  title,
  icon,
  tone = 'default',
  size = 'confirm',
  busy = false,
  onClose,
  initialFocusRef,
  selectInitial = false,
  onShortcut,
  children,
  footer,
}: DialogProps) {
  const overlay = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const entry = useRef<DialogEntry | null>(null);
  const options = useRef({ busy, onClose, initialFocusRef, selectInitial, onShortcut });
  const titleId = useId();
  // 最新回调不重建栈，输入或保存状态变化不会抢走其他弹窗的焦点。
  useLayoutEffect(() => {
    options.current = { busy, onClose, initialFocusRef, selectInitial, onShortcut };
  });
  useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const current: DialogEntry = {
      overlay: overlay.current!,
      panel: panel.current!,
      focus: () => {
        const opts = options.current;
        const target = opts.busy
          ? current.panel
          : (opts.initialFocusRef?.current ?? focusable(current.panel)[0] ?? current.panel);
        target.focus();
        if (opts.selectInitial && target instanceof HTMLInputElement && !opts.busy) target.select();
      },
    };
    entry.current = current;
    dialogs.push(current);
    syncStack();
    current.focus();
    const containFocus = (event: FocusEvent) => {
      if (
        topDialog() === current &&
        event.target instanceof Node &&
        !current.panel.contains(event.target)
      )
        current.focus();
    };
    document.addEventListener('focusin', containFocus);
    return () => {
      document.removeEventListener('focusin', containFocus);
      const wasTop = topDialog() === current;
      dialogs.splice(dialogs.indexOf(current), 1);
      syncStack();
      // 只在顶层退出时恢复焦点；同时退出的下层弹窗不能干扰仍存在的确认框。
      if (wasTop) {
        const top = topDialog();
        if (
          previous?.isConnected &&
          !previous.closest('[inert]') &&
          !previous.matches(':disabled') &&
          (!top || top.panel.contains(previous))
        )
          previous.focus();
        else top?.focus();
      }
    };
  }, []);
  useLayoutEffect(() => {
    if (entry.current === topDialog()) entry.current?.focus();
  }, [busy]);

  return createPortal(
    <div
      ref={overlay}
      className="dialog-overlay"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (entry.current !== topDialog()) return;
        const opts = options.current;
        if (event.key === 'Escape') {
          event.preventDefault();
          if (!opts.busy) opts.onClose();
        } else if (event.key === 'Tab') {
          const targets = focusable(panel.current!);
          const first = targets[0],
            last = targets[targets.length - 1];
          if (!first) {
            event.preventDefault();
            panel.current?.focus();
          } else if (
            event.shiftKey &&
            (document.activeElement === first || document.activeElement === panel.current)
          ) {
            event.preventDefault();
            last.focus();
          } else if (
            !event.shiftKey &&
            (document.activeElement === last || document.activeElement === panel.current)
          ) {
            event.preventDefault();
            first.focus();
          }
        } else if (!opts.busy) opts.onShortcut?.(event);
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-label={title}
        aria-labelledby={titleId}
        aria-modal="true"
        aria-busy={busy}
        tabIndex={-1}
        className={`dialog dialog--${size} dialog--${tone}`}
      >
        <h2 id={titleId} className="dialog-title">
          {icon}
          {title}
        </h2>
        <div className="dialog-body">
          <fieldset className="dialog-content" disabled={busy}>
            {children}
          </fieldset>
        </div>
        <div className="dialog-actions">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}

type DialogButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'secondary' | 'primary' | 'success' | 'danger' | 'danger-outline';
};
export function DialogButton({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}: DialogButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`dialog-button dialog-button--${variant} ${className}`}
    />
  );
}

export function DialogToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      className="dialog-toggle"
      onClick={onChange}
    >
      <span />
    </button>
  );
}
