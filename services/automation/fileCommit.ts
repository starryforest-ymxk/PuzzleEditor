/** 仅发布新文件；路径比较包含符号链接/硬链接，不以覆盖写入模拟排他创建。 */
import * as path from 'node:path';
import { lstat, realpath, stat } from 'node:fs/promises';
import { readFileSnapshot, writeUtf8File } from '../../dist-node/files.js';
import { AutomationFailure } from './errors';
import { hashText } from './transactionData';

const missing = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';
const pathKey = (value: string) => (process.platform === 'win32' ? value.toLowerCase() : value);
async function canonicalTarget(input: string): Promise<string> {
  const absolute = path.resolve(input);
  try {
    await lstat(absolute);
    return await realpath(absolute);
  } catch (error) {
    if (!missing(error)) throw error;
    const parent = path.dirname(absolute);
    if (parent === absolute) throw error;
    return path.join(await canonicalTarget(parent), path.basename(absolute));
  }
}
export async function targetPath(input: string, protectedPaths: string[], suffix?: string) {
  if (suffix && !input.toLowerCase().endsWith(suffix))
    throw new AutomationFailure('INVALID_OUTPUT_EXTENSION', `Output must end in ${suffix}.`, 2);
  const target = await canonicalTarget(input);
  const targetStat = await stat(target).catch((error) => {
    if (missing(error)) return null;
    throw error;
  });
  for (const source of protectedPaths) {
    const canonical = await realpath(source);
    const sameFile =
      targetStat &&
      (await stat(canonical).then((s) => s.dev === targetStat.dev && s.ino === targetStat.ino));
    if (pathKey(canonical) === pathKey(target) || sameFile)
      throw new AutomationFailure(
        'INPUT_OUTPUT_COLLISION',
        'Output must not overwrite or alias an input file.',
        4,
        [],
        { path: target },
      );
  }
  // 不通过已存在的符号链接另存，以免返回的目标名与实际交付位置不一致。
  const leaf = await lstat(path.resolve(input)).catch((error) => {
    if (missing(error)) return null;
    throw error;
  });
  if (leaf?.isSymbolicLink())
    throw new AutomationFailure('OUTPUT_EXISTS', 'The output path is a symbolic link.', 4, [], {
      path: target,
    });
  return target;
}
export async function publishNew(target: string, content: string, allowMatching = false) {
  const expectedHash = hashText(content);
  try {
    await writeUtf8File(target, content, { exclusive: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      const existing = await lstat(target).catch(() => null);
      // Windows 的 mkdir(file-as-parent) 同样返回 EEXIST；目标不存在时属于 IO 失败。
      if (!existing) throw error;
      if (allowMatching) {
        const snapshot = await readFileSnapshot(target).catch(() => null);
        if (snapshot?.sha256 === expectedHash) {
          const { content: _content, ...output } = snapshot;
          return { status: 'already-applied' as const, output };
        }
      }
      throw new AutomationFailure(
        'OUTPUT_EXISTS',
        'The output already exists; no file was overwritten.',
        4,
        [],
        { path: target },
      );
    }
    throw error;
  }
  try {
    const { content: _content, ...output } = await readFileSnapshot(target);
    if (output.sha256 !== expectedHash)
      throw new Error('Published content changed before verification.');
    return { status: 'written' as const, output };
  } catch (error) {
    throw new AutomationFailure(
      'COMMIT_RESULT_UNCERTAIN',
      error instanceof Error ? error.message : 'Cannot verify the published output.',
      5,
      [],
      { path: target, expectedHash, published: true },
    );
  }
}
