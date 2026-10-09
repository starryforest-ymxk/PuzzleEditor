/** 覆盖前提独立于普通另存；文件身份与原文 hash 必须一起绑定。 */
import * as z from 'zod';
import { hashSchema, nonEmptyString } from './primitives';
const integer = z.string().regex(/^\d+$/);
export const overwriteExpectationSchema = z.strictObject({
  mode: z.literal('overwrite-source'),
  path: nonEmptyString,
  sha256: hashSchema,
  identity: z.strictObject({
    dev: integer,
    ino: integer,
    size: integer,
    mtimeNs: integer,
    ctimeNs: integer,
  }),
});
export const newOutputSchema = z.strictObject({
  path: nonEmptyString,
  mode: z.literal('create-new'),
  expected: z.literal('absent'),
});
export const validOutputMode = (input: {
  out?: string;
  inPlace?: boolean;
  allowOverwrite?: boolean;
}) =>
  Boolean(input.out) !== Boolean(input.inPlace) &&
  (!input.allowOverwrite || input.inPlace === true);
