/** 离线查询不持有 UI/Store；输出现有领域对象及明确的所属和分页信息。 */
import type { ProjectData } from '../../types/project';
import type { InspectRequest } from '../../contracts/automation/schemas';
import { collectVisibleVariables } from '../../utils/variableScope';
import { findGlobalVariableReferences } from '../../utils/validation/globalVariableReferences';
import { findStageVariableReferences } from '../../utils/validation/stageVariableReferences';
import { findNodeVariableReferences } from '../../utils/validation/variableReferences';
import { findScriptReferences } from '../../utils/validation/scriptReferences';
import { findEventReferences } from '../../utils/validation/eventReferences';
import { findPresentationGraphReferences } from '../../utils/validation/presentationGraphReferences';
import { type EntityRecord, findEntities, paginate, requireEntity } from './entities';
import { AutomationFailure } from './errors';

function stageTree(project: ProjectData, request: InspectRequest) {
  const rootId = request.id ?? project.stageTree.rootId;
  if (request.id && !project.stageTree.stages[rootId])
    throw new AutomationFailure('ENTITY_NOT_FOUND', 'The requested stage does not exist.', 3);
  const pending = [{ id: rootId, depth: 0 }];
  const visited = new Set<string>();
  const rows = [];
  // 扁平输出遍历深度，深链/环不使用递归；截断必须显式返回标记与子 ID。
  for (let cursor = 0; cursor < pending.length; cursor++) {
    const { id, depth } = pending[cursor];
    const stage = project.stageTree.stages[id];
    const revisited = visited.has(id);
    visited.add(id);
    rows.push({
      id,
      depth,
      missing: !stage,
      revisited,
      parentId: stage?.parentId,
      name: stage?.name,
      assetName: stage?.assetName,
      childrenIds: stage?.childrenIds ?? [],
      puzzleIds: Object.values(project.nodes)
        .filter((node) => node.stageId === id)
        .map((node) => node.id),
      truncated: Boolean(stage?.childrenIds.length && depth >= request.depth),
    });
    if (stage && !revisited && depth < request.depth) {
      for (const child of stage.childrenIds) pending.push({ id: child, depth: depth + 1 });
    }
  }
  return { rootId, ...paginate(rows, request) };
}

function references(project: ProjectData, entity: EntityRecord) {
  const { type, id, ownerType, ownerId } = entity.ref;
  switch (type) {
    case 'script':
      return findScriptReferences(project, id);
    case 'event':
      return findEventReferences(project, id);
    case 'presentation':
      return findPresentationGraphReferences(project, id);
    case 'variable':
      if (ownerType === 'stage') return findStageVariableReferences(project, ownerId!, id);
      if (ownerType === 'puzzle') return findNodeVariableReferences(project, ownerId!, id);
      return findGlobalVariableReferences(project, id);
    default:
      throw new AutomationFailure(
        'UNSUPPORTED_REFERENCE_QUERY',
        'References currently support script, event, variable, and presentation resources.',
        2,
      );
  }
}

export function queryProject(
  project: ProjectData,
  entries: EntityRecord[],
  request: InspectRequest,
): object {
  const { view } = request;
  if (view === 'summary') {
    return {
      meta: project.meta,
      rootStageId: project.stageTree.rootId,
      counts: Object.fromEntries(
        [
          'stage',
          'puzzle',
          'fsm',
          'state',
          'transition',
          'presentation',
          'presentation-node',
          'variable',
          'event',
          'script',
        ].map((type) => [type, entries.filter((entry) => entry.ref.type === type).length]),
      ),
    };
  }
  if (view === 'tree') return stageTree(project, request);
  if (view === 'entities') {
    return request.id
      ? { entity: requireEntity(entries, request) }
      : paginate(findEntities(entries, request), request);
  }
  if (view === 'fsm' || view === 'presentation') {
    const type = view === 'fsm' ? 'fsm' : 'presentation';
    const matches = findEntities(entries, { ...request, type });
    if (!request.id)
      return paginate(
        matches.map(({ value: _value, ...entry }) => entry),
        request,
      );
    const entity = requireEntity(entries, { ...request, type });
    return {
      entity,
      owners:
        view === 'fsm'
          ? Object.values(project.nodes)
              .filter((node) => node.stateMachineId === entity.ref.id)
              .map((node) => ({ nodeId: node.id, stageId: node.stageId }))
          : undefined,
    };
  }
  if (view === 'variables') {
    const node = request.nodeId ? project.nodes[request.nodeId] : undefined;
    if (request.nodeId && !node)
      throw new AutomationFailure('ENTITY_NOT_FOUND', 'The requested puzzle does not exist.', 3);
    if (request.stageId && !project.stageTree.stages[request.stageId])
      throw new AutomationFailure('ENTITY_NOT_FOUND', 'The requested stage does not exist.', 3);
    if (node && request.stageId && node.stageId !== request.stageId)
      throw new AutomationFailure(
        'CONTEXT_MISMATCH',
        'The puzzle does not belong to the supplied stage.',
        3,
      );
    const visible = collectVisibleVariables(project, request.stageId, request.nodeId);
    const chain = new Set<string>();
    let stageId: string | null = request.stageId ?? node?.stageId ?? null;
    while (stageId && !chain.has(stageId)) {
      chain.add(stageId);
      stageId = project.stageTree.stages[stageId]?.parentId ?? null;
    }
    const visibleSet = new Set(visible.all);
    // 对象身份保留实际祖先所有者，避免局部同 ID 在扁平输出时互相覆盖。
    const items = entries.filter(
      (entry) =>
        entry.ref.type === 'variable' &&
        visibleSet.has(entry.value as (typeof visible.all)[number]) &&
        (entry.ref.ownerType === 'project' ||
          (entry.ref.ownerType === 'stage' && chain.has(entry.ref.ownerId!)) ||
          (entry.ref.ownerType === 'puzzle' && entry.ref.ownerId === request.nodeId)),
    );
    return {
      context: {
        stageId: request.stageId ?? node?.stageId ?? null,
        nodeId: request.nodeId ?? null,
      },
      ...paginate(items, request),
    };
  }
  if (view === 'references') {
    const target = requireEntity(entries, request);
    return {
      target: target.ref,
      coverage:
        'editor-reference-scanners; graph-local-variable matches may include defensive candidates',
      ...paginate(references(project, target), request),
    };
  }
  // 这里只列资源目录，绑定调用参数及共享图上下文的完整验证由后续写入服务执行。
  const bindable = findEntities(entries, request).filter(
    (entry) =>
      ['script', 'event', 'presentation'].includes(entry.ref.type) &&
      entry.state !== 'MarkedForDelete',
  );
  return { requiresContextValidation: true, ...paginate(bindable, request) };
}
