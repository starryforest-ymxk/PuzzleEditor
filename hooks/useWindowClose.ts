import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { isElectron, onWindowCloseRequested, resolveWindowClose } from '../platform/electron';
import { useProjectSession } from '../store/context';

/** 只在应用根部注册；原生 X/Alt+F4 不一定触发 DOM blur，先提交当前字段草稿。 */
export function useWindowClose(): void {
  const session = useProjectSession();
  useEffect(() => {
    if (!isElectron()) return;
    const lifetime = new AbortController();
    let pending = false;
    const stop = onWindowCloseRequested((requestId) => {
      if (pending) return;
      pending = true;
      void (async () => {
        let approved = false;
        try {
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
              // 后台窗口的 blur 可能不派发 DOM 事件；React onBlur 依赖 focusout。
              if (!committed) field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
            } finally {
              field.removeEventListener('focusout', markBlur);
            }
          });
          approved = await session.requestClose(
            () => resolveWindowClose(requestId, true),
            lifetime.signal,
          );
        } catch (error) {
          session.pushMessage('error', `Unable to close the editor: ${String(error)}`);
        } finally {
          try {
            if (!approved) await resolveWindowClose(requestId, false);
          } catch (error) {
            session.pushMessage('error', `Unable to cancel the close request: ${String(error)}`);
          }
          pending = false;
        }
      })();
    });
    return () => {
      lifetime.abort();
      stop();
    };
  }, [session]);
}
