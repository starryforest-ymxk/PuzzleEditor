/** 自动化输入和能力描述的单一登记点。 */
import * as z from 'zod';
import {
  describeRequestSchema,
  inspectRequestSchema,
  readRequestSchema,
  validateRequestSchema,
} from './readSchemas';
import { writeInputSchemas } from './planSchemas';
import { rawInputSchemas } from './rawSchemas';
import { importInputSchemas } from './importSchemas';
import { sessionInputSchemas } from './sessionSchemas';
import { toolingInputSchemas } from './toolingSchemas';
export * from './readSchemas';
export const inputSchemas = {
  describe: describeRequestSchema,
  inspect: inspectRequestSchema,
  validate: validateRequestSchema,
  'json read': readRequestSchema,
  ...writeInputSchemas,
  ...rawInputSchemas,
  ...importInputSchemas,
  ...sessionInputSchemas,
  ...toolingInputSchemas,
};
export function jsonSchema(schema: z.ZodType) {
  return z.toJSONSchema(schema, { io: 'input', target: 'draft-2020-12' });
}
