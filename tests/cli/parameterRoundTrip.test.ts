import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { runCli } from './processHarness';
import { parameterCreationPlan, projectScriptBindings } from './parameterFixtures';
import { importProject } from '../../utils/projectImport';
import { prepareProject } from '../../services/projectFiles';
import { buildCandidate } from '../../services/automation/domainCandidate';
import { createEmptyProject } from '../../utils/projectFactory';
import { FIXED_TIME } from './fixtures';

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'puzzle parameters 中文 '));
});
afterEach(async () => {
  const target = resolve(directory);
  if (
    dirname(target) !== resolve(tmpdir()) ||
    !basename(target).startsWith('puzzle parameters 中文 ')
  )
    throw new Error('Unsafe cleanup path');
  await rm(target, { recursive: true, force: true });
});
const hash = (content: string) => createHash('sha256').update(content).digest('hex');
async function create() {
  const plan = join(directory, 'create.plan.json'),
    source = join(directory, '工程.puzzle.json');
  await writeFile(plan, JSON.stringify(parameterCreationPlan()), 'utf8');
  const result = await runCli(directory, [
    'create',
    '--name',
    'Parameter Round Trip',
    '--root-asset-name',
    'C4Root',
    '--plan',
    plan,
    '--out',
    source,
  ]);
  expect(result.code, JSON.stringify(result.result)).toBe(0);
  return { source, aliases: result.result.data.aliases };
}

function assertComplete(content: string, sourceKey = 'sink') {
  const raw = JSON.parse(content),
    reopened = importProject(content);
  // 必须比较磁盘原文，不能让导入时的自动补齐掩盖落盘缺陷。
  expect(reopened.notices).toEqual([]);
  expect(raw.project).toEqual(JSON.parse(JSON.stringify(reopened.project)));
  const bindings = projectScriptBindings(raw.project);
  expect(bindings).toHaveLength(4);
  for (const binding of bindings) {
    expect(new Set(binding.parameters.map((parameter) => parameter.id)).size).toBe(5);
    expect(binding.parameters.map((parameter) => parameter.kind)).toEqual([
      'Variable',
      'Variable',
      'Variable',
      'Variable',
      'Temporary',
    ]);
    expect(binding.parameters.every((parameter) => Boolean(parameter.id))).toBe(true);
    expect(binding.parameters.slice(0, 3).map((parameter) => parameter.source)).toEqual([
      { type: 'Constant', value: sourceKey },
      { type: 'Constant', value: 0 },
      { type: 'Constant', value: '' },
    ]);
    expect(binding.parameters[4].source).toEqual({ type: 'Constant', value: false });
    expect(binding.parameters[4].tempVariable).toMatchObject({ id: 'TEMP_5', type: 'boolean' });
  }
  expect(prepareProject(content, 'C:/test/new.puzzle.json').importNotices).toEqual([]);
  return bindings;
}

describe('CLI 参数与编辑器重新打开的一致性', () => {
  it('create 的原文包含完整参数，校验无导入提示，导出保留值并移除辅助字段', async () => {
    const { source } = await create(),
      content = await readFile(source, 'utf8');
    const bindings = assertComplete(content);
    const validated = await runCli(directory, ['validate', source, '--warnings-as-errors']);
    expect(validated.code, JSON.stringify(validated.result)).toBe(0);
    expect(validated.result.data).toMatchObject({
      valid: true,
      errors: 0,
      warnings: 0,
      importNotices: [],
    });
    const out = join(directory, 'runtime.export.json');
    expect((await runCli(directory, ['export', source, '--out', out])).code).toBe(0);
    const exported = projectScriptBindings(JSON.parse(await readFile(out, 'utf8')).data);
    expect(
      exported.map((binding) => binding.parameters.map((parameter) => parameter.source)),
    ).toEqual(bindings.map((binding) => binding.parameters.map((parameter) => parameter.source)));
    for (const binding of exported)
      for (const parameter of binding.parameters) {
        expect(parameter).not.toHaveProperty('id');
        expect(parameter).not.toHaveProperty('kind');
      }
    expect(await readFile(source, 'utf8')).toBe(content);
  });
  it('preview/apply 修改参数后的候选哈希与原文一致，重放幂等，源文件保留', async () => {
    const { source, aliases } = await create(),
      original = await readFile(source, 'utf8');
    const plan = join(directory, 'edit.plan.json'),
      receipt = join(directory, 'preview.json'),
      out = join(directory, '另存.puzzle.json');
    const binding = parameterCreationPlan().commands.find(
      (command) => command.op === 'stage.update',
    );
    if (binding?.op !== 'stage.update') throw new Error('Missing fixture binding');
    for (const presentation of [
      binding.changes.onEnterPresentation,
      binding.changes.onExitPresentation,
    ]) {
      if (presentation?.type !== 'Script') throw new Error('Missing script fixture');
      presentation.scriptId = { id: aliases.effect.id };
      presentation.parameters[0].source = { type: 'Constant', value: 'washer' };
      for (const parameter of presentation.parameters)
        if (parameter.source.type === 'VariableRef')
          parameter.source.variableId = { id: aliases.flag.id };
    }
    await writeFile(
      plan,
      JSON.stringify({
        apiVersion: '1.0.0',
        sourceHash: hash(original),
        scope: { project: true },
        commands: [
          { op: 'stage.update', target: { alias: 'root' }, changes: binding.changes },
          {
            op: 'transition.update',
            fsm: { id: aliases.door.fsmId },
            target: { id: aliases.call.id },
            changes: { presentation: binding.changes.onEnterPresentation },
          },
          {
            op: 'presentationNode.update',
            graph: { id: aliases.graph.id },
            target: { id: aliases.node.id },
            changes: { presentation: binding.changes.onEnterPresentation },
          },
        ],
      }),
      'utf8',
    );
    const preview = await runCli(directory, [
      'preview',
      source,
      '--plan',
      plan,
      '--receipt-out',
      receipt,
    ]);
    expect(preview.code, JSON.stringify(preview.result)).toBe(0);
    const args = ['apply', source, '--plan', plan, '--receipt', receipt, '--out', out];
    expect((await runCli(directory, args)).code).toBe(0);
    const content = await readFile(out, 'utf8');
    assertComplete(content, 'washer');
    expect(hash(content)).toBe(preview.result.data.receipt.candidateHash);
    const repeated = await runCli(directory, args);
    expect(repeated.code, JSON.stringify(repeated.result)).toBe(0);
    expect(repeated.result.ok).toBe(true);
    expect(await readFile(out, 'utf8')).toBe(content);
    expect(await readFile(source, 'utf8')).toBe(original);
  });
  it('校验使用的规范候选与文件内容相同，空在线计划不补默认值或制造变化', () => {
    const source = createEmptyProject('Fixture', '', FIXED_TIME);
    source.stageTree.stages[source.stageTree.rootId].assetName = 'C4Root';
    const candidate = buildCandidate(source, parameterCreationPlan(), FIXED_TIME, undefined, true);
    assertComplete(candidate.content);
    expect(JSON.parse(candidate.content).project).toEqual(
      JSON.parse(JSON.stringify(candidate.project)),
    );
    const memory = buildCandidate(
      source,
      { apiVersion: '1.0.0', scope: { project: true }, commands: [] },
      FIXED_TIME,
      undefined,
      false,
      false,
      'memory',
    );
    expect(memory.project).toEqual(source);
  });
  it('信息级补齐与真正导入警告分开计数，严格模式拒绝 warning', async () => {
    const { source } = await create(),
      file = JSON.parse(await readFile(source, 'utf8'));
    delete file.project.stageTree.stages[file.project.stageTree.rootId].onEnterPresentation
      .parameters[0].id;
    const legacy = join(directory, 'legacy.puzzle.json');
    await writeFile(legacy, JSON.stringify(file), 'utf8');
    const info = await runCli(directory, ['validate', legacy, '--warnings-as-errors']);
    expect(info.code, JSON.stringify(info.result)).toBe(0);
    expect(info.result.data.importNotices).toEqual([expect.objectContaining({ level: 'info' })]);
    expect(info.result.data.warnings).toBe(0);
    file.editorVersion = 'future';
    await writeFile(legacy, JSON.stringify(file), 'utf8');
    const warning = await runCli(directory, ['validate', legacy, '--warnings-as-errors']);
    expect(warning.code).toBe(3);
    expect(warning.result.data.warnings).toBe(1);
    expect(warning.result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'IMPORT_WARNING',
        level: 'warning',
        path: '$.editorVersion',
      }),
    ]);
  });
});
