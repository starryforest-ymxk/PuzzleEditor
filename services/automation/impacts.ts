/** 只读影响摘要保留前后引用；修改共享图不会隐式获得调用者的写权限。 */
import type { ProjectData } from '../../types/project';
import { buildPresentationUsage } from '../../utils/presentationUsage';
import { collectResourceReferences, type ResourceReference } from '../../utils/resourceReferences';
import { indexEntities } from './entities';

export function summarizeImpacts(before: ProjectData, after: ProjectData) {
  const source = indexEntities(before),
    target = indexEntities(after);
  const oldRefs = collectResourceReferences(before),
    newRefs = collectResourceReferences(after);
  const beforeUsage = buildPresentationUsage(before),
    afterUsage = buildPresentationUsage(after);
  const key = (ref: (typeof source)[number]['ref']) => JSON.stringify(ref);
  const oldEntities = new Map(source.map((entity) => [key(entity.ref), entity]));
  const newEntities = new Map(target.map((entity) => [key(entity.ref), entity]));
  const affectedGraphs = new Set<string>();
  const matches = (refs: ResourceReference[], entity: (typeof source)[number]) =>
    refs.filter(
      (ref) =>
        ref.type === entity.ref.type &&
        ref.id === entity.ref.id &&
        (ref.type !== 'variable' ||
          (ref.ownerType === entity.ref.ownerType &&
            (ref.ownerType === 'project' || ref.ownerId === entity.ref.ownerId))),
    );
  const resources = [];
  for (const identity of new Set([...oldEntities.keys(), ...newEntities.keys()])) {
    const prev = oldEntities.get(identity),
      next = newEntities.get(identity),
      entity = (next ?? prev)!;
    if (!['variable', 'script', 'event', 'presentation'].includes(entity.ref.type)) continue;
    if (JSON.stringify(prev?.value) === JSON.stringify(next?.value)) continue;
    const referencesBefore = matches(oldRefs, entity),
      referencesAfter = matches(newRefs, entity);
    for (const ref of [...referencesBefore, ...referencesAfter])
      if (ref.navContext?.graphId) affectedGraphs.add(ref.navContext.graphId);
    if (entity.ref.type === 'presentation') affectedGraphs.add(entity.ref.id);
    resources.push({
      target: entity.ref,
      change: !prev ? 'created' : !next ? 'deleted' : 'updated',
      referencesBefore,
      referencesAfter,
    });
  }
  const graphs = [];
  for (const id of new Set([
    ...Object.keys(before.presentationGraphs),
    ...Object.keys(after.presentationGraphs),
  ])) {
    const contextsBefore = beforeUsage.contexts.get(id) ?? [],
      contextsAfter = afterUsage.contexts.get(id) ?? [];
    const directReferencesBefore = beforeUsage.bindings.filter((binding) => binding.graphId === id);
    const directReferencesAfter = afterUsage.bindings.filter((binding) => binding.graphId === id);
    if (
      !affectedGraphs.has(id) &&
      JSON.stringify([contextsBefore, directReferencesBefore]) ===
        JSON.stringify([contextsAfter, directReferencesAfter])
    )
      continue;
    graphs.push({
      graphId: id,
      graphChanged:
        JSON.stringify(before.presentationGraphs[id]) !==
        JSON.stringify(after.presentationGraphs[id]),
      sharedBefore: contextsBefore.length > 1,
      sharedAfter: contextsAfter.length > 1,
      directReferencesBefore,
      directReferencesAfter,
      contextsBefore,
      contextsAfter,
    });
  }
  return {
    deletions: source
      .filter((entity) => !newEntities.has(key(entity.ref)))
      .map(({ ref: entity, path, name, state }) => ({
        entity,
        path: '/project' + path,
        name,
        state,
      })),
    resources,
    graphs,
    contextPolicy:
      'all-root-bindings; one representative graph path per root and graph; direct bindings are complete',
  };
}
