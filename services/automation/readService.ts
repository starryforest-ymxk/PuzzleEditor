/** Node 只读协调入口：快照、原文审计、共同导入/校验、查询结果分层组织。 */
import { readFileSnapshot } from '../../dist-node/files.js';
import { importProject } from '../../utils/projectImport';
import { validateProject } from '../../utils/validation/validator';
import type { InspectRequest } from '../../contracts/automation/schemas';
import { parseFileJson } from './jsonRead';
import { indexEntities } from './entities';
import { domainDiagnostics } from './diagnostics';
import { queryProject } from './queries';
import { AutomationFailure } from './errors';

export async function readSource(path: string, expectedHash?: string) {
  const { content, ...source } = await readFileSnapshot(path);
  if (expectedHash && expectedHash !== source.sha256) {
    throw new AutomationFailure(
      'REVISION_CONFLICT',
      'The source changed. Read its current snapshot before continuing.',
      4,
      [],
      { source },
      true,
    );
  }
  return { content, source };
}

export async function readCompleteJson(path: string, expectedHash?: string) {
  const { content, source } = await readSource(path, expectedHash);
  const parsed = parseFileJson(content);
  return {
    data: { source, file: parsed.value, rawText: content, parsedAvailable: parsed.parsedAvailable },
    diagnostics: parsed.diagnostics,
  };
}

export async function readProjectContext(path: string, expectedHash?: string) {
  const { content, source } = await readSource(path, expectedHash);
  const parsed = parseFileJson(content);
  if (!parsed.parsedAvailable)
    throw new AutomationFailure(
      'AMBIGUOUS_JSON',
      'Resolve duplicate keys or unsafe numbers before using structured project operations. Raw reading remains available.',
      3,
      parsed.diagnostics,
      { source },
    );
  const imported = importProject(content);
  const entries = indexEntities(imported.project);
  const diagnostics = domainDiagnostics(validateProject(imported.project), entries);
  return { source, imported, entries, diagnostics };
}

export async function inspectProject(request: InspectRequest) {
  const context = await readProjectContext(request.path, request.expectedHash);
  return {
    data: {
      source: context.source,
      sourceFormat: context.imported.format,
      normalized: context.imported.notices.length > 0,
      importNotices: context.imported.notices,
      view: request.view,
      result: queryProject(context.imported.project, context.entries, request),
    },
    diagnostics: context.diagnostics,
  };
}
