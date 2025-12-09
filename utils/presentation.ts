/**
 * 演出节点规范化工具
 * - 保证必需字段存在（nextIds / parameters / duration）
 * - 按类型裁剪无关字段（ScriptCall 才保留 scriptId/parameters；Wait 才保留 duration）
 */
import { PresentationNode } from '../types/presentation';

export const normalizePresentationNode = (node: PresentationNode): PresentationNode => {
  const base: PresentationNode = {
    ...node,
    nextIds: node.nextIds || []
  };

  switch (base.type) {
    case 'ScriptCall':
      return {
        ...base,
        parameters: base.parameters || [],
        duration: undefined
      };
    case 'Wait':
      return {
        ...base,
        duration: base.duration ?? 1,
        scriptId: undefined,
        parameters: undefined
      };
    case 'Branch':
    case 'Parallel':
    default:
      return {
        ...base,
        scriptId: undefined,
        parameters: undefined,
        duration: undefined
      };
  }
};
