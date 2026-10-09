/** C5 只使用隔离虚构工程；真实子进程覆盖授权声明、整文件策略和文件提交。 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, readFile, readdir, rm, stat, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { ProjectFile } from '../../types/project';
import type { ResourceState } from '../../types/common';
import { importProject } from '../../utils/projectImport';
import { serializeProject } from '../../services/projectFiles';
import { cliFile, FIXED_TIME } from './fixtures';
import { presentationProject } from './c4Fixtures';
import { runCli } from './processHarness';

let directory: string, source: string, candidate: string, output: string, receipt: string;
let original: ProjectFile;
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const run = (args: string[]) => runCli(directory, args);
const args = () => [source, '--candidate', candidate, '--out', output];
const preview = () => run(['json', 'preview', ...args(), '--receipt-out', receipt]);
const apply = () =>
  run(['json', 'apply', ...args(), '--receipt', receipt, '--allow-raw-json-write']);
const saveCandidate = (value: ProjectFile) =>
  writeFile(candidate, JSON.stringify(value, null, 2), 'utf8');

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'puzzle-cli-c5-'));
  source = join(directory, '原 项目.puzzle.json');
  candidate = join(directory, '候选 文件.json');
  output = join(directory, '输出 项目.puzzle.json');
  receipt = join(directory, '预览 回执.json');
  const imported = importProject(cliFile(presentationProject()));
  original = JSON.parse(
    serializeProject(imported.project, imported.editorState, FIXED_TIME),
  ) as ProjectFile;
  await writeFile(source, JSON.stringify(original, null, 2), 'utf8');
  const next = structuredClone(original);
  next.project.meta.name = 'C5 Raw Regression';
  next.project.presentationGraphs.intro.nodes.yes.duration = 0.75;
  await saveCandidate(next);
});
afterEach(async () => {
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('puzzle-cli-c5-'))
    throw new Error('Refusing cleanup outside the isolated test directory.');
  await rm(target, { recursive: true, force: true });
});

describe('C5 真实整文件往返与授权声明', () => {
  it('完整字节、BOM/换行/时间/编辑状态保持，图引用影响可读并可导出重开', async () => {
    const next = JSON.parse(await readFile(candidate, 'utf8')) as ProjectFile;
    next.editorState!.panelSizes.inspectorWidth = 360;
    const bytes = '\uFEFF' + JSON.stringify(next, null, 3).replaceAll('\n', '\r\n') + '\r\n';
    await writeFile(candidate, bytes, 'utf8');
    const sourceBefore = await readFile(source);
    const sourceStat = await stat(source);
    const result = await preview();
    expect(result.code).toBe(0);
    expect(result.result.data.receipt.candidate.sha256).toBe(sha(bytes));
    expect(result.result.data.changes).toContainEqual(
      expect.objectContaining({ path: '/editorState/panelSizes/inspectorWidth', after: 360 }),
    );
    expect(result.result.data.impacts.graphs).toContainEqual(
      expect.objectContaining({ graphId: 'intro', sharedAfter: true }),
    );
    expect(await readdir(directory)).toHaveLength(3);
    const submitted = await apply();
    expect(submitted.code).toBe(0);
    expect(submitted.result.data).toMatchObject({
      status: 'written',
      remainingErrors: 0,
      authorization: { basis: 'agent-chat', declared: true, verifiedByCli: false },
    });
    expect(await readFile(output)).toEqual(Buffer.from(bytes));
    expect(await readFile(source)).toEqual(sourceBefore);
    expect((await stat(source)).mtimeMs).toBe(sourceStat.mtimeMs);
    expect((await run(['validate', output])).result.data).toMatchObject({ valid: true, errors: 0 });
    const exported = join(directory, 'runtime.export.json');
    expect((await run(['export', output, '--out', exported])).code).toBe(0);
    const imported = importProject(await readFile(exported, 'utf8'));
    expect(imported.project.presentationGraphs.intro.nodes.yes.duration).toBe(0.75);
    expect(imported.project.blackboard.globalVariables.flag.value).toBe(false);
    expect(imported.project.presentationGraphs.intro.nodes.branch.nextIds).toEqual(['yes', 'no']);
  });

  it('默认预览不写任何文件，回执明确不是聊天授权', async () => {
    const before = await readdir(directory);
    const result = await run(['json', 'preview', ...args()]);
    expect(result.code).toBe(0);
    expect(result.result.data.receipt.kind).toBe('raw-json-preview');
    expect(result.result.data.authorizationRequired).toContain('agent chat');
    expect(await readdir(directory)).toEqual(before);
  });

  it('无显式启用先退出 6，不读取不存在的输入，也不建立输出目录', async () => {
    const result = await run([
      'json',
      'apply',
      'missing',
      '--candidate',
      'missing-candidate',
      '--out',
      'missing-dir/file.puzzle.json',
      '--receipt',
      'missing-receipt',
    ]);
    expect(result.code).toBe(6);
    expect(result.result.error.code).toBe('RAW_JSON_AUTHORIZATION_REQUIRED');
    expect(await readdir(directory)).toHaveLength(2);
  });

  it.each(['--yes', '--force', '--approved'])('拒绝伪装授权参数 %s', async (flag) => {
    const result = await run(['json', 'apply', ...args(), '--receipt', receipt, flag]);
    expect(result.code).toBe(2);
    expect(await readdir(directory)).toHaveLength(2);
  });

  it('普通入口不接受 raw 权限，重复启用参数也报错', async () => {
    expect(
      (
        await run([
          'apply',
          source,
          '--plan',
          candidate,
          '--receipt',
          receipt,
          '--out',
          output,
          '--allow-raw-json-write',
        ])
      ).code,
    ).toBe(2);
    expect(
      (
        await run([
          'json',
          'apply',
          ...args(),
          '--receipt',
          receipt,
          '--allow-raw-json-write',
          '--allow-raw-json-write',
        ])
      ).result.error.code,
    ).toBe('DUPLICATE_ARGUMENT');
  });

  it('同一回执重试与并发提交只交付同一候选，不重复写入或改变时间', async () => {
    expect((await preview()).code).toBe(0);
    const results = await Promise.all([apply(), apply()]);
    expect(results.map((r) => r.code)).toEqual([0, 0]);
    expect(results.map((r) => r.result.data.status).sort()).toEqual(['already-applied', 'written']);
    const before = await stat(output);
    expect((await apply()).result.data.status).toBe('already-applied');
    expect((await stat(output)).mtimeMs).toBe(before.mtimeMs);
  });
});

describe('C5 候选完整性与共同校验', () => {
  it.each([
    [
      'stage',
      (file: ProjectFile) => {
        delete file.project.stageTree.stages.room.assetName;
      },
    ],
    [
      'puzzle',
      (file: ProjectFile) => {
        delete file.project.nodes.door.assetName;
      },
    ],
    [
      'state',
      (file: ProjectFile) => {
        delete file.project.stateMachines['door-fsm'].states.idle.assetName;
      },
    ],
    [
      'variable',
      (file: ProjectFile) => {
        delete file.project.blackboard.globalVariables.flag.assetName;
      },
    ],
    [
      'event',
      (file: ProjectFile) => {
        file.project.blackboard.events.open.assetName = ' Open';
      },
    ],
    [
      'script',
      (file: ProjectFile) => {
        file.project.scripts.scripts.effect.assetName = '';
      },
    ],
  ])('不清空或自动修正 %s 的资产名', async (_label, mutate) => {
    mutate(original);
    await saveCandidate(original);
    const result = await preview();
    expect(result.result.error.code).toBe('ASSET_NAME_REQUIRED_OR_INVALID');
    expect(result.code).toBe(3);
    expect(await readdir(directory)).toHaveLength(2);
  });

  it('新增资产缺名拒绝；补齐外部资产名后可创建', async () => {
    original.project.blackboard.events.extra = { id: 'extra', name: 'Extra', state: 'Draft' };
    await saveCandidate(original);
    expect((await preview()).result.error.code).toBe('ASSET_NAME_REQUIRED_OR_INVALID');
    original.project.blackboard.events.extra.assetName = 'ExternalExtra';
    await saveCandidate(original);
    expect((await preview()).code).toBe(0);
    expect((await apply()).code).toBe(0);
  });

  it('不静默补缺失字段或调整面板尺寸，返回完整规范化建议', async () => {
    delete (
      original.project.stageTree.stages.room as Partial<
        typeof original.project.stageTree.stages.room
      >
    ).eventListeners;
    original.editorState!.panelSizes.inspectorWidth = -5;
    await saveCandidate(original);
    const result = await preview();
    expect(result.result.error.code).toBe('CANDIDATE_NORMALIZATION_REQUIRED');
    expect(result.result.data.normalizationChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/project/stageTree/stages/room/eventListeners' }),
        expect.objectContaining({ path: '/editorState/panelSizes/inspectorWidth' }),
      ]),
    );
  });

  it('来源版本提示不更改数据时可保留；未知字段不能偷偷删除', async () => {
    original.editorVersion = '1.0.0-beta';
    await saveCandidate(original);
    expect((await run(['json', 'preview', ...args()])).code).toBe(0);
    await writeFile(candidate, JSON.stringify({ ...original, future: { secret: false } }), 'utf8');
    expect((await preview()).result.error.code).toBe('PROJECT_STRUCTURE_INVALID');
  });

  it.each([
    [
      'duplicate key',
      '{"fileType":"puzzle-project","fileType":"puzzle-project"}',
      'AMBIGUOUS_JSON',
    ],
    ['unsafe number', '{"value":9007199254740993}', 'AMBIGUOUS_JSON'],
    ['syntax', '{', 'INVALID_JSON'],
    ['raw project', JSON.stringify(presentationProject()), 'PROJECT_FILE_REQUIRED'],
  ])('拒绝 %s 候选且不输出回执', async (_label, content, code) => {
    await writeFile(candidate, content, 'utf8');
    expect((await preview()).result.error.code).toBe(code);
    expect(await readdir(directory)).toHaveLength(2);
  });

  it('非法 UTF-8 被拒绝', async () => {
    await writeFile(candidate, Buffer.from([0xff, 0x7b]));
    expect((await preview()).result.error.code).toBe('INVALID_UTF8');
  });

  it('共享图中新失效引用使用共同校验并定位图', async () => {
    original.project.presentationGraphs.leaf.nodes.call.presentation = {
      type: 'Graph',
      graphId: 'absent',
    };
    await saveCandidate(original);
    const result = await preview();
    expect(result.result.error.code).toBe('CANDIDATE_VALIDATION_FAILED');
    expect(result.result.data.newErrors.length).toBeGreaterThan(0);
  });

  it('已有业务错误可以保留，不能以另一错误替换基线', async () => {
    original.project.presentationGraphs.leaf.nodes.call.presentation = {
      type: 'Graph',
      graphId: 'old-missing',
    };
    await writeFile(source, JSON.stringify(original), 'utf8');
    original.project.meta.description = 'Unrelated edit';
    await saveCandidate(original);
    const result = await run(['json', 'preview', ...args()]);
    expect(result.code).toBe(0);
    expect(result.result.data.remainingErrors).toBeGreaterThan(0);
    original.project.presentationGraphs.leaf.nodes.call.presentation.graphId = 'new-missing';
    await saveCandidate(original);
    expect((await preview()).result.error.code).toBe('CANDIDATE_VALIDATION_FAILED');
  });

  it('未改的旧缺名保持可编辑，不漏过新资产缺名', async () => {
    delete original.project.stageTree.stages.room.assetName;
    await writeFile(source, JSON.stringify(original), 'utf8');
    original.project.meta.name = 'Keep legacy error';
    await saveCandidate(original);
    expect((await run(['json', 'preview', ...args()])).code).toBe(0);
    original.project.blackboard.events.extra = { id: 'extra', name: 'Extra', state: 'Draft' };
    await saveCandidate(original);
    expect((await preview()).result.error.code).toBe('ASSET_NAME_REQUIRED_OR_INVALID');
  });
});

describe('C5 整文件替换仍遵守生命周期', () => {
  it.each<ResourceState>(['Implemented', 'MarkedForDelete'])(
    '未获永久删除许可不能移除 %s 资源或借改 ID 伪装',
    async (state) => {
      original.project.scripts.scripts.deleted.state = state;
      await writeFile(source, JSON.stringify(original), 'utf8');
      delete original.project.scripts.scripts.deleted;
      await saveCandidate(original);
      // C6 允许只读展示删除影响；raw 许可本身不包含永久删除能力。
      expect(
        (await run(['json', 'preview', ...args()])).result.data.requiredCapabilities,
      ).toContain('permanent_resource_delete');
      const protectedReceipt1 = join(directory, 'protected-1.receipt.json');
      expect(
        (await run(['json', 'preview', ...args(), '--receipt-out', protectedReceipt1])).code,
      ).toBe(0);
      expect(
        (
          await run([
            'json',
            'apply',
            ...args(),
            '--receipt',
            protectedReceipt1,
            '--allow-raw-json-write',
          ])
        ).result.error.code,
      ).toBe('PERMANENT_DELETE_AUTHORIZATION_REQUIRED');
      original.project.scripts.scripts.renamed = {
        id: 'renamed',
        name: 'Renamed',
        assetName: 'Renamed',
        category: 'Performance',
        state: 'Draft',
      };
      await saveCandidate(original);
      // C6 允许只读展示删除影响；raw 许可本身不包含永久删除能力。
      expect(
        (await run(['json', 'preview', ...args()])).result.data.requiredCapabilities,
      ).toContain('permanent_resource_delete');
      const protectedReceipt2 = join(directory, 'protected-2.receipt.json');
      expect(
        (await run(['json', 'preview', ...args(), '--receipt-out', protectedReceipt2])).code,
      ).toBe(0);
      expect(
        (
          await run([
            'json',
            'apply',
            ...args(),
            '--receipt',
            protectedReceipt2,
            '--allow-raw-json-write',
          ])
        ).result.error.code,
      ).toBe('PERMANENT_DELETE_AUTHORIZATION_REQUIRED');
    },
  );

  it.each<[ResourceState, ResourceState, boolean]>([
    ['Draft', 'Draft', true],
    ['Draft', 'Implemented', false],
    ['Draft', 'MarkedForDelete', false],
    ['Implemented', 'Implemented', true],
    ['Implemented', 'MarkedForDelete', true],
    ['Implemented', 'Draft', false],
    ['MarkedForDelete', 'Implemented', true],
    ['MarkedForDelete', 'MarkedForDelete', true],
    ['MarkedForDelete', 'Draft', false],
  ])('%s → %s 允许=%s', async (before, after, allowed) => {
    original.project.scripts.scripts.deleted.state = before;
    await writeFile(source, JSON.stringify(original), 'utf8');
    original.project.scripts.scripts.deleted.state = after;
    await saveCandidate(original);
    const result = await preview();
    expect(result.code).toBe(allowed ? 0 : 3);
    if (!allowed) expect(result.result.error.code).toBe('INVALID_RESOURCE_TRANSITION');
  });

  it('新增资源不能直接宣称已实现', async () => {
    original.project.blackboard.events.extra = {
      id: 'extra',
      name: 'Extra',
      assetName: 'Extra',
      state: 'Implemented',
    };
    await saveCandidate(original);
    expect((await preview()).result.error.code).toBe('INVALID_RESOURCE_TRANSITION');
  });

  it('局部变量可明确移动并保持状态，但不能顺带删除受保护声明', async () => {
    original.project.stageTree.stages.room.localVariables.shared.state = 'Implemented';
    await writeFile(source, JSON.stringify(original), 'utf8');
    const variable = original.project.stageTree.stages.room.localVariables.shared;
    delete original.project.stageTree.stages.room.localVariables.shared;
    original.project.nodes.door.localVariables.shared = { ...variable, scope: 'NodeLocal' };
    await saveCandidate(original);
    expect((await run(['json', 'preview', ...args()])).code).toBe(0);
    delete original.project.nodes.door.localVariables.shared;
    await saveCandidate(original);
    // C6 允许只读展示删除影响；raw 许可本身不包含永久删除能力。
    expect((await run(['json', 'preview', ...args()])).result.data.requiredCapabilities).toContain(
      'permanent_resource_delete',
    );
    const protectedReceipt3 = join(directory, 'protected-3.receipt.json');
    expect(
      (await run(['json', 'preview', ...args(), '--receipt-out', protectedReceipt3])).code,
    ).toBe(0);
    expect(
      (
        await run([
          'json',
          'apply',
          ...args(),
          '--receipt',
          protectedReceipt3,
          '--allow-raw-json-write',
        ])
      ).result.error.code,
    ).toBe('PERMANENT_DELETE_AUTHORIZATION_REQUIRED');
  });
});

describe('C5 指纹、路径与故障保护', () => {
  it.each(['source', 'candidate', 'receipt', 'target'])(
    '预览后 %s 改变拒绝旧回执',
    async (which) => {
      expect((await preview()).code).toBe(0);
      if (which === 'source')
        await writeFile(source, (await readFile(source, 'utf8')) + '\n', 'utf8');
      if (which === 'candidate')
        await writeFile(candidate, (await readFile(candidate, 'utf8')) + '\n', 'utf8');
      if (which === 'receipt') {
        const parsed = JSON.parse(await readFile(receipt, 'utf8'));
        parsed.candidate.sha256 = '0'.repeat(64);
        await writeFile(receipt, JSON.stringify(parsed), 'utf8');
      }
      if (which === 'target') output = join(directory, 'another.puzzle.json');
      const result = await apply();
      expect(result.code).toBe(4);
      expect(result.result.error.code).toBe('RECEIPT_CONFLICT');
      expect(await readdir(directory)).toHaveLength(3);
    },
  );

  it('expected-hash 前提错误拒绝；修改后重新预览允许继续', async () => {
    expect(
      (await run(['json', 'preview', ...args(), '--expected-hash', '0'.repeat(64)])).result.error
        .code,
    ).toBe('REVISION_CONFLICT');
    await writeFile(candidate, (await readFile(candidate, 'utf8')) + '\n', 'utf8');
    expect((await preview()).code).toBe(0);
    expect((await apply()).code).toBe(0);
  });

  it.each(['source', 'candidate', 'hardlink'])('输出与 %s 碰撞不能覆盖输入', async (which) => {
    if (which === 'source') output = source;
    if (which === 'candidate') {
      const renamed = join(directory, 'candidate.puzzle.json');
      await writeFile(renamed, await readFile(candidate));
      candidate = renamed;
      output = renamed;
    }
    if (which === 'hardlink') {
      await link(source, output);
    }
    const bytes = await readFile(source);
    expect((await preview()).result.error.code).toBe('INPUT_OUTPUT_COLLISION');
    expect(await readFile(source)).toEqual(bytes);
  });

  it('回执不能占用源、候选或输出路径', async () => {
    for (const path of [source, candidate, output]) {
      const result = await run(['json', 'preview', ...args(), '--receipt-out', path]);
      expect(result.result.error.code).toBe('INPUT_OUTPUT_COLLISION');
    }
    expect(await readdir(directory)).toHaveLength(2);
  });

  it('已有目标在 preview/apply 都受保护', async () => {
    expect((await preview()).code).toBe(0);
    await writeFile(output, 'existing bytes', 'utf8');
    expect((await run(['json', 'preview', ...args()])).result.error.code).toBe('OUTPUT_EXISTS');
    expect((await apply()).result.error.code).toBe('OUTPUT_EXISTS');
    expect(await readFile(output, 'utf8')).toBe('existing bytes');
  });

  it('回执类型、额外批准字段和重复键不能混用', async () => {
    expect((await preview()).code).toBe(0);
    const valid = await readFile(receipt, 'utf8');
    for (const extra of [{ approved: true }, { kind: 'domain-preview' }]) {
      await writeFile(receipt, JSON.stringify({ ...JSON.parse(valid), ...extra }), 'utf8');
      expect((await apply()).result.error.code).toBe('INVALID_CONTRACT');
    }
    await writeFile(receipt, '{"a":1,"a":2}', 'utf8');
    expect((await apply()).result.error.code).toBe('AMBIGUOUS_JSON');
  });

  it('预览后目标父目录变为文件，IO 失败不改输入', async () => {
    const blocker = join(directory, 'blocked');
    output = join(blocker, 'output.puzzle.json');
    expect((await preview()).code).toBe(0);
    await writeFile(blocker, 'block', 'utf8');
    const before = await readFile(source);
    expect((await apply()).code).toBe(5);
    expect(await readFile(source)).toEqual(before);
    expect(await readFile(blocker, 'utf8')).toBe('block');
  });
});
