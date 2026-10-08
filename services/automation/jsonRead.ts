/** 完整 JSON 读取保留原文；词法审计只报告歧义，不迁移/过滤工程字段。 */
import type { Diagnostic } from '../../contracts/automation/schemas';
import { AutomationFailure } from './errors';

const escapePointer = (key: string) => key.replaceAll('~', '~0').replaceAll('/', '~1');

// 比较十进制数值而非拼写，1e2 和 100 等价；超大指数不展开为巨型字符串。
function decimalKey(text: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) return text;
  const fraction = match[3] ?? '';
  let digits = (match[2] + fraction).replace(/^0+/, '');
  if (!digits) return '0';
  const zeros = /0*$/.exec(digits)![0].length;
  digits = zeros ? digits.slice(0, -zeros) : digits;
  return `${match[1]}${digits}e${BigInt(match[4] ?? '0') - BigInt(fraction.length) + BigInt(zeros)}`;
}

export function parseFileJson(content: string): {
  value: unknown;
  diagnostics: Diagnostic[];
  parsedAvailable: boolean;
} {
  const text = content.replace(/^\uFEFF/, '');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new AutomationFailure(
      'INVALID_JSON',
      error instanceof Error ? error.message : 'Invalid JSON.',
      3,
      [
        {
          code: 'INVALID_JSON',
          level: 'error',
          message:
            'The source contains invalid JSON. Use json read --raw to read its original text.',
          path: '',
          pathBasis: 'source',
          retryable: false,
        },
      ],
    );
  }
  const diagnostics: Diagnostic[] = [];
  const stack: Array<{
    kind: 'object' | 'array';
    path: string;
    keys: Set<string>;
    key: string;
    index: number;
  }> = [];
  let parsedAvailable = true;
  const tokens =
    /"(?:\\[\s\S]|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\]:,]|true|false|null/g;
  for (const match of text.matchAll(tokens)) {
    const token = match[0];
    const parent = stack.at(-1);
    if (token === '}' || token === ']') {
      stack.pop();
      continue;
    }
    if (token === ':' || token === ',') continue;
    if (
      token.startsWith('"') &&
      parent?.kind === 'object' &&
      /^\s*:/.test(text.slice(match.index + token.length))
    ) {
      const key: string = JSON.parse(token);
      parent.key = key;
      if (parent.keys.has(key)) {
        diagnostics.push({
          code: 'JSON_DUPLICATE_KEY',
          level: 'warning',
          message: `Duplicate key ${JSON.stringify(key)}. The complete rawText is authoritative.`,
          path: `${parent.path}/${escapePointer(key)}`,
          pathBasis: 'source',
          retryable: false,
        });
        parsedAvailable = false;
      }
      parent.keys.add(key);
      continue;
    }
    const path = parent
      ? `${parent.path}/${parent.kind === 'array' ? parent.index++ : escapePointer(parent.key)}`
      : '';
    if (token === '{' || token === '[') {
      stack.push({
        kind: token === '{' ? 'object' : 'array',
        path,
        keys: new Set(),
        key: '',
        index: 0,
      });
    } else if (/^-?\d/.test(token)) {
      const number = Number(token);
      if (
        !Number.isFinite(number) ||
        decimalKey(token) !== decimalKey(String(number)) ||
        (Number.isInteger(number) && !Number.isSafeInteger(number))
      ) {
        diagnostics.push({
          code: 'JSON_NUMBER_PRECISION',
          level: 'warning',
          message: `Number ${token} cannot be safely represented by the JavaScript numeric model. Read rawText.`,
          path,
          pathBasis: 'source',
          retryable: false,
        });
        parsedAvailable = false;
      }
    }
  }
  // 不把 Infinity 序列化成 null、或把重复键/舍入后的对象冒充无损结构化读取。
  return { value: parsedAvailable ? value : null, diagnostics, parsedAvailable };
}
