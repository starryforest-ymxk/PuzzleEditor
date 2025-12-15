/**
 * 演出节点规范化工具
 * - 保证必需字段存在（nextIds / parameters / duration）
 * - 按类型裁剪无关字段（ScriptCall 才保留 scriptId/parameters；Wait 才保留 duration）
 */
import { PresentationNode } from '../types/presentation';
import { PresentationBinding } from '../types/common';

export const normalizePresentationNode = (node: PresentationNode): PresentationNode => {
  const base: PresentationNode = {
    ...node,
    nextIds: node.nextIds || []
  };

  // 统一演出绑定：
  // - 若新字段 presentation 缺失但旧字段 scriptId 存在，则自动提升为 Script 绑定（解决旧工程 Inspector 显示 None 的问题）
  // - 若已存在 Script 绑定但 scriptId 为空，则回填旧字段，保证数据一致
  const normalizedPresentation: PresentationBinding | undefined = (() => {
    const binding = base.presentation;
    if (!binding) {
      if (base.type === 'ScriptCall' && base.scriptId) {
        return { type: 'Script', scriptId: base.scriptId, parameters: base.parameters || [] };
      }
      return undefined;
    }
    if (binding.type === 'Script') {
      return {
        ...binding,
        scriptId: binding.scriptId ?? base.scriptId ?? '',
        parameters: binding.parameters || []
      };
    }
    return binding;
  })();

  switch (base.type) {
    case 'ScriptCall':
      return {
        ...base,
        presentation: normalizedPresentation,
        // 兼容旧字段：
        // - Script 绑定：同步 scriptId/parameters
        // - Graph 绑定：清理 scriptId/parameters，避免画布/导出出现“Script: xxx”假象
        // - 无绑定：保留旧字段（例如极少数未升级的数据）
        scriptId: normalizedPresentation?.type === 'Script'
          ? normalizedPresentation.scriptId
          : normalizedPresentation?.type === 'Graph'
            ? undefined
            : base.scriptId,
        parameters: normalizedPresentation?.type === 'Script'
          ? (normalizedPresentation.parameters || [])
          : normalizedPresentation?.type === 'Graph'
            ? undefined
            : (base.parameters || []),
        duration: undefined
      };
    case 'Wait':
      return {
        ...base,
        duration: base.duration ?? 1,
        presentation: undefined,
        scriptId: undefined,
        parameters: undefined
      };
    case 'Branch':
    case 'Parallel':
    default:
      return {
        ...base,
        presentation: undefined,
        scriptId: undefined,
        parameters: undefined,
        duration: undefined
      };
  }
};
