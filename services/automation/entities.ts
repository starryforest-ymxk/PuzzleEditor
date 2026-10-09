/** 查询实体索引携带所属域；图内 ID 和局部变量 ID 不假设工程全局唯一。 */
import type { ProjectData } from '../../types/project';
import type { EntityRef, InspectRequest } from '../../contracts/automation/schemas';
import { AutomationFailure } from './errors';
import { projectResources, projectPointer } from '../../utils/projectResources';

export interface EntityRecord {
  ref: EntityRef;
  path: string;
  name?: string;
  assetName?: string;
  state?: string;
  stageId?: string;
  nodeId?: string;
  value: object;
}
export const pointer = projectPointer;
/** 真正带 assetName 的业务实体目录，备用写入与兼容命名映射共用。 */
export const isNamedAsset = (entry: EntityRecord) =>
  ['stage', 'puzzle', 'state', 'variable', 'event', 'script'].includes(entry.ref.type);

export function indexEntities(project: ProjectData): EntityRecord[] {
  const entries: EntityRecord[] = [];
  const add = (
    ref: EntityRef,
    path: string,
    value: object,
    context: { stageId?: string; nodeId?: string } = {},
  ) => {
    const named = value as { name?: string; assetName?: string; state?: string };
    entries.push({
      ref,
      path,
      name: named.name,
      assetName: named.assetName,
      state: named.state,
      ...context,
      value,
    });
  };
  for (const stage of Object.values(project.stageTree.stages)) {
    add({ type: 'stage', id: stage.id }, pointer('stageTree', 'stages', stage.id), stage, {
      stageId: stage.id,
    });
  }
  for (const node of Object.values(project.nodes)) {
    const context = { stageId: node.stageId, nodeId: node.id };
    add({ type: 'puzzle', id: node.id }, pointer('nodes', node.id), node, context);
  }
  for (const fsm of Object.values(project.stateMachines)) {
    add({ type: 'fsm', id: fsm.id }, pointer('stateMachines', fsm.id), fsm);
    for (const state of Object.values(fsm.states))
      add(
        { type: 'state', id: state.id, ownerType: 'fsm', ownerId: fsm.id },
        pointer('stateMachines', fsm.id, 'states', state.id),
        state,
      );
    for (const transition of Object.values(fsm.transitions))
      add(
        { type: 'transition', id: transition.id, ownerType: 'fsm', ownerId: fsm.id },
        pointer('stateMachines', fsm.id, 'transitions', transition.id),
        transition,
      );
  }
  for (const graph of Object.values(project.presentationGraphs)) {
    add({ type: 'presentation', id: graph.id }, pointer('presentationGraphs', graph.id), graph);
    for (const node of Object.values(graph.nodes))
      add(
        { type: 'presentation-node', id: node.id, ownerType: 'presentation', ownerId: graph.id },
        pointer('presentationGraphs', graph.id, 'nodes', node.id),
        node,
      );
  }
  for (const entry of projectResources(project))
    add(entry.ref, entry.path, entry.value, { stageId: entry.stageId, nodeId: entry.nodeId });
  return entries;
}

export function findEntities(
  entries: EntityRecord[],
  request: Partial<InspectRequest>,
): EntityRecord[] {
  return entries.filter(
    (entry) =>
      (!request.type || entry.ref.type === request.type) &&
      (!request.id || entry.ref.id === request.id) &&
      (!request.ownerType || entry.ref.ownerType === request.ownerType) &&
      (!request.ownerId || entry.ref.ownerId === request.ownerId) &&
      (!request.search ||
        [entry.ref.id, entry.name, entry.assetName].some((value) =>
          value?.toLowerCase().includes(request.search!.toLowerCase()),
        )),
  );
}

export function requireEntity(
  entries: EntityRecord[],
  request: Partial<InspectRequest>,
): EntityRecord {
  const matches = findEntities(entries, request);
  if (!matches.length)
    throw new AutomationFailure('ENTITY_NOT_FOUND', 'No entity matches the requested identity.', 3);
  if (matches.length > 1)
    throw new AutomationFailure(
      'AMBIGUOUS_ENTITY',
      'Specify an entity type and owner to resolve this identity.',
      3,
      [],
      { candidates: matches.map(({ value: _value, ...entry }) => entry) },
    );
  return matches[0];
}

export function paginate<T>(items: T[], request: Pick<InspectRequest, 'offset' | 'limit'>) {
  const { offset, limit } = request;
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    offset,
    limit,
    nextOffset: offset + limit < items.length ? offset + limit : null,
  };
}
