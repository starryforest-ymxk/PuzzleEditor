/** 授权覆盖的共用文件事务：备份先于替换，回执重试只核验已知前后态。 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readFileSnapshot, writeUtf8File, type FileSnapshot } from './files.js';
import {
  ProjectLease,
  ProjectFileError,
  readProjectSnapshot,
  sameIdentity,
  pathKey,
  projectPath,
  digest,
  type FileIdentity,
  type ProjectSnapshot,
} from './projectOwnership.js';

export interface OverwriteExpectation {
  mode: 'overwrite-source';
  path: string;
  sha256: string;
  identity: FileIdentity;
}
interface CommitRecord {
  version: 1;
  requestHash: string;
  source: OverwriteExpectation;
  afterHash: string;
  phase: 'preparing' | 'backed-up' | 'replacing' | 'written';
  createdAt: string;
}
export type CommitCheckpoint = 'after-backup' | 'before-replace' | 'after-replace';
const missing = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';
const metadata = ({ content: _content, ...snapshot }: FileSnapshot) => snapshot;
function conflict(message: string, details?: unknown): never {
  throw new ProjectFileError('OVERWRITE_CONFLICT', message, details);
}
async function safeDirectory(directory: string) {
  await fs.mkdir(directory, { recursive: true });
  if (
    (await fs.lstat(directory)).isSymbolicLink() ||
    pathKey(await fs.realpath(directory)) !== pathKey(directory)
  )
    conflict('Transaction storage must not be a redirected directory.', { path: directory });
}

export async function executeOverwrite<T>(
  request: {
    path: string;
    expected: OverwriteExpectation;
    requestHash: string;
    candidateHash: string;
  },
  prepare: (original: ProjectSnapshot) => Promise<{ content: string; result: T }>,
  verifyInputs: () => Promise<void>,
  checkpoint?: (stage: CommitCheckpoint) => Promise<void>,
) {
  const lease = await ProjectLease.acquire(request.path, 'cli-overwrite');
  const expected = request.expected;
  const id = digest(`${request.requestHash}\n${pathKey(expected.path)}`);
  const base = path.join(
    path.dirname(lease.path),
    `.${path.basename(lease.path)}.puzzle-transactions`,
  );
  const directory = path.join(base, id),
    journal = path.join(directory, 'record.json'),
    backup = path.join(directory, 'before.puzzle.json');
  let published = false;
  const details = () => ({
    path: lease.path,
    expectedHash: request.candidateHash,
    backupPath: backup,
    recordPath: journal,
    transactionId: id,
    published,
  });
  try {
    if (pathKey(lease.path) !== pathKey(expected.path))
      conflict('The source now resolves to another path.');
    let current = await readProjectSnapshot(request.path);
    let record: CommitRecord | undefined;
    const recordBytes = await fs.readFile(journal).catch((error) => {
      if (missing(error)) return undefined;
      throw error;
    });
    if (recordBytes) {
      // 不接受记录中的任意路径；备份位置总是从本次规范工程与回执推导。
      try {
        record = JSON.parse(recordBytes.toString('utf8')) as CommitRecord;
      } catch {
        conflict('The transaction record is unreadable.', details());
      }
      if (
        !record ||
        record.version !== 1 ||
        record.requestHash !== request.requestHash ||
        record.afterHash !== request.candidateHash ||
        JSON.stringify(record.source) !== JSON.stringify(expected) ||
        !['preparing', 'backed-up', 'replacing', 'written'].includes(record.phase) ||
        typeof record.createdAt !== 'string' ||
        Object.keys(record).some(
          (key) =>
            !['version', 'requestHash', 'source', 'afterHash', 'phase', 'createdAt'].includes(key),
        )
      )
        conflict('The transaction record does not match this receipt.', details());
      // 已存在存储也必须检查真实路径，不通过链接读取别人放置的备份/记录。
      for (const entry of [base, directory, journal]) {
        if (
          (await fs.lstat(entry)).isSymbolicLink() ||
          pathKey(await fs.realpath(entry)) !== pathKey(entry)
        )
          conflict('Transaction storage was redirected.', details());
      }
    }
    const isBefore =
      current.sha256 === expected.sha256 && sameIdentity(current.identity, expected.identity);
    const isAfter =
      !!record &&
      current.sha256 === record.afterHash &&
      ['replacing', 'written'].includes(record.phase);
    if (!isBefore && !isAfter)
      conflict(
        'The source is neither the previewed revision nor this transaction result. Preview again.',
        details(),
      );
    let original = current;
    if (isAfter) {
      const saved = await readFileSnapshot(backup);
      if (saved.sha256 !== expected.sha256 || (await fs.lstat(backup)).isSymbolicLink())
        conflict('The original backup cannot be verified.', details());
      original = {
        ...saved,
        path: expected.path,
        identity: expected.identity,
        modifiedAt: new Date(Number(BigInt(expected.identity.mtimeNs) / 1000000n)).toISOString(),
      };
    }
    const prepared = await prepare(original);
    if (digest(prepared.content) !== request.candidateHash)
      conflict('The reconstructed candidate differs from preview.', details());
    await verifyInputs();
    if (isAfter) {
      const verified = await readProjectSnapshot(request.path);
      if (
        verified.sha256 !== request.candidateHash ||
        !sameIdentity(verified.identity, current.identity)
      )
        conflict('The result changed during retry verification.', details());
      return {
        result: prepared.result,
        status: 'already-applied' as const,
        output: metadata(verified),
        backup: { path: backup, sha256: expected.sha256 },
        transaction: { id, path: journal },
      };
    }
    await safeDirectory(base);
    await safeDirectory(directory);
    const persist = async (phase: CommitRecord['phase']) => {
      record = {
        version: 1,
        requestHash: request.requestHash,
        source: expected,
        afterHash: request.candidateHash,
        phase,
        createdAt: record?.createdAt ?? new Date().toISOString(),
      };
      await writeUtf8File(journal, JSON.stringify(record, null, 2) + '\n');
    };
    if (!record) {
      record = {
        version: 1,
        requestHash: request.requestHash,
        source: expected,
        afterHash: request.candidateHash,
        phase: 'preparing',
        createdAt: new Date().toISOString(),
      };
      await writeUtf8File(journal, JSON.stringify(record, null, 2) + '\n', { exclusive: true });
    }
    const savedBackup = await fs.lstat(backup).catch((error) => {
      if (missing(error)) return undefined;
      throw error;
    });
    if (savedBackup?.isSymbolicLink()) conflict('The backup is a symbolic link.', details());
    if (!savedBackup) await writeUtf8File(backup, original.content, { exclusive: true });
    if ((await readFileSnapshot(backup)).sha256 !== expected.sha256)
      conflict('Backup verification failed. The source was not replaced.', details());
    await persist('backed-up');
    await checkpoint?.('after-backup');
    await writeUtf8File(lease.path, prepared.content, {
      beforePublish: async (temporary) => {
        if ((await readFileSnapshot(temporary)).sha256 !== request.candidateHash)
          conflict('Temporary candidate verification failed.', details());
        await lease.holdFile(temporary);
        await persist('replacing');
        await checkpoint?.('before-replace');
        await verifyInputs();
        await lease.assertPath(request.path);
        current = await readProjectSnapshot(request.path);
        if (
          current.sha256 !== expected.sha256 ||
          !sameIdentity(current.identity, expected.identity)
        )
          conflict('The source changed before replacement.', details());
        if (
          pathKey(await projectPath(journal)) !== pathKey(journal) ||
          pathKey(await projectPath(backup)) !== pathKey(backup) ||
          (await readFileSnapshot(backup)).sha256 !== expected.sha256
        )
          conflict('Transaction storage changed before replacement.', details());
      },
    });
    published = true;
    await checkpoint?.('after-replace');
    const verified = await readProjectSnapshot(request.path);
    if (verified.sha256 !== request.candidateHash)
      throw new Error('The published file changed before verification.');
    await persist('written');
    return {
      result: prepared.result,
      status: 'written' as const,
      output: metadata(verified),
      backup: { path: backup, sha256: expected.sha256 },
      transaction: { id, path: journal },
    };
  } catch (error) {
    if (published)
      throw new ProjectFileError(
        'COMMIT_RESULT_UNCERTAIN',
        error instanceof Error ? error.message : String(error),
        details(),
        5,
      );
    if (error instanceof ProjectFileError) throw error;
    // 上层领域/授权错误原样传递；文件故障附上恢复位置，不伪装已经成功覆盖。
    if (error instanceof Error && 'exitCode' in error) throw error;
    throw new ProjectFileError(
      'OVERWRITE_IO_ERROR',
      error instanceof Error ? error.message : String(error),
      details(),
      5,
    );
  } finally {
    await lease.release();
  }
}
