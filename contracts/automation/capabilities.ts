/** 能力、权限、示例与帮助共用此表；未实现命令不注册执行器。 */
import {
  API_VERSION,
  inputSchemas,
  jsonSchema,
  namingSchemas,
  resultSchema,
  type Permission,
} from './schemas';
import { planSchema, receiptSchema } from './planSchemas';

export const capabilities = [
  {
    operation: 'describe',
    implemented: true,
    permission: 'read',
    summary: 'Describe capabilities and JSON Schemas.',
    example: 'puzzle describe --json',
  },
  {
    operation: 'inspect',
    implemented: true,
    permission: 'read',
    summary: 'Query normalized project context without saving.',
    example: 'puzzle inspect "Demo.puzzle.json" --view tree --json',
  },
  {
    operation: 'validate',
    implemented: true,
    permission: 'read',
    summary: 'Validate structure and domain rules without saving.',
    example: 'puzzle validate "Demo.puzzle.json" --json',
  },
  {
    operation: 'json read',
    implemented: true,
    permission: 'read',
    summary: 'Read the complete file or its original UTF-8 text.',
    example: 'puzzle json read "Demo.puzzle.json" --raw',
  },
  {
    operation: 'create',
    implemented: true,
    permission: 'semantic_write',
    summary: 'Create a project with external asset names (C2).',
  },
  {
    operation: 'preview',
    implemented: true,
    permission: 'read',
    summary: 'Preview a domain edit plan (C2).',
  },
  {
    operation: 'apply',
    implemented: true,
    permission: 'semantic_write',
    summary: 'Apply a domain edit plan (C2).',
  },
  {
    operation: 'export',
    implemented: true,
    permission: 'semantic_write',
    summary: 'Write a runtime export (C2).',
  },
  {
    operation: 'json preview',
    implemented: false,
    permission: 'read',
    summary: 'Preview a full JSON candidate (C5).',
  },
  {
    operation: 'json apply',
    implemented: false,
    permission: 'raw_json_write',
    summary: 'Apply a fallback JSON candidate after direct user confirmation (C5).',
  },
] satisfies Array<{
  operation: string;
  implemented: boolean;
  permission: Permission;
  summary: string;
  example?: string;
}>;

export function describeCapabilities(operation?: string) {
  return {
    apiVersion: API_VERSION,
    phase: 'C2',
    capabilities: capabilities
      .filter((item) => !operation || item.operation === operation)
      .map((item) => ({
        ...item,
        requiresDirectUserConfirmation: item.permission === 'raw_json_write',
        inputSchema: Object.hasOwn(inputSchemas, item.operation)
          ? jsonSchema(inputSchemas[item.operation as keyof typeof inputSchemas])
          : null,
      })),
    resultSchema: jsonSchema(resultSchema),
    planSchema: jsonSchema(planSchema),
    receiptSchema: jsonSchema(receiptSchema),
    planRules: [
      'Plans require an explicit edit scope. Existing project plans also require sourceHash.',
      'References are {id} or {alias}; root is a reserved stage alias.',
      'All creation declarations are allocated first and created in owner dependency order; non-creation commands then run in their original order.',
      'Resource creation always starts in Draft. Deleting an implemented resource marks it; permanent deletion of marked resources is unavailable.',
      'Omitted fields remain unchanged; null clears optional bindings, [] clears lists.',
      'Preview receipts are consistency checks, not raw JSON write approval.',
      'Only new output paths are published; apply can verify an existing byte-identical output.',
    ],
    namingContracts: {
      status: 'enforced-by-C2-plan-contracts',
      schemas: Object.fromEntries(
        Object.entries(namingSchemas).map(([key, schema]) => [key, jsonSchema(schema)]),
      ),
      appliesTo: [
        'stage (including root)',
        'puzzle',
        'state (including initial)',
        'variable (global/stage/node)',
        'event',
        'script',
      ],
      rules: [
        'All new assetName values come from the caller.',
        'Omitted assetName on an existing entity is preserved.',
        'No translation, generation, trimming, or suffix fallback.',
      ],
    },
    permissions: {
      read: 'Read and preview only.',
      semantic_write: 'Scoped domain operations; does not grant raw JSON write.',
      raw_json_write:
        'Fallback only. Requires direct user approval of this exact candidate and target on every write. Flags, preview receipts, and agent assertions are not approval.',
    },
    queryRules: [
      'Structured views use the existing importer; import notices disclose normalization. json read preserves the disk file.',
      'Use ownerType and ownerId for scoped IDs; ambiguous matches return candidates.',
      'Reuse source.sha256 with --expected-hash for additional pages.',
      'Bindings lists eligible resource metadata only; final binding parameters and caller scope still require validation.',
    ],
    exitCodes: {
      success: 0,
      internal: 1,
      input: 2,
      validation: 3,
      conflict: 4,
      io: 5,
      approval: 6,
      interrupted: 130,
    },
  };
}
