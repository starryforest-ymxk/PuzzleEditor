/** CLI 只负责文件参数与传输；在线候选和权限在当前桌面会话内重新计算。 */
import { discoverSessions, requestSession } from '../dist-node/sessionTransport.js';
import { readFileSnapshot } from '../dist-node/files.js';
import {
  sessionInputSchemas,
  sessionTokenSchema,
  sessionReceiptSchema,
  onlineQuerySchema,
  type SessionRequest,
} from '../contracts/automation/sessionSchemas';
import { planSchema } from '../contracts/automation/planSchemas';
import { parseContract } from '../services/automation/transactionData';
import { publishNew, targetPath } from '../services/automation/fileCommit';
import { AutomationFailure } from '../services/automation/errors';
import type { Diagnostic } from '../contracts/automation/schemas';

export async function runSessionCommand(
  operation: keyof typeof sessionInputSchemas,
  input: unknown,
  stdin?: string,
) {
  if (operation === 'session list')
    return { data: { sessions: await discoverSessions() }, diagnostics: [] };
  const common = sessionInputSchemas[operation].parse(input);
  if (!('instance' in common)) throw new Error('Missing session identity');
  const sessionId = common.session;
  let request: SessionRequest, receiptOut: string | undefined;
  const load = async (path: string) => (await readFileSnapshot(path)).content;
  const plan = async (path: string) =>
    parseContract(planSchema, path === '-' ? (stdin ?? '') : await load(path), 'Plan');
  switch (operation) {
    case 'history list':
      request = { operation: 'history.list', sessionId };
      break;
    case 'history undo':
    case 'history redo': {
      const {
        instance: _instance,
        session: _session,
        token,
        ...value
      } = sessionInputSchemas[operation].parse(input);
      request = {
        ...value,
        operation: operation === 'history undo' ? 'history.undo' : 'history.redo',
        sessionId,
        token: parseContract(sessionTokenSchema, await load(token), 'Session token'),
      };
      break;
    }
    case 'session status':
      request = { operation: 'status', sessionId };
      break;
    case 'session validate':
      request = { operation: 'validate', sessionId };
      break;
    case 'session inspect': {
      const {
        instance: _instance,
        session: _session,
        ...query
      } = sessionInputSchemas[operation].parse(input);
      request = { operation: 'inspect', sessionId, query: onlineQuerySchema.parse(query) };
      break;
    }
    case 'session preview': {
      const value = sessionInputSchemas[operation].parse(input);
      receiptOut = value.receiptOut;
      request = {
        operation: 'preview',
        sessionId,
        token: parseContract(sessionTokenSchema, await load(value.token), 'Session token'),
        plan: await plan(value.plan),
      };
      break;
    }
    case 'session apply': {
      const value = sessionInputSchemas[operation].parse(input);
      request = {
        operation: 'apply',
        sessionId,
        receipt: parseContract(sessionReceiptSchema, await load(value.receipt), 'Session receipt'),
        plan: await plan(value.plan),
        requestId: value.requestId,
        allowOverwrite: value.allowOverwrite,
        allowPermanentDelete: value.allowPermanentDelete,
      };
      break;
    }
    case 'session save': {
      const {
        instance: _instance,
        session: _session,
        token,
        ...value
      } = sessionInputSchemas[operation].parse(input);
      request = {
        ...value,
        operation: 'save',
        sessionId,
        out: value.out ? await targetPath(value.out, [token], '.puzzle.json') : undefined,
        token: parseContract(sessionTokenSchema, await load(token), 'Session token'),
      };
      break;
    }
  }
  const result = await requestSession(common.instance, request);
  if (!result.ok)
    throw new AutomationFailure(
      result.error?.code ?? 'SESSION_FAILED',
      result.error?.message ?? 'Session operation failed.',
      result.error?.exitCode ?? 5,
      result.diagnostics as Diagnostic[],
      result.data,
      result.error?.retryable,
    );
  if (receiptOut) {
    const receipt = sessionReceiptSchema.parse((result.data as { receipt: unknown }).receipt);
    await publishNew(await targetPath(receiptOut, []), JSON.stringify(receipt, null, 2) + '\n');
  }
  return { data: result.data, diagnostics: result.diagnostics as Diagnostic[] };
}
