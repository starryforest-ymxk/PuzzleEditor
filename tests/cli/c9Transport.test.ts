import { SESSION_PROTOCOL } from '../../dist-node/sessionTransport.js';
/** 真实 Windows 管道及 CLI 子进程，所有登记/权限探测均在独立临时目录。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  discoverSessions,
  requestSession,
  startSessionServer,
} from '../../dist-node/sessionTransport.js';
import { runCli } from './processHarness';
import { verifySessionDirectory } from '../../dist-node/sessionSecurity.js';
let directory: string;
const servers: Awaited<ReturnType<typeof startSessionServer>>[] = [];
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'puzzle C9 中文 '));
  vi.stubEnv('PUZZLE_EDITOR_SESSION_DIR', join(directory, 'sessions'));
});
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
  vi.unstubAllEnvs();
});
const serve = async () => {
  const handler = vi.fn(async (instanceId: string, request: unknown) => ({
    ok: true,
    data: { instanceId, request },
    diagnostics: [],
  }));
  const server = await startSessionServer(handler);
  servers.push(server);
  return { ...server, handler };
};
describe.skipIf(process.platform !== 'win32')('C9 当前用户发现、认证与命令行', () => {
  it('并发发布/清理临时文件不被误判为权限异常，实际 ACL 仍逐项验证', async () => {
    await verifySessionDirectory(true);
    let running = true;
    const churn = (async () => {
      while (running) {
        for (let i = 0; i < 32; i++)
          await writeFile(join(directory, 'sessions', `temporary-${i}.tmp`), '{}');
        for (let i = 0; i < 32; i++)
          await unlink(join(directory, 'sessions', `temporary-${i}.tmp`));
      }
    })();
    try {
      for (let i = 0; i < 4; i++)
        expect(await verifySessionDirectory()).toBe(join(directory, 'sessions'));
    } finally {
      running = false;
      await churn;
    }
  }, 15000);
  it('没有桌面实例时返回空列表，不建立目录', async () => {
    const result = await runCli(directory, ['session', 'list']);
    expect(result.code).toBe(0);
    expect(result.result.data.sessions).toEqual([]);
    expect(await readdir(directory)).toEqual([]);
  });
  it('两个实例分别可发现，CLI 必须提供明确实例和会话', async () => {
    const a = await serve(),
      b = await serve();
    const list = await runCli(directory, ['session', 'list']);
    expect(list.code).toBe(0);
    expect(list.result.data.sessions).toHaveLength(2);
    const read = await runCli(directory, [
      'session',
      'status',
      '--instance',
      a.instanceId,
      '--session',
      '7',
    ]);
    expect(read.result.data.request).toEqual({ operation: 'status', sessionId: 7 });
    expect(b.handler.mock.calls).toHaveLength(1);
    expect((await runCli(directory, ['session', 'status'])).code).toBe(2);
  }, 15000);
  it('认证前或错误签名不调用业务处理器', async () => {
    const server = await serve();
    await new Promise<void>((resolve, reject) => {
      const socket = createConnection('\\\\.\\pipe\\puzzle-editor-session-v1-' + server.instanceId);
      socket.once('error', reject);
      socket.once('close', () => resolve());
      socket.once('data', (data) => {
        const hello = JSON.parse(data.toString());
        socket.write(
          JSON.stringify({
            protocol: SESSION_PROTOCOL,
            nonce: hello.nonce,
            request: '{"operation":"apply"}',
            proof: 'a'.repeat(64),
          }) + '\n',
        );
      });
    });
    expect(server.handler).not.toHaveBeenCalled();
  });
  it('未知操作、错误 secret、关闭实例均无业务副作用', async () => {
    const server = await serve();
    await expect(requestSession(server.instanceId, { operation: 'exec' })).rejects.toMatchObject({
      code: 'SESSION_RESULT_UNKNOWN',
    });
    expect(server.handler).not.toHaveBeenCalled();
    const path = join(directory, 'sessions', server.instanceId + '.json'),
      original = await readFile(path, 'utf8');
    await writeFile(path, JSON.stringify({ ...JSON.parse(original), secret: 'b'.repeat(64) }));
    await expect(requestSession(server.instanceId, { operation: 'status' })).rejects.toMatchObject({
      code: 'SESSION_UNAVAILABLE',
    });
    expect(server.handler).not.toHaveBeenCalled();
  }, 15000);
  it('不兼容与陈旧登记如实报告，不自动删除或尝试 PID 接管', async () => {
    await serve();
    const instance = randomUUID(),
      file = join(directory, 'sessions', instance + '.json');
    await writeFile(
      file,
      JSON.stringify({
        protocol: 99,
        instanceId: instance,
        secret: 'a'.repeat(64),
        pid: process.pid,
      }),
    );
    const list = await discoverSessions();
    expect(list.find((s) => s.instanceId === instance)).toMatchObject({
      status: 'unavailable',
      error: { code: 'SESSION_PROTOCOL_MISMATCH' },
    });
    expect(await readFile(file, 'utf8')).toContain('99');
  });
  it('登记文件向 Everyone 授权后整个发现失败关闭', async () => {
    const server = await serve();
    const script = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); $acl=[System.IO.File]::GetAccessControl($env:C9_PROBE_FILE); $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new('S-1-1-0'),'Read','Allow')); [System.IO.File]::SetAccessControl($env:C9_PROBE_FILE,$acl)`;
    await promisify(execFile)(
      join(process.env.SystemRoot!, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64'),
      ],
      {
        windowsHide: true,
        env: {
          ...process.env,
          C9_PROBE_FILE: join(directory, 'sessions', server.instanceId + '.json'),
        },
      },
    );
    await expect(discoverSessions()).rejects.toMatchObject({ code: 'SESSION_ACCESS_UNVERIFIED' });
    expect(server.handler).not.toHaveBeenCalled();
  });
  it('会话命令不接受离线路径、任意 Action 或省略幂等 ID', async () => {
    for (const args of [
      ['session', 'inspect', 'local.puzzle.json'],
      [
        'session',
        'apply',
        '--instance',
        randomUUID(),
        '--session',
        '0',
        '--plan',
        'p.json',
        '--receipt',
        'r.json',
      ],
      [
        'session',
        'status',
        '--instance',
        randomUUID(),
        '--session',
        '0',
        '--action',
        'RESET_PROJECT',
      ],
    ])
      expect((await runCli(directory, args)).code).toBe(2);
  });
});
