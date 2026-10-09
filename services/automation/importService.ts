/** 兼容转换固定时间/身份后重建候选；只发布新工程，不改源文件或 GUI 会话。 */
import { randomUUID } from 'node:crypto';
import { readFileSnapshot } from '../../dist-node/files.js';
import { API_VERSION } from '../../contracts/automation/primitives';
import { POLICY_VERSION } from '../../contracts/automation/permissions';
import {
  IMPORT_CONVERTER_VERSION,
  importNamesSchema,
  importReceiptSchema,
  type ImportReceipt,
  type ImportRequests,
} from '../../contracts/automation/importSchemas';
import { importProject, type ImportNotice } from '../../utils/projectImport';
import { defaultProjectEditorState } from '../../utils/projectEditorState';
import { equalProjectData } from '../../utils/equalProjectData';
import { serializeProject } from '../projectFiles';
import { readSource } from './readService';
import { parseFileJson } from './jsonRead';
import { fullDiff, hashText, parseContract } from './transactionData';
import { targetPath, publishNew, requireAbsentOutput } from './fileCommit';
import { validateCandidate } from './candidateValidation';
import { applyImportNames } from './importNames';
import { AutomationFailure } from './errors';

async function prepare(
  request: ImportRequests['import preview'],
  context: ImportReceipt['context'],
) {
  const source = await readSource(request.path, request.expectedHash);
  const parsed = parseFileJson(source.content);
  if (!parsed.parsedAvailable)
    throw new AutomationFailure(
      'AMBIGUOUS_JSON',
      'Conversion requires unambiguous JSON. Raw reading remains available.',
      3,
      parsed.diagnostics,
    );
  const imported = importProject(source.content, context);
  const names = request.names ? await readFileSnapshot(request.names) : undefined;
  const mapping = names
    ? parseContract(importNamesSchema, names.content, 'Import name mapping')
    : undefined;
  if (mapping && mapping.sourceHash !== source.source.sha256)
    throw new AutomationFailure(
      'REVISION_CONFLICT',
      'The name mapping was prepared for a different source snapshot.',
      4,
      [],
      { source: source.source },
      true,
    );
  const named = applyImportNames(imported.project, mapping);
  const editorStateDefaulted = imported.editorState === undefined;
  const editorState =
    imported.editorState ?? defaultProjectEditorState(imported.project.stageTree.rootId);
  const notices: ImportNotice[] = [...imported.notices];
  if (editorStateDefaulted)
    notices.push({
      path: '$.editorState',
      message:
        'The source has no saved editor state. Shared defaults are used; lost UI state cannot be recovered.',
    });
  const content = serializeProject(named.project, editorState, context.now);
  const finalProject = importProject(content, context).project;
  // 已有受保护资源是源文件声明，转换不新建或删改它们；命名改动仍不得新增业务错误。
  const validation = validateCandidate(imported.project, finalProject);
  const protectedPaths = [source.source.path, ...(names ? [names.path] : [])];
  const target = await targetPath(request.out, protectedPaths, '.puzzle.json');
  const receipt: ImportReceipt = {
    apiVersion: API_VERSION,
    kind: 'import-preview',
    converterVersion: IMPORT_CONVERTER_VERSION,
    policyVersion: POLICY_VERSION,
    requiredCapabilities: [],
    source: { path: source.source.path, sha256: source.source.sha256 },
    names: names ? { path: names.path, sha256: names.sha256 } : null,
    output: { path: target, mode: 'create-new', expected: 'absent' },
    context,
    detectedFormat: imported.format,
    candidateHash: hashText(content),
  };
  return {
    source,
    names,
    protectedPaths,
    target,
    receipt,
    content,
    data: {
      source: source.source,
      detectedFormat: imported.format,
      converterVersion: IMPORT_CONVERTER_VERSION,
      requiredCapabilities: [],
      importNotices: notices,
      migrated: imported.migrated,
      editorStateDefaulted,
      nameChanges: named.nameChanges,
      missingAssetNames: named.missingAssetNames,
      remainingErrors: validation.remainingErrors,
      candidateHash: receipt.candidateHash,
      candidateFile: JSON.parse(content) as unknown,
      changes: fullDiff(parsed.value, JSON.parse(content)),
      output: receipt.output,
    },
    diagnostics: validation.diagnostics,
  };
}

async function unchanged(
  request: ImportRequests['import preview'],
  prepared: Awaited<ReturnType<typeof prepare>>,
) {
  const check = async (path: string, expected: { path: string; sha256: string }) => {
    const latest = await readSource(path, expected.sha256);
    if (latest.source.path !== expected.path)
      throw new AutomationFailure(
        'REVISION_CONFLICT',
        'An input now resolves to a different file. Preview again.',
        4,
        [],
        null,
        true,
      );
  };
  await check(request.path, prepared.source.source);
  if (request.names && prepared.names) await check(request.names, prepared.names);
}

export async function previewImport(request: ImportRequests['import preview']) {
  const prepared = await prepare(request, {
    now: new Date().toISOString(),
    runtimeProjectId: `proj-imported-${randomUUID()}`,
  });
  await requireAbsentOutput(prepared.target);
  let receiptFile;
  if (request.receiptOut) {
    // 目标尚不存在不能作为 realpath 输入；先分别规范化再比较输出位置。
    const receiptTarget = await targetPath(request.receiptOut, prepared.protectedPaths);
    if (
      (process.platform === 'win32' ? receiptTarget.toLowerCase() : receiptTarget) ===
      (process.platform === 'win32' ? prepared.target.toLowerCase() : prepared.target)
    )
      throw new AutomationFailure(
        'INPUT_OUTPUT_COLLISION',
        'Receipt and converted project must use different output paths.',
        4,
      );
    await unchanged(request, prepared);
    receiptFile = await publishNew(receiptTarget, JSON.stringify(prepared.receipt, null, 2) + '\n');
  }
  return {
    data: { ...prepared.data, receipt: prepared.receipt, receiptFile },
    diagnostics: prepared.diagnostics,
  };
}

export async function applyImport(request: ImportRequests['import apply']) {
  const receiptFile = await readFileSnapshot(request.receipt);
  const receipt = parseContract(importReceiptSchema, receiptFile.content, 'Import receipt');
  const prepared = await prepare(request, receipt.context);
  if (!equalProjectData(receipt, prepared.receipt))
    throw new AutomationFailure(
      'RECEIPT_CONFLICT',
      'Source, mapping, output, or reconstructed conversion differs from preview.',
      4,
      [],
      null,
      true,
    );
  await targetPath(request.out, [...prepared.protectedPaths, receiptFile.path], '.puzzle.json');
  await unchanged(request, prepared);
  const currentReceipt = await readFileSnapshot(request.receipt);
  if (currentReceipt.path !== receiptFile.path || currentReceipt.sha256 !== receiptFile.sha256)
    throw new AutomationFailure(
      'RECEIPT_CONFLICT',
      'The import receipt changed before publication.',
      4,
    );
  const result = await publishNew(prepared.target, prepared.content, true);
  return { data: { ...prepared.data, ...result }, diagnostics: prepared.diagnostics };
}
