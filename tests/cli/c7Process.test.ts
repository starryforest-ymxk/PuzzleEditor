/** C7 真实子进程转换验收；仅使用隔离虚构工程，源/目标/回执逐字节核验。 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, readdir, rm, link, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { runCli } from './processHarness';
import { conversionInput, conversionProject } from './c7Fixtures';
import { importProject, type ProjectSourceFormat } from '../../utils/projectImport';
import { normalizeForExport } from '../../utils/exportNormalizer';
import type { ImportNames } from '../../contracts/automation/importSchemas';
import { defaultProjectEditorState } from '../../utils/projectEditorState';

let directory: string, source: string, out: string, receipt: string, names: string;
const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const run = (args: string[]) => runCli(directory, args);
const preview = (extra: string[] = []) =>
  run(['import', 'preview', source, '--out', out, '--receipt-out', receipt, ...extra]);
const apply = (extra: string[] = []) =>
  run(['import', 'apply', source, '--out', out, '--receipt', receipt, ...extra]);
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const write = async (path: string, data: unknown) => writeFile(path, JSON.stringify(data), 'utf8');
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'puzzle-cli-c7-'));
  source = join(directory, '兼容 来源.json');
  out = join(directory, '完整 工程.puzzle.json');
  receipt = join(directory, '转换 回执.json');
  names = join(directory, '外部 命名.json');
  await writeFile(source, conversionInput('export'), 'utf8');
});
afterEach(async () => {
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('puzzle-cli-c7-'))
    throw new Error('Unsafe cleanup path');
  await rm(target, { recursive: true, force: true });
});
async function mapNames(entries: ImportNames['entries']) {
  await write(names, { apiVersion: '1.0.0', sourceHash: hash(await readFile(source)), entries });
}
async function unchangedSource(original: Buffer) {
  expect(await readFile(source)).toEqual(original);
  expect(await readdir(directory)).not.toContain('prefs');
}

describe('C7 支持格式、命名与往返', () => {
  it('能力发现提供两入口、映射/回执 Schema，拒绝其他权限与通用编辑参数', async () => {
    const { result } = await run(['describe']);
    expect(result.data).toMatchObject({
      phase: 'C10',
      importConverterVersion: 'C7.1',
      policyVersion: 'C10',
    });
    expect(result.data.capabilities).toHaveLength(22);
    expect(result.data.importNamesSchema.additionalProperties).toBe(false);
    expect(result.data.importReceiptSchema.properties.kind.const).toBe('import-preview');
    for (const flag of [
      '--allow-overwrite',
      '--allow-raw-json-write',
      '--allow-permanent-delete',
      '--force',
    ])
      expect((await preview([flag])).code).toBe(2);
    expect((await run(['import', 'apply', source, '--out', out])).code).toBe(2);
    expect((await run(['import', 'preview', source, '--out', out, '--out', out])).code).toBe(2);
  });
  it.each<ProjectSourceFormat>(['project', 'export', 'raw', 'legacy-manifest'])(
    '%s 预览提交并导出，与 GUI 导入相同，原 ID/状态/0/false 保留',
    async (format) => {
      await writeFile(source, '\uFEFF' + conversionInput(format), 'utf8');
      const original = await readFile(source);
      const p = await preview();
      expect(p.code).toBe(0);
      const data = p.result.data;
      expect(data.detectedFormat).toBe(format);
      expect(data.requiredCapabilities).toEqual([]);
      expect(data.missingAssetNames).toEqual([]);
      expect(data.remainingErrors).toBe(0);
      expect(await readdir(directory)).not.toContain(basename(out));
      const applied = await apply();
      expect(applied.code).toBe(0);
      expect(applied.result.data.output.sha256).toBe(data.candidateHash);
      expect(await json(out)).toEqual(data.candidateFile);
      const converted = importProject(await readFile(out, 'utf8'));
      const gui = importProject(original.toString('utf8'), data.receipt.context);
      expect(converted.project).toEqual({
        ...gui.project,
        meta: { ...gui.project.meta, updatedAt: data.receipt.context.now },
      });
      expect(converted.editorState).toEqual(
        gui.editorState ?? defaultProjectEditorState(gui.project.stageTree.rootId),
      );
      expect(converted.project.nodes.door.localVariables.shared).toMatchObject({
        value: 0,
        state: 'MarkedForDelete',
      });
      expect(converted.project.blackboard.globalVariables.flag.value).toBe(false);
      expect(converted.project.presentationGraphs.intro.nodes.yes.duration).toBe(0);
      expect(converted.project.scripts.scripts.effect.state).toBe('Implemented');
      expect((await run(['validate', out])).code).toBe(0);
      const exported = join(directory, 'converted.export.json');
      expect((await run(['export', out, '--out', exported])).code).toBe(0);
      expect((await json(exported)).data).toEqual(normalizeForExport(gui.project));
      expect((await json(exported)).data.presentationGraphs.intro.nodes.yes.duration).toBe(0);
      const mtime = (await stat(out)).mtimeMs;
      expect((await apply()).result.data.status).toBe('already-applied');
      expect((await stat(out)).mtimeMs).toBe(mtime);
      await unchangedSource(original);
    },
  );
  it('不带 receipt-out 的预览无文件副作用，返回完整候选和默认 UI 说明', async () => {
    const before = await readdir(directory);
    const p = await run(['import', 'preview', source, '--out', out]);
    expect(p.code).toBe(0);
    expect(await readdir(directory)).toEqual(before);
    expect(p.result.data.editorStateDefaulted).toBe(true);
    expect(p.result.data.importNotices).toContainEqual(
      expect.objectContaining({ path: '$.editorState' }),
    );
    expect(p.result.data.candidateFile.project.meta.id).toBe(
      p.result.data.receipt.context.runtimeProjectId,
    );
    expect(p.result.data.candidateFile.project.meta.createdAt).toBe(
      p.result.data.receipt.context.now,
    );
  });
  it('源未保存的元数据时间、参数辅助 ID 和布局重建后与预览字节一致', async () => {
    const project = conversionProject();
    Reflect.deleteProperty(project.meta, 'createdAt');
    Reflect.deleteProperty(project.meta, 'updatedAt');
    await write(source, project);
    const p = await preview();
    expect(p.code).toBe(0);
    expect((await apply()).code).toBe(0);
    const saved = await json(out);
    expect(saved.project.meta.createdAt).toBe(p.result.data.receipt.context.now);
    expect(hash(await readFile(out))).toBe(p.result.data.candidateHash);
    expect(
      saved.project.presentationGraphs.intro.nodes.finish.presentation.parameters[0].id,
    ).toBeTruthy();
  });
  it('已知 legacy 条件迁移保持布尔/数值，移除空 triggers 明示 notice', async () => {
    const raw = await json(source);
    raw.data.triggers = { triggers: {} };
    raw.data.stateMachines['door-fsm'].transitions.go.condition = {
      type: 'VARIABLE_REF',
      variableId: 'flag',
      variableScope: 'Global',
    };
    raw.data.stateMachines['lock-fsm'].transitions.go.condition = {
      type: 'COMPARISON',
      operator: '==',
      left: { type: 'LITERAL', value: 0 },
      right: { type: 'LITERAL', value: 0 },
    };
    await write(source, raw);
    const p = await preview();
    expect(p.code).toBe(0);
    expect(p.result.data.migrated).toBe(true);
    expect((await apply()).code).toBe(0);
    const saved = await json(out);
    expect(saved.project.stateMachines['door-fsm'].transitions.go.condition).toEqual({
      type: 'Comparison',
      operator: '==',
      left: { type: 'VariableRef', variableId: 'flag', scope: 'Global' },
      right: { type: 'Constant', value: true },
    });
    expect(saved.project.stateMachines['lock-fsm'].transitions.go.condition.right.value).toBe(0);
  });
  it('完整覆盖命名域，局部同 ID 精确匹配；全局 owner 不依赖随机项目 UUID', async () => {
    await mapNames([
      { entity: { type: 'stage', id: 'room' }, assetName: 'ExternalRoom' },
      { entity: { type: 'puzzle', id: 'door' }, assetName: 'ExternalDoor' },
      {
        entity: { type: 'state', id: 'idle', ownerType: 'fsm', ownerId: 'door-fsm' },
        assetName: 'ExternalIdle',
      },
      { entity: { type: 'variable', id: 'flag', ownerType: 'project' }, assetName: 'ExternalFlag' },
      {
        entity: { type: 'variable', id: 'shared', ownerType: 'stage', ownerId: 'room' },
        assetName: 'ExternalRoomKey',
      },
      {
        entity: { type: 'variable', id: 'shared', ownerType: 'puzzle', ownerId: 'door' },
        assetName: 'ExternalNodeKey',
      },
      { entity: { type: 'event', id: 'open' }, assetName: 'ExternalOpen' },
      { entity: { type: 'script', id: 'effect' }, assetName: 'ExternalEffect' },
    ]);
    const original = await readFile(source),
      p = await preview(['--names', names]);
    expect(p.code).toBe(0);
    expect(p.result.data.nameChanges).toHaveLength(8);
    expect((await apply(['--names', names])).code).toBe(0);
    const saved = (await json(out)).project;
    expect(saved.stateMachines['door-fsm'].states.idle.assetName).toBe('ExternalIdle');
    expect(saved.stateMachines['lock-fsm'].states.idle.assetName).toBe('Idle');
    expect(saved.stageTree.stages.STAGE_1.localVariables.shared.assetName).toBe('ParentKey');
    expect(saved.blackboard.globalVariables.flag.assetName).toBe('ExternalFlag');
    expect(saved.nodes.door.localVariables.shared.state).toBe('MarkedForDelete');
    expect(saved.scripts.scripts.effect.state).toBe('Implemented');
    await unchangedSource(original);
  });
  it('旧缺名和业务错误可原样转换；外部名称补齐后导出恢复', async () => {
    const raw = await json(source);
    delete raw.data.nodes.door.assetName;
    delete raw.data.blackboard.globalVariables.flag.assetName;
    await write(source, raw);
    let p = await preview();
    expect(p.code).toBe(0);
    expect(p.result.data.missingAssetNames).toHaveLength(2);
    expect(p.result.data.remainingErrors).toBe(2);
    expect((await apply()).code).toBe(0);
    expect((await run(['export', out, '--out', join(directory, 'blocked.export.json')])).code).toBe(
      3,
    );
    out = join(directory, 'named.puzzle.json');
    receipt = join(directory, 'named.receipt.json');
    await mapNames([
      { entity: { type: 'puzzle', id: 'door' }, assetName: 'Door' },
      { entity: { type: 'variable', id: 'flag', ownerType: 'project' }, assetName: 'Flag' },
    ]);
    p = await preview(['--names', names]);
    expect(p.code).toBe(0);
    expect(p.result.data.remainingErrors).toBe(0);
    expect((await apply(['--names', names])).code).toBe(0);
    expect((await run(['export', out, '--out', join(directory, 'named.export.json')])).code).toBe(
      0,
    );
  });
});

describe('C7 拒绝有损输入与不受支持的命名', () => {
  it.each([
    'unknown-field',
    'future-version',
    'unknown-format',
    'lossy-triggers',
    'lossy-operand',
    'broken-root',
    'unrelated',
  ])('%s 在建立基线前拒绝，不生成回执或项目', async (kind) => {
    const raw = await json(source);
    if (kind === 'unknown-field') raw.data.futureState = { important: true };
    if (kind === 'future-version') raw.manifestVersion = '2.0.0';
    if (kind === 'unknown-format') raw.fileType = 'future-project';
    if (kind === 'lossy-triggers') raw.data.triggers = { triggers: { old: { id: 'old' } } };
    if (kind === 'lossy-operand')
      raw.data.stateMachines['door-fsm'].transitions.go.condition = {
        type: 'VARIABLE_REF',
        variableScope: 'StageLocal',
        variableId: 'shared',
      };
    if (kind === 'broken-root') raw.data.stageTree.rootId = 'missing';
    await write(source, kind === 'unrelated' ? { hello: 'world' } : raw);
    const original = await readFile(source),
      p = await preview();
    expect(p.code).toBe(3);
    expect(p.result.error.code).toBe('PROJECT_STRUCTURE_INVALID');
    expect(await readdir(directory)).toEqual([basename(source)]);
    await unchangedSource(original);
  });
  it.each(['duplicate', 'precision', 'encoding', 'syntax'])(
    '拒绝 %s 原始文件问题',
    async (kind) => {
      if (kind === 'duplicate')
        await writeFile(source, '{"fileType":"puzzle-export","fileType":"puzzle-project"}');
      if (kind === 'precision') await writeFile(source, '{"value":9007199254740993}');
      if (kind === 'encoding') await writeFile(source, Buffer.from([0xff, 0xfe, 0x00]));
      if (kind === 'syntax') await writeFile(source, '{');
      expect((await preview()).code).toBe(3);
      expect(await readdir(directory)).toEqual([basename(source)]);
    },
  );
  it.each([
    { entity: { type: 'puzzle', id: 'door' }, assetName: ' Door' },
    { entity: { type: 'puzzle', id: 'door' } },
    { entity: { type: 'state', id: 'idle' }, assetName: 'Idle' },
    { entity: { type: 'variable', id: 'shared', ownerType: 'stage' }, assetName: 'Name' },
    { entity: { type: 'presentation', id: 'intro' }, assetName: 'Name' },
    { entity: { type: 'script', id: 'effect' }, assetName: 'Name', state: 'Draft' },
    { path: '/project/nodes/door', value: {} },
  ])('拒绝缺字段/非法/通用补丁映射 %j', async (entry) => {
    await write(names, {
      apiVersion: '1.0.0',
      sourceHash: hash(await readFile(source)),
      entries: [entry],
    });
    const p = await preview(['--names', names]);
    expect(p.code).toBe(2);
    expect(p.result.error.code).toBe('INVALID_CONTRACT');
    expect(await readdir(directory)).not.toContain(basename(out));
  });
  it.each(['duplicate', 'unknown', 'wrong-owner', 'new-error', 'old-hash', 'duplicate-json'])(
    '拒绝 %s 映射而不更改源',
    async (kind) => {
      const entry: ImportNames['entries'][number] = {
        entity: { type: 'puzzle', id: kind === 'unknown' ? 'absent' : 'door' },
        assetName: kind === 'new-error' ? 'Lock' : 'NewDoor',
      };
      await mapNames(
        kind === 'wrong-owner'
          ? [
              {
                entity: { type: 'variable', id: 'shared', ownerType: 'puzzle', ownerId: 'lock' },
                assetName: 'Name',
              },
            ]
          : kind === 'duplicate'
            ? [entry, entry]
            : [entry],
      );
      if (kind === 'old-hash') {
        const data = await json(names);
        data.sourceHash = '0'.repeat(64);
        await write(names, data);
      }
      if (kind === 'duplicate-json') await writeFile(names, '{"entries":[],"entries":[]}');
      const original = await readFile(source),
        p = await preview(['--names', names]);
      const expected =
        kind === 'duplicate' || kind === 'duplicate-json' ? 2 : kind === 'old-hash' ? 4 : 3;
      expect(p.code).toBe(expected);
      expect(await readdir(directory)).not.toContain(basename(receipt));
      await unchangedSource(original);
    },
  );
});

describe('C7 回执、文件所有权与重试', () => {
  it.each([
    'source',
    'mapping',
    'omit-mapping',
    'target',
    'converter',
    'candidate',
    'context',
    'permissions',
    'format',
  ])('%s 变化拒绝提交，原工程保持', async (kind) => {
    await mapNames([{ entity: { type: 'puzzle', id: 'door' }, assetName: 'ExternalDoor' }]);
    expect((await preview(['--names', names])).code).toBe(0);
    const original = await readFile(source);
    if (kind === 'source') await writeFile(source, original.toString() + '\n');
    if (kind === 'mapping') await writeFile(names, (await readFile(names, 'utf8')) + '\n');
    if (kind === 'target') out = join(directory, 'other.puzzle.json');
    const r = await json(receipt);
    if (kind === 'converter') r.converterVersion = 'C0';
    if (kind === 'candidate') r.candidateHash = '0'.repeat(64);
    if (kind === 'context')
      r.context.runtimeProjectId = 'proj-imported-22222222-2222-4222-8222-222222222222';
    if (kind === 'permissions') r.requiredCapabilities = ['raw_json_write'];
    if (kind === 'format') r.detectedFormat = 'raw';
    await write(receipt, r);
    const a = await apply(kind === 'omit-mapping' ? [] : ['--names', names]);
    expect(a.code).toBe(['converter', 'permissions'].includes(kind) ? 2 : 4);
    expect(await readdir(directory)).not.toContain(basename(out));
    if (kind !== 'source') await unchangedSource(original);
  });
  it('expected-hash、已有输出、回执和目标重合均阻断预览', async () => {
    expect((await preview(['--expected-hash', '0'.repeat(64)])).code).toBe(4);
    expect(
      (await run(['import', 'preview', source, '--out', out, '--receipt-out', out])).result.error
        .code,
    ).toBe('INPUT_OUTPUT_COLLISION');
    await writeFile(out, 'existing');
    expect((await preview()).result.error.code).toBe('OUTPUT_EXISTS');
    expect(await readFile(out, 'utf8')).toBe('existing');
  });
  it.each(['source', 'names', 'receipt'])(
    '保护 %s 的路径及硬链接，不能作为项目输出',
    async (target) => {
      await mapNames([]);
      expect((await preview(['--names', names])).code).toBe(0);
      const input = target === 'source' ? source : target === 'names' ? names : receipt;
      const before = await readFile(input),
        alias = join(directory, 'alias.puzzle.json');
      await link(input, alias);
      if (target === 'receipt') {
        const r = await json(receipt);
        r.output.path = alias;
        await write(receipt, r);
        const p = await run([
          'import',
          'apply',
          source,
          '--names',
          names,
          '--receipt',
          receipt,
          '--out',
          alias,
        ]);
        expect(p.result.error.code).toBe('INPUT_OUTPUT_COLLISION');
      } else {
        const p = await run(['import', 'preview', source, '--names', names, '--out', alias]);
        expect(p.result.error.code).toBe('INPUT_OUTPUT_COLLISION');
        expect(await readFile(input)).toEqual(before);
      }
    },
  );
  it('同一回执并发发布只产生一个文件，已有不同目标不覆盖', async () => {
    expect((await preview()).code).toBe(0);
    const attempts = await Promise.all([apply(), apply()]);
    expect(attempts.map((a) => a.code)).toEqual([0, 0]);
    expect(attempts.map((a) => a.result.data.status).sort()).toEqual([
      'already-applied',
      'written',
    ]);
    await writeFile(out, 'third party');
    expect((await apply()).result.error.code).toBe('OUTPUT_EXISTS');
    expect(await readFile(out, 'utf8')).toBe('third party');
  });
});
