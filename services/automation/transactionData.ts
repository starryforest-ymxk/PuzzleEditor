/** 预览数据与完整差异；数组保持原顺序，不把领域变更转换为公开的 JSON 写接口。 */
import { createHash } from 'node:crypto';
import type * as z from 'zod';
import { parseFileJson } from './jsonRead';
import { AutomationFailure } from './errors';
import { checkJsonDepth } from '../../utils/projectImport/readers';

export const hashText = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
export function parseContract<T>(schema: z.ZodType<T>, content: string, label: string): T {
  const parsed = parseFileJson(content);
  if (!parsed.parsedAvailable)
    throw new AutomationFailure(
      'AMBIGUOUS_JSON',
      `${label} contains ambiguous JSON.`,
      2,
      parsed.diagnostics,
    );
  try {
    checkJsonDepth(parsed.value);
  } catch {
    throw new AutomationFailure(
      'INVALID_CONTRACT',
      `${label} exceeds the supported JSON nesting depth.`,
      2,
    );
  }
  const result = schema.safeParse(parsed.value);
  if (!result.success)
    throw new AutomationFailure(
      'INVALID_CONTRACT',
      `${label} does not satisfy its contract.`,
      2,
      result.error.issues.map((issue) => ({
        code: 'INVALID_CONTRACT',
        level: 'error',
        message: issue.message,
        path: '/' + issue.path.join('/'),
        pathBasis: 'request',
        retryable: false,
        ...(issue.path[0] === 'commands' && typeof issue.path[1] === 'number'
          ? { operationIndex: issue.path[1] }
          : {}),
      })),
    );
  return result.data;
}
export { fullDiff, type Change } from './projectDiff';
