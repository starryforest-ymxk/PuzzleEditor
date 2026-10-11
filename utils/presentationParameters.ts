import type { ParameterBinding } from '../types/common';

/** 工具内部统一补齐编辑器辅助字段；确定性 ID 保证预览、重放和导入结果相同。 */
export function completeParameterBindings(
  parameters: ParameterBinding[],
  onRestored?: (index: number) => void,
): ParameterBinding[] {
  const used = new Set(parameters.map((parameter) => parameter.id).filter(Boolean));
  let changed = false;
  const completed = parameters.map((parameter, index) => {
    if (parameter.id && parameter.kind) return parameter;
    let id = parameter.id || `import-param-${index + 1}`;
    while (!parameter.id && used.has(id)) id += '-copy';
    used.add(id);
    changed = true;
    onRestored?.(index);
    return {
      ...parameter,
      id,
      kind: parameter.kind || (parameter.tempVariable ? 'Temporary' : 'Variable'),
    } satisfies ParameterBinding;
  });
  return changed ? completed : parameters;
}
