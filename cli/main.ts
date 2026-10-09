/** CLI 执行入口；输出使用单一结果对象，异常不混入 stdout 堆栈。 */
import {
  capabilities,
  describeCapabilities,
  CLI_PHASE,
} from '../contracts/automation/capabilities';
import {
  API_VERSION,
  describeRequestSchema,
  inspectRequestSchema,
  readRequestSchema,
  validateRequestSchema,
  type Diagnostic,
  type AutomationError,
} from '../contracts/automation/schemas';
import { FileSnapshotError } from '../dist-node/files.js';
import { ProjectFileError } from '../dist-node/projectOwnership.js';
import { ProjectImportError } from '../utils/projectImport';
import { AutomationFailure } from '../services/automation/errors';
import {
  inspectProject,
  readCompleteJson,
  readProjectContext,
  readSource,
} from '../services/automation/readService';
import { helpText, parseCommand, operationName } from './arguments';
import { runToolingCommand } from '../services/cliTooling/commands';
import { runSessionCommand } from './session';
import { decodeUtf8 } from '../dist-node/files.js';
import { writeInputSchemas } from '../contracts/automation/planSchemas';
import { rawInputSchemas } from '../contracts/automation/rawSchemas';
import { importInputSchemas } from '../contracts/automation/importSchemas';
import { previewImport, applyImport } from '../services/automation/importService';
import { previewRawJson, applyRawJson } from '../services/automation/rawWriteService';
import {
  createProject,
  previewProject,
  applyProject,
  exportProject,
} from '../services/automation/writeService';

/** stdin 只承载计划，不作为确认通道；限制输入大小并严格解码。 */
async function planStdin(input: unknown): Promise<string | undefined> {
  if (!input || typeof input !== 'object' || !('plan' in input) || input.plan !== '-')
    return undefined;
  const buffers: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 16 * 1024 * 1024)
      throw new AutomationFailure('PLAN_TOO_LARGE', 'Stdin plans are limited to 16 MiB.', 2);
    buffers.push(bytes);
  }
  return decodeUtf8(Buffer.concat(buffers));
}

async function main() {
  const argv = process.argv.slice(2);
  const rawOutput =
    argv[0] === 'json' && argv[1] === 'read' && argv.includes('--raw') && !argv.includes('--json');
  let command = operationName(argv);
  let diagnostics: Diagnostic[] = [];
  let data: unknown = null;
  let error: AutomationError | undefined;
  let exitCode = 0;
  try {
    const parsed = parseCommand(argv);
    if (parsed.kind === 'help') {
      process.stdout.write(helpText(parsed.operation));
      return;
    }
    command = parsed.operation;
    switch (parsed.operation) {
      case 'version':
      case 'doctor':
      case 'config show':
      case 'config path':
      case 'skills list':
      case 'skills read':
      case 'skills status':
      case 'skills install':
      case 'skills uninstall':
      case 'skills recover':
      case 'setup install':
      case 'setup status':
      case 'setup uninstall':
      case 'setup recover':
        data = await runToolingCommand(parsed.operation, parsed.input, CLI_PHASE);
        if (parsed.operation === 'doctor' && !(data as { healthy: boolean }).healthy) {
          exitCode = 3;
          error = {
            code: 'DOCTOR_FAILED',
            message: 'One or more diagnostic checks failed.',
            retryable: false,
          };
        }
        break;
      case 'history list':
      case 'history undo':
      case 'history redo':
      case 'session list':
      case 'session status':
      case 'session inspect':
      case 'session validate':
      case 'session preview':
      case 'session apply':
      case 'session save':
        ({ data, diagnostics } = await runSessionCommand(
          parsed.operation,
          parsed.input,
          await planStdin(parsed.input),
        ));
        break;
      case 'import preview':
        ({ data, diagnostics } = await previewImport(
          importInputSchemas['import preview'].parse(parsed.input),
        ));
        break;
      case 'import apply':
        ({ data, diagnostics } = await applyImport(
          importInputSchemas['import apply'].parse(parsed.input),
        ));
        break;
      case 'json preview':
        ({ data, diagnostics } = await previewRawJson(
          rawInputSchemas['json preview'].parse(parsed.input),
        ));
        break;
      case 'json apply':
        ({ data, diagnostics } = await applyRawJson(
          rawInputSchemas['json apply'].parse(parsed.input),
        ));
        break;
      case 'create':
        ({ data, diagnostics } = await createProject(
          writeInputSchemas.create.parse(parsed.input),
          await planStdin(parsed.input),
        ));
        break;
      case 'preview':
        ({ data, diagnostics } = await previewProject(
          writeInputSchemas.preview.parse(parsed.input),
          await planStdin(parsed.input),
        ));
        break;
      case 'apply':
        ({ data, diagnostics } = await applyProject(
          writeInputSchemas.apply.parse(parsed.input),
          await planStdin(parsed.input),
        ));
        break;
      case 'export':
        ({ data, diagnostics } = await exportProject(writeInputSchemas.export.parse(parsed.input)));
        break;
      case 'describe': {
        const request = describeRequestSchema.parse(parsed.input);
        if (request.operation && !capabilities.some((item) => item.operation === request.operation))
          throw new AutomationFailure(
            'UNKNOWN_OPERATION',
            'The requested operation is not known.',
            2,
          );
        data = describeCapabilities(request.operation);
        break;
      }
      case 'json read': {
        const request = readRequestSchema.parse(parsed.input);
        if (request.raw) {
          process.stdout.write((await readSource(request.path, request.expectedHash)).content);
          return;
        }
        ({ data, diagnostics } = await readCompleteJson(request.path, request.expectedHash));
        break;
      }
      case 'inspect':
        ({ data, diagnostics } = await inspectProject(inspectRequestSchema.parse(parsed.input)));
        break;
      case 'validate': {
        const request = validateRequestSchema.parse(parsed.input);
        const context = await readProjectContext(request.path, request.expectedHash);
        diagnostics = context.diagnostics;
        const errors = diagnostics.filter((item) => item.level === 'error').length;
        const warnings = diagnostics.filter((item) => item.level === 'warning').length;
        data = {
          source: context.source,
          sourceFormat: context.imported.format,
          importNotices: context.imported.notices,
          valid: errors === 0,
          errors,
          warnings,
          warningsAsErrors: request.warningsAsErrors,
        };
        if (errors || (request.warningsAsErrors && warnings)) {
          exitCode = 3;
          error = {
            code: errors ? 'VALIDATION_FAILED' : 'WARNINGS_AS_ERRORS',
            message: 'Project validation did not pass the requested policy.',
            retryable: false,
          };
        }
        break;
      }
    }
  } catch (caught) {
    if (caught instanceof AutomationFailure) {
      exitCode = caught.exitCode;
      data = caught.data;
      diagnostics = caught.diagnostics;
      error = {
        code: caught.code,
        message: caught.message,
        retryable: caught.retryable,
        path: caught.path,
      };
    } else if (caught instanceof ProjectFileError) {
      exitCode = caught.exitCode;
      data = caught.details;
      error = { code: caught.code, message: caught.message, retryable: caught.exitCode === 4 };
    } else if (caught instanceof ProjectImportError) {
      exitCode = 3;
      error = {
        code: 'PROJECT_STRUCTURE_INVALID',
        message: caught.message,
        retryable: false,
        path: caught.path,
      };
      diagnostics = [{ ...error, level: 'error', pathBasis: 'source' }];
    } else if (caught instanceof FileSnapshotError) {
      exitCode = caught.code === 'FILE_CHANGED' ? 4 : 3;
      error = {
        code: caught.code,
        message: caught.message,
        retryable: caught.code === 'FILE_CHANGED',
      };
    } else if (caught instanceof Error && 'code' in caught && typeof caught.code === 'string') {
      exitCode = 5;
      error = { code: 'IO_ERROR', message: `${caught.code}: ${caught.message}`, retryable: false };
    } else {
      exitCode = 1;
      error = {
        code: 'INTERNAL_ERROR',
        message: caught instanceof Error ? caught.message : String(caught),
        retryable: false,
      };
    }
  }
  const output =
    JSON.stringify({
      apiVersion: API_VERSION,
      ok: exitCode === 0,
      command,
      data,
      diagnostics,
      ...(error ? { error } : {}),
    }) + '\n';
  (rawOutput ? process.stderr : process.stdout).write(output);
  process.exitCode = exitCode;
}

// 不强制 process.exit，以免大文件输出在管道排空前被截断。
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') process.exitCode = 5;
  else {
    process.stderr.write(`Output failed: ${error.message}\n`);
    process.exitCode = 5;
  }
});
void main().catch((error: unknown) => {
  process.stderr.write(
    JSON.stringify({
      apiVersion: API_VERSION,
      ok: false,
      command: 'output',
      data: null,
      diagnostics: [],
      error: {
        code: 'OUTPUT_FAILED',
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
      },
    }) + '\n',
  );
  process.exitCode = 1;
});
