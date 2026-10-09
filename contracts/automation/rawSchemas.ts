/** 备用整文件入口独立声明权限；回执只证明预览一致性，不认证聊天授权。 */
import * as z from 'zod';
import { API_VERSION, hashSchema, nonEmptyString } from './primitives';
import { POLICY_VERSION, requiredCapabilitiesSchema } from './permissions';
import { newOutputSchema, overwriteExpectationSchema, validOutputMode } from './overwriteSchemas';

const input = {
  path: nonEmptyString,
  candidate: nonEmptyString,
  out: nonEmptyString.optional(),
  inPlace: z.boolean().optional(),
  expectedHash: hashSchema.optional(),
};
export const rawInputSchemas = {
  'json preview': z
    .strictObject({ ...input, receiptOut: nonEmptyString.optional() })
    .refine(validOutputMode, 'Use exactly one of --out or --in-place.'),
  'json apply': z
    .strictObject({
      ...input,
      receipt: nonEmptyString,
      allowRawJsonWrite: z.boolean().default(false),
      allowPermanentDelete: z.boolean().optional(),
      allowOverwrite: z.boolean().optional(),
    })
    .refine(
      validOutputMode,
      'Use exactly one of --out or --in-place; --allow-overwrite requires --in-place.',
    ),
};
const fingerprint = z.strictObject({ path: nonEmptyString, sha256: hashSchema });
export const rawReceiptSchema = z.strictObject({
  apiVersion: z.literal(API_VERSION),
  kind: z.literal('raw-json-preview'),
  policyVersion: z.literal(POLICY_VERSION),
  requiredCapabilities: requiredCapabilitiesSchema,
  source: fingerprint,
  candidate: fingerprint,
  output: z.union([newOutputSchema, overwriteExpectationSchema]),
});
export type RawReceipt = z.infer<typeof rawReceiptSchema>;
export type RawRequests = {
  [K in keyof typeof rawInputSchemas]: z.infer<(typeof rawInputSchemas)[K]>;
};
