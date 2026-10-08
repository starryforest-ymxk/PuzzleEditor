/** Node 文件 IO 的唯一实现；不加载 Electron、偏好或编辑器会话。 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { TextDecoder } from 'node:util';

export class FileSnapshotError extends Error {
  constructor(
    public readonly code: 'FILE_CHANGED' | 'INVALID_UTF8',
    message: string,
  ) {
    super(message);
    this.name = 'FileSnapshotError';
  }
}

export interface FileSnapshot {
  path: string;
  sha256: string;
  size: number;
  modifiedAt: string;
  content: string;
}

export function decodeUtf8(bytes: Uint8Array): string {
  try {
    // 保留文件原有 BOM；解析层决定是否忽略，原文读取不能改写它。
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new FileSnapshotError('INVALID_UTF8', 'The file is not valid UTF-8.');
  }
}

export async function readUtf8File(filePath: string): Promise<string> {
  return decodeUtf8(await fs.promises.readFile(filePath));
}

/** 同一打开句柄读取并检查路径替换/读取期间修改；不承诺锁住后续的第三方写入。 */
export async function readFileSnapshot(filePath: string): Promise<FileSnapshot> {
  const canonicalPath = await fs.promises.realpath(path.resolve(filePath));
  const file = await fs.promises.open(canonicalPath, 'r');
  try {
    const before = await file.stat({ bigint: true });
    if (!before.isFile())
      throw Object.assign(new Error('Expected a regular file.'), { code: 'EISDIR' });
    const bytes = await file.readFile();
    const after = await file.stat({ bigint: true });
    const current = await fs.promises.stat(canonicalPath, { bigint: true });
    const same = (left: fs.BigIntStats, right: fs.BigIntStats) =>
      left.dev === right.dev &&
      left.ino === right.ino &&
      left.size === right.size &&
      left.mtimeNs === right.mtimeNs &&
      left.ctimeNs === right.ctimeNs;
    if (
      !same(before, after) ||
      !same(after, current) ||
      BigInt(bytes.length) !== after.size ||
      (await fs.promises.realpath(path.resolve(filePath))) !== canonicalPath
    ) {
      throw new FileSnapshotError(
        'FILE_CHANGED',
        'The file changed while it was being read. Read it again.',
      );
    }
    return {
      path: canonicalPath,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      size: bytes.length,
      modifiedAt: after.mtime.toISOString(),
      content: decodeUtf8(bytes),
    };
  } finally {
    await file.close();
  }
}

/** 延续桌面保存策略：同目录临时文件完整写入后发布，排他创建绝不覆盖目标。 */
export async function writeUtf8File(
  filePath: string,
  content: string,
  options?: { exclusive?: boolean },
): Promise<void> {
  const directory = path.dirname(filePath);
  await fs.promises.mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  try {
    await fs.promises.writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
    if (options?.exclusive) await fs.promises.link(temporary, filePath);
    else await fs.promises.rename(temporary, filePath);
  } finally {
    await fs.promises.unlink(temporary).catch(() => undefined);
  }
}
