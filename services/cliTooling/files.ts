/** 工具文件只在显式目标内操作；拒绝链接及歧义 JSON，避免把未知内容纳入所有权。 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type * as z from 'zod';
import { AutomationFailure } from '../automation/errors';
import { parseContract } from '../automation/transactionData';

export const digest = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex');
export const same = (a: unknown, b: unknown) => isDeepStrictEqual(a, b);
export function conflict(message: string): never {
  throw new AutomationFailure('TOOLING_CONFLICT', message, 4);
}
export async function plainPath(target: string) {
  const absolute = path.resolve(target);
  let cursor = path.parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    const stat = await fs.lstat(cursor).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (stat?.isSymbolicLink()) conflict('Symbolic links and junctions are not managed: ' + cursor);
  }
  return absolute;
}
export async function optionalBytes(file: string) {
  await plainPath(file);
  const stat = await fs.lstat(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!stat) return null;
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > 256 * 1024 * 1024)
    conflict('Expected a bounded regular file with one hard link: ' + file);
  return fs.readFile(file);
}
export async function readContract<T>(file: string, schema: z.ZodType<T>) {
  const bytes = await optionalBytes(file);
  if (!bytes) return null;
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new AutomationFailure('INVALID_UTF8', 'Invalid UTF-8: ' + file, 2);
  }
  return parseContract(schema, text, file);
}
export async function atomicBytes(file: string, bytes: string | Uint8Array | null) {
  await plainPath(file);
  if (bytes === null) {
    await fs.unlink(file).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    return;
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.next-' + randomUUID();
  try {
    await fs.writeFile(temp, bytes, { flag: 'wx' });
    await fs.rename(temp, file);
  } finally {
    await fs.unlink(temp).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
export const writeRecord = (file: string, record: unknown) =>
  atomicBytes(file, record === null ? null : JSON.stringify(record, null, 2) + '\n');
export async function treeFiles(root: string): Promise<string[]> {
  await plainPath(root);
  const entries = await fs
    .readdir(root, { withFileTypes: true })
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
  const result: string[] = [];
  for (const entry of entries) {
    const file = path.join(root, entry.name);
    if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile()))
      conflict('Unknown managed entry: ' + file);
    if (entry.isDirectory()) {
      const children = await treeFiles(file);
      result.push(
        ...(children.length
          ? children.map((child) => entry.name + '/' + child)
          : [entry.name + '/']),
      );
    } else result.push(entry.name);
  }
  return result;
}
export async function pruneEmpty(root: string) {
  await plainPath(root);
  for (const entry of await fs
    .readdir(root, { withFileTypes: true })
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    }))
    if (entry.isDirectory() && !entry.isSymbolicLink())
      await pruneEmpty(path.join(root, entry.name));
  await fs.rmdir(root).catch((error: NodeJS.ErrnoException) => {
    if (!['ENOENT', 'ENOTEMPTY'].includes(error.code ?? '')) throw error;
  });
}
