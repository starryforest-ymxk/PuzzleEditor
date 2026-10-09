/** 删除不暗中解绑或改变同 ID 局部变量的绑定；共享图按仍存在的调用上下文判断。 */
import type { ProjectData } from '../types/project';
import { compareProjectResources, type ProjectResource } from './projectResources';
import { collectResourceReferences, type ResourceReference } from './resourceReferences';

function referencesResource(reference: ResourceReference, resource: ProjectResource) {
  if (reference.type !== resource.ref.type || reference.id !== resource.ref.id) return false;
  return (
    reference.type !== 'variable' ||
    (reference.ownerType === resource.ref.ownerType &&
      (reference.ownerType === 'project' || reference.ownerId === resource.ref.ownerId))
  );
}
export function findDeletionReferenceConflicts(before: ProjectData, after: ProjectData) {
  const removed = compareProjectResources(before, after).removed;
  if (!removed.length) return [];
  const previousRefs = collectResourceReferences(before),
    nextRefs = collectResourceReferences(after);
  return removed.flatMap((resource) => {
    const original = previousRefs.filter((ref) => referencesResource(ref, resource));
    const references = nextRefs.filter((ref) => {
      if (referencesResource(ref, resource)) return true;
      if (resource.ref.type !== 'variable') return false;
      return original.some((previous) => {
        if (
          previous.path !== ref.path ||
          previous.id !== ref.id ||
          previous.type !== ref.type ||
          previous.scope !== ref.scope
        )
          return false;
        // 同一图可由多个 Stage 使用；删除某个根调用不会使其他调用自动失效。
        if (previous.contexts?.length)
          return (
            !ref.contexts?.length ||
            previous.contexts.some((old) =>
              ref.contexts!.some((next) => old.caller.path === next.caller.path),
            )
          );
        return true;
      });
    });
    return references.length ? [{ entity: resource.ref, references }] : [];
  });
}
