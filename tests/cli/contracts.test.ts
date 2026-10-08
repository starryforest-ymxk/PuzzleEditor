import { describe, expect, it } from 'vitest';
import {
  assetIdentitySchema,
  assetNameSchema,
  projectIdentitySchema,
  puzzleIdentitySchema,
  inspectRequestSchema,
  jsonSchema,
} from '../../contracts/automation/schemas';
import { parseCommand } from '../../cli/arguments';
import { parseFileJson } from '../../services/automation/jsonRead';

describe('外部命名与只读契约', () => {
  it.each(['', ' ', '中文', '3Door', 'Door-name', ' Door', 'Door ', 'Door\n', 'Door\r\n'])(
    '拒绝无效 assetName %j，不做转换',
    (value) => {
      expect(assetNameSchema.safeParse(value).success).toBe(false);
    },
  );
  it('资产、根 Stage、连带初始状态缺名均不接受', () => {
    expect(assetIdentitySchema.safeParse({ name: 'Door' }).success).toBe(false);
    expect(projectIdentitySchema.safeParse({ name: 'Demo' }).success).toBe(false);
    expect(
      puzzleIdentitySchema.safeParse({
        name: 'Door',
        assetName: 'Door',
        initialState: { name: 'Idle' },
      }).success,
    ).toBe(false);
    const named = { name: '门', assetName: '_Door_2' };
    expect(assetIdentitySchema.parse(named)).toEqual(named);
    expect(assetIdentitySchema.safeParse({ ...named, generated: true }).success).toBe(false);
    expect(jsonSchema(puzzleIdentitySchema)).toMatchObject({
      additionalProperties: false,
      required: ['name', 'assetName', 'initialState'],
      properties: { initialState: { required: ['name', 'assetName'] } },
    });
  });
  it('只读请求拒绝越权字段、未知字段和异常分页', () => {
    expect(inspectRequestSchema.safeParse({ path: 'a', approved: true }).success).toBe(false);
    expect(inspectRequestSchema.safeParse({ path: 'a', offset: -1 }).success).toBe(false);
    expect(() => parseCommand(['inspect', 'a', '--view', 'summary', '--id', 'x'])).toThrow(
      'not supported',
    );
    expect(() => parseCommand(['inspect', 'a', '--view', 'entities', '--owner-id', 'x'])).toThrow(
      'together',
    );
  });
});

describe('无损原文与解析歧义', () => {
  it('重复键包含转义拼写，不能被 JSON.parse 静默覆盖', () => {
    const result = parseFileJson('{"obj":{"a":1,"\\u0061":2},"list":[{"x":0}]}');
    expect(result.parsedAvailable).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'JSON_DUPLICATE_KEY', path: '/obj/a' }),
    );
  });
  it.each(['9007199254740993', '1e400', '0.10000000000000001', '1e-400'])(
    '数值 %s 不能静默舍入',
    (number) => {
      expect(parseFileJson(`{"value":${number}}`)).toMatchObject({
        value: null,
        parsedAvailable: false,
        diagnostics: [{ code: 'JSON_NUMBER_PRECISION', path: '/value' }],
      });
    },
  );
  it('正常浮点、零、false、科学计数、字符串中的数字与键不误报', () => {
    const result = parseFileJson(
      '{"a":0.1,"b":1e2,"c":false,"d":0,"str":"{\\"a\\":123}","empty":null}',
    );
    expect(result.parsedAvailable).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.value).toMatchObject({ a: 0.1, b: 100, c: false, d: 0 });
  });
});
