/** 声明先按归属依赖创建，随后依序编辑；任何失败只丢弃候选，不影响传入工程。 */
import type { ProjectData } from '../../../types/project';
import type { Plan, Operation } from '../../../contracts/automation/planSchemas';
import type { VariableDefinition } from '../../../types/blackboard';
import type { ScriptDefinition } from '../../../types/manifest';
import type { ResourceState } from '../../../types/common';
import { ownEntry } from '../../../utils/recordLookup';
import { variableValueMatches } from '../../../utils/parameterCompatibility';
import { createDefaultStage, canMoveStage } from '../../../utils/stageTreeUtils';
import { createNodeWithStateMachine } from '../../../utils/puzzleNodeUtils';
import { planHierarchyDeletion } from '../../../utils/hierarchyDeletion';
import {
  resolveDeleteAction,
  canTransitionResourceStateFromAutomation,
} from '../../../utils/resourceLifecycle';
import { CommandContext, CommandFailure, fail } from './context';
import { stageFields, puzzleFields } from './bindings';
import { createFsmEntity, editFsm, isFsmOperation } from './fsm';
import {
  createPresentationEntity,
  editPresentation,
  isPresentationOperation,
} from './presentation';

export { CommandFailure } from './context';
export function assertVariableValue(variable: Pick<VariableDefinition, 'type' | 'value'>) {
  const { type, value } = variable;
  if (!variableValueMatches(type, value))
    fail(
      'VARIABLE_VALUE_TYPE',
      `Value must match variable type ${type}; no coercion is performed.`,
    );
}
function assertScript(script: Pick<ScriptDefinition, 'category' | 'lifecycleType'>) {
  if (script.category === 'Lifecycle' ? !script.lifecycleType : script.lifecycleType !== undefined)
    fail(
      'SCRIPT_TARGET_INVALID',
      'Lifecycle scripts require a lifecycleType; other script categories must not have one.',
    );
}
function assertIndex(index: number, length: number, append = false) {
  if (index < 0 || index > (append ? length : length - 1))
    fail('INDEX_OUT_OF_RANGE', `Index ${index} is outside the target list.`);
}
function deleteState(state: ResourceState): ResourceState | null {
  if (state === 'MarkedForDelete')
    fail(
      'PERMANENT_DELETE_FORBIDDEN',
      'Ordinary delete cannot permanently remove marked resources. Use an explicit purge operation with agent-chat authorization.',
    );
  const result = resolveDeleteAction(state);
  return result.shouldRemove ? null : result.nextState;
}
function assertPurge(state: ResourceState) {
  if (state === 'Draft')
    fail(
      'PURGE_REQUIRES_PROTECTED_RESOURCE',
      'Use ordinary delete for Draft resources; purge requires Implemented or MarkedForDelete.',
    );
}
function restoreState(state: ResourceState): ResourceState {
  if (
    state !== 'MarkedForDelete' ||
    !canTransitionResourceStateFromAutomation(state, 'Implemented')
  )
    fail('INVALID_RESOURCE_TRANSITION', 'Only marked resources can be restored.');
  return 'Implemented';
}
function unlockedInitial(isInitial: boolean | undefined, data: ReturnType<typeof stageFields>) {
  if (isInitial && (data.unlockCondition || (data.unlockTriggers?.length ?? 0) > 0))
    fail('INITIAL_STAGE_UNLOCK', 'Initial stages cannot have unlock conditions or triggers.');
}
function create(ctx: CommandContext, op: Operation): boolean {
  if (!('alias' in op)) return true;
  if (isFsmOperation(op)) return createFsmEntity(ctx, op);
  if (isPresentationOperation(op)) return createPresentationEntity(ctx, op);
  const allocated = ctx.allocations[op.alias];
  if (op.op === 'stage.create') {
    const parentId = ctx.resolve(op.parent, 'stage');
    if (!ownEntry(ctx.project.stageTree.stages, parentId)) return false;
    ctx.inheritStage(allocated.id, parentId);
    const data = stageFields(ctx, op.data);
    unlockedInitial(ctx.stage(parentId).childrenIds.length === 0, data);
    const stage = { ...createDefaultStage(parentId, [], op.data.name), ...data, id: allocated.id };
    ctx.dispatch({ type: 'ADD_STAGE', payload: { parentId, stage } });
  } else if (op.op === 'puzzle.create') {
    const stageId = ctx.resolve(op.stage, 'stage');
    if (!ownEntry(ctx.project.stageTree.stages, stageId)) return false;
    ctx.inheritPuzzle(allocated.id, stageId);
    const order =
      Math.max(
        -1,
        ...Object.values(ctx.project.nodes)
          .filter((n) => n.stageId === stageId)
          .map((n) => n.displayOrder ?? 0),
      ) + 1;
    const defaults = createNodeWithStateMachine(
      stageId,
      { nodeIds: [], fsmIds: [], stateIds: [] },
      op.data.name,
      order,
    );
    const { alias: _initialAlias, ...initialData } = op.initialState;
    const initial = {
      ...Object.values(defaults.stateMachine.states)[0],
      ...initialData,
      id: allocated.initialStateId!,
    };
    const stateMachine = {
      ...defaults.stateMachine,
      id: allocated.fsmId!,
      initialStateId: initial.id,
      states: { [initial.id]: initial },
    };
    const node = {
      ...defaults.node,
      ...puzzleFields(ctx, op.data),
      id: allocated.id,
      stateMachineId: stateMachine.id,
    };
    ctx.dispatch({ type: 'ADD_PUZZLE_NODE', payload: { stageId, node, stateMachine } });
  } else if (op.op === 'variable.create') {
    const owner = ctx.owner(op.owner);
    if (owner.type === 'stage' && !ownEntry(ctx.project.stageTree.stages, owner.id!)) return false;
    if (owner.type === 'puzzle' && !ownEntry(ctx.project.nodes, owner.id!)) return false;
    assertVariableValue(op.data);
    ctx.addVariable(owner, {
      ...op.data,
      id: allocated.id,
      scope: ctx.variableScope(owner),
      state: 'Draft',
    });
  } else if (op.op === 'event.create') {
    ctx.allowGlobal('event');
    ctx.dispatch({
      type: 'ADD_EVENT',
      payload: { event: { ...op.data, id: allocated.id, state: 'Draft' } },
    });
  } else if (op.op === 'script.create') {
    ctx.allowGlobal('script');
    assertScript(op.data);
    ctx.dispatch({
      type: 'ADD_SCRIPT',
      payload: { script: { ...op.data, id: allocated.id, state: 'Draft' } },
    });
  }
  return true;
}
function edit(ctx: CommandContext, op: Operation): void {
  if ('alias' in op) return;
  if (isFsmOperation(op)) return editFsm(ctx, op);
  if (isPresentationOperation(op)) return editPresentation(ctx, op);
  if (op.op === 'stage.delete' || op.op === 'puzzle.delete') {
    const target =
      op.op === 'stage.delete'
        ? { type: 'stage' as const, id: ctx.resolve(op.target, 'stage'), cascade: op.cascade }
        : { type: 'puzzle' as const, id: ctx.resolve(op.target, 'puzzle') };
    const deletion = planHierarchyDeletion(ctx.project, target);
    if (!deletion.ok) throw new CommandFailure(deletion.code, deletion.message, deletion.details);
    // 父级 childrenIds 和后继初始项也是实际改动，不因删除子树自动扩大 scope。
    deletion.affectedStageIds.forEach((id) => ctx.allowStage(id));
    deletion.puzzleIds.forEach((id) => ctx.allowPuzzle(id));
    ctx.dispatch(
      target.type === 'stage'
        ? { type: 'DELETE_STAGE', payload: { stageId: target.id } }
        : { type: 'DELETE_PUZZLE_NODE', payload: { nodeId: target.id } },
    );
    return;
  }
  if (op.op === 'project.update') {
    if (!ctx.plan.scope.project)
      fail('SCOPE_VIOLATION', 'Project metadata requires project scope.');
    ctx.dispatch({ type: 'UPDATE_PROJECT_META', payload: op.changes });
    return;
  }
  if (op.op === 'stage.update') {
    const stageId = ctx.resolve(op.target, 'stage'),
      stage = ctx.stage(stageId);
    ctx.allowStage(stageId);
    const data = stageFields(ctx, op.changes);
    unlockedInitial(stage.isInitial, data);
    ctx.dispatch({ type: 'UPDATE_STAGE', payload: { stageId, data } });
    return;
  }
  if (op.op === 'stage.move' || op.op === 'stage.reorder') {
    const stageId = ctx.resolve(op.target, 'stage'),
      stage = ctx.stage(stageId);
    ctx.allowStage(stageId);
    if (!stage.parentId)
      fail('ROOT_STAGE_PROTECTED', 'The root stage cannot be moved or reordered.');
    ctx.allowStage(stage.parentId!);
    const newParentId = op.op === 'stage.move' ? ctx.resolve(op.parent, 'stage') : stage.parentId!;
    const parent = ctx.stage(newParentId);
    ctx.allowStage(parent.id);
    if (!canMoveStage(ctx.project.stageTree, stageId, newParentId))
      fail('STAGE_CYCLE', 'Cannot move a stage into itself or a descendant.');
    const sameParent = newParentId === stage.parentId;
    const insertIndex =
      op.index ?? (sameParent ? parent.childrenIds.indexOf(stageId) : parent.childrenIds.length);
    assertIndex(insertIndex, parent.childrenIds.length, !sameParent);
    ctx.dispatch(
      sameParent
        ? { type: 'REORDER_STAGE', payload: { stageId, newIndex: insertIndex } }
        : { type: 'MOVE_STAGE', payload: { stageId, newParentId, insertIndex } },
    );
    return;
  }
  if (op.op === 'puzzle.update') {
    const nodeId = ctx.resolve(op.target, 'puzzle');
    ctx.puzzle(nodeId);
    ctx.allowPuzzle(nodeId);
    ctx.dispatch({ type: 'UPDATE_NODE', payload: { nodeId, data: puzzleFields(ctx, op.changes) } });
    return;
  }
  if (op.op === 'puzzle.reorder') {
    const stageId = ctx.resolve(op.stage, 'stage');
    ctx.stage(stageId);
    ctx.allowStage(stageId);
    const ids = op.order.map((r) => ctx.resolve(r, 'puzzle'));
    const existing = Object.values(ctx.project.nodes)
      .filter((n) => n.stageId === stageId)
      .map((n) => n.id);
    if (
      ids.length !== existing.length ||
      new Set(ids).size !== ids.length ||
      existing.some((id) => !ids.includes(id))
    )
      fail('INCOMPLETE_ORDER', 'Order must list every puzzle in this stage exactly once.');
    ctx.dispatch({ type: 'REORDER_PUZZLE_NODES', payload: { stageId, nodeIds: ids } });
    return;
  }
  if (op.op === 'puzzle.move') {
    const nodeId = ctx.resolve(op.target, 'puzzle'),
      node = ctx.puzzle(nodeId),
      stageId = ctx.resolve(op.stage, 'stage');
    ctx.stage(stageId);
    ctx.allowPuzzle(nodeId);
    ctx.allowStage(node.stageId);
    ctx.allowStage(stageId);
    const ids = Object.values(ctx.project.nodes)
      .filter((n) => n.stageId === stageId && n.id !== nodeId)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((n) => n.id);
    const insertIndex = op.index ?? ids.length;
    assertIndex(insertIndex, ids.length, true);
    ids.splice(insertIndex, 0, nodeId);
    ctx.dispatch({ type: 'UPDATE_NODE', payload: { nodeId, data: { stageId } } });
    ctx.dispatch({ type: 'REORDER_PUZZLE_NODES', payload: { stageId, nodeIds: ids } });
    return;
  }
  if (
    op.op === 'variable.update' ||
    op.op === 'variable.move' ||
    op.op === 'variable.delete' ||
    op.op === 'variable.purge' ||
    op.op === 'variable.restore'
  ) {
    const id = ctx.resolve(op.target, 'variable'),
      owner = ctx.owner(op.owner);
    ctx.allowOwner(owner);
    const variable =
      ownEntry(ctx.variables(owner), id) ??
      fail('ENTITY_NOT_FOUND', `Variable ${id} does not exist in the supplied owner.`);
    if (op.op === 'variable.update') {
      assertVariableValue({ ...variable, ...op.changes });
      ctx.updateVariable(owner, id, op.changes);
    } else if (op.op === 'variable.move') {
      const destination = ctx.owner(op.destination);
      ctx.allowOwner(destination);
      if (owner.type === destination.type && owner.id === destination.id) return;
      if (ownEntry(ctx.variables(destination), id))
        fail('ENTITY_CONFLICT', 'A variable with the same ID exists in the destination.');
      ctx.removeVariable(owner, id);
      ctx.addVariable(destination, { ...variable, scope: ctx.variableScope(destination) });
    } else if (op.op === 'variable.purge') {
      assertPurge(variable.state);
      ctx.removeVariable(owner, id);
    } else if (op.op === 'variable.restore')
      ctx.updateVariable(owner, id, { state: restoreState(variable.state) });
    else {
      const state = deleteState(variable.state);
      if (state) ctx.updateVariable(owner, id, { state });
      else ctx.removeVariable(owner, id);
    }
    return;
  }
  if (
    op.op === 'event.update' ||
    op.op === 'event.delete' ||
    op.op === 'event.restore' ||
    op.op === 'event.purge'
  ) {
    ctx.allowGlobal('event');
    const id = ctx.resolve(op.target, 'event'),
      event =
        ownEntry(ctx.project.blackboard.events, id) ??
        fail('ENTITY_NOT_FOUND', `Event ${id} does not exist.`);
    if (op.op === 'event.update')
      ctx.dispatch({ type: 'UPDATE_EVENT', payload: { id, data: op.changes } });
    else if (op.op === 'event.purge') {
      assertPurge(event.state);
      ctx.dispatch({ type: 'APPLY_DELETE_EVENT', payload: { id } });
    } else if (op.op === 'event.restore')
      ctx.dispatch({
        type: 'UPDATE_EVENT',
        payload: { id, data: { state: restoreState(event.state) } },
      });
    else {
      deleteState(event.state);
      ctx.dispatch({ type: 'SOFT_DELETE_EVENT', payload: { id } });
    }
    return;
  }
  if (
    op.op === 'script.update' ||
    op.op === 'script.delete' ||
    op.op === 'script.restore' ||
    op.op === 'script.purge'
  ) {
    ctx.allowGlobal('script');
    const id = ctx.resolve(op.target, 'script'),
      script =
        ownEntry(ctx.project.scripts.scripts, id) ??
        fail('ENTITY_NOT_FOUND', `Script ${id} does not exist.`);
    if (op.op === 'script.update') {
      const { lifecycleType, ...changes } = op.changes;
      const data: Partial<ScriptDefinition> = {
        ...changes,
        ...(lifecycleType !== undefined ? { lifecycleType: lifecycleType ?? undefined } : {}),
      };
      assertScript({ ...script, ...data });
      ctx.dispatch({ type: 'UPDATE_SCRIPT', payload: { id, data } });
    } else if (op.op === 'script.purge') {
      assertPurge(script.state);
      ctx.dispatch({ type: 'APPLY_DELETE_SCRIPT', payload: { id } });
    } else if (op.op === 'script.restore')
      ctx.dispatch({
        type: 'UPDATE_SCRIPT',
        payload: { id, data: { state: restoreState(script.state) } },
      });
    else {
      deleteState(script.state);
      ctx.dispatch({ type: 'SOFT_DELETE_SCRIPT', payload: { id } });
    }
  }
}
export function executePlan(source: ProjectData, plan: Plan) {
  const ctx = new CommandContext(source, plan);
  const attempt = (i: number, fn: () => boolean | void) => {
    try {
      return fn();
    } catch (error) {
      if (error instanceof CommandFailure) error.operationIndex = i;
      throw error;
    }
  };
  let pending = plan.commands.map((op, i) => ({ op, i })).filter(({ op }) => 'alias' in op);
  while (pending.length) {
    const next = pending.filter(({ op, i }) => !attempt(i, () => create(ctx, op)));
    if (next.length === pending.length) {
      const error = new CommandFailure(
        'CREATION_DEPENDENCY',
        'A creation owner or endpoint is missing, or the declarations form a dependency cycle.',
      );
      error.operationIndex = next[0].i;
      throw error;
    }
    pending = next;
  }
  plan.commands.forEach((op, i) => attempt(i, () => edit(ctx, op)));
  return { project: ctx.project, allocations: ctx.allocations };
}
