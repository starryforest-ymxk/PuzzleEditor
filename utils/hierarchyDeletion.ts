/** GUI 与自动化共用纯删除计划；不猜共享 FSM 所有权，不执行文件或 UI 操作。 */
import type { ProjectData } from '../types/project';
import { ownEntry } from './recordLookup';
import { updateInitialStatusByParent } from './stageTreeUtils';

type HierarchyProject = Pick<ProjectData, 'stageTree' | 'nodes' | 'stateMachines'>;
export type HierarchyDeleteTarget =
  { type: 'stage'; id: string; cascade?: boolean } | { type: 'puzzle'; id: string };

export function planHierarchyDeletion<T extends HierarchyProject>(
  project: T,
  target: HierarchyDeleteTarget,
) {
  const reject = (code: string, message: string, details: object = {}) => ({
    ok: false as const,
    code,
    message,
    details,
  });
  const stages = project.stageTree.stages;
  const stageIds = new Set<string>();
  let parentId: string;
  if (target.type === 'stage') {
    const stage = ownEntry(stages, target.id);
    if (!stage) return reject('ENTITY_NOT_FOUND', `Stage ${target.id} does not exist.`);
    if (stage.id === project.stageTree.rootId || !stage.parentId)
      return reject('ROOT_STAGE_PROTECTED', 'The root stage cannot be deleted.');
    parentId = stage.parentId;
    const parent = ownEntry(stages, parentId);
    if (!parent || parent.childrenIds.filter((id) => id === target.id).length !== 1)
      return reject('STAGE_STRUCTURE_INVALID', 'The stage parent link is inconsistent.');
    const queue = [target.id];
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i],
        current = ownEntry(stages, id);
      if (!current || stageIds.has(id) || id === project.stageTree.rootId)
        return reject(
          'STAGE_STRUCTURE_INVALID',
          'The deletion subtree contains a missing, repeated, or root stage.',
        );
      stageIds.add(id);
      for (const childId of current.childrenIds) {
        if (ownEntry(stages, childId)?.parentId !== id)
          return reject('STAGE_STRUCTURE_INVALID', 'A child stage has an inconsistent parent.');
        queue.push(childId);
      }
    }
    // 非树形或孤立链接不能靠级联删除扩大范围，先要求显式修复结构。
    for (const stage of Object.values(stages)) {
      if (stageIds.has(stage.id)) continue;
      if (
        (stage.parentId && stageIds.has(stage.parentId)) ||
        stage.childrenIds.some(
          (id) => stageIds.has(id) && !(stage.id === parentId && id === target.id),
        )
      )
        return reject(
          'STAGE_STRUCTURE_INVALID',
          'A stage outside the subtree has a conflicting hierarchy link.',
        );
    }
  } else {
    const node = ownEntry(project.nodes, target.id);
    if (!node) return reject('ENTITY_NOT_FOUND', `Puzzle ${target.id} does not exist.`);
    parentId = node.stageId;
  }
  const nodeIds = new Set(
    Object.values(project.nodes)
      .filter((node) =>
        target.type === 'puzzle' ? node.id === target.id : stageIds.has(node.stageId),
      )
      .map((node) => node.id),
  );
  if (
    target.type === 'stage' &&
    !target.cascade &&
    (stageIds.size > 1 ||
      nodeIds.size > 0 ||
      Object.keys(stages[target.id].localVariables).length > 0)
  )
    return reject('CASCADE_REQUIRED', 'Deleting a non-empty stage requires cascade: true.', {
      stageIds: [...stageIds],
      puzzleIds: [...nodeIds],
    });
  const fsmIds = new Set(
    [...nodeIds].map((id) => project.nodes[id].stateMachineId).filter(Boolean),
  );
  const outsideOwners = Object.values(project.nodes).filter(
    (node) => !nodeIds.has(node.id) && fsmIds.has(node.stateMachineId),
  );
  if (outsideOwners.length)
    return reject(
      'FSM_SHARED_OUTSIDE_DELETION',
      'An associated FSM is still owned by a puzzle outside the deletion scope.',
      {
        owners: outsideOwners.map((node) => ({
          puzzleId: node.id,
          fsmId: node.stateMachineId,
          stageId: node.stageId,
        })),
      },
    );
  let nextStages = stages;
  if (target.type === 'stage') {
    nextStages = { ...stages };
    for (const id of stageIds) delete nextStages[id];
    const parent = nextStages[parentId];
    nextStages[parentId] = {
      ...parent,
      childrenIds: parent.childrenIds.filter((id) => !stageIds.has(id)),
    };
    nextStages = updateInitialStatusByParent(nextStages, parentId);
  }
  const nodes = { ...project.nodes },
    stateMachines = { ...project.stateMachines };
  for (const id of nodeIds) delete nodes[id];
  for (const id of fsmIds) delete stateMachines[id];
  return {
    ok: true as const,
    project: {
      ...project,
      stageTree:
        nextStages === stages ? project.stageTree : { ...project.stageTree, stages: nextStages },
      nodes,
      stateMachines,
    },
    parentId,
    stageIds: [...stageIds],
    puzzleIds: [...nodeIds],
    fsmIds: [...fsmIds],
    affectedStageIds: Object.keys(stages).filter((id) => nextStages[id] !== stages[id]),
  };
}
