/** 自动化接口的运行时契约；TS 类型和 JSON Schema 从这里派生。 */
import * as z from 'zod';
import {
  API_VERSION,
  nonEmptyString,
  assetNameSchema,
  assetIdentitySchema,
  projectIdentitySchema,
  puzzleIdentitySchema,
} from './primitives';
import { writeInputSchemas } from './planSchemas';
export {
  API_VERSION,
  nonEmptyString,
  assetNameSchema,
  assetIdentitySchema,
  projectIdentitySchema,
  puzzleIdentitySchema,
} from './primitives';

export const permissionSchema = z.enum(['read', 'semantic_write', 'raw_json_write']);
export const entityTypeSchema = z.enum([
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
]);
export const ownerTypeSchema = z.enum(['stage', 'puzzle', 'fsm', 'presentation', 'project']);
export const entityRefSchema = z.strictObject({
  type: entityTypeSchema,
  id: nonEmptyString,
  ownerType: ownerTypeSchema.optional(),
  ownerId: nonEmptyString.optional(),
});
export const sourceSchema = z.strictObject({
  path: nonEmptyString,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  size: z.number().int().nonnegative(),
  modifiedAt: z.string(),
});
export const diagnosticSchema = z.strictObject({
  code: nonEmptyString,
  level: z.enum(['error', 'warning', 'hint']),
  message: z.string(),
  path: z.string().optional(),
  pathBasis: z.enum(['source', 'normalized-project', 'request']).optional(),
  entity: entityRefSchema.optional(),
  location: z.string().optional(),
  suggestion: z.string().optional(),
  operationIndex: z.number().int().nonnegative().optional(),
  retryable: z.boolean(),
});
export const errorSchema = z.strictObject({
  code: nonEmptyString,
  message: z.string(),
  retryable: z.boolean(),
  path: z.string().optional(),
});
export const resultSchema = z.strictObject({
  apiVersion: z.literal(API_VERSION),
  ok: z.boolean(),
  command: z.string(),
  data: z.json(),
  diagnostics: z.array(diagnosticSchema),
  error: errorSchema.optional(),
});

const fileRequest = { path: nonEmptyString, expectedHash: sourceSchema.shape.sha256.optional() };
const page = {
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(1000).default(100),
};
export const inspectRequestSchema = z.strictObject({
  ...fileRequest,
  view: z
    .enum([
      'summary',
      'tree',
      'entities',
      'fsm',
      'presentation',
      'references',
      'variables',
      'bindings',
    ])
    .default('summary'),
  type: entityTypeSchema.optional(),
  id: nonEmptyString.optional(),
  ownerType: ownerTypeSchema.optional(),
  ownerId: nonEmptyString.optional(),
  search: nonEmptyString.optional(),
  stageId: nonEmptyString.optional(),
  nodeId: nonEmptyString.optional(),
  depth: z.number().int().min(0).max(128).default(16),
  ...page,
});
export const validateRequestSchema = z.strictObject({
  ...fileRequest,
  warningsAsErrors: z.boolean().default(false),
});
export const readRequestSchema = z.strictObject({
  ...fileRequest,
  raw: z.boolean().default(false),
});
export const describeRequestSchema = z.strictObject({ operation: nonEmptyString.optional() });

export type EntityRef = z.infer<typeof entityRefSchema>;
export type EntityType = EntityRef['type'];
export type Diagnostic = z.infer<typeof diagnosticSchema>;
export type AutomationError = z.infer<typeof errorSchema>;
export type InspectRequest = z.infer<typeof inspectRequestSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Permission = z.infer<typeof permissionSchema>;

/** 命名片段只冻结身份要求；未来写命令的完整配置尚未开放。 */
export const namingSchemas = {
  assetName: assetNameSchema,
  assetIdentity: assetIdentitySchema,
  projectIdentity: projectIdentitySchema,
  puzzleIdentity: puzzleIdentitySchema,
};
export const inputSchemas = {
  describe: describeRequestSchema,
  inspect: inspectRequestSchema,
  validate: validateRequestSchema,
  'json read': readRequestSchema,
  ...writeInputSchemas,
};
export function jsonSchema(schema: z.ZodType) {
  return z.toJSONSchema(schema, { io: 'input', target: 'draft-2020-12' });
}
