/** 终端参数只适配共用契约；严格拒绝重复参数和无效组合，避免静默忽略意图。 */
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { capabilities, CLI_PHASE } from '../contracts/automation/capabilities';
import { inputSchemas, type InspectRequest } from '../contracts/automation/schemas';
import { AutomationFailure } from '../services/automation/errors';

const flagName = (name: string) => name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
const numbers = new Set(['offset', 'limit', 'depth', 'session']);
const booleans = new Set([
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

/** 从能力登记识别命令树，新增组不再维护第二份前缀名单。 */
export function operationName(argv: string[]) {
  if (argv[0] === '--version' || argv[0] === '-v') return 'version';
  return (
    capabilities.find((item) =>
      item.operation.split(' ').every((word, index) => word === argv[index]),
    )?.operation ??
    argv[0] ??
    'help'
  );
}

export function parseCommand(argv: string[]) {
  if (!argv.length || argv[0] === '--help' || argv[0] === '-h') return { kind: 'help' as const };
  const operation = operationName(argv);
  const definition = capabilities.find((item) => item.operation === operation);
  if (!definition)
    throw new AutomationFailure('UNKNOWN_COMMAND', `Unknown command: ${operation}. Use --help.`, 2);
  if (!definition.implemented)
    throw new AutomationFailure(
      'COMMAND_NOT_AVAILABLE',
      `${operation} is not implemented. No file was written.`,
      2,
    );
  const name = operation as keyof typeof inputSchemas;
  const schema = inputSchemas[name];
  const positional =
    name === 'skills read' ? 'name' : Object.hasOwn(schema.shape, 'path') ? 'path' : null;
  const fields = Object.keys(schema.shape).filter((key) => key !== positional);
  const options: NonNullable<ParseArgsConfig['options']> = {
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  };
  for (const field of fields)
    options[flagName(field)] = { type: booleans.has(field) ? 'boolean' : 'string' };
  let parsed;
  try {
    parsed = parseArgs({
      args: argv.slice(name.split(' ').length),
      options,
      allowPositionals: true,
      strict: true,
      tokens: true,
    });
  } catch (error) {
    throw new AutomationFailure(
      'INVALID_ARGUMENT',
      error instanceof Error ? error.message : 'Invalid arguments.',
      2,
    );
  }
  const seen = new Set<string>();
  for (const token of parsed.tokens) {
    if (token.kind !== 'option') continue;
    if (seen.has(token.name))
      throw new AutomationFailure(
        'DUPLICATE_ARGUMENT',
        `Option --${token.name} was supplied more than once.`,
        2,
      );
    seen.add(token.name);
  }
  if (parsed.values.help) return { kind: 'help' as const, operation: name };
  if (parsed.values.raw && parsed.values.json)
    throw new AutomationFailure('INVALID_ARGUMENT', '--raw and --json are mutually exclusive.', 2);
  const noPath = positional === null;
  if (parsed.positionals.length !== (noPath ? 0 : 1))
    throw new AutomationFailure(
      'INVALID_ARGUMENT',
      noPath ? `${name} takes no input file path.` : 'Exactly one input file path is required.',
      2,
    );
  const input: Record<string, unknown> = positional ? { [positional]: parsed.positionals[0] } : {};
  for (const field of fields) {
    const value = parsed.values[flagName(field)];
    if (value === undefined) continue;
    if (numbers.has(field)) {
      if (typeof value !== 'string' || !/^\d+$/.test(value))
        throw new AutomationFailure(
          'INVALID_ARGUMENT',
          `--${flagName(field)} requires a non-negative integer.`,
          2,
        );
      input[field] = Number(value);
    } else input[field] = value;
  }
  if (name === 'inspect' || name === 'session inspect') checkInspectOptions(input);
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AutomationFailure(
      'INVALID_ARGUMENT',
      'Arguments do not satisfy the command contract.',
      2,
      result.error.issues.map((issue) => ({
        code: 'INVALID_ARGUMENT',
        level: 'error',
        message: issue.message,
        path: '/' + issue.path.join('/'),
        pathBasis: 'request',
        retryable: false,
      })),
    );
  return { kind: 'command' as const, operation: name, input: result.data };
}

function checkInspectOptions(input: Record<string, unknown>) {
  const view = (input.view ?? 'summary') as InspectRequest['view'] | 'project';
  const allowed: Record<InspectRequest['view'] | 'project', string[]> = {
    project: [],
    summary: [],
    tree: ['id', 'depth', 'offset', 'limit'],
    entities: ['type', 'id', 'ownerType', 'ownerId', 'search', 'offset', 'limit'],
    fsm: ['id', 'search', 'offset', 'limit'],
    presentation: ['id', 'search', 'offset', 'limit'],
    references: ['type', 'id', 'ownerType', 'ownerId', 'offset', 'limit'],
    variables: ['stageId', 'nodeId', 'offset', 'limit'],
    bindings: ['type', 'search', 'offset', 'limit'],
  };
  if (!Object.hasOwn(allowed, view)) return; // 枚举错误交给共用 Schema 产生定位。
  for (const key of Object.keys(input))
    if (!['view', 'path', 'expectedHash', 'instance', 'session', ...allowed[view]].includes(key)) {
      throw new AutomationFailure(
        'INVALID_ARGUMENT',
        `--${flagName(key)} is not supported by view ${view}.`,
        2,
      );
    }
  if (Boolean(input.ownerId) !== Boolean(input.ownerType))
    throw new AutomationFailure(
      'INVALID_ARGUMENT',
      '--owner-type and --owner-id must be supplied together.',
      2,
    );
  if (view === 'references' && (!input.id || !input.type))
    throw new AutomationFailure('INVALID_ARGUMENT', 'references requires --type and --id.', 2);
  if (input.id && input.search)
    throw new AutomationFailure('INVALID_ARGUMENT', 'Choose --id or --search, not both.', 2);
  if (
    view === 'bindings' &&
    input.type &&
    !['script', 'event', 'presentation'].includes(String(input.type))
  )
    throw new AutomationFailure(
      'INVALID_ARGUMENT',
      'bindings supports script, event, and presentation resource types.',
      2,
    );
  if (
    ['entities', 'fsm', 'presentation'].includes(view) &&
    input.id &&
    (input.offset !== undefined || input.limit !== undefined)
  )
    throw new AutomationFailure(
      'INVALID_ARGUMENT',
      'Pagination is only available for lists, not a single entity.',
      2,
    );
}

export function helpText(operation?: keyof typeof inputSchemas): string {
  const lines = [
    `Puzzle Editor CLI — ${CLI_PHASE} offline tools and explicit desktop sessions`,
    '',
    'Usage: puzzle <command> [file] [options]',
    'Output defaults to JSON. --json is explicit machine mode. --raw writes only original text.',
    '',
  ];
  for (const item of capabilities.filter(
    (candidate) => !operation || candidate.operation === operation,
  )) {
    lines.push(`${item.operation}: ${item.summary}${item.implemented ? '' : ' [unavailable]'}`);
    if (Object.hasOwn(inputSchemas, item.operation)) {
      const shape = inputSchemas[item.operation as keyof typeof inputSchemas].shape;
      lines.push(
        '  Options: ' +
          Object.keys(shape)
            .filter((key) => key !== 'path')
            .concat(['json', 'help'])
            .map((key) => '--' + flagName(key))
            .join(', '),
      );
    }
    if ('example' in item && item.example) lines.push('  ' + item.example);
  }
  lines.push(
    '',
    'inspect views: summary, tree, entities, fsm, presentation, references, variables, bindings',
    'Use describe --json for schemas, scope rules, permission levels, and exit codes.',
  );
  return lines.join('\n') + '\n';
}
