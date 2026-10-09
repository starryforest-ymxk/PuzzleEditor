/** 领域完整差异的单一实现，不依赖 Node IO，供 GUI 与 CLI 复用。 */
import { equalProjectData } from '../../utils/equalProjectData';
export interface Change {
  path: string;
  kind: 'add' | 'remove' | 'replace';
  before?: unknown;
  after?: unknown;
}
export function fullDiff(before: unknown, after: unknown, path = ''): Change[] {
  if (equalProjectData(before, after)) return [];
  if (before === undefined) return [{ path, kind: 'add', after }];
  if (after === undefined) return [{ path, kind: 'remove', before }];
  if (
    before === null ||
    after === null ||
    typeof before !== 'object' ||
    typeof after !== 'object' ||
    Array.isArray(before) ||
    Array.isArray(after)
  )
    return [{ path, kind: 'replace', before, after }];
  const a = before as Record<string, unknown>,
    b = after as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((key) =>
    fullDiff(
      Object.hasOwn(a, key) ? a[key] : undefined,
      Object.hasOwn(b, key) ? b[key] : undefined,
      path + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1'),
    ),
  );
}
