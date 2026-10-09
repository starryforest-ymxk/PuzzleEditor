/**
 * 演出节点规范化工具
 * - 保证必需字段存在（nextIds / duration）
 * - 按类型裁剪无关字段（仅 PresentationNode 允许携带 presentation；Wait 才保留 duration）
 */
import { PresentationGraph, PresentationNode } from '../types/presentation';
import { PresentationBinding } from '../types/common';

export const normalizePresentationNode = (node: PresentationNode): PresentationNode => {
  const base: PresentationNode = {
    ...node,
    nextIds: node.nextIds || [],
  };

  // 严格模式：不再迁移/兼容旧字段（scriptId/parameters）。
  // 仅在 PresentationNode 节点上保留 presentation，并确保 Script 绑定的 parameters 始终为数组。
  const normalizedPresentation: PresentationBinding | undefined = (() => {
    const binding = base.presentation;
    if (!binding) return undefined;
    if (binding.type === 'Script') {
      return {
        ...binding,
        parameters: Array.isArray(binding.parameters) ? binding.parameters : [],
      };
    }
    return binding;
  })();

  switch (base.type) {
    case 'PresentationNode':
      return {
        ...base,
        presentation: normalizedPresentation,
        duration: undefined,
      };
    case 'Wait':
      return {
        ...base,
        duration: base.duration ?? 1,
        presentation: undefined,
      };
    case 'Branch':
    case 'Parallel':
    default:
      return {
        ...base,
        presentation: undefined,
        duration: undefined,
      };
  }
};

/** GUI 与离线命令共用默认值，ID/名称始终由调用方提供。 */
export function createPresentationGraph(
  input: Pick<PresentationGraph, 'id' | 'name'> & Partial<PresentationGraph>,
): PresentationGraph {
  return { description: '', nodes: {}, startNodeId: null, ...input };
}
export function createPresentationNode(
  input: Pick<PresentationNode, 'id' | 'name' | 'type' | 'position'> & Partial<PresentationNode>,
): PresentationNode {
  return normalizePresentationNode({ nextIds: [], ...input });
}
