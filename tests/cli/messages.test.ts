/** 编译后的独立 CLI 经真实认证管道读 Store，旧桌面显式拒绝。 */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { startSessionServer } from '../../dist-node/sessionTransport.js';
import { OnlineSession } from '../../services/onlineSession';
import { setup } from '../services/onlineSessionHarness';
import { runCli } from './processHarness';
let directory: string;
let server: Awaited<ReturnType<typeof startSessionServer>>;
let s: ReturnType<typeof setup>;
let legacy = false;
let requests: string[];
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'puzzle-message-cli 中文 '));
  vi.stubEnv('PUZZLE_EDITOR_SESSION_DIR', join(directory, 'sessions'));
  s = setup();
  legacy = false;
  requests = [];
  let online: OnlineSession;
  server = await startSessionServer(async (instance, input) => {
    const request = input as { operation: string };
    requests.push(request.operation);
    const result = await (online ??= new OnlineSession(
      s.store,
      s.session,
      s.barrier,
      instance,
    )).handle(input);
    if (
      legacy &&
      result.data &&
      typeof result.data === 'object' &&
      'supportedFeatures' in result.data
    )
      delete result.data.supportedFeatures;
    return result;
  });
});
afterEach(async () => {
  await server?.close();
  vi.unstubAllEnvs();
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('puzzle-message-cli '))
    throw new Error('Unsafe cleanup');
  await rm(target, { recursive: true, force: true });
});
const args = () => ['session', 'messages', '--instance', server.instanceId, '--session', '0'];
describe.skipIf(process.platform !== 'win32')('真实 CLI 消息栈只读', () => {
  it('完整、过滤及分页读取不改变工程；历史 error 仍是成功读取', async () => {
    for (const [id, level] of [
      ['one', 'info'],
      ['two', 'warning'],
      ['three', 'error'],
    ] as const)
      s.store.dispatch({
        type: 'ADD_MESSAGE',
        payload: { id, level, text: 'Original ' + id, timestamp: '2026-10-12T00:00:00Z' },
      });
    const state = s.store.getState(),
      token = await s.token();
    const first = await runCli(directory, [...args(), '--limit', '1']);
    expect(first.code, JSON.stringify(first.result)).toBe(0);
    expect(first.result.data.result.messages[0].id).toBe('one');
    const next = await runCli(directory, [
      ...args(),
      '--cursor',
      first.result.data.result.nextCursor,
    ]);
    expect(next.result.data.result.messages.map((m: { id: string }) => m.id)).toEqual([
      'two',
      'three',
    ]);
    const filtered = await runCli(directory, [...args(), '--level', 'error']);
    expect(filtered.code).toBe(0);
    expect(filtered.result.data.result.messages[0].level).toBe('error');
    expect(s.store.getState()).toBe(state);
    expect(await s.token()).toEqual(token);
    expect(s.barrier.flush).not.toHaveBeenCalled();
    expect(s.platform.write).not.toHaveBeenCalled();
  }, 15000);
  it('旧桌面不发送新操作，返回不支持能力而非空消息', async () => {
    legacy = true;
    const result = await runCli(directory, args());
    expect(result.code).toBe(4);
    expect(result.result.error.code).toBe('UNSUPPORTED_SESSION_CAPABILITY');
    expect(requests).toEqual(['status']);
    expect(s.barrier.flush).not.toHaveBeenCalled();
  }, 15000);
  it('缺少目标或越界 limit 在 IO 前拒绝，清空使真实 CLI 游标失效', async () => {
    expect((await runCli(directory, ['session', 'messages'])).code).toBe(2);
    expect((await runCli(directory, [...args(), '--limit', '201'])).code).toBe(2);
    expect(requests).toEqual([]);
    for (const id of ['one', 'two'])
      s.store.dispatch({
        type: 'ADD_MESSAGE',
        payload: { id, level: 'info', text: id, timestamp: '2026-10-12T00:00:00Z' },
      });
    const result = await runCli(directory, [...args(), '--limit', '1']);
    s.store.dispatch({ type: 'CLEAR_MESSAGES' });
    const stale = await runCli(directory, [
      ...args(),
      '--cursor',
      result.result.data.result.nextCursor,
    ]);
    expect(stale.result.error.code).toBe('MESSAGE_CURSOR_EXPIRED');
  }, 15000);
});
