/** 主进程只路由白名单请求到登记窗口的主框架；业务和保存权限留在应用层。 */
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'node:crypto';
import {
  startSessionServer,
  validSessionPayload,
  SESSION_MAX_BYTES,
  type SessionResponse,
} from '../dist-node/sessionTransport.js';
import { IPC_CHANNELS } from './types.js';

interface Target {
  window: BrowserWindow;
  url: string;
  generation: number;
  server?: Awaited<ReturnType<typeof startSessionServer>>;
  pending: Map<
    string,
    { resolve: (value: SessionResponse) => void; reject: (error: Error) => void }
  >;
}
const targets = new Map<number, Target>();
let installed = false;
const baseURL = (url: string) => url.split('#')[0];
function owner(event: IpcMainInvokeEvent): Target {
  const target = targets.get(event.sender.id);
  if (
    !target ||
    event.senderFrame !== event.sender.mainFrame ||
    baseURL(event.senderFrame.url) !== target.url
  )
    throw new Error('Online operations require the registered editor main frame.');
  return target;
}
async function stop(target: Target) {
  target.generation++;
  const server = target.server;
  target.server = undefined;
  for (const pending of target.pending.values())
    pending.reject(new Error('Editor session ended; result may be unknown.'));
  target.pending.clear();
  await server?.close();
}
export function registerSessionBridge(window: BrowserWindow, url: string): void {
  const target: Target = { window, url: baseURL(url), generation: 0, pending: new Map() };
  const id = window.webContents.id;
  targets.set(id, target);
  window.webContents.on('did-start-navigation', (_event, _url, _inPlace, mainFrame) => {
    if (mainFrame) void stop(target);
  });
  window.once('closed', () => {
    targets.delete(id);
    void stop(target);
  });
  if (installed) return;
  installed = true;
  ipcMain.handle(IPC_CHANNELS.SESSION_START, async (event) => {
    const current = owner(event);
    const stopping = stop(current);
    const generation = current.generation;
    await stopping;
    if (generation !== current.generation)
      return { success: false, error: 'A newer editor registration replaced this request.' };
    try {
      const server = await startSessionServer(
        (instanceId, request) =>
          new Promise<SessionResponse>((resolve, reject) => {
            if (
              current.generation !== generation ||
              current.window.isDestroyed() ||
              !validSessionPayload(request)
            ) {
              reject(new Error('Session ended.'));
              return;
            }
            if (current.pending.size >= 32) {
              reject(new Error('Session busy.'));
              return;
            }
            const requestId = randomUUID();
            const timer = setTimeout(() => {
              current.pending.delete(requestId);
              reject(new Error('Renderer response timed out.'));
            }, 25000);
            current.pending.set(requestId, {
              resolve: (value) => {
                clearTimeout(timer);
                resolve(value);
              },
              reject: (error) => {
                clearTimeout(timer);
                reject(error);
              },
            });
            current.window.webContents.send(IPC_CHANNELS.SESSION_REQUEST, {
              instanceId,
              requestId,
              request,
            });
          }),
      );
      if (current.generation !== generation || current.window.isDestroyed()) {
        await server.close();
        return { success: false, error: 'Editor session changed during registration.' };
      }
      current.server = server;
      return { success: true, data: server.instanceId };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle(IPC_CHANNELS.SESSION_STOP, async (event, instanceId: unknown) => {
    const current = owner(event);
    if (instanceId === current.server?.instanceId) await stop(current);
  });
  ipcMain.handle(
    IPC_CHANNELS.SESSION_RESPONSE,
    (event, instanceId: unknown, requestId: unknown, response: unknown) => {
      const current = owner(event);
      if (instanceId !== current.server?.instanceId || typeof requestId !== 'string')
        throw new Error('Unexpected session response identity.');
      const pending = current.pending.get(requestId);
      if (!pending) return;
      if (
        !response ||
        typeof response !== 'object' ||
        !('ok' in response) ||
        typeof response.ok !== 'boolean' ||
        Buffer.byteLength(JSON.stringify(response)) > SESSION_MAX_BYTES
      )
        throw new Error('Invalid session response.');
      current.pending.delete(requestId);
      pending.resolve(response as SessionResponse);
    },
  );
}
