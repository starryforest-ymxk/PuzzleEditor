/** 在线传输与 CLI 共用契约；文件路径只出现在 CLI 适配，桥内使用已解析的值。 */
import * as z from 'zod';
import { inspectRequestSchema } from './readSchemas';
import { planSchema } from './planSchemas';
import { POLICY_VERSION } from './permissions';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const nonEmpty = z.string().min(1);
export const sessionTokenSchema = z.strictObject({
  instanceId: z.uuid(),
  sessionId: z.number().int().nonnegative(),
  contentEpoch: z.number().int().nonnegative(),
  contentHash: hash,
});
export type SessionToken = z.infer<typeof sessionTokenSchema>;
export const sessionReceiptSchema = z.strictObject({
  kind: z.literal('session-preview'),
  policyVersion: z.literal(POLICY_VERSION),
  token: sessionTokenSchema,
  planHash: hash,
  candidateHash: hash,
});
export const onlineQuerySchema = inspectRequestSchema
  .omit({ path: true, expectedHash: true })
  .extend({
    view: z.union([inspectRequestSchema.shape.view, z.literal('project')]).default('summary'),
  });
const target = { instance: z.uuid(), session: z.number().int().nonnegative() };
const declarations = {
  allowOverwrite: z.boolean().optional(),
  allowPermanentDelete: z.boolean().optional(),
};
// 时间前缀是幂等有效期；客户端首次执行前保存 ID，重试不可自动换 ID。
const requestId = z.string().regex(/^\d{13}:[0-9a-f-]{36}$/);
const entryId = z.string().regex(/^\d+:\d+$/);
const historyDeclarations = { ...declarations, allowRawJsonWrite: z.boolean().optional() };
const historyInput = z.strictObject({
  ...target,
  token: nonEmpty,
  entryId,
  requestId,
  ...historyDeclarations,
});
export const sessionInputSchemas = {
  'history list': z.strictObject(target),
  'history undo': historyInput,
  'history redo': historyInput,
  'session list': z.strictObject({}),
  'session status': z.strictObject(target),
  'session inspect': onlineQuerySchema.extend(target),
  'session validate': z.strictObject(target),
  'session preview': z.strictObject({
    ...target,
    token: nonEmpty,
    plan: nonEmpty,
    receiptOut: nonEmpty.optional(),
  }),
  'session apply': z.strictObject({
    ...target,
    plan: nonEmpty,
    receipt: nonEmpty,
    requestId,
    ...declarations,
  }),
  'session save': z.strictObject({
    ...target,
    token: nonEmpty,
    requestId,
    out: nonEmpty.optional(),
    expectedDiskHash: hash.optional(),
    allowOverwrite: z.boolean().optional(),
  }),
};
const bridgeTarget = { sessionId: z.number().int().nonnegative() };
export const sessionRequestSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('history.list'), ...bridgeTarget }),
  z.strictObject({
    operation: z.literal('history.undo'),
    ...bridgeTarget,
    token: sessionTokenSchema,
    entryId,
    requestId,
    ...historyDeclarations,
  }),
  z.strictObject({
    operation: z.literal('history.redo'),
    ...bridgeTarget,
    token: sessionTokenSchema,
    entryId,
    requestId,
    ...historyDeclarations,
  }),
  z.strictObject({ operation: z.literal('discover') }),
  z.strictObject({ operation: z.literal('status'), ...bridgeTarget }),
  z.strictObject({ operation: z.literal('inspect'), ...bridgeTarget, query: onlineQuerySchema }),
  z.strictObject({ operation: z.literal('validate'), ...bridgeTarget }),
  z.strictObject({
    operation: z.literal('preview'),
    ...bridgeTarget,
    token: sessionTokenSchema,
    plan: planSchema,
  }),
  z.strictObject({
    operation: z.literal('apply'),
    ...bridgeTarget,
    requestId,
    receipt: sessionReceiptSchema,
    plan: planSchema,
    ...declarations,
  }),
  z.strictObject({
    operation: z.literal('save'),
    ...bridgeTarget,
    requestId,
    token: sessionTokenSchema,
    out: nonEmpty.optional(),
    expectedDiskHash: hash.optional(),
    allowOverwrite: z.boolean().optional(),
  }),
]);
export type SessionRequest = z.infer<typeof sessionRequestSchema>;
