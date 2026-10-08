import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

// 菜单与选择器共享关闭规则；子菜单交给父层处理，避免一次 Escape 重复回调。
export function useLayerDismissal({
  layerRef,
  boundaryRef,
  onClose,
  enabled = true,
  consumeOutside = false,
}: {
  layerRef: RefObject<HTMLDivElement | null>;
  boundaryRef?: RefObject<HTMLDivElement | null>;
  onClose?: () => void;
  enabled?: boolean;
  consumeOutside?: boolean;
}) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!enabled) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const outside = (event: MouseEvent) => {
      if (
        layerRef.current?.contains(event.target as Node) ||
        boundaryRef?.current?.contains(event.target as Node)
      )
        return;
      closeRef.current?.();
      if (consumeOutside) event.stopPropagation();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const anchor = boundaryRef?.current?.querySelector<HTMLElement>('button');
      (anchor || (previousFocus?.isConnected ? previousFocus : null))?.focus();
      closeRef.current?.();
      event.stopPropagation();
    };
    window.addEventListener('mousedown', outside, true);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('mousedown', outside, true);
      window.removeEventListener('keydown', escape);
    };
  }, [boundaryRef, consumeOutside, enabled, layerRef]);
}
