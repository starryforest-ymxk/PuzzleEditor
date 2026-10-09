// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createDomEditBarrier } from '../../hooks/editBarrierDom';
import { registerEditGuard } from '../../services/editBarrier';

describe('C9 DOM 草稿与交互屏障', () => {
  it('非法数字不会被提前 blur，组合输入/指针/弹窗均标记 busy', () => {
    const barrier = createDomEditBarrier();
    const field = document.createElement('input');
    field.type = 'number';
    document.body.append(field);
    field.focus();
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(barrier.status()).toMatchObject({ pendingEdits: true, invalid: true });
    expect(document.activeElement).toBe(field);
    document.dispatchEvent(new Event('compositionstart'));
    expect(barrier.status().busy).toBe(true);
    document.dispatchEvent(new Event('compositionend'));
    expect(barrier.status().busy).toBe(false);
    document.dispatchEvent(new Event('pointerdown'));
    expect(barrier.status().busy).toBe(true);
    document.dispatchEvent(new Event('pointerup'));
    expect(barrier.status().busy).toBe(false);
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    document.body.append(modal);
    expect(barrier.status().busy).toBe(true);
    modal.remove();
    field.remove();
    expect(barrier.status().pendingEdits).toBe(false);
    barrier.dispose();
  });
  it('共用 blur fallback 提交后台字段，并清理 pending', () => {
    const barrier = createDomEditBarrier();
    const field = document.createElement('input');
    document.body.append(field);
    field.focus();
    field.blur = () => undefined;
    let count = 0;
    field.addEventListener('focusout', () => count++);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(barrier.status().pendingEdits).toBe(true);
    barrier.flush();
    expect(count).toBe(1);
    expect(barrier.status().pendingEdits).toBe(false);
    barrier.dispose();
    field.remove();
  });
  it('未聚焦字段的语义错误与跨事件连线由共同登记保留', () => {
    const barrier = createDomEditBarrier(),
      unregister = registerEditGuard({ pendingEdits: true, invalid: true, busy: true });
    expect(barrier.status()).toEqual({ pendingEdits: true, invalid: true, busy: true });
    unregister();
    expect(barrier.status()).toEqual({ pendingEdits: false, invalid: false, busy: false });
    barrier.dispose();
  });
});
