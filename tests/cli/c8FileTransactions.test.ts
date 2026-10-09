/** C8 故障注入只操作临时目录；验证真实备份、替换与回读，不模拟事务本身。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { executeOverwrite } from '../../dist-node/projectOverwrite.js';
import { readProjectSnapshot, ProjectLease, digest } from '../../dist-node/projectOwnership.js';

let directory: string, source: string;
let request: Parameters<typeof executeOverwrite>[0];
const before = '\uFEFF{"original":true}\r\n',
  after = '{"modified":true}\n';
const ioError = () => Object.assign(new Error('Injected disk failure'), { code: 'EIO' });
const commit = (checkpoint?: Parameters<typeof executeOverwrite>[3]) =>
  executeOverwrite(
    request,
    async () => ({ content: after, result: {} }),
    async () => {},
    checkpoint,
  );
beforeEach(async () => {
  directory = await fs.promises.mkdtemp(join(tmpdir(), 'puzzle-c8-file-'));
  source = join(directory, 'source.puzzle.json');
  await fs.promises.writeFile(source, before, 'utf8');
  const snapshot = await readProjectSnapshot(source);
  request = {
    path: source,
    expected: {
      mode: 'overwrite-source',
      path: snapshot.path,
      sha256: snapshot.sha256,
      identity: snapshot.identity,
    },
    requestHash: digest('receipt'),
    candidateHash: digest(after),
  };
});
afterEach(async () => {
  vi.restoreAllMocks();
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('puzzle-c8-file-'))
    throw new Error('Unsafe cleanup');
  await fs.promises.rm(target, { recursive: true, force: true });
});
describe.skipIf(process.platform !== 'win32')('C8 文件事务故障与别名', () => {
  it('备份创建失败不替换源，已有 preparing 记录可重试', async () => {
    const link = fs.promises.link;
    vi.spyOn(fs.promises, 'link').mockImplementation(async (from, to) => {
      if (String(to).endsWith('before.puzzle.json')) throw ioError();
      return link(from, to);
    });
    await expect(commit()).rejects.toMatchObject({
      code: 'OVERWRITE_IO_ERROR',
      details: { published: false },
    });
    expect(await fs.promises.readFile(source, 'utf8')).toBe(before);
    vi.restoreAllMocks();
    expect((await commit()).status).toBe('written');
  });
  it.each(['temporary', 'rename'] as const)(
    '%s 失败保留原文与备份，修复磁盘后继续',
    async (mode) => {
      const open = fs.promises.open,
        rename = fs.promises.rename;
      if (mode === 'temporary')
        vi.spyOn(fs.promises, 'open').mockImplementation(async (...args) => {
          if (
            dirname(String(args[0])) === directory &&
            basename(String(args[0])).startsWith('.source.puzzle.json.') &&
            args[1] === 'wx'
          )
            throw ioError();
          return open(...args);
        });
      else
        vi.spyOn(fs.promises, 'rename').mockImplementation(async (from, to) => {
          if (to === source) throw ioError();
          return rename(from, to);
        });
      await expect(commit()).rejects.toMatchObject({ code: 'OVERWRITE_IO_ERROR' });
      expect(await fs.promises.readFile(source, 'utf8')).toBe(before);
      vi.restoreAllMocks();
      const result = await commit();
      expect(result.status).toBe('written');
      expect(await fs.promises.readFile(result.backup.path, 'utf8')).toBe(before);
    },
  );
  it.each(['record', 'readback'] as const)(
    '已替换后 %s 失败明确报告结果待核验，同回执不二次执行',
    async (mode) => {
      const rename = fs.promises.rename,
        open = fs.promises.open;
      let published = false;
      vi.spyOn(fs.promises, 'rename').mockImplementation(async (from, to) => {
        if (mode === 'record' && published && String(to).endsWith('record.json')) throw ioError();
        return rename(from, to);
      });
      vi.spyOn(fs.promises, 'open').mockImplementation(async (...args) => {
        if (mode === 'readback' && published && args[0] === source) throw ioError();
        return open(...args);
      });
      await expect(
        commit(async (stage) => {
          if (stage === 'after-replace') published = true;
        }),
      ).rejects.toMatchObject({
        code: 'COMMIT_RESULT_UNCERTAIN',
        details: { published: true, expectedHash: digest(after) },
      });
      vi.restoreAllMocks();
      expect(await fs.promises.readFile(source, 'utf8')).toBe(after);
      const stamp = (await fs.promises.stat(source)).mtimeMs;
      expect((await commit()).status).toBe('already-applied');
      expect((await fs.promises.stat(source)).mtimeMs).toBe(stamp);
    },
  );
  it('发布前第三方修改不被覆盖或回滚，已备份原文保持', async () => {
    await expect(
      commit(async (stage) => {
        if (stage === 'before-replace') await fs.promises.writeFile(source, 'third-party');
      }),
    ).rejects.toMatchObject({ code: 'OVERWRITE_CONFLICT' });
    expect(await fs.promises.readFile(source, 'utf8')).toBe('third-party');
    await expect(commit()).rejects.toMatchObject({ code: 'OVERWRITE_CONFLICT' });
  });
  it.each(['backup', 'record'] as const)('%s 损坏后拒绝自动恢复', async (kind) => {
    const result = await commit();
    await fs.promises.writeFile(
      kind === 'backup' ? result.backup.path : result.transaction.path,
      '{}',
    );
    await expect(commit()).rejects.toMatchObject({ code: 'OVERWRITE_CONFLICT' });
    expect(await fs.promises.readFile(source, 'utf8')).toBe(after);
  });
  it('事务目录为 junction 时拒绝写入被指向位置', async () => {
    const outside = join(directory, 'redirected');
    await fs.promises.mkdir(outside);
    await fs.promises.symlink(
      outside,
      join(directory, '.source.puzzle.json.puzzle-transactions'),
      'junction',
    );
    await expect(commit()).rejects.toMatchObject({ code: 'OVERWRITE_CONFLICT' });
    expect(await fs.promises.readdir(outside)).toEqual([]);
    expect(await fs.promises.readFile(source, 'utf8')).toBe(before);
  });
  it('目录别名与文件重命名不能绕过已有所有权，释放后可取得', async () => {
    const folder = join(directory, 'real');
    await fs.promises.mkdir(folder);
    const actual = join(folder, 'project.puzzle.json');
    await fs.promises.writeFile(actual, before);
    const alias = join(directory, 'alias');
    await fs.promises.symlink(folder, alias, 'junction');
    const lease = await ProjectLease.acquire(actual, 'desktop');
    try {
      await expect(
        ProjectLease.acquire(join(alias, 'project.puzzle.json'), 'other'),
      ).rejects.toMatchObject({ code: 'PROJECT_OWNED' });
      const moved = join(directory, 'renamed.puzzle.json');
      await fs.promises.rename(actual, moved);
      await expect(ProjectLease.acquire(moved, 'other')).rejects.toMatchObject({
        code: 'PROJECT_OWNED',
      });
    } finally {
      await lease.release();
    }
    const next = await ProjectLease.acquire(join(directory, 'renamed.puzzle.json'), 'other');
    await next.release();
  });
});
