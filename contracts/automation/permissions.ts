/** 最高权限能力同级但独立授权；策略版本绑定预览语义，不是聊天批准凭据。 */
import * as z from 'zod';
export const POLICY_VERSION = 'C10';
export const capabilitySchema = z.enum([
  'raw_json_write',
  'overwrite_project',
  'permanent_resource_delete',
]);
export const requiredCapabilitiesSchema = z.array(capabilitySchema);
export type RequiredCapability = z.infer<typeof capabilitySchema>;
export const capabilityDefinitions = {
  raw_json_write: {
    level: 'highest',
    declaration: 'allowRawJsonWrite',
    flag: '--allow-raw-json-write',
    implemented: true,
    errorCode: 'RAW_JSON_AUTHORIZATION_REQUIRED',
  },
  overwrite_project: {
    level: 'highest',
    declaration: 'allowOverwrite',
    flag: '--allow-overwrite',
    implemented: true,
    errorCode: 'OVERWRITE_AUTHORIZATION_REQUIRED',
  },
  permanent_resource_delete: {
    level: 'highest',
    declaration: 'allowPermanentDelete',
    flag: '--allow-permanent-delete',
    implemented: true,
    errorCode: 'PERMANENT_DELETE_AUTHORIZATION_REQUIRED',
  },
} as const;
export type CapabilityDeclarations = Partial<
  Record<(typeof capabilityDefinitions)[RequiredCapability]['declaration'], boolean>
>;
