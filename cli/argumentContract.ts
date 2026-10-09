/** 参数的终端适配只有一个维护点；Schema 仍然拥有必填性、默认值和领域约束。 */
import { inputSchemas, jsonSchema } from '../contracts/automation/schemas';

export type CommandName = keyof typeof inputSchemas;
export const flagName = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
export const numericArguments = new Set(['offset', 'limit', 'depth', 'session']);
export const booleanArguments = new Set([
  'raw',
  'warningsAsErrors',
  'allowRawJsonWrite',
  'allowPermanentDelete',
  'inPlace',
  'allowOverwrite',
  'dryRun',
  'offline',
  'online',
]);
export function positionalArgument(name: CommandName) {
  return name === 'skills read'
    ? 'name'
    : Object.hasOwn(inputSchemas[name].shape, 'path')
      ? 'path'
      : null;
}
export const inspectViewArguments = {
  project: [],
  summary: [],
  tree: ['id', 'depth', 'offset', 'limit'],
  entities: ['type', 'id', 'ownerType', 'ownerId', 'search', 'offset', 'limit'],
  fsm: ['id', 'search', 'offset', 'limit'],
  presentation: ['id', 'search', 'offset', 'limit'],
  references: ['type', 'id', 'ownerType', 'ownerId', 'offset', 'limit'],
  variables: ['stageId', 'nodeId', 'offset', 'limit'],
  bindings: ['type', 'search', 'offset', 'limit'],
} satisfies Record<string, string[]>;

export interface JsonShape {
  type?: string | string[];
  properties?: Record<string, JsonShape>;
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  format?: string;
  items?: JsonShape;
  oneOf?: JsonShape[];
  anyOf?: JsonShape[];
  allOf?: JsonShape[];
  $ref?: string;
  $defs?: Record<string, JsonShape>;
}
export function schemaLabel(schema: JsonShape): string {
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  if (schema.$ref) return 'reference';
  if (schema.oneOf || schema.anyOf)
    return (schema.oneOf ?? schema.anyOf ?? []).map(schemaLabel).join(' | ');
  if (schema.type === 'array') return 'array<' + schemaLabel(schema.items ?? {}) + '>';
  return Array.isArray(schema.type) ? schema.type.join(' | ') : (schema.type ?? 'JSON');
}
export function schemaConstraints(schema: JsonShape): string {
  return [
    ...[
      'minimum',
      'maximum',
      'minLength',
      'maxLength',
      'minItems',
      'maxItems',
      'pattern',
      'format',
    ].flatMap((key) => {
      const value = schema[key as keyof JsonShape];
      return value === undefined ? [] : [key + '=' + JSON.stringify(value)];
    }),
    ...(schema.allOf ?? []).map(schemaConstraints),
  ]
    .filter(Boolean)
    .join('; ');
}
export function commandArguments(name: CommandName) {
  const schema = jsonSchema(inputSchemas[name]) as JsonShape;
  const positional = positionalArgument(name);
  return Object.entries(schema.properties ?? {}).map(([field, definition]) => ({
    field,
    definition,
    positional: field === positional,
    flag: field === positional ? '<' + field + '>' : '--' + flagName(field),
    required: schema.required?.includes(field) ?? false,
    terminalType: booleanArguments.has(field)
      ? 'boolean'
      : numericArguments.has(field)
        ? 'integer'
        : 'string',
  }));
}
export function commandUsage(name: CommandName) {
  return (
    'puzzle ' +
    name +
    commandArguments(name)
      .map((arg) => {
        const value =
          arg.positional || arg.terminalType === 'boolean' ? '' : ' <' + arg.field + '>';
        const text = arg.flag + value;
        return ' ' + (arg.required ? text : '[' + text + ']');
      })
      .join('') +
    ' [--json] [--help]'
  );
}
