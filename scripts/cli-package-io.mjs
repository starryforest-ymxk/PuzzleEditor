/** 发行脚本共用路径边界和指纹；递归清理只允许核对后的直属临时目录。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function inside(parent, target) {
  const relative = path.relative(parent, target);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}
export async function removeOwnedDirectory(parent, directory, prefix) {
  const actual = await fs.realpath(directory);
  const expectedParent = await fs.realpath(parent);
  if (
    path.dirname(actual) !== expectedParent ||
    !path.basename(actual).startsWith(prefix) ||
    (await fs.lstat(directory)).isSymbolicLink()
  )
    throw new Error('Refusing cleanup outside the owned temporary directory.');
  await fs.rm(actual, { recursive: true, force: true });
}
