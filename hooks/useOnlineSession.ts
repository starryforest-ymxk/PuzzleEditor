import { useEffect } from 'react';
import type { EditorStore } from '../store/editorStore';
import type { ProjectSession } from '../services/projectSession';
import { OnlineSession } from '../services/onlineSession';
import { createDomEditBarrier } from './editBarrierDom';

/** Provider 只装配生命周期；无桌面桥的浏览器保持现有行为。 */
export function useOnlineSession(store: EditorStore, session: ProjectSession): void {
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.startOnlineSession || !api.onOnlineSessionRequest || !api.respondOnlineSession)
      return;
    let alive = true,
      online: OnlineSession | undefined,
      instance: string | undefined;
    const barrier = createDomEditBarrier();
    const stop = api.onOnlineSessionRequest((event) => {
      if (!alive || !online || event.instanceId !== instance) return;
      void online
        .handle(event.request)
        .then((response) => api.respondOnlineSession!(event.instanceId, event.requestId, response))
        .catch(() => undefined);
    });
    void api
      .startOnlineSession()
      .then((result) => {
        if (!alive) {
          if (result.data) void api.stopOnlineSession?.(result.data);
          return;
        }
        if (result.success && result.data) {
          instance = result.data;
          online = new OnlineSession(store, session, barrier, instance);
        } else
          session.pushMessage(
            'warning',
            `Online CLI session unavailable: ${result.error ?? 'Unknown error'}`,
          );
      })
      .catch((error) => {
        if (alive)
          session.pushMessage('warning', `Online CLI session unavailable: ${String(error)}`);
      });
    return () => {
      alive = false;
      stop();
      barrier.dispose();
      if (instance) void api.stopOnlineSession?.(instance).catch(() => undefined);
    };
  }, [store, session]);
}
