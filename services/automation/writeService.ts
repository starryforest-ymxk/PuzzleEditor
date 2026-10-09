/** 离线事务协调：重新执行受限命令并校验，再排他交付；回执不授权 JSON 直接编辑。 */
import { readFileSnapshot, type FileSnapshot } from '../../dist-node/files.js';
import { executeOverwrite } from '../../dist-node/projectOverwrite.js';
import { describeOverwrite, assertOverwriteMode } from './overwriteService';
import {
  planSchema,
  receiptSchema,
  type Plan,
  type Receipt,
  type WriteRequests,
} from '../../contracts/automation/planSchemas';
import { API_VERSION } from '../../contracts/automation/primitives';
import { createEmptyProject } from '../../utils/projectFactory';
import { importProject } from '../../utils/projectImport';
import type { EditorUIState } from '../../types/project';
import { buildCandidate } from './domainCandidate';
import { prepareRuntimeExport } from '../projectExportPreparation';
import { readSource, readProjectContext } from './readService';
import { parseFileJson } from './jsonRead';
import { AutomationFailure } from './errors';
import { parseContract, hashText, fullDiff } from './transactionData';
import { targetPath, publishNew } from './fileCommit';
import { assertCapabilities } from './permissions';
import { POLICY_VERSION } from '../../contracts/automation/permissions';

async function loadPlan(input: string | undefined, stdin?: string) {
  if (!input)
    return {
      plan: { apiVersion: API_VERSION, scope: { project: true }, commands: [] } satisfies Plan,
      hash: hashText(''),
      path: undefined,
    };
  const snapshot = input === '-' ? undefined : await readFileSnapshot(input);
  if (input === '-' && stdin === undefined)
    throw new AutomationFailure('STDIN_REQUIRED', 'Plan input was not supplied on stdin.', 2);
  const text = snapshot?.content ?? stdin!;
  return {
    plan: parseContract(planSchema, text, 'Plan'),
    hash: snapshot?.sha256 ?? hashText(text),
    path: snapshot?.path,
  };
}
async function unchanged(plan: Awaited<ReturnType<typeof loadPlan>>) {
  if (plan.path && (await readFileSnapshot(plan.path)).sha256 !== plan.hash)
    throw new AutomationFailure(
      'PLAN_CONFLICT',
      'The plan changed. Preview it again.',
      4,
      [],
      null,
      true,
    );
}
async function editableSource(
  path: string,
  plan: Plan,
  expectedHash?: string,
  original?: FileSnapshot,
  now?: string,
) {
  if (!plan.sourceHash)
    throw new AutomationFailure(
      'SOURCE_HASH_REQUIRED',
      'Editing plans must include the sourceHash returned by inspect.',
      2,
    );
  if (expectedHash && expectedHash !== plan.sourceHash)
    throw new AutomationFailure('REVISION_CONFLICT', 'Request and plan source hashes differ.', 4);
  const source = original
    ? {
        content: original.content,
        source: {
          path: original.path,
          sha256: original.sha256,
          size: original.size,
          modifiedAt: original.modifiedAt,
        },
      }
    : await readSource(path, plan.sourceHash);
  if (source.source.sha256 !== plan.sourceHash)
    throw new AutomationFailure(
      'REVISION_CONFLICT',
      'The plan does not match the original source.',
      4,
    );
  const parsed = parseFileJson(source.content);
  if (!parsed.parsedAvailable)
    throw new AutomationFailure(
      'AMBIGUOUS_JSON',
      'The source cannot be edited as structured JSON.',
      3,
      parsed.diagnostics,
    );
  const imported = importProject(source.content, { now });
  if (imported.format !== 'project')
    throw new AutomationFailure(
      'PROJECT_FILE_REQUIRED',
      'Convert this source with import preview/apply, or save it as a complete .puzzle.json project in the editor before domain editing.',
      3,
    );
  // 已存编辑状态逐字段保持；领域计划不能通过普通字段替换编辑器状态。
  const editorState = (parsed.value as { editorState?: EditorUIState }).editorState;
  return { ...source, imported, raw: parsed.value, editorState };
}
export async function createProject(request: WriteRequests['create'], stdin?: string) {
  const loaded = await loadPlan(request.plan, stdin);
  if (loaded.plan.sourceHash)
    throw new AutomationFailure(
      'UNEXPECTED_SOURCE_HASH',
      'Creation plans must not include an existing sourceHash.',
      2,
    );
  const savedAt = new Date().toISOString();
  const project = createEmptyProject(request.name, request.description, savedAt);
  project.stageTree.stages[project.stageTree.rootId].assetName = request.rootAssetName;
  const candidate = buildCandidate(project, loaded.plan, savedAt, undefined, true);
  assertCapabilities(candidate.requiredCapabilities, {}, candidate.permanentDeletions);
  const target = await targetPath(request.out, loaded.path ? [loaded.path] : [], '.puzzle.json');
  await unchanged(loaded);
  const result = await publishNew(target, candidate.content);
  return {
    data: {
      ...result,
      requiredCapabilities: candidate.requiredCapabilities,
      aliases: candidate.allocations,
      impacts: candidate.impacts,
      remainingErrors: candidate.remainingErrors,
    },
    diagnostics: candidate.diagnostics,
  };
}
export async function previewProject(request: WriteRequests['preview'], stdin?: string) {
  const savedAt = new Date().toISOString();
  const loaded = await loadPlan(request.plan, stdin),
    source = await editableSource(
      request.path,
      loaded.plan,
      request.expectedHash,
      undefined,
      savedAt,
    );
  const candidate = buildCandidate(
    source.imported.project,
    loaded.plan,
    savedAt,
    source.editorState,
    false,
    request.inPlace,
  );
  const receipt: Receipt = {
    apiVersion: API_VERSION,
    kind: 'domain-preview',
    policyVersion: POLICY_VERSION,
    requiredCapabilities: candidate.requiredCapabilities,
    source: { path: source.source.path, sha256: source.source.sha256 },
    ...(request.inPlace
      ? { overwrite: await describeOverwrite(request.path, source.source.sha256) }
      : {}),
    planHash: loaded.hash,
    savedAt,
    candidateHash: hashText(candidate.content),
    allocations: candidate.allocations,
  };
  const changes = fullDiff(source.raw, JSON.parse(candidate.content));
  let receiptFile;
  if (request.receiptOut) {
    const target = await targetPath(request.receiptOut, [
      source.source.path,
      ...(loaded.path ? [loaded.path] : []),
    ]);
    await unchanged(loaded);
    await readSource(source.source.path, source.source.sha256);
    receiptFile = await publishNew(target, JSON.stringify(receipt, null, 2) + '\n');
  }
  return {
    data: {
      source: source.source,
      requiredCapabilities: candidate.requiredCapabilities,
      permanentDeletions: candidate.permanentDeletions,
      importNotices: source.imported.notices,
      changes,
      aliases: candidate.allocations,
      receipt,
      receiptFile,
      impacts: candidate.impacts,
      remainingErrors: candidate.remainingErrors,
    },
    diagnostics: candidate.diagnostics,
  };
}
export async function applyProject(request: WriteRequests['apply'], stdin?: string) {
  if (request.inPlace) assertCapabilities(['overwrite_project'], request);
  const loaded = await loadPlan(request.plan, stdin);
  if (loaded.plan.commands.some((op) => op.op.endsWith('.purge')))
    assertCapabilities(['permanent_resource_delete'], request);
  const receiptFile = await readFileSnapshot(request.receipt);
  const receipt = parseContract(receiptSchema, receiptFile.content, 'Receipt');
  assertOverwriteMode(request.inPlace, !!receipt.overwrite);
  const verifyInputs = async () => {
    await unchanged(loaded);
    const current = await readFileSnapshot(request.receipt);
    if (current.sha256 !== receiptFile.sha256 || current.path !== receiptFile.path)
      throw new AutomationFailure('RECEIPT_CONFLICT', 'The receipt changed before publication.', 4);
  };
  // 首次提交与备份重试使用同一候选重建，授权、生命周期及错误基线不能被重试绕过。
  const prepare = async (original?: FileSnapshot) => {
    const source = await editableSource(
      request.path,
      loaded.plan,
      request.expectedHash,
      original,
      receipt.savedAt,
    );
    if (
      receipt.planHash !== loaded.hash ||
      receipt.source.path !== source.source.path ||
      receipt.source.sha256 !== source.source.sha256
    )
      throw new AutomationFailure(
        'RECEIPT_CONFLICT',
        'Source or plan differs from the preview receipt.',
        4,
      );
    const candidate = buildCandidate(
      source.imported.project,
      loaded.plan,
      receipt.savedAt,
      source.editorState,
      false,
      request.inPlace,
    );
    assertCapabilities(candidate.requiredCapabilities, request, candidate.permanentDeletions);
    if (
      receipt.candidateHash !== hashText(candidate.content) ||
      JSON.stringify(receipt.requiredCapabilities) !==
        JSON.stringify(candidate.requiredCapabilities) ||
      JSON.stringify(receipt.allocations) !== JSON.stringify(candidate.allocations)
    )
      throw new AutomationFailure(
        'RECEIPT_CONFLICT',
        'The reconstructed candidate differs from the preview receipt.',
        4,
      );
    return {
      source,
      content: candidate.content,
      result: {
        data: {
          source: source.source,
          requiredCapabilities: candidate.requiredCapabilities,
          permanentDeletions: candidate.permanentDeletions,
          aliases: candidate.allocations,
          changes: fullDiff(source.raw, JSON.parse(candidate.content)),
          impacts: candidate.impacts,
          remainingErrors: candidate.remainingErrors,
        },
        diagnostics: candidate.diagnostics,
      },
    };
  };
  if (request.inPlace && receipt.overwrite) {
    await targetPath(
      request.path,
      [receiptFile.path, ...(loaded.path ? [loaded.path] : [])],
      '.puzzle.json',
    );
    const committed = await executeOverwrite(
      {
        path: request.path,
        expected: receipt.overwrite,
        requestHash: receiptFile.sha256,
        candidateHash: receipt.candidateHash,
      },
      prepare,
      verifyInputs,
    );
    const { result, ...publication } = committed;
    return { ...result, data: { ...result.data, ...publication } };
  }
  const prepared = await prepare();
  const target = await targetPath(
    request.out!,
    [prepared.source.source.path, receiptFile.path, ...(loaded.path ? [loaded.path] : [])],
    '.puzzle.json',
  );
  await verifyInputs();
  await readSource(request.path, prepared.source.source.sha256);
  return {
    ...prepared.result,
    data: { ...prepared.result.data, ...(await publishNew(target, prepared.content, true)) },
  };
}
export async function exportProject(request: WriteRequests['export']) {
  const source = await readProjectContext(request.path, request.expectedHash);
  const prepared = prepareRuntimeExport(source.imported.project, new Date().toISOString());
  if (!prepared.ok)
    throw new AutomationFailure(
      'VALIDATION_FAILED',
      'Export requires a project without errors.',
      3,
      source.diagnostics,
    );
  const target = await targetPath(request.out, [source.source.path], '.export.json');
  await readSource(source.source.path, source.source.sha256);
  return {
    data: { ...(await publishNew(target, prepared.content)), source: source.source },
    diagnostics: source.diagnostics,
  };
}
