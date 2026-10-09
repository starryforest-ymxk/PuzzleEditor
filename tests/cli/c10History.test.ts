/** 独立 CLI 进程经过真实认证管道操作共同 Store；文件 IO 另由桌面包验收。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { startSessionServer } from '../../dist-node/sessionTransport.js';
import { OnlineSession } from '../../services/onlineSession';
import { setup, id } from '../services/onlineSessionHarness';
import { runCli } from './processHarness';

let directory: string;
let server: Awaited<ReturnType<typeof startSessionServer>>;
let s: ReturnType<typeof setup>;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'puzzle C10 中文 '));
  vi.stubEnv('PUZZLE_EDITOR_SESSION_DIR', join(directory, 'sessions'));
  s = setup();
  let online: OnlineSession;
  server = await startSessionServer((instance, request) =>
    (online ??= new OnlineSession(s.store, s.session, s.barrier, instance)).handle(request),
  );
});
afterEach(async () => {
  await server?.close();
  vi.unstubAllEnvs();
});
const target = () => ['--instance', server.instanceId, '--session', '0'];
const run = (args: string[]) => runCli(directory, args);
const history = async () => (await run(['history', 'list', ...target()])).result.data;
const human = (name: string) =>
  s.store.dispatch({ type: 'UPDATE_PROJECT_META', payload: { name } });
async function mutation(direction = 'undo') {
  const data = await history(),
    path = join(directory, randomUUID() + '.json');
  await writeFile(path, JSON.stringify(data.token));
  return [
    'history',
    direction,
    ...target(),
    '--token',
    path,
    '--entry-id',
    (direction === 'undo' ? data.history.undoEntryId : data.history.redoEntryId) ?? '0:999',
    '--request-id',
    id(),
  ];
}

describe.skipIf(process.platform !== 'win32')('C10 真实 CLI 历史契约', () => {
  it('describe 暴露 22 个入口和严格历史字段、聊天声明及协议', async () => {
    const { result } = await run(['describe']);
    expect(result.data.phase).toBe('C10');
    expect(result.data.capabilities).toHaveLength(22);
    expect(result.data.sessionRules[0]).toContain('protocol 2');
    const undo = result.data.capabilities.find(
      (x: { operation: string }) => x.operation === 'history undo',
    );
    expect(undo.inputSchema.required).toEqual(
      expect.arrayContaining(['instance', 'session', 'token', 'entryId', 'requestId']),
    );
    expect(undo.inputSchema.additionalProperties).toBe(false);
    expect(undo.conditionalCapabilities).toContain('permanent_resource_delete');
    expect(undo.cliVerifiesChatAuthorization).toBe(false);
  });
  it('真实 CLI Undo/Redo、同 ID 重试与 GUI 条目身份一致', async () => {
    human('A');
    human('B');
    const before = await history(),
      undo = await mutation();
    const a = await run(undo);
    expect(a.code).toBe(0);
    expect(a.result.data.status).toBe('undone');
    expect(s.store.getState().project.meta.name).toBe('A');
    expect((await run(undo)).result.data).toEqual(a.result.data);
    expect((await history()).history.redoEntryId).toBe(before.history.undoEntryId);
    expect((await run(await mutation('redo'))).code).toBe(0);
    expect(s.store.getState().project.meta.name).toBe('B');
    expect(s.session.savePolicy().autoSaveBlocked).toBe(true);
    expect(s.platform.write).not.toHaveBeenCalled();
  }, 15000);
  it('缺参数、重复参数、任意路径和多条/跳过选项在传输前拒绝', async () => {
    human('A');
    const before = s.store.getState(),
      valid = await mutation();
    for (const args of [
      ['history', 'list'],
      ['history', 'undo', ...target()],
      ['history', 'list', ...target(), 'unrelated.puzzle.json'],
      [...valid, '--count', '2'],
      [...valid, '--force'],
      [...valid, '--entry-id', '0:1'],
      [...valid, '--path', 'x'],
    ])
      expect((await run(args)).code).toBe(2);
    expect(s.store.getState()).toBe(before);
  }, 15000);
  it('错误顶部和被修改的 token 失败且内容保持，空栈如实报告', async () => {
    expect((await run(await mutation())).result.error.code).toBe('HISTORY_EMPTY');
    human('A');
    const args = await mutation(),
      before = s.store.getState();
    args[args.indexOf('--entry-id') + 1] = '0:999';
    expect((await run(args)).result.error.code).toBe('HISTORY_CONFLICT');
    const path = args[args.indexOf('--token') + 1],
      token = JSON.parse(await readFile(path, 'utf8'));
    await writeFile(path, JSON.stringify({ ...token, contentEpoch: token.contentEpoch + 1 }));
    args[args.indexOf('--request-id') + 1] = id();
    expect((await run(args)).result.error.code).toBe('SESSION_CONFLICT');
    expect(s.store.getState()).toBe(before);
  }, 15000);
  it('C9 协议登记明确不兼容，不删除登记或尝试写入', async () => {
    const old = randomUUID(),
      path = join(directory, 'sessions', old + '.json');
    const bytes = JSON.stringify({
      protocol: 1,
      instanceId: old,
      secret: 'a'.repeat(64),
      pid: process.pid,
    });
    await writeFile(path, bytes);
    const list = await run(['session', 'list']);
    expect(
      list.result.data.sessions.find((x: { instanceId: string }) => x.instanceId === old).error
        .code,
    ).toBe('SESSION_PROTOCOL_MISMATCH');
    expect(
      (await run(['history', 'list', '--instance', old, '--session', '0'])).result.error.code,
    ).toBe('SESSION_PROTOCOL_MISMATCH');
    expect(await readFile(path, 'utf8')).toBe(bytes);
    expect(s.platform.write).not.toHaveBeenCalled();
  }, 15000);
  it('历史实际永久删除检查声明，许可与 requestId 指纹独立', async () => {
    s.store.dispatch({
      type: 'ADD_EVENT',
      payload: { event: { id: 'new', name: 'New', assetName: 'New', state: 'Implemented' } },
    });
    const args = await mutation();
    expect((await run(args)).code).toBe(6);
    expect((await run([...args, '--allow-permanent-delete'])).result.error.code).toBe(
      'REQUEST_ID_CONFLICT',
    );
    args[args.indexOf('--request-id') + 1] = id();
    expect((await run([...args, '--allow-permanent-delete'])).code).toBe(0);
    expect(s.store.getState().history).toEqual({ past: [], future: [] });
  }, 15000);
});
