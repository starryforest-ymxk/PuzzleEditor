/** FSM 修改必须核对 Puzzle 权限及局部 ID 归属，再复用 Slice；不让静默 no-op 掩盖错误。 */
import type * as z from 'zod';
import type {
  Operation,
  Ref,
  statePatchSchema,
  transitionPatchSchema,
} from '../../../contracts/automation/planSchemas';
import type { State, Transition } from '../../../types/stateMachine';
import { createState, createTransition } from '../../../utils/fsmFactories';
import { ownEntry } from '../../../utils/recordLookup';
import { condition, modifier, presentation, trigger, puzzleFields } from './bindings';
import { CommandContext, fail } from './context';

type FsmOperation = Extract<Operation, { fsm: unknown }>;
type FsmCreate = Extract<FsmOperation, { alias: string }>;
export function isFsmOperation(op: Operation): op is FsmOperation {
  return 'fsm' in op;
}

function stateFields(ctx: CommandContext, input: z.infer<typeof statePatchSchema>): Partial<State> {
  return {
    ...puzzleFields(ctx, input),
    ...(input.position !== undefined ? { position: input.position } : {}),
  };
}
function transitionFields(
  ctx: CommandContext,
  input: z.infer<typeof transitionPatchSchema>,
): Partial<Transition> {
  const result: Partial<Transition> = {};
  for (const key of ['name', 'description'] as const)
    if (input[key] !== undefined) result[key] = input[key];
  if (input.priority !== undefined) result.priority = input.priority;
  for (const key of ['fromSide', 'toSide'] as const)
    if (input[key] !== undefined) result[key] = input[key] ?? undefined;
  if (input.triggers !== undefined)
    result.triggers = input.triggers.map((item) => trigger(ctx, item));
  if (input.condition !== undefined)
    result.condition = input.condition === null ? undefined : condition(ctx, input.condition);
  if (input.presentation !== undefined)
    result.presentation =
      input.presentation === null ? undefined : presentation(ctx, input.presentation);
  if (input.invokeEventIds !== undefined)
    result.invokeEventIds = input.invokeEventIds.map((ref) => ctx.resolve(ref, 'event'));
  if (input.parameterModifiers !== undefined)
    result.parameterModifiers = input.parameterModifiers.map((item) => modifier(ctx, item));
  return result;
}
function stateId(ctx: CommandContext, fsmId: string, ref: Ref): string {
  const id = ctx.resolveInFsm(ref, 'state', fsmId);
  if (!ownEntry(ctx.fsm(fsmId).states, id))
    fail('ENTITY_NOT_FOUND', `State ${id} does not exist in FSM ${fsmId}.`);
  return id;
}

export function createFsmEntity(ctx: CommandContext, op: FsmCreate): boolean {
  const fsmId = ctx.fsmId(op.fsm);
  if (!ownEntry(ctx.project.stateMachines, fsmId)) return false;
  ctx.allowFsm(fsmId);
  const id = ctx.allocations[op.alias].id;
  if (op.op === 'state.create') {
    ctx.dispatch({
      type: 'ADD_STATE',
      payload: {
        fsmId,
        state: createState({
          ...stateFields(ctx, op.data),
          id,
          name: op.data.name,
          assetName: op.data.assetName,
          position: op.data.position,
        }),
      },
    });
    return true;
  }
  const fromStateId = ctx.resolveInFsm(op.from, 'state', fsmId);
  const toStateId = ctx.resolveInFsm(op.to, 'state', fsmId);
  // 前向 alias 可以等待创建；显式旧 ID 不存在则立即失败，不自动补节点。
  for (const ref of [op.from, op.to]) {
    if (!ownEntry(ctx.fsm(fsmId).states, ctx.resolveInFsm(ref, 'state', fsmId))) {
      if ('id' in ref) stateId(ctx, fsmId, ref);
      return false;
    }
  }
  ctx.dispatch({
    type: 'ADD_TRANSITION',
    payload: {
      fsmId,
      transition: createTransition({
        ...transitionFields(ctx, op.data),
        id,
        name: op.data.name,
        fromStateId,
        toStateId,
      }),
    },
  });
  return true;
}

export function editFsm(ctx: CommandContext, op: Exclude<FsmOperation, FsmCreate>): void {
  const fsmId = ctx.fsmId(op.fsm),
    fsm = ctx.fsm(fsmId);
  ctx.allowFsm(fsmId);
  if (op.op === 'fsm.update') {
    ctx.dispatch({ type: 'UPDATE_FSM', payload: { fsmId, data: op.changes } });
    return;
  }
  if (op.op === 'fsm.setInitial') {
    ctx.dispatch({
      type: 'UPDATE_FSM',
      payload: { fsmId, data: { initialStateId: stateId(ctx, fsmId, op.state) } },
    });
    return;
  }
  if (op.op === 'state.update' || op.op === 'state.delete') {
    const id = stateId(ctx, fsmId, op.target);
    if (op.op === 'state.update') {
      ctx.dispatch({
        type: 'UPDATE_STATE',
        payload: { fsmId, stateId: id, data: stateFields(ctx, op.changes) },
      });
      return;
    }
    if (Object.keys(fsm.states).length <= 1)
      fail('LAST_STATE_PROTECTED', `Cannot delete the last state in FSM ${fsmId}.`);
    if (op.replacementInitialState && fsm.initialStateId !== id)
      fail(
        'INVALID_INITIAL_REPLACEMENT',
        'Only deleting the current initial state accepts a replacement.',
      );
    const replacement = op.replacementInitialState
      ? stateId(ctx, fsmId, op.replacementInitialState)
      : undefined;
    if (fsm.initialStateId === id && (!replacement || replacement === id))
      fail(
        'INITIAL_STATE_REPLACEMENT_REQUIRED',
        'Deleting the initial state requires a different replacement state in the same FSM.',
      );
    const related = Object.values(fsm.transitions).filter(
      (edge) => edge.fromStateId === id || edge.toStateId === id,
    );
    if (related.length && !op.deleteTransitions)
      fail(
        'STATE_HAS_TRANSITIONS',
        `State ${id} has ${related.length} incident transition(s); set deleteTransitions to true or remove/redirect them first.`,
      );
    if (replacement)
      ctx.dispatch({
        type: 'UPDATE_FSM',
        payload: { fsmId, data: { initialStateId: replacement } },
      });
    ctx.dispatch({ type: 'DELETE_STATE', payload: { fsmId, stateId: id } });
    return;
  }
  const id = ctx.resolveInFsm(op.target, 'transition', fsmId);
  if (!ownEntry(fsm.transitions, id))
    fail('ENTITY_NOT_FOUND', `Transition ${id} does not exist in FSM ${fsmId}.`);
  if (op.op === 'transition.delete') {
    ctx.dispatch({ type: 'DELETE_TRANSITION', payload: { fsmId, transitionId: id } });
    return;
  }
  const data: Partial<Transition> =
    op.op === 'transition.update'
      ? transitionFields(ctx, op.changes)
      : {
          ...transitionFields(ctx, { fromSide: op.fromSide, toSide: op.toSide }),
          fromStateId: stateId(ctx, fsmId, op.from),
          toStateId: stateId(ctx, fsmId, op.to),
        };
  ctx.dispatch({ type: 'UPDATE_TRANSITION', payload: { fsmId, transitionId: id, data } });
}
