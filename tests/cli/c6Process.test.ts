/** C6 真实子进程：只使用临时虚构工程，验证授权声明、回执、整批失败和删除交付。 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { ProjectData } from '../../types/project';
import type { Plan } from '../../contracts/automation/planSchemas';
import { executePlan } from '../../store/commands/automation/execute';
import { serializeProject } from '../../services/projectFiles';
import { cliFile, FIXED_TIME } from './fixtures';
import { deletionProject } from './c6Fixtures';
import { runCli } from './processHarness';

let directory: string, source: string, output: string, serial: number;
const run = (args: string[]) => runCli(directory, args);
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const writeSource = (project: ProjectData) => writeFile(source, cliFile(project), 'utf8');
const removeRoom: Plan['commands'][number] = {
  op: 'stage.delete',
  target: { id: 'room' },
  cascade: true,
};
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'puzzle-cli-c6-'));
  source = join(directory, '源 工程.puzzle.json');
  output = join(directory, '输出 工程.puzzle.json');
  serial = 0;
  await writeSource(deletionProject());
});
afterEach(async () => {
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('puzzle-cli-c6-'))
    throw new Error('Unsafe cleanup path');
  await rm(target, { recursive: true, force: true });
});
async function preview(commands: Plan['commands'], scope: Plan['scope'] = { project: true }) {
  const plan = join(directory, `plan-${serial++}.json`),
    receipt = plan + '.receipt.json';
  await writeFile(
    plan,
    JSON.stringify({
      apiVersion: '1.0.0',
      scope,
      sourceHash: hash(await readFile(source, 'utf8')),
      commands,
    }),
    'utf8',
  );
  return {
    ...(await run(['preview', source, '--plan', plan, '--receipt-out', receipt])),
    plan,
    receipt,
  };
}
const apply = (prepared: { plan: string; receipt: string }, flags: string[] = []) =>
  run([
    'apply',
    source,
    '--plan',
    prepared.plan,
    '--receipt',
    prepared.receipt,
    '--out',
    output,
    ...flags,
  ]);

describe('C6 领域删除与交付', () => {
  it('新版目录保留 C6 的 47 种操作和同级独立能力，覆盖能力可调用但不能用于另存模式', async () => {
    const described = await run(['describe']);
    expect(described.result.data.phase).toBe(CLI_PHASE);
    expect(described.result.data.planSchema.properties.commands.items.oneOf).toHaveLength(47);
    expect(described.result.data.authorizationCapabilities.overwrite_project).toMatchObject({
      level: 'highest',
      implemented: true,
    });
    expect(
      described.result.data.capabilities.find(
        (item: { operation: string }) => item.operation === 'apply',
      ),
    ).toMatchObject({
      conditionalCapabilities: ['overwrite_project', 'permanent_resource_delete'],
    });
    const prepared = await preview([removeRoom]);
    expect((await apply(prepared, ['--allow-overwrite'])).code).toBe(2);
  });
  it('预览包含整棵子树和局部 FSM 实体，普通删除另存可重试且源原文保持', async () => {
    const original = await readFile(source);
    const prepared = await preview([removeRoom]);
    expect(prepared.code).toBe(0);
    const data = prepared.result.data;
    expect(data.requiredCapabilities).toEqual([]);
    expect(data.receipt.policyVersion).toBe('C10');
    expect(data.impacts.deletions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entity: { type: 'stage', id: 'deep' } }),
        expect.objectContaining({ entity: { type: 'puzzle', id: 'door' } }),
        expect.objectContaining({ entity: { type: 'fsm', id: 'door-fsm' } }),
        expect.objectContaining({
          entity: { type: 'state', id: 'idle', ownerType: 'fsm', ownerId: 'door-fsm' },
        }),
        expect.objectContaining({
          entity: { type: 'transition', id: 'go', ownerType: 'fsm', ownerId: 'lock-fsm' },
        }),
        expect.objectContaining({
          entity: { type: 'variable', id: 'shared', ownerType: 'puzzle', ownerId: 'door' },
        }),
      ]),
    );
    expect(
      data.changes.some((change: { path: string }) =>
        change.path.includes('/sibling/unlockCondition'),
      ),
    ).toBe(true);
    expect((await apply(prepared)).code).toBe(0);
    expect((await apply(prepared)).result.data.status).toBe('already-applied');
    const edited = JSON.parse(await readFile(output, 'utf8')).project;
    expect(edited.nodes).toEqual({});
    expect(edited.stateMachines).toEqual({});
    expect(edited.presentationGraphs.intro).toBeDefined();
    expect(edited.scripts.scripts.deleted).toBeDefined();
    expect(await readFile(source)).toEqual(original);
    expect((await run(['validate', output])).result.data.errors).toBe(0);
    expect(
      (await run(['export', output, '--out', join(directory, 'result.export.json')])).code,
    ).toBe(0);
  });
  it.each(['Implemented', 'MarkedForDelete'] as const)(
    '%s 级联预览可读，缺声明零写入，授权声明后成功',
    async (state) => {
      await writeSource(deletionProject(state));
      const original = await readFile(source),
        prepared = await preview([removeRoom]);
      expect(prepared.code).toBe(0);
      expect(prepared.result.data.requiredCapabilities).toEqual(['permanent_resource_delete']);
      expect(prepared.result.data.permanentDeletions).toHaveLength(3);
      const before = await readdir(directory),
        denied = await apply(prepared);
      expect(denied.code).toBe(6);
      expect(denied.result.error.code).toBe('PERMANENT_DELETE_AUTHORIZATION_REQUIRED');
      expect(denied.result.data.permanentDeletions).toHaveLength(3);
      expect(await readdir(directory)).toEqual(before);
      expect((await apply(prepared, ['--allow-permanent-delete'])).code).toBe(0);
      expect(await readFile(source)).toEqual(original);
    },
  );
  it('Puzzle 删除的局部受保护变量同样要求永久删除能力', async () => {
    await writeSource(deletionProject('Implemented'));
    const prepared = await preview([{ op: 'puzzle.delete', target: { id: 'door' } }], {
      puzzles: [{ id: 'door' }],
    });
    expect(prepared.result.data.permanentDeletions).toHaveLength(1);
    expect((await apply(prepared)).code).toBe(6);
    expect((await apply(prepared, ['--allow-permanent-delete'])).code).toBe(0);
    const project = JSON.parse(await readFile(output, 'utf8')).project;
    expect(project.nodes.lock).toBeDefined();
    expect(project.stageTree.stages.room.localVariables.shared.state).toBe('Implemented');
  });
  it.each([
    [{ op: 'stage.delete', target: { alias: 'root' }, cascade: true }, 'ROOT_STAGE_PROTECTED'],
    [{ op: 'stage.delete', target: { id: 'room' } }, 'CASCADE_REQUIRED'],
    [{ op: 'puzzle.delete', target: { id: 'missing' } }, 'ENTITY_NOT_FOUND'],
  ] as const)('拒绝 %j 且不创建回执/输出', async (command, code) => {
    const result = await preview([command]);
    expect(result.code).toBe(3);
    expect(result.result.error.code).toBe(code);
    expect(await readdir(directory)).toHaveLength(2);
  });
  it('删除后失败不发布，scope 不足不扩大父级范围', async () => {
    const bytes = await readFile(source);
    const failed = await preview([
      removeRoom,
      { op: 'puzzle.update', target: { id: 'door' }, changes: { name: 'Gone' } },
    ]);
    expect(failed.result.error.code).toBe('ENTITY_NOT_FOUND');
    const scoped = await preview([removeRoom], { stages: [{ id: 'room' }] });
    expect(scoped.result.error.code).toBe('SCOPE_VIOLATION');
    expect(await readFile(source)).toEqual(bytes);
    expect((await readdir(directory)).some((name) => name.endsWith('.receipt.json'))).toBe(false);
  });
  it('共享 FSM 拒绝并返回范围外所有者，不删除其他 Puzzle', async () => {
    const project = deletionProject();
    project.nodes.lock.stateMachineId = 'door-fsm';
    await writeSource(project);
    const result = await preview([{ op: 'puzzle.delete', target: { id: 'door' } }]);
    expect(result.result.error.code).toBe('FSM_SHARED_OUTSIDE_DELETION');
    expect(result.result.data.owners).toContainEqual(
      expect.objectContaining({ puzzleId: 'lock', fsmId: 'door-fsm' }),
    );
  });
});

describe('C6 显式 purge', () => {
  const targets: {
    label: string;
    command: Plan['commands'][number];
    protect: (p: ProjectData, state: 'Implemented' | 'MarkedForDelete') => void;
  }[] = [
    {
      label: 'global',
      command: { op: 'variable.purge', target: { id: 'spare' }, owner: { type: 'global' } },
      protect: (p, state) => {
        p.blackboard.globalVariables.spare = {
          ...p.blackboard.globalVariables.flag,
          id: 'spare',
          name: 'Spare',
          assetName: 'Spare',
          state,
        };
      },
    },
    {
      label: 'stage',
      command: {
        op: 'variable.purge',
        target: { id: 'shared' },
        owner: { type: 'stage', ref: { id: 'deep' } },
      },
      protect: (p, state) => {
        p.stageTree.stages.deep.localVariables.shared.state = state;
      },
    },
    {
      label: 'node',
      command: {
        op: 'variable.purge',
        target: { id: 'shared' },
        owner: { type: 'puzzle', ref: { id: 'door' } },
      },
      protect: (p, state) => {
        p.nodes.door.localVariables.shared.state = state;
      },
    },
    {
      label: 'event',
      command: { op: 'event.purge', target: { id: 'spare' } },
      protect: (p, state) => {
        p.blackboard.events.spare = { id: 'spare', name: 'Spare', assetName: 'Spare', state };
      },
    },
    {
      label: 'script',
      command: { op: 'script.purge', target: { id: 'deleted' } },
      protect: (p, state) => {
        p.scripts.scripts.deleted.state = state;
      },
    },
  ];
  for (const state of ['Implemented', 'MarkedForDelete'] as const)
    it.each(targets)(`${state} $label purge 需授权并只删除目标`, async ({ command, protect }) => {
      const project = deletionProject();
      protect(project, state);
      await writeSource(project);
      const prepared = await preview([command]);
      expect(prepared.code).toBe(0);
      expect(prepared.result.data.permanentDeletions).toHaveLength(1);
      const denied = await apply(prepared);
      expect(denied.code).toBe(6);
      expect((await apply(prepared, ['--allow-permanent-delete'])).code).toBe(0);
      expect((await run(['validate', output])).result.data.errors).toBe(0);
    });
  it('普通 delete 仍标删，重复 delete 不会变成 purge，Draft 不用 purge', async () => {
    const project = deletionProject();
    project.scripts.scripts.deleted.state = 'Implemented';
    await writeSource(project);
    const ordinary = await preview([{ op: 'script.delete', target: { id: 'deleted' } }]);
    expect(ordinary.result.data.requiredCapabilities).toEqual([]);
    expect((await apply(ordinary)).code).toBe(0);
    expect(JSON.parse(await readFile(output, 'utf8')).project.scripts.scripts.deleted.state).toBe(
      'MarkedForDelete',
    );
    const repeated = await preview([
      { op: 'script.delete', target: { id: 'deleted' } },
      { op: 'script.delete', target: { id: 'deleted' } },
    ]);
    expect(repeated.result.error.code).toBe('PERMANENT_DELETE_FORBIDDEN');
    expect((await preview([{ op: 'event.purge', target: { id: 'open' } }])).result.error.code).toBe(
      'PURGE_REQUIRES_PROTECTED_RESOURCE',
    );
  });
  it('显式 purge 缺声明在工程/回执读取前拒绝，scope/回执不能代替授权', async () => {
    const prepared = await preview([{ op: 'script.purge', target: { id: 'deleted' } }]);
    const result = await run([
      'apply',
      'missing-source',
      '--plan',
      prepared.plan,
      '--receipt',
      'missing-receipt',
      '--out',
      join(directory, 'missing-dir/result.puzzle.json'),
    ]);
    expect(result.code).toBe(6);
    expect(await readdir(directory)).not.toContain('missing-dir');
    expect((await apply(prepared, ['--allow-raw-json-write'])).code).toBe(2);
  });
  it('受引用资源需同批显式修复，授权不会关闭引用校验', async () => {
    const project = deletionProject();
    project.blackboard.events.open.state = 'Implemented';
    await writeSource(project);
    const failed = await preview([{ op: 'event.purge', target: { id: 'open' } }]);
    expect(failed.result.error.code).toBe('CANDIDATE_VALIDATION_FAILED');
    const repaired = await preview([
      { op: 'event.purge', target: { id: 'open' } },
      ...['door-fsm', 'lock-fsm'].map((id) => ({
        op: 'transition.update' as const,
        fsm: { id },
        target: { id: 'go' },
        changes: { triggers: [{ type: 'Always' as const }] },
      })),
    ]);
    expect(repaired.code).toBe(0);
    expect((await apply(repaired, ['--allow-permanent-delete'])).code).toBe(0);
  });
  it('原本无业务错误的同 ID 祖先回退也被拒绝', async () => {
    const project = deletionProject();
    project.nodes.door.eventListeners = [
      {
        eventId: 'open',
        action: {
          type: 'ModifyParameter',
          modifiers: [
            {
              targetVariableId: 'shared',
              targetScope: 'StageLocal',
              operation: 'Set',
              source: { type: 'Constant', value: 1 },
            },
          ],
        },
      },
    ];
    await writeSource(project);
    const result = await preview([
      {
        op: 'variable.delete',
        owner: { type: 'stage', ref: { id: 'room' } },
        target: { id: 'shared' },
      },
    ]);
    expect(result.result.error.code).toBe('DELETION_REFERENCES_REMAIN');
  });
});

describe('C6 备用 JSON 权限组合与回执', () => {
  it('raw 删除父对象不能绕过永久删除声明，两项均声明后原文交付', async () => {
    const project = deletionProject('Implemented');
    await writeSource(project);
    const candidate = join(directory, 'candidate.json'),
      receipt = join(directory, 'raw-receipt.json');
    const next = executePlan(project, {
      apiVersion: '1.0.0',
      scope: { project: true },
      commands: [removeRoom],
    }).project;
    const bytes = serializeProject(next, undefined, FIXED_TIME);
    await writeFile(candidate, bytes, 'utf8');
    const args = [source, '--candidate', candidate, '--out', output];
    const prepared = await run(['json', 'preview', ...args, '--receipt-out', receipt]);
    expect(prepared.code).toBe(0);
    expect(prepared.result.data.requiredCapabilities).toEqual([
      'raw_json_write',
      'permanent_resource_delete',
    ]);
    const before = await readdir(directory);
    expect(
      (await run(['json', 'apply', ...args, '--receipt', receipt, '--allow-permanent-delete']))
        .result.error.code,
    ).toBe('RAW_JSON_AUTHORIZATION_REQUIRED');
    expect(
      (await run(['json', 'apply', ...args, '--receipt', receipt, '--allow-raw-json-write'])).result
        .error.code,
    ).toBe('PERMANENT_DELETE_AUTHORIZATION_REQUIRED');
    expect(await readdir(directory)).toEqual(before);
    expect(
      (
        await run([
          'json',
          'apply',
          ...args,
          '--receipt',
          receipt,
          '--allow-raw-json-write',
          '--allow-permanent-delete',
        ])
      ).code,
    ).toBe(0);
    expect(await readFile(output, 'utf8')).toBe(bytes);
  });
  it.each(['old-policy', 'removed-capabilities', 'changed-source'] as const)(
    '%s 拒绝旧/篡改回执且无输出',
    async (mode) => {
      await writeSource(deletionProject('Implemented'));
      const prepared = await preview([removeRoom]);
      if (mode === 'changed-source') {
        const project = deletionProject('Implemented');
        project.meta.name = 'Changed';
        await writeSource(project);
      } else {
        const receipt = JSON.parse(await readFile(prepared.receipt, 'utf8'));
        if (mode === 'old-policy') delete receipt.policyVersion;
        else receipt.requiredCapabilities = [];
        await writeFile(prepared.receipt, JSON.stringify(receipt), 'utf8');
      }
      const result = await apply(prepared, ['--allow-permanent-delete']);
      expect([2, 4]).toContain(result.code);
      expect(await readdir(directory)).not.toContain(basename(output));
    },
  );
});
import { CLI_PHASE } from '../../contracts/automation/capabilities';
