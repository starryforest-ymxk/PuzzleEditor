/** 引用类型与兼容入口；领域字段遍历由 resourceReferences 统一维护。 */
import type { ProjectLike } from './types';
import { findResourceReferences, type ResourceReferenceIndex } from '../resourceReferences';
export interface ReferenceNavigationContext {
  /** 目标类型：Stage/Node/State/Transition/PresentationGraph/PresentationNode */
  targetType:
    'STAGE' | 'NODE' | 'STATE' | 'TRANSITION' | 'PRESENTATION_GRAPH' | 'PRESENTATION_NODE';
  /** Stage ID - Stage 相关导航 */
  stageId?: string;
  /** Node ID - 大多数情况需要先导航到 Node */
  nodeId?: string;
  /** State ID - 状态节点选择 */
  stateId?: string;
  /** Transition ID - 转移选择 */
  transitionId?: string;
  /** Presentation Graph ID - 演出图 */
  graphId?: string;
  /** Presentation Node ID - 演出图节点 */
  presentationNodeId?: string;
}

export interface VariableReferenceInfo {
  location: string; // 引用发生的具体位置描述
  detail?: string; // 额外说明（如所属对象名称）
  /** 导航上下文，用于点击跳转 */
  navContext?: ReferenceNavigationContext;
}

export const findGlobalVariableReferences = (
  project: ProjectLike,
  id: string,
  index?: ResourceReferenceIndex,
) => findResourceReferences(project, { type: 'variable', id, ownerType: 'project' }, index);
