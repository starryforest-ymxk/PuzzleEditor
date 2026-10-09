/** 白名单遍历领域引用；常量 JSON 不参与引用解析。位置查询和黑板计数共用此入口。 */
import type { ConditionExpression, TriggerConfig } from '../types/stateMachine';
import type {
  EventListener,
  ParameterModifier,
  PresentationBinding,
  ValueSource,
  VariableScope,
} from '../types/common';
import type { ProjectLike } from './validation/types';
import type {
  ReferenceNavigationContext,
  VariableReferenceInfo,
} from './validation/globalVariableReferences';
import {
  buildPresentationUsage,
  referencePath,
  resolveLocalVariableOwner,
  type PresentationCallContext,
  type PresentationCaller,
} from './presentationUsage';
import { ownEntry } from './recordLookup';

export interface ResourceReference extends VariableReferenceInfo {
  type: 'script' | 'event' | 'presentation' | 'variable';
  id: string;
  path: string;
  pathBasis: 'normalized-project';
  ownerType?: 'project' | 'stage' | 'puzzle';
  ownerId?: string;
  scope?: VariableScope;
  resolution?: 'resolved' | 'unresolved';
  contexts?: PresentationCallContext[];
}
interface Site {
  path: string;
  location: string;
  navContext: ReferenceNavigationContext;
  context?: Pick<PresentationCaller, 'stageId' | 'nodeId'>;
  contexts?: PresentationCallContext[];
}
const at = (site: Site, key: string | number): Site => ({
  ...site,
  path: site.path + referencePath(key),
  location: `${site.location} > ${key}`,
});
export function collectResourceReferences(project: ProjectLike): ResourceReference[] {
  const refs: ResourceReference[] = [];
  const usage = buildPresentationUsage(project);
  const add = (
    type: ResourceReference['type'],
    id: string | undefined,
    site: Site,
    scope?: VariableScope,
  ) => {
    if (!id) return;
    const base = {
      type,
      id,
      path: site.path,
      pathBasis: 'normalized-project' as const,
      location: site.location,
      navContext: site.navContext,
      ...(site.contexts ? { contexts: site.contexts } : {}),
    };
    if (type !== 'variable' || scope === 'Global') {
      refs.push({ ...base, ownerType: 'project', scope });
      return;
    }
    if (scope !== 'StageLocal' && scope !== 'NodeLocal') return;
    const owners = new Map<string, ResourceReference>();
    const contexts =
      site.contexts ??
      (site.context
        ? [
            {
              caller: { ...site.context, path: site.path, field: 'presentation' as const },
              graphPath: [],
            },
          ]
        : []);
    for (const context of contexts) {
      const owner = resolveLocalVariableOwner(project, scope, id, context.caller);
      if (!owner) continue;
      const key = JSON.stringify(owner);
      const current = owners.get(key);
      if (current && site.contexts) current.contexts!.push(context);
      else
        owners.set(key, {
          ...base,
          ...owner,
          scope,
          resolution: 'resolved',
          ...(site.contexts ? { contexts: [context] } : {}),
        });
    }
    if (owners.size) refs.push(...owners.values());
    else refs.push({ ...base, scope, resolution: 'unresolved' });
  };
  const value = (source: ValueSource | undefined, site: Site) => {
    if (source?.type === 'VariableRef')
      add('variable', source.variableId, at(site, 'variableId'), source.scope);
  };
  const condition = (expr: ConditionExpression | undefined, site: Site) => {
    if (!expr) return;
    if (expr.type === 'Comparison') {
      value(expr.left, at(site, 'left'));
      value(expr.right, at(site, 'right'));
    }
    if (expr.type === 'ScriptRef') add('script', expr.scriptId, at(site, 'scriptId'));
    if (expr.type === 'And' || expr.type === 'Or')
      expr.children?.forEach((child, i) => condition(child, at(at(site, 'children'), i)));
    if (expr.type === 'Not') condition(expr.operand, at(site, 'operand'));
  };
  const modifiers = (items: ParameterModifier[] | undefined, site: Site) =>
    items?.forEach((item, i) => {
      add('variable', item.targetVariableId, at(at(site, i), 'targetVariableId'), item.targetScope);
      if (item.operation !== 'Toggle') value(item.source, at(at(site, i), 'source'));
    });
  const listeners = (items: EventListener[] | undefined, site: Site) =>
    items?.forEach((item, i) => {
      add('event', item.eventId, at(at(site, i), 'eventId'));
      if (item.action.type === 'ModifyParameter')
        modifiers(item.action.modifiers, at(at(at(site, i), 'action'), 'modifiers'));
    });
  const triggers = (items: TriggerConfig[] | undefined, site: Site) =>
    items?.forEach((item, i) => {
      if (item.type === 'OnEvent') add('event', item.eventId, at(at(site, i), 'eventId'));
      if (item.type === 'CustomScript') add('script', item.scriptId, at(at(site, i), 'scriptId'));
    });
  const binding = (item: PresentationBinding | undefined, site: Site) => {
    if (item?.type === 'Graph') add('presentation', item.graphId, at(site, 'graphId'));
    if (item?.type === 'Script') {
      add('script', item.scriptId, at(site, 'scriptId'));
      item.parameters?.forEach((parameter, i) =>
        value(parameter.source, at(at(at(site, 'parameters'), i), 'source')),
      );
    }
  };
  for (const stage of Object.values(project.stageTree.stages)) {
    const site: Site = {
      path: referencePath('stageTree', 'stages', stage.id),
      location: `Stage ${stage.name}`,
      navContext: { targetType: 'STAGE', stageId: stage.id },
      context: { stageId: stage.id },
    };
    add('script', stage.lifecycleScriptId, at(site, 'lifecycleScriptId'));
    condition(stage.unlockCondition, at(site, 'unlockCondition'));
    triggers(stage.unlockTriggers, at(site, 'unlockTriggers'));
    listeners(stage.eventListeners, at(site, 'eventListeners'));
    binding(stage.onEnterPresentation, at(site, 'onEnterPresentation'));
    binding(stage.onExitPresentation, at(site, 'onExitPresentation'));
  }
  // 每个 Puzzle 的上下文独立，损坏工程中共享 FSM 也不会丢失调用者。
  for (const node of Object.values(project.nodes)) {
    const site: Site = {
      path: referencePath('nodes', node.id),
      location: `Node ${node.name}`,
      navContext: { targetType: 'NODE', nodeId: node.id },
      context: { stageId: node.stageId, nodeId: node.id },
    };
    add('script', node.lifecycleScriptId, at(site, 'lifecycleScriptId'));
    listeners(node.eventListeners, at(site, 'eventListeners'));
    const fsm = ownEntry(project.stateMachines, node.stateMachineId);
    if (!fsm) continue;
    for (const state of Object.values(fsm.states)) {
      const current: Site = {
        ...site,
        path: referencePath('stateMachines', fsm.id, 'states', state.id),
        location: `${site.location} > State ${state.name}`,
        navContext: { targetType: 'STATE', nodeId: node.id, stateId: state.id },
      };
      add('script', state.lifecycleScriptId, at(current, 'lifecycleScriptId'));
      listeners(state.eventListeners, at(current, 'eventListeners'));
    }
    for (const transition of Object.values(fsm.transitions)) {
      const current: Site = {
        ...site,
        path: referencePath('stateMachines', fsm.id, 'transitions', transition.id),
        location: `${site.location} > Transition ${transition.name}`,
        navContext: { targetType: 'TRANSITION', nodeId: node.id, transitionId: transition.id },
      };
      condition(transition.condition, at(current, 'condition'));
      triggers(transition.triggers, at(current, 'triggers'));
      binding(transition.presentation, at(current, 'presentation'));
      modifiers(transition.parameterModifiers, at(current, 'parameterModifiers'));
      transition.invokeEventIds?.forEach((id, i) =>
        add('event', id, at(at(current, 'invokeEventIds'), i)),
      );
    }
  }
  for (const graph of Object.values(project.presentationGraphs ?? {})) {
    for (const node of Object.values(graph.nodes)) {
      const site: Site = {
        path: referencePath('presentationGraphs', graph.id, 'nodes', node.id),
        location: `Presentation ${graph.name} > Node ${node.name}`,
        navContext: {
          targetType: 'PRESENTATION_NODE',
          graphId: graph.id,
          presentationNodeId: node.id,
        },
        contexts: usage.contexts.get(graph.id) ?? [],
      };
      binding(node.presentation, at(site, 'presentation'));
      condition(node.condition, at(site, 'condition'));
    }
  }
  return refs;
}
export function findResourceReferences(
  project: ProjectLike,
  target: Pick<ResourceReference, 'type' | 'id' | 'ownerType' | 'ownerId'>,
  index?: ResourceReferenceIndex,
) {
  return (index ?? createResourceReferenceIndex(project)).find(target);
}

/** 批量查询显式持有本次快照索引，避免每个资源重建；不建立跨项目全局缓存。 */
export function createResourceReferenceIndex(project: ProjectLike) {
  const groups = new Map<string, ResourceReference[]>();
  for (const ref of collectResourceReferences(project)) {
    const key = JSON.stringify([ref.type, ref.id]);
    const list = groups.get(key) ?? [];
    list.push(ref);
    groups.set(key, list);
  }
  return {
    find: (target: Pick<ResourceReference, 'type' | 'id' | 'ownerType' | 'ownerId'>) =>
      (groups.get(JSON.stringify([target.type, target.id])) ?? []).filter(
        (ref) =>
          (!target.ownerType || ref.ownerType === target.ownerType) &&
          (!target.ownerId || ref.ownerId === target.ownerId),
      ),
  };
}
export type ResourceReferenceIndex = ReturnType<typeof createResourceReferenceIndex>;
