import { flushSync } from 'react-dom';
import { editGuardState, type EditBarrier } from '../services/editBarrier';

/** 原生关闭与在线编辑共用；后台窗口也必须发送 React 使用的 focusout。 */
export function flushActiveField(): void {
  flushSync(() => {
    const field = document.activeElement;
    if (!(field instanceof HTMLElement)) return;
    let committed = false;
    const markBlur = () => {
      committed = true;
    };
    field.addEventListener('focusout', markBlur);
    try {
      field.blur();
      if (!committed) field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    } finally {
      field.removeEventListener('focusout', markBlur);
    }
  });
}
export function createDomEditBarrier(): EditBarrier & { dispose(): void } {
  let pointer = false,
    dragging = false,
    composing = false;
  const dirty = new Set<EventTarget>();
  const lifetime = new AbortController();
  const on = (name: string, fn: (event: Event) => void) =>
    document.addEventListener(name, fn, { capture: true, signal: lifetime.signal });
  on('input', (e) => {
    if (e.target) dirty.add(e.target);
  });
  on('focusout', (e) => {
    if (e.target) dirty.delete(e.target);
  });
  on('pointerdown', () => {
    pointer = true;
  });
  on('pointerup', () => {
    pointer = false;
  });
  on('pointercancel', () => {
    pointer = false;
  });
  on('dragstart', () => {
    dragging = true;
  });
  on('dragend', () => {
    dragging = false;
    pointer = false;
  });
  on('drop', () => {
    dragging = false;
    pointer = false;
  });
  on('compositionstart', () => {
    composing = true;
  });
  on('compositionend', () => {
    composing = false;
  });
  return {
    status: () => {
      for (const field of dirty)
        if (field instanceof Element && !field.isConnected) dirty.delete(field);
      const guard = editGuardState();
      const invalid = [...dirty].some(
        (field) =>
          field instanceof HTMLInputElement &&
          (!field.validity.valid || (field.type === 'number' && field.value === '')),
      );
      return {
        pendingEdits: guard.pendingEdits || dirty.size > 0,
        invalid: guard.invalid || invalid,
        busy:
          guard.busy ||
          pointer ||
          dragging ||
          composing ||
          Boolean(document.querySelector('[role="dialog"]')),
      };
    },
    flush: flushActiveField,
    dispose: () => lifetime.abort(),
  };
}
