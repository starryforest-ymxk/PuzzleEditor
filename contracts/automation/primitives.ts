/** 读写契约共用的版本与命名原语，禁止入口自行补名或放宽格式。 */
import * as z from 'zod';
import { ASSET_NAME_REGEX } from '../../utils/assetNameValidation';

export const API_VERSION = '1.0.0' as const;
export const nonEmptyString = z.string().min(1).regex(/\S/, 'Expected a non-blank string.');
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const assetNameSchema = z
  .string()
  .min(1)
  .regex(ASSET_NAME_REGEX)
  .regex(/^(?![\s\S]*\s)/, 'Whitespace is not allowed in an asset name.')
  .describe('Required external asset name. Never generated, translated, trimmed, or deduplicated.');
export const assetIdentitySchema = z.strictObject({
  name: nonEmptyString,
  assetName: assetNameSchema,
});
export const projectIdentitySchema = z.strictObject({
  name: nonEmptyString,
  rootAssetName: assetNameSchema,
});
export const puzzleIdentitySchema = assetIdentitySchema.extend({
  initialState: assetIdentitySchema,
});
