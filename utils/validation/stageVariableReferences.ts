/** 兼容 GUI 的引用入口；局部归属、调用上下文及字段路径共用领域索引。 */
import type { ProjectLike } from './types';
import { findResourceReferences, type ResourceReferenceIndex } from '../resourceReferences';
export type { VariableReferenceInfo, ReferenceNavigationContext } from './globalVariableReferences';
export const findStageVariableReferences = (
  project: ProjectLike,
  ownerId: string,
  id: string,
  index?: ResourceReferenceIndex,
) => findResourceReferences(project, { type: 'variable', id, ownerType: 'stage', ownerId }, index);
