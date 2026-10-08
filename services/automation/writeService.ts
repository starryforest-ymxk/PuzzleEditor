/** 离线事务协调：重新执行受限命令并校验，再排他交付；回执不授权 JSON 直接编辑。 */
import { readFileSnapshot } from '../../dist-node/files.js';
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
import { validateProject } from '../../utils/validation/validator';
import type { CodedValidationResult } from '../../types/validation';
import type { ProjectData, EditorUIState } from '../../types/project';
import { executePlan, CommandFailure } from '../../store/commands/automation/execute';
import { serializeProject } from '../projectFiles';
import { prepareRuntimeExport } from '../projectExportPreparation';
import { readSource, readProjectContext } from './readService';
import { parseFileJson } from './jsonRead';
import { indexEntities } from './entities';
import { domainDiagnostics } from './diagnostics';
import { AutomationFailure } from './errors';
import { parseContract, hashText, fullDiff } from './transactionData';
import { targetPath, publishNew } from './fileCommit';

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
function baselineKey(item: CodedValidationResult) {
  // 同一位置的规则 ID 可能没有包含失效目标；连同诊断详情比较，禁止用另一错误替换旧错误。
  // message 仅作为完整字符串比较，不从英文文案解析实体或错误码。
  return JSON.stringify([
    item.code,
    item.objectType,
    item.objectId,
    item.contextId,
    item.fsmId,
    item.ownerType,
    item.ownerId,
    item.field,
    item.id,
    item.message,
  ]);
}
function buildCandidate(
  source: ProjectData,
  plan: Plan,
  savedAt: string,
  editorState: EditorUIState | undefined,
  creating = false,
) {
  let execution: ReturnType<typeof executePlan>;
  try {
    execution = executePlan(source, plan);
  } catch (error) {
    if (!(error instanceof CommandFailure)) throw error;
    throw new AutomationFailure(error.code, error.message, 3, [
      {
        code: error.code,
        level: 'error',
        message: error.message,
        retryable: false,
        operationIndex: error.operationIndex,
        path: error.operationIndex === undefined ? '/scope' : `/commands/${error.operationIndex}`,
        pathBasis: 'request',
      },
    ]);
  }
  const content = serializeProject(execution.project, editorState, savedAt);
  // 序列化后再次走实际导入边界，保证可被 GUI 打开，不把类型断言当成结构验证。
  const finalProject = importProject(content).project;
  const before = creating ? [] : validateProject(source),
    after = validateProject(finalProject);
  const counts = new Map<string, number>();
  for (const item of before.filter((r) => r.level === 'error'))
    counts.set(baselineKey(item), (counts.get(baselineKey(item)) ?? 0) + 1);
  const sourceEntities = indexEntities(source),
    targetEntities = indexEntities(finalProject);
  const added = after.filter((item) => {
    if (item.level !== 'error') return false;
    const key = baselineKey(item),
      count = counts.get(key) ?? 0;
    counts.set(key, count - 1);
    if (count <= 0) return true;
    if (item.field === 'assetName') {
      const target = domainDiagnostics([item], targetEntities)[0].entity;
      if (target) {
        const same = (ref: typeof target) => JSON.stringify(ref) === JSON.stringify(target);
        return (
          sourceEntities.find((e) => same(e.ref))?.assetName !==
          targetEntities.find((e) => same(e.ref))?.assetName
        );
      }
    }
    return false;
  });
  const diagnostics = domainDiagnostics(after, targetEntities);
  if (added.length)
    throw new AutomationFailure(
      'CANDIDATE_VALIDATION_FAILED',
      'The candidate introduces errors. No project file was written.',
      3,
      diagnostics,
      {
        newErrors: domainDiagnostics(added, targetEntities),
        changes: fullDiff(source, finalProject),
      },
    );
  return {
    ...execution,
    project: finalProject,
    content,
    diagnostics,
    remainingErrors: after.filter((d) => d.level === 'error').length,
  };
}
async function editableSource(path: string, plan: Plan, expectedHash?: string) {
  if (!plan.sourceHash)
    throw new AutomationFailure(
      'SOURCE_HASH_REQUIRED',
      'Editing plans must include the sourceHash returned by inspect.',
      2,
    );
  if (expectedHash && expectedHash !== plan.sourceHash)
    throw new AutomationFailure('REVISION_CONFLICT', 'Request and plan source hashes differ.', 4);
  const source = await readSource(path, plan.sourceHash);
  const parsed = parseFileJson(source.content);
  if (!parsed.parsedAvailable)
    throw new AutomationFailure(
      'AMBIGUOUS_JSON',
      'The source cannot be edited as structured JSON.',
      3,
      parsed.diagnostics,
    );
  const imported = importProject(source.content);
  if (imported.format !== 'project')
    throw new AutomationFailure(
      'PROJECT_FILE_REQUIRED',
      'Save this imported format as a complete .puzzle.json project in the editor before editing it with the CLI.',
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
  const target = await targetPath(request.out, loaded.path ? [loaded.path] : [], '.puzzle.json');
  await unchanged(loaded);
  const result = await publishNew(target, candidate.content);
  return {
    data: { ...result, aliases: candidate.allocations, remainingErrors: candidate.remainingErrors },
    diagnostics: candidate.diagnostics,
  };
}
export async function previewProject(request: WriteRequests['preview'], stdin?: string) {
  const loaded = await loadPlan(request.plan, stdin),
    source = await editableSource(request.path, loaded.plan, request.expectedHash);
  const savedAt = new Date().toISOString();
  const candidate = buildCandidate(
    source.imported.project,
    loaded.plan,
    savedAt,
    source.editorState,
  );
  const receipt: Receipt = {
    apiVersion: API_VERSION,
    kind: 'domain-preview',
    source: { path: source.source.path, sha256: source.source.sha256 },
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
      importNotices: source.imported.notices,
      changes,
      aliases: candidate.allocations,
      receipt,
      receiptFile,
      remainingErrors: candidate.remainingErrors,
    },
    diagnostics: candidate.diagnostics,
  };
}
export async function applyProject(request: WriteRequests['apply'], stdin?: string) {
  const loaded = await loadPlan(request.plan, stdin),
    receiptFile = await readFileSnapshot(request.receipt);
  const receipt = parseContract(receiptSchema, receiptFile.content, 'Receipt');
  const source = await editableSource(request.path, loaded.plan, request.expectedHash);
  if (
    receipt.planHash !== loaded.hash ||
    receipt.source.path !== source.source.path ||
    receipt.source.sha256 !== source.source.sha256
  )
    throw new AutomationFailure(
      'RECEIPT_CONFLICT',
      'Source or plan differs from the preview receipt.',
      4,
      [],
      null,
      true,
    );
  const candidate = buildCandidate(
    source.imported.project,
    loaded.plan,
    receipt.savedAt,
    source.editorState,
  );
  if (
    receipt.candidateHash !== hashText(candidate.content) ||
    JSON.stringify(receipt.allocations) !== JSON.stringify(candidate.allocations)
  )
    throw new AutomationFailure(
      'RECEIPT_CONFLICT',
      'The reconstructed candidate differs from the preview receipt.',
      4,
      [],
      null,
      true,
    );
  const target = await targetPath(
    request.out,
    [source.source.path, receiptFile.path, ...(loaded.path ? [loaded.path] : [])],
    '.puzzle.json',
  );
  await unchanged(loaded);
  await readSource(source.source.path, source.source.sha256);
  if ((await readFileSnapshot(receiptFile.path)).sha256 !== receiptFile.sha256)
    throw new AutomationFailure('RECEIPT_CONFLICT', 'The receipt changed before publication.', 4);
  const result = await publishNew(target, candidate.content, true);
  return {
    data: {
      ...result,
      source: source.source,
      aliases: candidate.allocations,
      changes: fullDiff(source.raw, JSON.parse(candidate.content)),
      remainingErrors: candidate.remainingErrors,
    },
    diagnostics: candidate.diagnostics,
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
