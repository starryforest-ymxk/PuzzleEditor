/** 原始候选只做校验与按字节交付；授权来自 Agent 聊天，CLI 只要求明确启用。 */
import { API_VERSION } from '../../contracts/automation/primitives';
import {
  rawReceiptSchema,
  type RawReceipt,
  type RawRequests,
} from '../../contracts/automation/rawSchemas';
import { readFileSnapshot, type FileSnapshot } from '../../dist-node/files.js';
import { importProject } from '../../utils/projectImport';
import type { ProjectFile } from '../../types/project';
import { equalProjectData } from '../../utils/equalProjectData';
import { AutomationFailure } from './errors';
import { parseFileJson } from './jsonRead';
import { fullDiff, parseContract } from './transactionData';
import { targetPath, publishNew, requireAbsentOutput } from './fileCommit';
import { assertRawPolicy } from './rawPolicy';
import { validateCandidate } from './candidateValidation';
import { summarizeImpacts } from './impacts';
import { analyzePermissions, assertCapabilities } from './permissions';
import { POLICY_VERSION } from '../../contracts/automation/permissions';
import { executeOverwrite, type OverwriteExpectation } from '../../dist-node/projectOverwrite.js';
import { describeOverwrite, assertOverwriteMode } from './overwriteService';

const samePath = (a: string, b: string) =>
  process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const fingerprint = ({ path, sha256 }: FileSnapshot) => ({ path, sha256 });
const metadata = ({ content: _content, ...snapshot }: FileSnapshot) => snapshot;
async function readProject(path: string, expectedHash?: string, original?: FileSnapshot) {
  const snapshot = original ?? (await readFileSnapshot(path));
  if (expectedHash && snapshot.sha256 !== expectedHash)
    throw new AutomationFailure(
      'REVISION_CONFLICT',
      'The source changed. Read and preview it again.',
      4,
      [],
      null,
      true,
    );
  const parsed = parseFileJson(snapshot.content);
  if (!parsed.parsedAvailable)
    throw new AutomationFailure(
      'AMBIGUOUS_JSON',
      'Structured writes require unambiguous JSON.',
      3,
      parsed.diagnostics,
    );
  const imported = importProject(snapshot.content);
  if (imported.format !== 'project')
    throw new AutomationFailure(
      'PROJECT_FILE_REQUIRED',
      'Raw editing requires a complete puzzle-project file.',
      3,
    );
  return { snapshot, raw: parsed.value as ProjectFile, imported };
}

async function unchanged(path: string, initial: FileSnapshot) {
  const current = await readFileSnapshot(path);
  if (!samePath(current.path, initial.path) || current.sha256 !== initial.sha256)
    throw new AutomationFailure(
      'REVISION_CONFLICT',
      'An input changed since preview. Preview again.',
      4,
      [],
      { path },
      true,
    );
}

async function prepare(
  request: RawRequests['json preview'],
  original?: FileSnapshot,
  overwrite?: OverwriteExpectation,
) {
  const source = await readProject(request.path, request.expectedHash, original);
  const candidate = await readProject(request.candidate);
  // 只比较已导入的规范数据，不把导入器补值后的对象偷偷写回候选。
  const normalized = JSON.parse(
    JSON.stringify({
      ...candidate.raw,
      project: candidate.imported.project,
      ...(candidate.raw.editorState === undefined
        ? {}
        : { editorState: candidate.imported.editorState }),
    }),
  ) as ProjectFile;
  const normalizationChanges = fullDiff(candidate.raw, normalized);
  if (normalizationChanges.length)
    throw new AutomationFailure(
      'CANDIDATE_NORMALIZATION_REQUIRED',
      'Prepare the reported normalized fields in a new candidate, then preview again. No project was written.',
      3,
      [],
      {
        normalizationChanges,
        importNotices: candidate.imported.notices,
      },
    );
  assertRawPolicy(source.imported.project, candidate.imported.project);
  const validation = validateCandidate(source.imported.project, candidate.imported.project);
  const permissions = analyzePermissions(source.imported.project, candidate.imported.project, {
    rawJsonWrite: true,
    overwriteProject: request.inPlace,
  });
  const target = await targetPath(
    request.inPlace ? request.path : request.out!,
    [...(request.inPlace ? [] : [source.snapshot.path]), candidate.snapshot.path],
    '.puzzle.json',
  );
  const receipt: RawReceipt = {
    apiVersion: API_VERSION,
    kind: 'raw-json-preview',
    policyVersion: POLICY_VERSION,
    requiredCapabilities: permissions.requiredCapabilities,
    source: fingerprint(source.snapshot),
    candidate: fingerprint(candidate.snapshot),
    output: request.inPlace
      ? (overwrite ?? (await describeOverwrite(request.path, source.snapshot.sha256)))
      : { path: target, mode: 'create-new', expected: 'absent' },
  };
  return {
    source,
    candidate,
    target,
    receipt,
    ...validation,
    ...permissions,
    changes: fullDiff(source.raw, candidate.raw),
    impacts: summarizeImpacts(source.imported.project, candidate.imported.project),
  };
}

export async function previewRawJson(request: RawRequests['json preview']) {
  const prepared = await prepare(request);
  const { source, candidate, target, receipt, diagnostics, changes, impacts, remainingErrors } =
    prepared;
  if (!request.inPlace) await requireAbsentOutput(target);
  let receiptFile;
  if (request.receiptOut) {
    const receiptTarget = await targetPath(request.receiptOut, [
      source.snapshot.path,
      candidate.snapshot.path,
    ]);
    if (samePath(receiptTarget, target))
      throw new AutomationFailure(
        'INPUT_OUTPUT_COLLISION',
        'Receipt and project output must use different paths.',
        4,
      );
    await unchanged(request.path, source.snapshot);
    await unchanged(request.candidate, candidate.snapshot);
    receiptFile = await publishNew(receiptTarget, JSON.stringify(receipt, null, 2) + '\n');
  }
  return {
    data: {
      source: metadata(source.snapshot),
      requiredCapabilities: prepared.requiredCapabilities,
      permanentDeletions: prepared.permanentDeletions,
      candidate: metadata(candidate.snapshot),
      output: receipt.output,
      changes,
      impacts,
      remainingErrors,
      receipt,
      receiptFile,
      sourceImportNotices: source.imported.notices,
      authorizationRequired:
        'Explicit user authorization in the agent chat; apply also requires --allow-raw-json-write.',
    },
    diagnostics,
  };
}

export async function applyRawJson(request: RawRequests['json apply']) {
  assertCapabilities(
    request.inPlace ? ['raw_json_write', 'overwrite_project'] : ['raw_json_write'],
    request,
  );
  const receiptFile = await readFileSnapshot(request.receipt);
  const receipt = parseContract(rawReceiptSchema, receiptFile.content, 'Raw JSON receipt');
  assertOverwriteMode(request.inPlace, receipt.output.mode === 'overwrite-source');
  const overwrite = receipt.output.mode === 'overwrite-source' ? receipt.output : undefined;
  const build = async (original?: FileSnapshot) => {
    const prepared = await prepare(request, original, overwrite);
    assertCapabilities(prepared.requiredCapabilities, request, prepared.permanentDeletions);
    if (!equalProjectData(receipt, prepared.receipt))
      throw new AutomationFailure(
        'RECEIPT_CONFLICT',
        'Source, candidate, or output differs from the raw preview receipt.',
        4,
      );
    return prepared;
  };
  const candidateFile = await readFileSnapshot(request.candidate);
  const verifyInputs = async () => {
    await unchanged(request.receipt, receiptFile);
    await unchanged(request.candidate, candidateFile);
  };
  const response = (prepared: Awaited<ReturnType<typeof prepare>>) => ({
    data: {
      requiredCapabilities: prepared.requiredCapabilities,
      permanentDeletions: prepared.permanentDeletions,
      source: metadata(prepared.source.snapshot),
      candidate: metadata(prepared.candidate.snapshot),
      changes: prepared.changes,
      impacts: prepared.impacts,
      remainingErrors: prepared.remainingErrors,
      authorization: { basis: 'agent-chat', declared: true, verifiedByCli: false },
    },
    diagnostics: prepared.diagnostics,
  });
  if (request.inPlace && overwrite) {
    await targetPath(request.path, [receiptFile.path, candidateFile.path], '.puzzle.json');
    const committed = await executeOverwrite(
      {
        path: request.path,
        expected: overwrite,
        requestHash: receiptFile.sha256,
        candidateHash: receipt.candidate.sha256,
      },
      async (original) => {
        const prepared = await build(original);
        return { content: prepared.candidate.snapshot.content, result: response(prepared) };
      },
      verifyInputs,
    );
    const { result, ...publication } = committed;
    return { ...result, data: { ...result.data, ...publication } };
  }
  const prepared = await build();
  await targetPath(
    request.out!,
    [prepared.source.snapshot.path, candidateFile.path, receiptFile.path],
    '.puzzle.json',
  );
  await unchanged(request.path, prepared.source.snapshot);
  await verifyInputs();
  const result = response(prepared);
  return {
    ...result,
    data: {
      ...result.data,
      ...(await publishNew(prepared.target, prepared.candidate.snapshot.content, true)),
    },
  };
}
