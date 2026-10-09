/** 资源身份与实际移除的唯一比较入口；局部 ID 必须连同所属对象解释。 */
import type { ProjectData } from '../types/project';
import type { VariableDefinition, EventDefinition } from '../types/blackboard';
import type { ScriptDefinition } from '../types/manifest';

type ResourceProject = Pick<ProjectData, 'meta' | 'stageTree' | 'nodes' | 'blackboard' | 'scripts'>;
export interface ResourceIdentity {
  type: 'variable' | 'event' | 'script';
  id: string;
  ownerType?: 'project' | 'stage' | 'puzzle';
  ownerId?: string;
}
export interface ProjectResource {
  ref: ResourceIdentity;
  path: string;
  value: VariableDefinition | EventDefinition | ScriptDefinition;
  stageId?: string;
  nodeId?: string;
}
export const projectPointer = (...parts: string[]) =>
  '/' + parts.map((part) => part.replaceAll('~', '~0').replaceAll('/', '~1')).join('/');
export const resourceKey = (ref: ResourceIdentity) =>
  JSON.stringify([ref.type, ref.id, ref.ownerType ?? null, ref.ownerId ?? null]);

export function projectResources(project: ResourceProject): ProjectResource[] {
  const result: ProjectResource[] = [];
  for (const stage of Object.values(project.stageTree.stages))
    for (const variable of Object.values(stage.localVariables))
      result.push({
        ref: { type: 'variable', id: variable.id, ownerType: 'stage', ownerId: stage.id },
        path: projectPointer('stageTree', 'stages', stage.id, 'localVariables', variable.id),
        value: variable,
        stageId: stage.id,
      });
  for (const node of Object.values(project.nodes))
    for (const variable of Object.values(node.localVariables))
      result.push({
        ref: { type: 'variable', id: variable.id, ownerType: 'puzzle', ownerId: node.id },
        path: projectPointer('nodes', node.id, 'localVariables', variable.id),
        value: variable,
        stageId: node.stageId,
        nodeId: node.id,
      });
  for (const variable of Object.values(project.blackboard.globalVariables))
    result.push({
      ref: { type: 'variable', id: variable.id, ownerType: 'project', ownerId: project.meta.id },
      path: projectPointer('blackboard', 'globalVariables', variable.id),
      value: variable,
    });
  for (const event of Object.values(project.blackboard.events))
    result.push({
      ref: { type: 'event', id: event.id },
      path: projectPointer('blackboard', 'events', event.id),
      value: event,
    });
  for (const script of Object.values(project.scripts.scripts))
    result.push({
      ref: { type: 'script', id: script.id },
      path: projectPointer('scripts', 'scripts', script.id),
      value: script,
    });
  return result;
}

export function compareProjectResources(before: ResourceProject, after: ResourceProject) {
  const old = new Map(projectResources(before).map((entry) => [resourceKey(entry.ref), entry]));
  const added = new Map<string, ProjectResource>();
  const retained: { before: ProjectResource; after: ProjectResource }[] = [];
  for (const entry of projectResources(after)) {
    const key = resourceKey(entry.ref),
      previous = old.get(key);
    if (previous) {
      retained.push({ before: previous, after: entry });
      old.delete(key);
    } else added.set(key, entry);
  }
  // 合法变量搬移不是永久删除；仅未匹配的同 ID 两端都唯一时才能承认身份延续。
  const groups = (entries: Iterable<ProjectResource>) => {
    const result = new Map<string, ProjectResource[]>();
    for (const entry of entries) {
      if (entry.ref.type !== 'variable') continue;
      const group = result.get(entry.ref.id) ?? [];
      group.push(entry);
      result.set(entry.ref.id, group);
    }
    return result;
  };
  const oldGroups = groups(old.values());
  for (const [id, entries] of groups(added.values())) {
    const previous = oldGroups.get(id);
    if (entries.length !== 1 || previous?.length !== 1) continue;
    retained.push({ before: previous[0], after: entries[0] });
    old.delete(resourceKey(previous[0].ref));
    added.delete(resourceKey(entries[0].ref));
  }
  const removed = [...old.values()];
  return {
    retained,
    added: [...added.values()],
    removed,
    permanent: removed.filter((entry) => entry.value.state !== 'Draft'),
  };
}
