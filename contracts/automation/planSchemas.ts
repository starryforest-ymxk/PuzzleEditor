/** 领域计划只开放明确意图和白名单字段；不提供通用 JSON/Action 写入口。 */
import * as z from 'zod';
import type { ConditionExpression } from '../../types/stateMachine';
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
  source: z.strictObject({ type: z.literal('Constant'), value: z.json() }),
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
    op: z.literal('puzzle.create'),
    alias,
    stage: refSchema,
    data: puzzlePatchSchema.extend(assetIdentitySchema.shape),
    initialState: assetIdentitySchema.extend({ description: z.string().optional() }),
  }),
  z.strictObject({ op: z.literal('puzzle.update'), target: refSchema, changes: puzzlePatchSchema }),
  z.strictObject({
    op: z.literal('puzzle.move'),
    target: refSchema,
    stage: refSchema,
    index: index.optional(),
  }),
  z.strictObject({ op: z.literal('puzzle.reorder'), stage: refSchema, order: z.array(refSchema) }),
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
  z.strictObject({ op: z.literal('variable.restore'), target: refSchema, owner: ownerSchema }),
  z.strictObject({ op: z.literal('event.create'), alias, data: resourceData }),
  z.strictObject({
    op: z.literal('event.update'),
    target: refSchema,
    changes: z.strictObject(resourceFields),
  }),
  z.strictObject({ op: z.literal('event.delete'), target: refSchema }),
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
  z.strictObject({ op: z.literal('script.restore'), target: refSchema }),
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
  }),
  apply: z.strictObject({
    path: nonEmptyString,
    plan: nonEmptyString,
    receipt: nonEmptyString,
    out: nonEmptyString,
    expectedHash: hashSchema.optional(),
  }),
  export: z.strictObject({
    path: nonEmptyString,
    out: nonEmptyString,
    expectedHash: hashSchema.optional(),
  }),
};
export const receiptSchema = z.strictObject({
  apiVersion: z.literal(API_VERSION),
  kind: z.literal('domain-preview'),
  source: z.strictObject({ path: nonEmptyString, sha256: hashSchema }),
  planHash: hashSchema,
  savedAt: z.iso.datetime(),
  candidateHash: hashSchema,
  allocations: z.record(
    alias,
    z.strictObject({
      type: nonEmptyString,
      id: safeId,
      fsmId: safeId.optional(),
      initialStateId: safeId.optional(),
    }),
  ),
});
export type Receipt = z.infer<typeof receiptSchema>;
export type WriteRequests = {
  [K in keyof typeof writeInputSchemas]: z.infer<(typeof writeInputSchemas)[K]>;
};
