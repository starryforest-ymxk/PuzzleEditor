/** 当前用户 Windows IPC：双向 HMAC、单请求连接、硬性大小/时限；无网络监听或业务执行。 */
import { createServer, createConnection, type Socket } from 'node:net';
import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { readdir, readFile, unlink } from 'node:fs/promises';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { verifySessionDirectory, protectSessionPipe } from './sessionSecurity.js';
import { writeUtf8File } from './files.js';
import { ProjectFileError } from './projectOwnership.js';

export const SESSION_PROTOCOL = 2;
export const SESSION_MAX_BYTES = 32 * 1024 * 1024;
export const SESSION_OPERATIONS = [
  'discover',
  'status',
  'inspect',
  'validate',
  'preview',
  'apply',
  'save',
  'history.list',
  'history.undo',
  'history.redo',
] as const;
export interface SessionResponse {
  ok: boolean;
  data: unknown;
  diagnostics: unknown[];
  error?: { code: string; message: string; retryable: boolean; exitCode: number };
}
interface Registration {
  protocol: number;
  instanceId: string;
  secret: string;
  pid: number;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const pipeName = (id: string) => `puzzle-editor-session-v1-${id}`;
const endpoint = (id: string) => `\\\\.\\pipe\\${pipeName(id)}`;
function proof(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}
function validProof(secret: string, value: string, supplied: unknown): boolean {
  return (
    typeof supplied === 'string' &&
    /^[a-f0-9]{64}$/.test(supplied) &&
    timingSafeEqual(Buffer.from(proof(secret, value), 'hex'), Buffer.from(supplied, 'hex'))
  );
}
function frame(socket: Socket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks: Buffer[] = [];
    const cleanup = () => {
      socket.off('data', data);
      socket.off('error', error);
      socket.off('end', ended);
    };
    const error = (err: Error) => {
      cleanup();
      reject(err);
    };
    const ended = () => error(new Error('Connection ended before a complete response.'));
    const data = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > SESSION_MAX_BYTES) {
        error(new Error('Session message exceeds 32 MiB.'));
        socket.destroy();
        return;
      }
      chunks.push(chunk);
      if (!chunk.includes(10)) return;
      cleanup();
      try {
        const input = Buffer.concat(chunks).toString('utf8');
        if (input.indexOf('\n') !== input.length - 1)
          throw new Error('One message per frame is required.');
        const value: unknown = JSON.parse(input);
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new Error('Invalid message.');
        resolve(value as Record<string, unknown>);
      } catch (err) {
        reject(err);
      }
    };
    socket.on('data', data);
    socket.once('error', error);
    socket.once('end', ended);
  });
}
function send(socket: Socket, value: unknown): void {
  const text = JSON.stringify(value) + '\n';
  if (Buffer.byteLength(text) > SESSION_MAX_BYTES)
    throw new Error('Session message exceeds 32 MiB.');
  socket.write(text);
}
export function validSessionPayload(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'operation' in value &&
    SESSION_OPERATIONS.includes(value.operation as (typeof SESSION_OPERATIONS)[number]),
  );
}
export async function startSessionServer(
  handler: (instanceId: string, request: unknown) => Promise<SessionResponse>,
) {
  const directory = await verifySessionDirectory(true);
  if (!directory) throw new Error('Session directory unavailable.');
  const registration: Registration = {
    protocol: SESSION_PROTOCOL,
    instanceId: randomUUID(),
    secret: randomBytes(32).toString('hex'),
    pid: process.pid,
  };
  const sockets = new Set<Socket>();
  let ready = false;
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => undefined);
    socket.once('close', () => sockets.delete(socket));
    socket.setTimeout(30000, () => socket.destroy());
    if (!ready) {
      socket.resume();
      return;
    } // ACL 探测连接不会接触应用服务。
    void (async () => {
      const nonce = randomBytes(32).toString('hex');
      const incoming = frame(socket);
      send(socket, {
        protocol: SESSION_PROTOCOL,
        instanceId: registration.instanceId,
        nonce,
        proof: proof(registration.secret, 'server:' + nonce),
      });
      const message = await incoming;
      if (
        message.protocol !== SESSION_PROTOCOL ||
        message.nonce !== nonce ||
        typeof message.request !== 'string' ||
        !validProof(registration.secret, 'request:' + nonce + ':' + message.request, message.proof)
      )
        throw new Error('Session authentication failed.');
      const request: unknown = JSON.parse(message.request);
      if (!validSessionPayload(request)) throw new Error('Unknown session operation.');
      const result = await handler(registration.instanceId, request);
      if (socket.destroyed) return; // 结果仍由应用层幂等缓存持有，断开不撤销已提交操作。
      const response = JSON.stringify(result);
      send(socket, {
        response,
        proof: proof(registration.secret, 'response:' + nonce + ':' + response),
      });
      socket.end();
    })().catch(() => socket.destroy());
  });
  const path = join(directory, registration.instanceId + '.json');
  server.maxConnections = 64;
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(
        { path: endpoint(registration.instanceId), readableAll: false, writableAll: false },
        resolve,
      );
    });
    await protectSessionPipe(pipeName(registration.instanceId));
    await writeUtf8File(path, JSON.stringify(registration), { exclusive: true });
    await verifySessionDirectory();
    ready = true;
  } catch (error) {
    for (const socket of sockets) socket.destroy();
    server.close();
    await unlink(path).catch(() => undefined);
    throw error;
  }
  return {
    instanceId: registration.instanceId,
    close: async () => {
      ready = false;
      for (const socket of sockets) socket.destroy();
      // Electron 最后窗口关闭后可能立即退出，先同步移除本实例登记再等待管道完成关闭。
      try {
        unlinkSync(path);
      } catch {
        /* 异常退出遗留由 list 如实报告，不按 PID 删除其他登记。 */
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
async function registration(instanceId: string): Promise<Registration> {
  if (!uuid.test(instanceId))
    throw new ProjectFileError('INVALID_INSTANCE', 'An explicit instance UUID is required.');
  const directory = await verifySessionDirectory();
  if (!directory)
    throw new ProjectFileError(
      'SESSION_UNAVAILABLE',
      'No session discovery directory is available.',
    );
  const record: unknown = JSON.parse(await readFile(join(directory, instanceId + '.json'), 'utf8'));
  if (
    !record ||
    typeof record !== 'object' ||
    !('protocol' in record) ||
    record.protocol !== SESSION_PROTOCOL
  )
    throw new ProjectFileError(
      'SESSION_PROTOCOL_MISMATCH',
      'The desktop session uses an incompatible protocol.',
    );
  if (
    !('instanceId' in record) ||
    record.instanceId !== instanceId ||
    !('secret' in record) ||
    typeof record.secret !== 'string' ||
    !/^[a-f0-9]{64}$/.test(record.secret)
  )
    throw new ProjectFileError(
      'SESSION_ACCESS_UNVERIFIED',
      'Invalid current-user session registration.',
    );
  return record as Registration;
}
export async function requestSession(
  instanceId: string,
  request: unknown,
): Promise<SessionResponse> {
  const record = await registration(instanceId);
  let sent = false;
  const socket = createConnection(endpoint(instanceId));
  socket.on('error', () => undefined);
  socket.setTimeout(30000, () => socket.destroy(new Error('Session request timed out.')));
  try {
    const hello = await frame(socket);
    if (
      hello.protocol !== SESSION_PROTOCOL ||
      hello.instanceId !== instanceId ||
      typeof hello.nonce !== 'string' ||
      !validProof(record.secret, 'server:' + hello.nonce, hello.proof)
    )
      throw new Error('Host authentication failed.');
    const body = JSON.stringify(request),
      pending = frame(socket);
    send(socket, {
      protocol: SESSION_PROTOCOL,
      nonce: hello.nonce,
      request: body,
      proof: proof(record.secret, 'request:' + hello.nonce + ':' + body),
    });
    sent = true;
    const reply = await pending;
    if (
      typeof reply.response !== 'string' ||
      !validProof(record.secret, 'response:' + hello.nonce + ':' + reply.response, reply.proof)
    )
      throw new Error('Response authentication failed.');
    const result: unknown = JSON.parse(reply.response);
    if (
      !result ||
      typeof result !== 'object' ||
      !('ok' in result) ||
      typeof result.ok !== 'boolean'
    )
      throw new Error('Invalid response.');
    return result as SessionResponse;
  } catch {
    throw new ProjectFileError(
      sent ? 'SESSION_RESULT_UNKNOWN' : 'SESSION_UNAVAILABLE',
      sent
        ? 'The request may have committed. Retry only the exact same request ID and content within its retention window; never automatically create a replacement request.'
        : 'The session could not be authenticated or connected. No operation was sent.',
    );
  } finally {
    socket.destroy();
  }
}
export async function discoverSessions() {
  const directory = await verifySessionDirectory();
  if (!directory) return [];
  const names = (await readdir(directory)).filter(
    (name) => name.endsWith('.json') && uuid.test(name.slice(0, -5)),
  );
  return Promise.all(
    names.map(async (name) => {
      const instanceId = name.slice(0, -5);
      try {
        const result = await requestSession(instanceId, { operation: 'discover' });
        return { instanceId, status: result.ok ? 'available' : 'unavailable', ...result };
      } catch (error) {
        return {
          instanceId,
          status: 'unavailable',
          error: {
            code: error instanceof ProjectFileError ? error.code : 'SESSION_UNAVAILABLE',
            message:
              error instanceof ProjectFileError
                ? error.message
                : 'Invalid or stale session registration.',
          },
        };
      }
    }),
  );
}
