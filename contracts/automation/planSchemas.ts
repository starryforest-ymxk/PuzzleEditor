/** 领域计划只开放明确意图和白名单字段；不提供通用 JSON/Action 写入口。 */
import * as z from 'zod';
import { overwriteExpectationSchema, validOutputMode } from './overwriteSchemas';
import type { ConditionExpression } from '../../types/stateMachine';
import { POLICY_VERSION, requiredCapabilitiesSchema } from './permissions';
import {
  API_VERSION,
  nonEmptyString,
  hashSchema,
  assetIdentitySchema,
  assetNameSchema,
  projectIdentitySchema,
} from './primitives';

const safeId = nonEmptyString.regex(
  /^(?!(?:__proto__|constructor|prototype)$)/,
  'Reserved identifier.',
);
const alias = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/);
export const refSchema = z.union([z.strictObject({ id: safeId }), z.strictObject({ alias })]);
export type Ref = z.infer<typeof refSchema>;
export const fsmRefSchema = z.union([
  z.strictObject({ id: safeId }),
  z.strictObject({ puzzle: refSchema }),
]);
export type FsmRef = z.infer<typeof fsmRefSchema>;
export const ownerSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('global') }),
  z.strictObject({ type: z.literal('stage'), ref: refSchema }),
  z.strictObject({ type: z.literal('puzzle'), ref: refSchema }),
]);
export type Owner = z.infer<typeof ownerSchema>;
const variableType = z.enum(['boolean', 'integer', 'float', 'string']);
const scopeType = z.enum(['Global', 'StageLocal', 'NodeLocal']);
export const valueSourceSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('Constant'), value: z.json() }),
  z.strictObject({ type: z.literal('VariableRef'), variableId: refSchema, scope: scopeType }),
]);
type InputSource = z.infer<typeof valueSourceSchema>;
type ConditionInput = Omit<
  ConditionExpression,
  'children' | 'operand' | 'left' | 'right' | 'scriptId'
> & {
  children?: ConditionInput[];
  operand?: ConditionInput;
  left?: InputSource;
  right?: InputSource;
  scriptId?: Ref;
};
export const conditionSchema: z.ZodType<ConditionInput> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('And'), children: z.array(conditionSchema).min(1) }),
    z.strictObject({ type: z.literal('Or'), children: z.array(conditionSchema).min(1) }),
    z.strictObject({ type: z.literal('Not'), operand: conditionSchema }),
    z.strictObject({ type: z.literal('Literal'), value: z.boolean() }),
    z.strictObject({
      type: z.literal('Comparison'),
      operator: z.enum(['==', '!=', '>', '<', '>=', '<=']),
      left: valueSourceSchema,
      right: valueSourceSchema,
    }),
    z.strictObject({ type: z.literal('ScriptRef'), scriptId: refSchema }),
  ]),
);
export const triggerSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('Always') }),
  z.strictObject({ type: z.literal('HandledByScript') }),
  z.strictObject({ type: z.literal('OnEvent'), eventId: refSchema }),
  z.strictObject({ type: z.literal('CustomScript'), scriptId: refSchema }),
]);
export const modifierSchema = z.strictObject({
  targetVariableId: refSchema,
  targetScope: scopeType,
  operation: z.enum(['Set', 'Add', 'Subtract', 'Multiply', 'Divide', 'Toggle']),
  source: valueSourceSchema,
});
export const listenerSchema = z.strictObject({
  eventId: refSchema,
  action: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('InvokeScript') }),
    z.strictObject({ type: z.literal('ModifyParameter'), modifiers: z.array(modifierSchema) }),
  ]),
});
const parameter = z.strictObject({
  paramName: assetNameSchema,
  source: valueSourceSchema,
  description: z.string().optional(),
});
const temporaryParameter = z.strictObject({
  paramName: assetNameSchema,
  kind: z.literal('Temporary'),
  source: valueSourceSchema,
  tempVariable: z.strictObject({
    name: nonEmptyString,
    type: variableType,
    description: z.string().optional(),
  }),
  description: z.string().optional(),
});
export const presentationBindingSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('Script'),
    scriptId: refSchema,
    parameters: z.array(z.union([parameter, temporaryParameter])),
  }),
  z.strictObject({ type: z.literal('Graph'), graphId: refSchema }),
]);
const identityFields = {
  name: nonEmptyString.optional(),
  assetName: assetNameSchema.optional(),
  description: z.string().optional(),
};
const entityFields = {
  ...identityFields,
  lifecycleScriptId: refSchema.nullable().optional(),
  eventListeners: z.array(listenerSchema).optional(),
};
export const stagePatchSchema = z.strictObject({
  ...entityFields,
  unlockTriggers: z.array(triggerSchema).optional(),
  unlockCondition: conditionSchema.nullable().optional(),
  onEnterPresentation: presentationBindingSchema.nullable().optional(),
  onExitPresentation: presentationBindingSchema.nullable().optional(),
});
export const puzzlePatchSchema = z.strictObject(entityFields);
const positionSchema = z.strictObject({ x: z.number(), y: z.number() });
const sideSchema = z.enum(['top', 'right', 'bottom', 'left']);
// 导出器按非负整数处理优先级；CLI 提前拒绝会被导出静默截断或归零的输入。
const prioritySchema = z.number().int().nonnegative();
export const statePatchSchema = puzzlePatchSchema.extend({ position: positionSchema.optional() });
export const transitionPatchSchema = z.strictObject({
  name: nonEmptyString.optional(),
  description: z.string().optional(),
  priority: prioritySchema.optional(),
  triggers: z.array(triggerSchema).optional(),
  condition: conditionSchema.nullable().optional(),
  presentation: presentationBindingSchema.nullable().optional(),
  invokeEventIds: z.array(refSchema).optional(),
  parameterModifiers: z.array(modifierSchema).optional(),
  fromSide: sideSchema.nullable().optional(),
  toSide: sideSchema.nullable().optional(),
});
const resourceFields = {
  ...identityFields,
  displayOrder: z.number().int().nonnegative().optional(),
};
const resourceData = assetIdentitySchema.extend({
  description: z.string().optional(),
  displayOrder: z.number().int().nonnegative().optional(),
});
const scriptCategory = z.enum(['Performance', 'Lifecycle', 'Condition', 'Trigger']);
const lifecycleType = z.enum(['Stage', 'Node', 'State']);
const index = z.number().int().nonnegative();
const presentationMetadata = z.strictObject({
  name: nonEmptyString.optional(),
  description: z.string().optional(),
  displayOrder: index.optional(),
});
export const presentationNodePatchSchema = z.strictObject({
  name: nonEmptyString.optional(),
  description: z.string().optional(),
  type: z.enum(['PresentationNode', 'Wait', 'Branch', 'Parallel']).optional(),
  position: positionSchema.optional(),
  duration: z.number().nonnegative().nullable().optional(),
  condition: conditionSchema.nullable().optional(),
  presentation: presentationBindingSchema.nullable().optional(),
});
// 分支采用语义槽位，Parallel 采用有序索引；不开放 nextIds 整组替换。
const edgeSlot = z.union([z.enum(['true', 'false', 'next']), index]);
const edgeFields = { graph: refSchema, from: refSchema, slot: edgeSlot };
const edgeStyle = z.strictObject({
  fromSide: sideSchema.nullable().optional(),
  toSide: sideSchema.nullable().optional(),
});
const scalar = z.union([z.boolean(), z.number(), z.string()]);
const operations = [
  z.strictObject({
    op: z.literal('project.update'),
    changes: z.strictObject({
      name: nonEmptyString.optional(),
      description: z.string().optional(),
      version: nonEmptyString.optional(),
      exportFileName: z.string().optional(),
      exportPath: z.string().optional(),
    }),
  }),
  z.strictObject({
    op: z.literal('stage.create'),
    alias,
    parent: refSchema,
    data: stagePatchSchema.extend(assetIdentitySchema.shape),
  }),
  z.strictObject({ op: z.literal('stage.update'), target: refSchema, changes: stagePatchSchema }),
  z.strictObject({
    op: z.literal('stage.move'),
    target: refSchema,
    parent: refSchema,
    index: index.optional(),
  }),
  z.strictObject({ op: z.literal('stage.reorder'), target: refSchema, index }),
  z.strictObject({
    op: z.literal('stage.delete'),
    target: refSchema,
    cascade: z.boolean().optional(),
  }),
  z.strictObject({
    op: z.literal('puzzle.create'),
    alias,
    stage: refSchema,
    data: puzzlePatchSchema.extend(assetIdentitySchema.shape),
    initialState: assetIdentitySchema.extend({
      description: z.string().optional(),
      alias: alias.optional(),
    }),
  }),
  z.strictObject({ op: z.literal('puzzle.update'), target: refSchema, changes: puzzlePatchSchema }),
  z.strictObject({
    op: z.literal('puzzle.move'),
    target: refSchema,
    stage: refSchema,
    index: index.optional(),
  }),
  z.strictObject({ op: z.literal('puzzle.reorder'), stage: refSchema, order: z.array(refSchema) }),
  z.strictObject({ op: z.literal('puzzle.delete'), target: refSchema }),
  z.strictObject({
    op: z.literal('variable.create'),
    alias,
    owner: ownerSchema,
    data: resourceData.extend({ type: variableType, value: scalar }),
  }),
  z.strictObject({
    op: z.literal('variable.update'),
    target: refSchema,
    owner: ownerSchema,
    changes: z.strictObject({
      ...resourceFields,
      type: variableType.optional(),
      value: scalar.optional(),
    }),
  }),
  z.strictObject({
    op: z.literal('variable.move'),
    target: refSchema,
    owner: ownerSchema,
    destination: ownerSchema,
  }),
  z.strictObject({ op: z.literal('variable.delete'), target: refSchema, owner: ownerSchema }),
  z.strictObject({ op: z.literal('variable.purge'), target: refSchema, owner: ownerSchema }),
  z.strictObject({ op: z.literal('variable.restore'), target: refSchema, owner: ownerSchema }),
  z.strictObject({ op: z.literal('event.create'), alias, data: resourceData }),
  z.strictObject({
    op: z.literal('event.update'),
    target: refSchema,
    changes: z.strictObject(resourceFields),
  }),
  z.strictObject({ op: z.literal('event.delete'), target: refSchema }),
  z.strictObject({ op: z.literal('event.purge'), target: refSchema }),
  z.strictObject({ op: z.literal('event.restore'), target: refSchema }),
  z.strictObject({
    op: z.literal('script.create'),
    alias,
    data: resourceData.extend({
      category: scriptCategory,
      lifecycleType: lifecycleType.optional(),
    }),
  }),
  z.strictObject({
    op: z.literal('script.update'),
    target: refSchema,
    changes: z.strictObject({
      ...resourceFields,
      category: scriptCategory.optional(),
      lifecycleType: lifecycleType.nullable().optional(),
    }),
  }),
  z.strictObject({ op: z.literal('script.delete'), target: refSchema }),
  z.strictObject({ op: z.literal('script.purge'), target: refSchema }),
  z.strictObject({ op: z.literal('script.restore'), target: refSchema }),
  z.strictObject({
    op: z.literal('state.create'),
    alias,
    fsm: fsmRefSchema,
    data: statePatchSchema.extend({ ...assetIdentitySchema.shape, position: positionSchema }),
  }),
  z.strictObject({
    op: z.literal('state.update'),
    fsm: fsmRefSchema,
    target: refSchema,
    changes: statePatchSchema,
  }),
  z.strictObject({
    op: z.literal('state.delete'),
    fsm: fsmRefSchema,
    target: refSchema,
    replacementInitialState: refSchema.optional(),
    deleteTransitions: z.boolean().optional(),
  }),
  z.strictObject({ op: z.literal('fsm.setInitial'), fsm: fsmRefSchema, state: refSchema }),
  z.strictObject({
    op: z.literal('fsm.update'),
    fsm: fsmRefSchema,
    changes: z.strictObject({ displayOrder: index.optional() }),
  }),
  z.strictObject({
    op: z.literal('transition.create'),
    alias,
    fsm: fsmRefSchema,
    from: refSchema,
    to: refSchema,
    data: transitionPatchSchema.extend({
      name: nonEmptyString,
      priority: prioritySchema,
      triggers: z.array(triggerSchema),
    }),
  }),
  z.strictObject({
    op: z.literal('transition.update'),
    fsm: fsmRefSchema,
    target: refSchema,
    changes: transitionPatchSchema,
  }),
  z.strictObject({ op: z.literal('transition.delete'), fsm: fsmRefSchema, target: refSchema }),
  z.strictObject({
    op: z.literal('transition.redirect'),
    fsm: fsmRefSchema,
    target: refSchema,
    from: refSchema,
    to: refSchema,
    fromSide: sideSchema.nullable().optional(),
    toSide: sideSchema.nullable().optional(),
  }),
  z.strictObject({
    op: z.literal('presentation.create'),
    alias,
    data: presentationMetadata.extend({ name: nonEmptyString }),
  }),
  z.strictObject({
    op: z.literal('presentation.update'),
    graph: refSchema,
    changes: presentationMetadata,
  }),
  z.strictObject({ op: z.literal('presentation.delete'), graph: refSchema }),
  z.strictObject({
    op: z.literal('presentation.setStart'),
    graph: refSchema,
    node: refSchema.nullable(),
  }),
  z.strictObject({
    op: z.literal('presentationNode.create'),
    alias,
    graph: refSchema,
    data: presentationNodePatchSchema.extend({
      name: nonEmptyString,
      type: z.enum(['PresentationNode', 'Wait', 'Branch', 'Parallel']),
      position: positionSchema,
    }),
  }),
  z.strictObject({
    op: z.literal('presentationNode.update'),
    graph: refSchema,
    target: refSchema,
    changes: presentationNodePatchSchema,
  }),
  z.strictObject({
    op: z.literal('presentationNode.delete'),
    graph: refSchema,
    target: refSchema,
    replacementStart: refSchema.optional(),
    deleteEdges: z.boolean().optional(),
  }),
  z.strictObject({
    op: z.literal('presentationEdge.connect'),
    ...edgeFields,
    to: refSchema,
    style: edgeStyle.optional(),
  }),
  z.strictObject({ op: z.literal('presentationEdge.disconnect'), ...edgeFields }),
  z.strictObject({
    op: z.literal('presentationEdge.redirect'),
    ...edgeFields,
    to: refSchema,
    style: edgeStyle.optional(),
  }),
  z.strictObject({ op: z.literal('presentationEdge.update'), ...edgeFields, style: edgeStyle }),
] as const;
export const operationSchema = z.discriminatedUnion('op', operations);
export type Operation = z.infer<typeof operationSchema>;
export const planSchema = z.strictObject({
  apiVersion: z.literal(API_VERSION),
  sourceHash: hashSchema.optional(),
  scope: z.strictObject({
    project: z.boolean().optional(),
    stages: z.array(refSchema).optional(),
    puzzles: z.array(refSchema).optional(),
    presentations: z.array(refSchema).optional(),
    globals: z.array(z.enum(['variable', 'event', 'script'])).optional(),
  }),
  commands: z.array(operationSchema).max(10000),
});
export type Plan = z.infer<typeof planSchema>;

export const writeInputSchemas = {
  create: projectIdentitySchema.extend({
    out: nonEmptyString,
    description: z.string().optional(),
    plan: nonEmptyString.optional(),
  }),
  preview: z.strictObject({
    path: nonEmptyString,
    plan: nonEmptyString,
    receiptOut: nonEmptyString.optional(),
    expectedHash: hashSchema.optional(),
    inPlace: z.boolean().optional(),
  }),
  apply: z
    .strictObject({
      path: nonEmptyString,
      plan: nonEmptyString,
      receipt: nonEmptyString,
      out: nonEmptyString.optional(),
      inPlace: z.boolean().optional(),
      allowOverwrite: z.boolean().optional(),
      allowPermanentDelete: z.boolean().optional(),
      expectedHash: hashSchema.optional(),
    })
    .refine(
      validOutputMode,
      'Use exactly one of --out or --in-place; --allow-overwrite requires --in-place.',
    ),
  export: z.strictObject({
    path: nonEmptyString,
    out: nonEmptyString,
    expectedHash: hashSchema.optional(),
  }),
};
export const receiptSchema = z.strictObject({
  apiVersion: z.literal(API_VERSION),
  kind: z.literal('domain-preview'),
  policyVersion: z.literal(POLICY_VERSION),
  requiredCapabilities: requiredCapabilitiesSchema,
  source: z.strictObject({ path: nonEmptyString, sha256: hashSchema }),
  overwrite: overwriteExpectationSchema.optional(),
  planHash: hashSchema,
  savedAt: z.iso.datetime(),
  candidateHash: hashSchema,
  allocations: z.record(
    alias,
    z.strictObject({
      type: nonEmptyString,
      id: safeId,
      fsmId: safeId.optional(),
      graphId: safeId.optional(),
      initialStateId: safeId.optional(),
    }),
  ),
});
export type Receipt = z.infer<typeof receiptSchema>;
export type WriteRequests = {
  [K in keyof typeof writeInputSchemas]: z.infer<(typeof writeInputSchemas)[K]>;
};
