/** 转换入口只接受既有格式与资产名映射，不开放通用 JSON 修改或工程合并。 */
import * as z from 'zod';
import { API_VERSION, nonEmptyString, assetNameSchema, hashSchema } from './primitives';
import { POLICY_VERSION } from './permissions';

export const IMPORT_CONVERTER_VERSION = 'C7.1';
export const importEntitySchema = z.union([
  z.strictObject({ type: z.enum(['stage', 'puzzle', 'event', 'script']), id: nonEmptyString }),
  z.strictObject({
    type: z.literal('state'),
    id: nonEmptyString,
    ownerType: z.literal('fsm'),
    ownerId: nonEmptyString,
  }),
  z.strictObject({
    type: z.literal('variable'),
    id: nonEmptyString,
    ownerType: z.literal('project'),
  }),
  z.strictObject({
    type: z.literal('variable'),
    id: nonEmptyString,
    ownerType: z.enum(['stage', 'puzzle']),
    ownerId: nonEmptyString,
  }),
]);
export const importNamesSchema = z.strictObject({
  apiVersion: z.literal(API_VERSION),
  sourceHash: hashSchema,
  entries: z.array(z.strictObject({ entity: importEntitySchema, assetName: assetNameSchema })),
});
const input = {
  path: nonEmptyString,
  out: nonEmptyString,
  names: nonEmptyString.optional(),
  expectedHash: hashSchema.optional(),
};
export const importInputSchemas = {
  'import preview': z.strictObject({ ...input, receiptOut: nonEmptyString.optional() }),
  'import apply': z.strictObject({ ...input, receipt: nonEmptyString }),
};
const fingerprint = z.strictObject({ path: nonEmptyString, sha256: hashSchema });
export const importContextSchema = z.strictObject({
  now: z.string().datetime(),
  runtimeProjectId: z.string().regex(/^proj-imported-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/),
});
export const importReceiptSchema = z.strictObject({
  apiVersion: z.literal(API_VERSION),
  kind: z.literal('import-preview'),
  converterVersion: z.literal(IMPORT_CONVERTER_VERSION),
  policyVersion: z.literal(POLICY_VERSION),
  requiredCapabilities: z.tuple([]),
  source: fingerprint,
  names: fingerprint.nullable(),
  output: z.strictObject({
    path: nonEmptyString,
    mode: z.literal('create-new'),
    expected: z.literal('absent'),
  }),
  context: importContextSchema,
  detectedFormat: z.enum(['project', 'export', 'raw', 'legacy-manifest']),
  candidateHash: hashSchema,
});
export type ImportNames = z.infer<typeof importNamesSchema>;
export type ImportEntity = z.infer<typeof importEntitySchema>;
export type ImportReceipt = z.infer<typeof importReceiptSchema>;
export type ImportRequests = {
  [K in keyof typeof importInputSchemas]: z.infer<(typeof importInputSchemas)[K]>;
};
