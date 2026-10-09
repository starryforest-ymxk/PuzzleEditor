/** 工程写入所有权仅依赖 OS 句柄；不根据 PID/超时猜测并删除他人的锁。 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as net from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSnapshot, type FileSnapshot } from './files.js';

export class ProjectFileError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: unknown = null,
    public readonly exitCode = 4,
  ) {
    super(message);
    this.name = 'ProjectFileError';
  }
}
export interface FileIdentity {
  dev: string;
  ino: string;
  size: string;
  mtimeNs: string;
  ctimeNs: string;
}
export interface ProjectSnapshot extends FileSnapshot {
  identity: FileIdentity;
}
export const ownershipSupported = process.platform === 'win32';
export const pathKey = (input: string) =>
  process.platform === 'win32' ? input.toLowerCase() : input;
export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const missing = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

/** 尚未创建的目标也通过真实父路径规范化，不创建目录或跟随末端悬空链接。 */
export async function projectPath(input: string): Promise<string> {
  const absolute = path.resolve(input);
  try {
    await fs.lstat(absolute);
    return await fs.realpath(absolute);
  } catch (error) {
    if (!missing(error)) throw error;
    // 悬空链接不能作为新文件路径被另行解释。
    if (await fs.lstat(absolute).catch(() => null)) throw error;
    const parent = path.dirname(absolute);
    if (parent === absolute) throw error;
    return path.join(await projectPath(parent), path.basename(absolute));
  }
}
export async function fileIdentity(input: string): Promise<FileIdentity> {
  const stat = await fs.stat(input, { bigint: true });
  if (!stat.isFile() || stat.ino === 0n || stat.nlink !== 1n)
    throw new ProjectFileError(
      'UNSAFE_FILE_IDENTITY',
      'Project ownership requires a regular file with exactly one hard link.',
      { path: input },
    );
  return {
    dev: String(stat.dev),
    ino: String(stat.ino),
    size: String(stat.size),
    mtimeNs: String(stat.mtimeNs),
    ctimeNs: String(stat.ctimeNs),
  };
}
export const sameIdentity = (a: FileIdentity, b: FileIdentity) =>
  a.dev === b.dev &&
  a.ino === b.ino &&
  a.size === b.size &&
  a.mtimeNs === b.mtimeNs &&
  a.ctimeNs === b.ctimeNs;
export async function readProjectSnapshot(input: string): Promise<ProjectSnapshot> {
  const canonical = await projectPath(input),
    before = await fileIdentity(canonical);
  const snapshot = await readFileSnapshot(input),
    after = await fileIdentity(canonical);
  if (pathKey(snapshot.path) !== pathKey(canonical) || !sameIdentity(before, after))
    throw new ProjectFileError(
      'REVISION_CONFLICT',
      'The project identity changed while reading. Read and preview again.',
    );
  return { ...snapshot, identity: after };
}
const identityKey = (identity: FileIdentity) => `file:${identity.dev}:${identity.ino}`;
export const ownershipEndpoint = (key: string) =>
  `\\\\.\\pipe\\puzzle-editor-ownership-v1-${digest(key)}`;

/** 诊断只探测既有端点，不创建/删除锁；结果是瞬时观察，不能作为后续写入许可。 */
export async function inspectProjectOwnership(input: string) {
  if (!ownershipSupported) return { status: 'unsupported' };
  const canonical = await projectPath(input),
    identity = await fileIdentity(canonical);
  const probe = (key: string) =>
    new Promise<'held' | 'unobserved' | 'unknown'>((resolve) => {
      const socket = net.createConnection(ownershipEndpoint(key));
      const finish = (state: 'held' | 'unobserved' | 'unknown') => {
        socket.destroy();
        resolve(state);
      };
      socket.setTimeout(1000, () => finish('unknown'));
      socket.once('connect', () => finish('held'));
      socket.once('error', (error: NodeJS.ErrnoException) =>
        finish(['ENOENT', 'ECONNREFUSED'].includes(error.code ?? '') ? 'unobserved' : 'unknown'),
      );
    });
  const states = await Promise.all([
    probe('path:' + pathKey(canonical)),
    probe(identityKey(identity)),
  ]);
  return {
    status: states.includes('held')
      ? 'held'
      : states.includes('unknown')
        ? 'unknown'
        : 'unobserved',
  };
}

export class ProjectLease {
  readonly instanceId = randomUUID();
  private servers = new Map<string, net.Server>();
  private released = false;
  private constructor(
    readonly path: string,
    readonly role: string,
  ) {}

  static async acquire(input: string, role: string): Promise<ProjectLease> {
    if (!ownershipSupported)
      throw new ProjectFileError(
        'OWNERSHIP_UNSUPPORTED',
        'In-place editing is currently supported on Windows only.',
        null,
        5,
      );
    const canonical = await projectPath(input),
      lease = new ProjectLease(canonical, role);
    try {
      await lease.hold(`path:${pathKey(canonical)}`);
      if (pathKey(await projectPath(input)) !== pathKey(canonical))
        throw new ProjectFileError(
          'REVISION_CONFLICT',
          'The project path changed while acquiring ownership.',
        );
      await lease.refresh();
      return lease;
    } catch (error) {
      await lease.release();
      throw error;
    }
  }

  private async hold(key: string): Promise<void> {
    if (this.released)
      throw new ProjectFileError('OWNERSHIP_LOST', 'Project ownership has been released.');
    if (this.servers.has(key)) return;
    const server = net.createServer((socket) => {
      // 只暴露有界元数据，无命令解析、工程正文或写能力，也不把握手当聊天授权。
      socket.on('error', () => undefined);
      socket.end(
        JSON.stringify({
          protocol: 1,
          instanceId: this.instanceId,
          pid: process.pid,
          role: this.role,
        }) + '\n',
        () => socket.destroy(),
      );
    });
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(
          { path: ownershipEndpoint(key), exclusive: true, readableAll: false, writableAll: false },
          resolve,
        );
      });
      server.unref();
      this.servers.set(key, server);
    } catch (error) {
      server.close();
      throw new ProjectFileError(
        'PROJECT_OWNED',
        'The project is held by another editor or transaction, or ownership cannot be verified. Close that session or use a compatible online session when available.',
        {
          path: this.path,
          reason: error instanceof Error && 'code' in error ? error.code : 'unknown',
        },
      );
    }
  }

  /** 替换前就占用临时文件身份，旧身份保留至事务/会话结束，避免重命名别名绕过。 */
  async holdFile(input: string): Promise<void> {
    await this.hold(identityKey(await fileIdentity(input)));
  }
  async refresh(): Promise<void> {
    try {
      await this.holdFile(this.path);
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
  /** 完整受控替换后旧单链接 inode 已失效，及时释放以免自动保存累积句柄。 */
  async replaced(): Promise<void> {
    const current = identityKey(await fileIdentity(this.path));
    await this.hold(current);
    for (const [key, server] of this.servers)
      if (key.startsWith('file:') && key !== current) {
        this.servers.delete(key);
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
  }
  async assertPath(input: string): Promise<void> {
    if (this.released || pathKey(await projectPath(input)) !== pathKey(this.path))
      throw new ProjectFileError(
        'OWNERSHIP_LOST',
        'The requested path no longer matches the held project.',
      );
    await this.refresh();
  }
  async release(): Promise<void> {
    this.released = true;
    const servers = [...this.servers.values()];
    this.servers.clear();
    await Promise.all(
      servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  }
}
