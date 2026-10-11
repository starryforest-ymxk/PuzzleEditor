import { describe, expect, it } from 'vitest';
import { completeParameterBindings } from '../../utils/presentationParameters';
import type { ParameterBinding } from '../../types/common';

describe('参数辅助字段的唯一补齐规则', () => {
  it('避开已有 ID，保留合法身份和 Temporary 元数据，输入不变且重复调用稳定', () => {
    const parameters: ParameterBinding[] = [
      { paramName: 'First', source: { type: 'Constant', value: { alias: 'keep', value: false } } },
      {
        id: 'import-param-1',
        kind: 'Variable',
        paramName: 'Existing',
        source: { type: 'Constant', value: 0 },
      },
      {
        id: 'temporary',
        paramName: 'Temporary',
        source: { type: 'Constant', value: '' },
        tempVariable: { id: 'temp-existing', name: 'Text', type: 'string' },
      },
    ];
    const before = structuredClone(parameters),
      restored: number[] = [];
    const completed = completeParameterBindings(parameters, (index) => restored.push(index));
    expect(restored).toEqual([0, 2]);
    expect(completed.map((parameter) => parameter.id)).toEqual([
      'import-param-1-copy',
      'import-param-1',
      'temporary',
    ]);
    expect(completed[1]).toBe(parameters[1]);
    expect(completed[2]).toMatchObject({
      kind: 'Temporary',
      tempVariable: { id: 'temp-existing' },
    });
    expect(completed.map((parameter) => parameter.source)).toEqual(
      before.map((parameter) => parameter.source),
    );
    expect(parameters).toEqual(before);
    expect(
      completeParameterBindings(completed, () => {
        throw new Error('Already completed');
      }),
    ).toBe(completed);
    expect(completeParameterBindings(parameters)).toEqual(completed);
  });
});
