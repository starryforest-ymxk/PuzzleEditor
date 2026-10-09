/** 只转换契约规定的引用字段；常量 JSON 不做字符串替换，避免误改业务内容。 */
import type * as z from 'zod';
import type { ConditionExpression, TriggerConfig } from '../../../types/stateMachine';
import type {
  ValueSource,
  EventListener,
  PresentationBinding,
  ParameterModifier,
} from '../../../types/common';
import {
  conditionSchema,
  listenerSchema,
  presentationBindingSchema,
  modifierSchema,
  valueSourceSchema,
  stagePatchSchema,
  puzzlePatchSchema,
  triggerSchema,
} from '../../../contracts/automation/planSchemas';
import { CommandContext } from './context';

export function source(ctx: CommandContext, input: z.infer<typeof valueSourceSchema>): ValueSource {
  return input.type === 'Constant'
    ? input
    : { ...input, variableId: ctx.resolve(input.variableId, 'variable') };
}
export function condition(
  ctx: CommandContext,
  input: z.infer<typeof conditionSchema>,
): ConditionExpression {
  return {
    ...input,
    children: input.children?.map((c) => condition(ctx, c)),
    operand: input.operand ? condition(ctx, input.operand) : undefined,
    left: input.left ? source(ctx, input.left) : undefined,
    right: input.right ? source(ctx, input.right) : undefined,
    scriptId: input.scriptId ? ctx.resolve(input.scriptId, 'script') : undefined,
  };
}
export function modifier(
  ctx: CommandContext,
  input: z.infer<typeof modifierSchema>,
): ParameterModifier {
  return {
    ...input,
    targetVariableId: ctx.resolve(input.targetVariableId, 'variable'),
    source: source(ctx, input.source),
  };
}
export function listener(
  ctx: CommandContext,
  input: z.infer<typeof listenerSchema>,
): EventListener {
  return {
    eventId: ctx.resolve(input.eventId, 'event'),
    action:
      input.action.type === 'InvokeScript'
        ? input.action
        : { ...input.action, modifiers: input.action.modifiers.map((m) => modifier(ctx, m)) },
  };
}
export function presentation(
  ctx: CommandContext,
  input: z.infer<typeof presentationBindingSchema>,
): PresentationBinding {
  if (input.type === 'Graph')
    return { type: 'Graph', graphId: ctx.resolve(input.graphId, 'presentation') };
  return {
    type: 'Script',
    scriptId: ctx.resolve(input.scriptId, 'script'),
    parameters: input.parameters.map((p, i) =>
      'tempVariable' in p
        ? {
            ...p,
            source: source(ctx, p.source),
            tempVariable: { ...p.tempVariable, id: `TEMP_${i + 1}` },
          }
        : { ...p, source: source(ctx, p.source) },
    ),
  };
}
export function trigger(ctx: CommandContext, input: z.infer<typeof triggerSchema>): TriggerConfig {
  if (input.type === 'OnEvent') return { ...input, eventId: ctx.resolve(input.eventId, 'event') };
  if (input.type === 'CustomScript')
    return { ...input, scriptId: ctx.resolve(input.scriptId, 'script') };
  return input;
}
export function stageFields(ctx: CommandContext, input: z.infer<typeof stagePatchSchema>) {
  const result: {
    [
      K in keyof import('../../../types/stage').StageNode
    ]?: import('../../../types/stage').StageNode[K];
  } = {};
  for (const key of ['name', 'assetName', 'description'] as const)
    if (input[key] !== undefined) result[key] = input[key];
  if (input.lifecycleScriptId !== undefined)
    result.lifecycleScriptId =
      input.lifecycleScriptId === null ? undefined : ctx.resolve(input.lifecycleScriptId, 'script');
  if (input.eventListeners !== undefined)
    result.eventListeners = input.eventListeners.map((l) => listener(ctx, l));
  if (input.unlockCondition !== undefined)
    result.unlockCondition =
      input.unlockCondition === null ? undefined : condition(ctx, input.unlockCondition);
  if (input.unlockTriggers !== undefined)
    result.unlockTriggers = input.unlockTriggers.map((t) => trigger(ctx, t));
  for (const key of ['onEnterPresentation', 'onExitPresentation'] as const)
    if (input[key] !== undefined)
      result[key] = input[key] === null ? undefined : presentation(ctx, input[key]);
  return result;
}
export function puzzleFields(
  ctx: CommandContext,
  input: z.infer<typeof puzzlePatchSchema>,
): Partial<import('../../../types/puzzleNode').PuzzleNode> {
  return stageFields(ctx, input);
}
