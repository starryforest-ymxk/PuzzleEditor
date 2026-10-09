/** 在线应用服务：无 IO/DOM，复用领域候选、Store 历史及 ProjectSession 保存队列。 */
import type { EditorStore } from '../store/editorStore';
import { getHistoryEntry, historyTop } from '../store/documentHistory';
import { describeHistory, historyPermissions } from './onlineHistory';
import type { ProjectSession } from './projectSession';
import type { EditBarrier } from './editBarrier';
import {
  sessionRequestSchema,
  type SessionRequest,
  type SessionToken,
} from '../contracts/automation/sessionSchemas';
import { POLICY_VERSION } from '../contracts/automation/permissions';
import type { SessionResponse } from '../dist-node/sessionTransport.js';
import { buildCandidate } from './automation/domainCandidate';
import { fullDiff } from './automation/projectDiff';
import { sessionHash, canonicalJson } from './automation/sessionHash';
import { indexEntities } from './automation/entities';
import { domainDiagnostics } from './automation/diagnostics';
import { queryProject } from './automation/queries';
import { validateProject } from '../utils/validation/validator';
import { assertCapabilities } from './automation/permissions';
import { AutomationFailure } from './automation/errors';
import { projectUI, serializeProject } from './projectFiles';

const RETENTION_MS = 10 * 60 * 1000;
const fail = (code: string, message: string, exitCode = 4): never => {
  throw new AutomationFailure(code, message, exitCode, [], null, exitCode === 4);
};
export class OnlineSession {
  private requests = new Map<
    string,
    { hash: string; expires: number; result: Promise<SessionResponse> }
  >();
  constructor(
    private store: EditorStore,
    private session: ProjectSession,
    private barrier: EditBarrier,
    readonly instanceId: string,
    private now = Date.now,
  ) {}

  private async snapshot() {
    const state = this.store.getState(),
      version = this.store.getVersion();
    const project = getHistoryEntry(state).content;
    const token: SessionToken = {
      instanceId: this.instanceId,
      ...version,
      contentHash: await sessionHash(project),
    };
    return { state, project, token };
  }
  private matches(token: SessionToken): boolean {
    const version = this.store.getVersion();
    return (
      token.instanceId === this.instanceId &&
      token.sessionId === version.sessionId &&
      token.contentEpoch === version.contentEpoch
    );
  }
  private assertEditable(): void {
    const state = this.store.getState(),
      edit = this.barrier.status();
    if (!state.project.isLoaded) fail('NO_PROJECT', 'Open a project in this session first.');
    if (state.ui.readOnly) fail('SESSION_READ_ONLY', 'This editor is read-only.');
    if (state.runtime.projectOperation.phase !== 'idle' || edit.busy)
      fail('SESSION_BUSY', 'Finish the current editor operation before retrying.');
    if (edit.invalid) fail('PENDING_EDITS', 'Correct the unfinished field before retrying.');
  }
  private async enter(token: SessionToken) {
    this.assertEditable();
    this.barrier.flush();
    const snapshot = await this.snapshot();
    this.assertEditable();
    if (this.barrier.status().pendingEdits)
      fail('PENDING_EDITS', 'Uncommitted form edits remain. Finish them before retrying.');
    if (!this.matches(token) || canonicalJson(token) !== canonicalJson(snapshot.token))
      fail(
        'SESSION_CONFLICT',
        'Content or pending fields changed. Read the current token and preview again.',
      );
    return snapshot;
  }
  private metadata(snapshot: Awaited<ReturnType<OnlineSession['snapshot']>>) {
    return {
      token: snapshot.token,
      projectId: snapshot.project.meta.id,
      name: snapshot.project.meta.name,
      path: snapshot.state.runtime.currentProjectPath,
      loaded: snapshot.state.project.isLoaded,
      dirty: snapshot.state.ui.isDirty,
      readOnly: snapshot.state.ui.readOnly,
      ...this.barrier.status(),
      savePolicy: this.session.savePolicy(snapshot.state),
      history: {
        past: snapshot.state.history.past.length,
        future: snapshot.state.history.future.length,
      },
      resultRetentionMs: RETENTION_MS,
    };
  }
  async handle(input: unknown): Promise<SessionResponse> {
    try {
      const parsed = sessionRequestSchema.safeParse(input);
      if (!parsed.success)
        fail('INVALID_SESSION_REQUEST', 'The request does not match the session contract.', 2);
      const request = parsed.data!;
      if ('sessionId' in request && request.sessionId !== this.store.getState().document.sessionId)
        fail(
          'SESSION_EXPIRED',
          'The editor switched projects. Do not automatically replay the old request.',
        );
      if (!('requestId' in request)) return await this.execute(request);
      const now = this.now(),
        issued = Number(request.requestId.split(':')[0]);
      if (issued > now + 5000 || issued + RETENTION_MS <= now)
        fail(
          'REQUEST_EXPIRED',
          'The request ID is outside the result retention window. Inspect the project before creating another request.',
        );
      const hash = await sessionHash(request);
      for (const [id, entry] of this.requests) if (entry.expires <= now) this.requests.delete(id);
      const previous = this.requests.get(request.requestId);
      if (previous) {
        if (previous.hash !== hash)
          fail('REQUEST_ID_CONFLICT', 'The request ID already belongs to different content.');
        return previous.result;
      }
      if (this.requests.size >= 256)
        fail('SESSION_BUSY', 'The result cache is full. Wait for its retention window.');
      // 登记 Promise 后才执行任何提交，多个客户端和断线重试共用同一个结果。
      const result = Promise.resolve()
        .then(() => this.execute(request))
        .catch((error) => this.failure(error));
      this.requests.set(request.requestId, { hash, expires: issued + RETENTION_MS, result });
      return result;
    } catch (error) {
      return this.failure(error);
    }
  }
  private failure(error: unknown): SessionResponse {
    if (error instanceof AutomationFailure)
      return {
        ok: false,
        data: error.data,
        diagnostics: error.diagnostics,
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          exitCode: error.exitCode,
        },
      };
    return {
      ok: false,
      data: null,
      diagnostics: [],
      error: { code: 'SESSION_FAILED', message: String(error), retryable: false, exitCode: 5 },
    };
  }
  private async execute(request: SessionRequest): Promise<SessionResponse> {
    if (request.operation === 'history.list') {
      const snapshot = await this.snapshot();
      return {
        ok: true,
        data: { ...this.metadata(snapshot), history: describeHistory(snapshot.state) },
        diagnostics: [],
      };
    }
    if (request.operation === 'discover' || request.operation === 'status')
      return { ok: true, data: this.metadata(await this.snapshot()), diagnostics: [] };
    if (request.operation === 'inspect' || request.operation === 'validate') {
      const snapshot = await this.snapshot(),
        { project, state } = snapshot;
      const entries = indexEntities(project),
        diagnostics = domainDiagnostics(validateProject(project), entries);
      const result =
        request.operation === 'validate'
          ? { valid: !diagnostics.some((d) => d.level === 'error') }
          : request.query.view === 'project'
            ? {
                file: JSON.parse(
                  serializeProject(project, projectUI(state.ui), project.meta.updatedAt),
                ) as unknown,
              }
            : queryProject(project, entries, {
                ...request.query,
                view: request.query.view,
                path: '',
              });
      return { ok: true, data: { ...this.metadata(snapshot), result }, diagnostics };
    }
    const expected = request.operation === 'apply' ? request.receipt.token : request.token;
    const snapshot = await this.enter(expected);
    if (request.operation === 'history.undo' || request.operation === 'history.redo') {
      const direction = request.operation === 'history.undo' ? 'UNDO' : 'REDO';
      const entry =
        historyTop(snapshot.state, direction) ??
        fail('HISTORY_EMPTY', `There is no entry to ${direction.toLowerCase()}.`);
      if (entry.operation.entryId !== request.entryId)
        fail(
          'HISTORY_CONFLICT',
          'The expected entry is not the current history top. Read history again.',
        );
      const permissions = historyPermissions(snapshot.project, entry, direction);
      assertCapabilities(permissions.requiredCapabilities, request, permissions.permanentDeletions);
      const validationResults = validateProject(entry.content);
      this.assertEditable();
      if (
        this.barrier.status().pendingEdits ||
        !this.store.compareAndDispatch(expected, {
          type: 'RESTORE_AUTOMATION_HISTORY',
          direction,
          entryId: request.entryId,
          restrictAutoSave: !request.allowOverwrite,
          validationResults,
        })
      )
        fail('SESSION_CONFLICT', 'The editor changed before history commit.');
      const after = await this.snapshot();
      return {
        ok: true,
        data: {
          ...this.metadata(after),
          before: expected,
          changed: true,
          status: direction === 'UNDO' ? 'undone' : 'redone',
          entry: entry.operation,
          history: describeHistory(after.state),
        },
        diagnostics: domainDiagnostics(validationResults, indexEntities(after.project)),
      };
    }
    if (request.operation === 'save') {
      if (!request.out) {
        assertCapabilities(['overwrite_project'], request);
        if (!request.expectedDiskHash)
          fail('DISK_HASH_REQUIRED', 'Supply expectedDiskHash for current-file saving.', 2);
      }
      const result = await this.session.saveProject({
        agent: {
          ...request,
          matches: () =>
            this.matches(expected) &&
            !this.barrier.status().busy &&
            !this.barrier.status().invalid &&
            !this.barrier.status().pendingEdits,
        },
      });
      const data = { ...this.metadata(await this.snapshot()), save: result };
      if (result.status !== 'saved')
        return {
          ok: false,
          data,
          diagnostics: [],
          error: {
            code: 'SESSION_SAVE_FAILED',
            message: result.status === 'failed' ? result.error : 'Project was not saved.',
            retryable: false,
            exitCode: 5,
          },
        };
      return { ok: true, data, diagnostics: [] };
    }
    if (request.plan.sourceHash !== expected.contentHash)
      fail('SESSION_CONFLICT', 'Plan sourceHash must match the session token contentHash.');
    const candidate = buildCandidate(
      snapshot.project,
      request.plan,
      snapshot.project.meta.updatedAt,
      undefined,
      false,
      false,
      'memory',
    );
    const planHash = await sessionHash(request.plan),
      candidateHash = await sessionHash(candidate.project);
    const receipt = {
      kind: 'session-preview' as const,
      policyVersion: POLICY_VERSION,
      token: expected,
      planHash,
      candidateHash,
    };
    this.assertEditable();
    if (!this.matches(expected) || this.barrier.status().pendingEdits)
      fail('SESSION_CONFLICT', 'The editor changed during candidate preparation.');
    if (request.operation === 'preview')
      return {
        ok: true,
        data: {
          ...this.metadata(snapshot),
          receipt,
          candidate: candidate.project,
          changes: fullDiff(snapshot.project, candidate.project),
          allocations: candidate.allocations,
          impacts: candidate.impacts,
          requiredCapabilities: candidate.requiredCapabilities,
          permanentDeletions: candidate.permanentDeletions,
        },
        diagnostics: candidate.diagnostics,
      };
    if (canonicalJson(receipt) !== canonicalJson(request.receipt))
      fail('RECEIPT_CONFLICT', 'The plan or candidate differs from the preview.');
    assertCapabilities(candidate.requiredCapabilities, request, candidate.permanentDeletions);
    const beforeRevision = snapshot.state.document.revision;
    // 最后的同步检查与一次 dispatch 之间没有 await，不允许中间工程或历史可见。
    if (
      !this.store.compareAndDispatch(expected, {
        type: 'COMMIT_AUTOMATION',
        payload: candidate.project,
        validationResults: validateProject(candidate.project),
        restrictAutoSave: !request.allowOverwrite,
        history: {
          summary: `${request.plan.commands.length} domain operations: ${[...new Set(request.plan.commands.map((command) => command.op))].join(', ')}`,
          requiredCapabilities: candidate.requiredCapabilities,
        },
      })
    )
      fail('SESSION_CONFLICT', 'The editor changed before commit.');
    const after = await this.snapshot();
    const changed = after.state.document.revision !== beforeRevision;
    if (changed && this.session.savePolicy().autoSaveBlocked)
      this.session.pushMessage(
        'info',
        'Agent changes are in memory. Automatic saving is paused for these changes until an explicit authorized save or a human Save.',
      );
    return {
      ok: true,
      data: {
        ...this.metadata(after),
        before: expected,
        changed,
        status: changed ? 'edited' : 'unchanged',
      },
      diagnostics: candidate.diagnostics,
    };
  }
}
