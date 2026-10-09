/** C8 真实 CLI 覆盖验收：所有最高权限操作只作用于隔离虚构项目。 */
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import * as net from 'node:net';
import { runCli } from './processHarness';
import { conversionProject } from './c7Fixtures';
import { cliFile } from './fixtures';
import { importProject } from '../../utils/projectImport';
import { serializeProject } from '../../services/projectFiles';
import {
  ProjectLease,
  ownershipEndpoint,
  projectPath,
  pathKey,
} from '../../dist-node/projectOwnership.js';

let dir: string, source: string, plan: string, receipt: string, candidate: string;
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const json = async (p: string) => JSON.parse(await fs.readFile(p, 'utf8'));
const write = (p: string, value: unknown) => fs.writeFile(p, JSON.stringify(value), 'utf8');
const run = (args: string[]) => runCli(dir, args);
const preview = (flags: string[] = []) =>
  run(['preview', source, '--plan', plan, '--in-place', '--receipt-out', receipt, ...flags]);
const apply = (flags: string[] = ['--allow-overwrite']) =>
  run(['apply', source, '--plan', plan, '--receipt', receipt, '--in-place', ...flags]);
const rawPreview = () =>
  run([
    'json',
    'preview',
    source,
    '--candidate',
    candidate,
    '--in-place',
    '--receipt-out',
    receipt,
  ]);
const rawApply = (flags: string[] = ['--allow-raw-json-write', '--allow-overwrite']) =>
  run([
    'json',
    'apply',
    source,
    '--candidate',
    candidate,
    '--in-place',
    '--receipt',
    receipt,
    ...flags,
  ]);
beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), 'puzzle-cli-c8-'));
  source = join(dir, '源 工程.puzzle.json');
  plan = join(dir, 'plan.json');
  receipt = join(dir, 'receipt.json');
  candidate = join(dir, 'candidate.puzzle.json');
  // C7 fixture 有意含旧参数格式；覆盖测试使用完整工程，避免混入导入迁移效果。
  const normalized = importProject(cliFile(conversionProject()));
  await fs.writeFile(
    source,
    serializeProject(normalized.project, normalized.editorState, normalized.project.meta.updatedAt),
    'utf8',
  );
  await write(plan, {
    apiVersion: '1.0.0',
    sourceHash: hash(await fs.readFile(source)),
    scope: { project: true },
    commands: [{ op: 'project.update', changes: { description: 'C8 domain edit' } }],
  });
  const edited = await json(source);
  edited.project.meta.description = 'C8 raw edit';
  await fs.writeFile(candidate, '\uFEFF' + JSON.stringify(edited, null, 4) + '\r\n', 'utf8');
});
afterEach(async () => {
  const target = resolve(dir);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('puzzle-cli-c8-'))
    throw new Error('Unsafe cleanup');
  await fs.rm(target, { recursive: true, force: true });
});

describe.skipIf(process.platform !== 'win32')('C8 覆盖的权限、原文与可重试交付', () => {
  it('能力扩展为 19 个入口和 47 个领域操作，C8 覆盖可发现', async () => {
    const d = (await run(['describe'])).result.data;
    expect(d.phase).toBe(CLI_PHASE);
    expect(d.policyVersion).toBe('C10');
    expect(d.capabilities).toHaveLength(36);
    expect(d.planSchema.properties.commands.items.oneOf).toHaveLength(47);
    expect(d.authorizationCapabilities.overwrite_project.implemented).toBe(true);
  });
  it('领域覆盖保留其他数据与编辑状态、备份原字节，并发同回执不重复执行', async () => {
    const before = await fs.readFile(source),
      original = await json(source);
    const p = await preview();
    expect(p.code).toBe(0);
    expect(p.result.data.receipt.overwrite).toMatchObject({
      mode: 'overwrite-source',
      sha256: hash(before),
    });
    expect(p.result.data.requiredCapabilities).toEqual(['overwrite_project']);
    expect(await fs.readFile(source)).toEqual(before);
    const committed = await apply();
    expect(committed.code).toBe(0);
    expect(committed.result.data.status).toBe('written');
    expect(await fs.readFile(committed.result.data.backup.path)).toEqual(before);
    const saved = await json(source);
    expect(saved.project.meta.description).toBe('C8 domain edit');
    expect(saved.editorState).toEqual(original.editorState);
    expect(saved.project.presentationGraphs).toEqual(original.project.presentationGraphs);
    const after = await fs.readFile(source),
      modified = (await fs.stat(source)).mtimeMs;
    expect((await apply()).result.data.status).toBe('already-applied');
    expect(await fs.readFile(source)).toEqual(after);
    expect((await fs.stat(source)).mtimeMs).toBe(modified);
    const parallel = await Promise.all([apply(), apply()]);
    expect(
      parallel.every(
        (r) => r.code === 0 || (r.code === 4 && r.result.error.code === 'PROJECT_OWNED'),
      ),
    ).toBe(true);
    expect((await run(['validate', source])).code).toBe(0);
  });
  it('raw 覆盖保留候选 BOM/缩进/换行及时间，重试也需两项许可', async () => {
    const before = await fs.readFile(source),
      raw = await fs.readFile(candidate);
    const previewed = await rawPreview();
    expect(previewed.code, JSON.stringify(previewed.result)).toBe(0);
    expect((await rawApply(['--allow-raw-json-write'])).code).toBe(6);
    expect((await rawApply(['--allow-overwrite'])).code).toBe(6);
    expect(await fs.readFile(source)).toEqual(before);
    const result = await rawApply();
    expect(result.code).toBe(0);
    expect(await fs.readFile(source)).toEqual(raw);
    expect(await fs.readFile(result.result.data.backup.path)).toEqual(before);
    expect((await rawApply(['--allow-raw-json-write'])).code).toBe(6);
    expect((await rawApply()).result.data.status).toBe('already-applied');
  });
  it('raw+覆盖+永久删除三能力按实际效果组合，缺任一项不创建备份或改源', async () => {
    const edited = await json(source);
    delete edited.project.scripts.scripts.deleted;
    await write(candidate, edited);
    expect((await rawPreview()).code).toBe(0);
    const before = await fs.readFile(source),
      listing = await fs.readdir(dir);
    for (const flags of [
      [],
      ['--allow-raw-json-write'],
      ['--allow-overwrite'],
      ['--allow-raw-json-write', '--allow-overwrite'],
      ['--allow-raw-json-write', '--allow-permanent-delete'],
      ['--allow-overwrite', '--allow-permanent-delete'],
    ]) {
      expect((await rawApply(flags)).code).toBe(6);
      expect(await fs.readFile(source)).toEqual(before);
      expect(await fs.readdir(dir)).toEqual(listing);
    }
    expect(
      (await rawApply(['--allow-raw-json-write', '--allow-overwrite', '--allow-permanent-delete']))
        .code,
    ).toBe(0);
  });
  it('领域 purge+覆盖缺声明不读取源；提供两项许可后提交', async () => {
    const p = await json(plan);
    p.commands = [{ op: 'script.purge', target: { id: 'deleted' } }];
    await write(plan, p);
    expect((await preview()).code).toBe(0);
    expect((await apply()).code).toBe(6);
    expect((await apply(['--allow-permanent-delete'])).code).toBe(6);
    expect((await apply(['--allow-overwrite', '--allow-permanent-delete'])).code).toBe(0);
    expect((await json(source)).project.scripts.scripts.deleted).toBeUndefined();
  });
  it('模式互斥，旧另存回执与覆盖回执不能互换，import/export 无覆盖参数', async () => {
    expect((await apply(['--allow-overwrite', '--out', join(dir, 'other.puzzle.json')])).code).toBe(
      2,
    );
    expect(
      (
        await run([
          'json',
          'preview',
          source,
          '--candidate',
          candidate,
          '--out',
          join(dir, 'other.puzzle.json'),
          '--in-place',
        ])
      ).code,
    ).toBe(2);
    expect((await run(['import', 'preview', source, '--in-place'])).code).toBe(2);
    expect(
      (await run(['export', source, '--out', join(dir, 'x.export.json'), '--allow-overwrite']))
        .code,
    ).toBe(2);
    expect((await run(['preview', source, '--plan', plan, '--receipt-out', receipt])).code).toBe(0);
    expect((await apply()).result.error.code).toBe('RECEIPT_CONFLICT');
    await fs.unlink(receipt);
    expect((await preview()).code).toBe(0);
    expect(
      (
        await run([
          'apply',
          source,
          '--plan',
          plan,
          '--receipt',
          receipt,
          '--out',
          join(dir, 'other.puzzle.json'),
        ])
      ).result.error.code,
    ).toBe('RECEIPT_CONFLICT');
  });
  it.each(['source', 'plan', 'receipt', 'identity', 'policy', 'candidateHash'] as const)(
    '%s 改动使覆盖拒绝且无事务目录',
    async (changed) => {
      expect((await preview()).code).toBe(0);
      if (changed === 'source') await fs.appendFile(source, ' ');
      else if (changed === 'plan') await fs.appendFile(plan, ' ');
      else {
        const r = await json(receipt);
        if (changed === 'identity') r.overwrite.identity.ino = '1';
        else if (changed === 'policy') r.policyVersion = 'C6';
        else if (changed === 'candidateHash') r.candidateHash = 'a'.repeat(64);
        else r.source.sha256 = 'b'.repeat(64);
        await write(receipt, r);
      }
      const before = await fs.readFile(source);
      expect((await apply()).code).not.toBe(0);
      expect(await fs.readFile(source)).toEqual(before);
      expect((await fs.readdir(dir)).some((f) => f.endsWith('.puzzle-transactions'))).toBe(false);
    },
  );
  it('相同字节但 inode 替换也不冒充原版本；硬链接源拒绝覆盖', async () => {
    expect((await preview()).code).toBe(0);
    const copy = join(dir, 'same.puzzle.json');
    await fs.copyFile(source, copy);
    await fs.rename(copy, source);
    expect((await apply()).code).toBe(4);
    await fs.unlink(receipt);
    await fs.link(source, copy);
    expect((await preview()).result.error.code).toBe('UNSAFE_FILE_IDENTITY');
  });
  it('已写入后的第三方改动拒绝重试，不自动还原备份', async () => {
    await preview();
    expect((await apply()).code).toBe(0);
    await fs.appendFile(source, ' ');
    const modified = await fs.readFile(source);
    expect((await apply()).code).toBe(4);
    expect(await fs.readFile(source)).toEqual(modified);
  });
  it('raw 候选或回执改变后不能重试；丢失备份不能假报完成', async () => {
    await rawPreview();
    const applied = await rawApply();
    expect(applied.code).toBe(0);
    const resultBytes = await fs.readFile(source);
    await fs.appendFile(candidate, ' ');
    expect((await rawApply()).code).toBe(4);
    await fs.writeFile(candidate, resultBytes);
    await fs.unlink(applied.result.data.backup.path);
    expect((await rawApply()).code).not.toBe(0);
    expect(await fs.readFile(source)).toEqual(resultBytes);
  });
  it('存活桌面所有者与未知/无响应所有者均拒绝，释放后可继续', async () => {
    await preview();
    const lease = await ProjectLease.acquire(source, 'desktop');
    try {
      expect((await apply()).result.error.code).toBe('PROJECT_OWNED');
    } finally {
      await lease.release();
    }
    const server = net.createServer((socket) => socket.destroy());
    const endpoint = ownershipEndpoint(`path:${pathKey(await projectPath(source))}`);
    await new Promise<void>((done, fail) =>
      server.once('error', fail).listen({ path: endpoint, exclusive: true }, done),
    );
    try {
      expect((await apply()).result.error.code).toBe('PROJECT_OWNED');
    } finally {
      await new Promise<void>((done) => server.close(() => done()));
    }
    expect((await apply()).code).toBe(0);
  });
  it.each(['after-backup', 'after-replace'] as const)(
    '进程在 %s 被终止，OS 释放锁且同回执能核验恢复',
    async (stage) => {
      await rawPreview();
      const r = await json(receipt),
        original = await fs.readFile(source);
      const moduleUrl = pathToFileURL(resolve('dist-node/projectOverwrite.js')).href;
      const code = `import {executeOverwrite} from ${JSON.stringify(moduleUrl)};let raw='';for await(const chunk of process.stdin)raw+=chunk;const data=JSON.parse(raw);await executeOverwrite(data.request,async()=>({content:data.content,result:{}}),async()=>{},async stage=>{if(stage===data.stage){process.stdout.write('checkpoint\\n');await new Promise(()=>setInterval(()=>{},1000));}});`;
      const child = spawn(process.execPath, ['--input-type=module', '-e', code], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      child.stdin.end(
        JSON.stringify({
          request: {
            path: source,
            expected: r.output,
            requestHash: hash(await fs.readFile(receipt)),
            candidateHash: r.candidate.sha256,
          },
          content: await fs.readFile(candidate, 'utf8'),
          stage,
        }),
      );
      try {
        await new Promise<void>((done, fail) => {
          const timer = setTimeout(() => fail(new Error('Checkpoint timeout')), 6000);
          child.stdout.once('data', () => {
            clearTimeout(timer);
            done();
          });
          child.once('exit', (code) => {
            clearTimeout(timer);
            fail(new Error(`Early exit ${code}`));
          });
        });
        await new Promise<void>((done) => {
          child.once('exit', () => done());
          child.kill();
        });
        const retry = await rawApply();
        expect(retry.code).toBe(0);
        expect(retry.result.data.status).toBe(
          stage === 'after-replace' ? 'already-applied' : 'written',
        );
        expect(await fs.readFile(retry.result.data.backup.path)).toEqual(original);
        expect(await fs.readFile(source)).toEqual(await fs.readFile(candidate));
      } finally {
        if (child.exitCode === null && !child.killed) child.kill();
      }
    },
  );
});
import { CLI_PHASE } from '../../contracts/automation/capabilities';
