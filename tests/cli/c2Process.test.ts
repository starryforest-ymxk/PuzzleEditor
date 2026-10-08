import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, readdir, rm, mkdir, link, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { planSchema, type Plan } from '../../contracts/automation/planSchemas';
import { cliFile, cliProject, FIXED_TIME } from './fixtures';
import { creationPlan } from './c2Fixtures';
import { serializeProject } from '../../services/projectFiles';

const binary = resolve('dist-cli/cli.js');
let directory: string, source: string;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'puzzle-cli-c2-'));
  source = join(directory, '源 工程.puzzle.json');
  await writeFile(source, cliFile(), 'utf8');
  await mkdir(join(directory, 'prefs'));
});
afterEach(async () => {
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('puzzle-cli-c2-'))
    throw new Error('Unsafe cleanup path');
  await rm(target, { recursive: true, force: true });
});
async function run(args: string[], stdin?: string) {
  return new Promise<{ code: number | null; result: ReturnType<typeof JSON.parse> }>(
    (resolveRun, reject) => {
      const child = spawn(process.execPath, [binary, ...args], {
        cwd: directory,
        windowsHide: true,
        env: {
          ...process.env,
          APPDATA: join(directory, 'prefs'),
          LOCALAPPDATA: join(directory, 'prefs'),
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const out: Buffer[] = [],
        err: Buffer[] = [];
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('CLI command timed out'));
      }, 15000);
      child.stdout.on('data', (b: Buffer) => out.push(b));
      child.stderr.on('data', (b: Buffer) => err.push(b));
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', (code) => {
        clearTimeout(timer);
        try {
          expect(Buffer.concat(err).toString()).toBe('');
          resolveRun({ code, result: JSON.parse(Buffer.concat(out).toString()) });
        } catch (error) {
          reject(error);
        }
      });
      child.stdin.end(stdin ?? '');
    },
  );
}
async function planFile(commands: Plan['commands'], scope: Plan['scope'] = { project: true }) {
  const path = join(directory, '计划.json');
  const text = JSON.stringify({
    apiVersion: '1.0.0',
    sourceHash: hash(await readFile(source, 'utf8')),
    scope,
    commands,
  });
  await writeFile(path, text);
  return path;
}
async function preview(commands: Plan['commands'], scope: Plan['scope'] = { project: true }) {
  const plan = await planFile(commands, scope),
    receipt = join(directory, 'receipt.json');
  const output = await run(['preview', source, '--plan', plan, '--receipt-out', receipt]);
  return { ...output, plan, receipt };
}
async function apply(
  prepared: { plan: string; receipt: string },
  out = join(directory, 'edited.puzzle.json'),
) {
  return {
    ...(await run([
      'apply',
      source,
      '--plan',
      prepared.plan,
      '--receipt',
      prepared.receipt,
      '--out',
      out,
    ])),
    out,
  };
}
const createEvent: Plan['commands'][number] = {
  op: 'event.create',
  alias: 'newEvent',
  data: { name: 'New event', assetName: 'NewEvent' },
};

describe('C2 编译产物完整写入链路', () => {
  it('无 plan 创建只含外部命名根 Stage 的合法空项目', async () => {
    const target = join(directory, '空 工程.puzzle.json');
    const result = await run([
      'create',
      '--name',
      'Empty',
      '--root-asset-name',
      'EmptyRoot',
      '--out',
      target,
    ]);
    expect(result.code).toBe(0);
    expect((await run(['validate', target])).code).toBe(0);
    const file = JSON.parse(await readFile(target, 'utf8'));
    expect(file.project.stageTree.stages.STAGE_1.assetName).toBe('EmptyRoot');
    expect(await readdir(join(directory, 'prefs'))).toEqual([]);
  });
  it('前向 alias、多层 Stage、不同层 Puzzle、资源创建与导出完整闭环', async () => {
    const target = join(directory, '中文 新建.puzzle.json'),
      plan = join(directory, 'create-plan.json');
    await writeFile(plan, JSON.stringify(creationPlan()));
    const output = await run([
      'create',
      '--name',
      'CLI C2 Smoke',
      '--root-asset-name',
      'C2Root',
      '--plan',
      plan,
      '--out',
      target,
    ]);
    expect(output.result.error).toBeUndefined();
    expect(output.code).toBe(0);
    const aliases = output.result.data.aliases,
      file = JSON.parse(await readFile(target, 'utf8')),
      p = file.project;
    expect(p.stageTree.stages[aliases.inner.id].parentId).toBe(aliases.room.id);
    expect(p.nodes[aliases.door.id].stageId).toBe(aliases.inner.id);
    expect(p.nodes[aliases.panel.id].stageId).toBe('STAGE_1');
    expect(p.nodes[aliases.door.id].localVariables[aliases.found.id].value).toBe(false);
    expect(p.stageTree.stages[aliases.room.id].localVariables[aliases.key.id].value).toBe(0);
    expect(p.stateMachines[aliases.door.fsmId].states[aliases.door.initialStateId].assetName).toBe(
      'Locked',
    );
    expect((await run(['validate', target])).code).toBe(0);
    const exported = join(directory, 'output.export.json');
    expect((await run(['export', target, '--out', exported])).code).toBe(0);
    expect(JSON.parse(await readFile(exported, 'utf8')).fileType).toBe('puzzle-export');
  });
  it('默认预览零写入，回执重建同一候选且重试确认已有输出', async () => {
    const original = await readFile(source),
      before = await stat(source),
      plan = await planFile([createEvent]);
    const names = await readdir(directory),
      peek = await run(['preview', source, '--plan', plan]);
    expect(peek.code).toBe(0);
    expect(await readdir(directory)).toEqual(names);
    const receipt = join(directory, 'receipt.json');
    await writeFile(receipt, JSON.stringify(peek.result.data.receipt));
    const first = await apply({ plan, receipt });
    expect(first.result.error).toBeUndefined();
    expect(first.code).toBe(0);
    const firstBytes = await readFile(first.out),
      firstStat = await stat(first.out);
    const second = await apply({ plan, receipt });
    expect(second.result.data.status).toBe('already-applied');
    expect(await readFile(first.out)).toEqual(firstBytes);
    expect((await stat(first.out)).mtimeMs).toBe(firstStat.mtimeMs);
    expect(await readFile(source)).toEqual(original);
    expect((await stat(source)).mtimeMs).toBe(before.mtimeMs);
    expect(hash(firstBytes.toString())).toBe(peek.result.data.receipt.candidateHash);
  });
  it('局部更新保留资产名、完整 FSM/演出和 editorState', async () => {
    const raw = JSON.parse(await readFile(source, 'utf8'));
    const p = await preview(
      [
        {
          op: 'puzzle.update',
          target: { id: 'door' },
          changes: { name: 'Renamed door', description: 'Only this property' },
        },
      ],
      { puzzles: [{ id: 'door' }] },
    );
    expect(p.code).toBe(0);
    const output = await apply(p);
    expect(output.code).toBe(0);
    const edited = JSON.parse(await readFile(output.out, 'utf8'));
    expect(edited.project.nodes.door.assetName).toBe(raw.project.nodes.door.assetName);
    expect(edited.project.stateMachines).toEqual(raw.project.stateMachines);
    expect(edited.project.presentationGraphs).toEqual(raw.project.presentationGraphs);
    expect(edited.editorState).toEqual(raw.editorState);
  });
  it('stdin 计划在预览和提交中使用相同原始指纹', async () => {
    const text = JSON.stringify({
      apiVersion: '1.0.0',
      sourceHash: hash(await readFile(source, 'utf8')),
      scope: { globals: ['event'] },
      commands: [createEvent],
    });
    const receipt = join(directory, 'stdin-receipt.json'),
      out = join(directory, 'stdin-output.puzzle.json');
    expect(
      (await run(['preview', source, '--plan', '-', '--receipt-out', receipt], text)).code,
    ).toBe(0);
    expect(
      (await run(['apply', source, '--plan', '-', '--receipt', receipt, '--out', out], text)).code,
    ).toBe(0);
  });
  it('Stage 重排和移动更新两边初始项，清除的解锁配置出现在预览中', async () => {
    const p = await preview([
      {
        op: 'stage.create',
        alias: 'side',
        parent: { alias: 'root' },
        data: {
          name: 'Side',
          assetName: 'Side',
          unlockTriggers: [{ type: 'OnEvent', eventId: { id: 'open' } }],
          unlockCondition: { type: 'Literal', value: false },
        },
      },
      { op: 'stage.reorder', target: { alias: 'side' }, index: 0 },
      { op: 'stage.move', target: { id: 'room' }, parent: { alias: 'side' } },
    ]);
    expect(p.code).toBe(0);
    const output = await apply(p);
    expect(output.code).toBe(0);
    const tree = JSON.parse(await readFile(output.out, 'utf8')).project.stageTree,
      side = p.result.data.aliases.side.id;
    expect(tree.stages.STAGE_1.childrenIds).toEqual([side]);
    expect(tree.stages[side].childrenIds).toEqual(['room']);
    expect(tree.stages[side].isInitial).toBe(true);
    expect(tree.stages.room.isInitial).toBe(true);
    expect(tree.stages[side].unlockTriggers).toEqual([]);
    expect(tree.stages[side].unlockCondition).toBeUndefined();
    expect(p.result.data.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/project/stageTree/stages/room/parentId', after: side }),
      ]),
    );
  });
  it('同批删除不复用编号，局部变量移动与更新保留身份', async () => {
    const project = cliProject();
    project.blackboard.events.EVENT_9 = {
      id: 'EVENT_9',
      name: 'Old',
      assetName: 'OldEvent',
      state: 'Draft',
    };
    await writeFile(source, cliFile(project));
    const p = await preview([
      { op: 'event.delete', target: { id: 'EVENT_9' } },
      createEvent,
      { op: 'event.create', alias: 'second', data: { name: 'Second', assetName: 'Second' } },
      {
        op: 'variable.create',
        alias: 'counter',
        owner: { type: 'global' },
        data: { name: 'Counter', assetName: 'Counter', type: 'integer', value: 0 },
      },
      {
        op: 'variable.move',
        owner: { type: 'global' },
        target: { alias: 'counter' },
        destination: { type: 'puzzle', ref: { id: 'door' } },
      },
      {
        op: 'variable.update',
        owner: { type: 'puzzle', ref: { id: 'door' } },
        target: { alias: 'counter' },
        changes: { value: 3 },
      },
      { op: 'puzzle.reorder', stage: { id: 'room' }, order: [{ id: 'lock' }, { id: 'door' }] },
    ]);
    expect(p.code).toBe(0);
    expect(p.result.data.aliases.newEvent.id).toBe('EVENT_10');
    expect(p.result.data.aliases.second.id).toBe('EVENT_11');
    const output = await apply(p);
    expect(output.code).toBe(0);
    const after = JSON.parse(await readFile(output.out, 'utf8')).project,
      id = p.result.data.aliases.counter.id;
    expect(after.blackboard.globalVariables[id]).toBeUndefined();
    expect(after.nodes.door.localVariables[id]).toMatchObject({
      id,
      scope: 'NodeLocal',
      value: 3,
      assetName: 'Counter',
    });
    expect(after.nodes.lock.displayOrder).toBe(0);
    expect(after.nodes.door.displayOrder).toBe(1);
  });
});

describe('C2 拒绝非法操作且保留源工程', () => {
  it.each([
    [
      { op: 'stage.move', target: { alias: 'root' }, parent: { id: 'room' } },
      'ROOT_STAGE_PROTECTED',
    ],
    [{ op: 'stage.move', target: { id: 'room' }, parent: { id: 'room' } }, 'STAGE_CYCLE'],
    [{ op: 'stage.reorder', target: { id: 'room' }, index: 99 }, 'INDEX_OUT_OF_RANGE'],
    [
      { op: 'puzzle.update', target: { id: 'missing' }, changes: { name: 'Lost' } },
      'ENTITY_NOT_FOUND',
    ],
    [{ op: 'puzzle.reorder', stage: { id: 'room' }, order: [{ id: 'door' }] }, 'INCOMPLETE_ORDER'],
    [
      {
        op: 'stage.update',
        target: { id: 'room' },
        changes: { unlockCondition: { type: 'Literal', value: false } },
      },
      'INITIAL_STAGE_UNLOCK',
    ],
    [
      { op: 'event.create', alias: 'root', data: { name: 'Root', assetName: 'Root' } },
      'DUPLICATE_ALIAS',
    ],
    [
      {
        op: 'variable.create',
        alias: 'bad',
        owner: { type: 'global' },
        data: { name: 'Bad', assetName: 'Bad', type: 'boolean', value: 0 },
      },
      'VARIABLE_VALUE_TYPE',
    ],
    [
      {
        op: 'script.create',
        alias: 'bad',
        data: { name: 'Bad', assetName: 'Bad', category: 'Lifecycle' },
      },
      'SCRIPT_TARGET_INVALID',
    ],
    [{ op: 'script.delete', target: { id: 'deleted' } }, 'PERMANENT_DELETE_FORBIDDEN'],
  ])('拒绝 %j', async (command, code) => {
    const original = await readFile(source),
      p = await preview([createEvent, command as Plan['commands'][number]]);
    expect(p.result.error?.code).toBe(code);
    expect(p.result.diagnostics[0].operationIndex).toBe(1);
    expect(await readdir(directory)).not.toContain('receipt.json');
    expect(await readFile(source)).toEqual(original);
  });
  it.each([
    { op: 'event.create', alias: 'bad', data: { name: 'Missing' } },
    {
      op: 'variable.create',
      alias: 'bad',
      owner: { type: 'stage', ref: { id: 'room' } },
      data: { name: 'Bad', assetName: '  ', type: 'integer', value: 0 },
    },
    {
      op: 'puzzle.create',
      alias: 'bad',
      stage: { id: 'room' },
      data: { name: 'Bad', assetName: 'Bad' },
      initialState: { name: 'Initial' },
    },
    { op: 'event.update', target: { id: 'open' }, changes: { id: 'Injected' } },
    { op: 'event.update', target: { id: 'open' }, changes: { state: 'Draft' } },
    { op: 'stage.update', target: { id: '__proto__' }, changes: { name: 'Injected' } },
    { op: 'json.replace', value: {} },
  ])('契约拒绝缺名/保留字段/通用 JSON 入口 %j', async (command) => {
    const p = await preview([command as Plan['commands'][number]]);
    expect(p.code).toBe(2);
    expect(p.result.error.code).toBe('INVALID_CONTRACT');
    expect(await readdir(directory)).not.toContain('receipt.json');
  });
  it('根资产名必填且格式非法时不创建输出目录', async () => {
    const target = join(directory, 'new', 'bad.puzzle.json');
    for (const args of [[], ['--root-asset-name', 'bad-name'], ['--root-asset-name', ' ']])
      expect((await run(['create', '--name', 'Bad', '--out', target, ...args])).code).toBe(2);
    expect(await readdir(directory)).not.toContain('new');
  });
  it('同作用域资产名重复拒绝，同名局部变量 ID 不误定位', async () => {
    const p = await preview([
      {
        op: 'variable.create',
        alias: 'duplicate',
        owner: { type: 'stage', ref: { id: 'room' } },
        data: { name: 'Duplicate', assetName: 'RoomKey', type: 'integer', value: 0 },
      },
    ]);
    expect(p.result.error.code).toBe('CANDIDATE_VALIDATION_FAILED');
    expect(p.result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ASSET_NAME_DUPLICATE',
          entity: expect.objectContaining({ ownerType: 'stage', ownerId: 'room' }),
        }),
      ]),
    );
  });
  it('局部授权拒绝全局资源与跨范围移动', async () => {
    expect((await preview([createEvent], { puzzles: [{ id: 'door' }] })).result.error.code).toBe(
      'SCOPE_VIOLATION',
    );
    expect(
      (
        await preview([{ op: 'puzzle.move', target: { id: 'door' }, stage: { alias: 'root' } }], {
          stages: [{ id: 'room' }],
        })
      ).result.error.code,
    ).toBe('SCOPE_VIOLATION');
  });
  it('前向 alias 类型错误、未知和父级环明确失败', async () => {
    const p = creationPlan();
    p.commands = [
      {
        op: 'stage.create',
        alias: 'a',
        parent: { alias: 'b' },
        data: { name: 'A', assetName: 'A' },
      },
      {
        op: 'stage.create',
        alias: 'b',
        parent: { alias: 'a' },
        data: { name: 'B', assetName: 'B' },
      },
    ];
    const path = join(directory, 'create.json');
    await writeFile(path, JSON.stringify(p));
    expect(
      (
        await run([
          'create',
          '--name',
          'Bad',
          '--root-asset-name',
          'Root',
          '--plan',
          path,
          '--out',
          join(directory, 'bad.puzzle.json'),
        ])
      ).result.error.code,
    ).toBe('CREATION_DEPENDENCY');
    expect(
      (
        await preview([
          { op: 'puzzle.update', target: { alias: 'root' }, changes: { name: 'Bad' } },
        ])
      ).result.error.code,
    ).toBe('ALIAS_TYPE_MISMATCH');
    expect(
      (
        await preview([
          { op: 'puzzle.update', target: { alias: 'unknown' }, changes: { name: 'Bad' } },
        ])
      ).result.error.code,
    ).toBe('UNKNOWN_ALIAS');
  });
  it('错误基线允许保留旧缺名并修复；不允许新增错误', async () => {
    const project = cliProject();
    delete project.nodes.lock.assetName;
    await writeFile(source, serializeProject(project, undefined, FIXED_TIME));
    const p = await preview([
      { op: 'puzzle.update', target: { id: 'door' }, changes: { description: 'Still editing' } },
    ]);
    expect(p.code).toBe(0);
    expect(p.result.data.remainingErrors).toBe(1);
    expect((await apply(p)).code).toBe(0);
    const fix = await planFile([
      { op: 'puzzle.update', target: { id: 'lock' }, changes: { assetName: 'Lock' } },
    ]);
    expect((await run(['preview', source, '--plan', fix])).result.data.remainingErrors).toBe(0);
    await writeFile(
      fix,
      JSON.stringify({
        ...JSON.parse(await readFile(fix, 'utf8')),
        commands: [{ op: 'puzzle.update', target: { id: 'lock' }, changes: { assetName: 'Door' } }],
      }),
    );
    expect((await run(['preview', source, '--plan', fix])).result.error.code).toBe(
      'CANDIDATE_VALIDATION_FAILED',
    );
  });
  it('移动 Puzzle 离开局部变量可见范围拒绝；显式清理后允许且 ID 保持', async () => {
    const project = cliProject();
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
              source: { type: 'Constant', value: 0 },
            },
          ],
        },
      },
    ];
    delete project.stageTree.stages[project.stageTree.rootId].localVariables.shared;
    await writeFile(source, serializeProject(project, undefined, FIXED_TIME));
    const move = { op: 'puzzle.move', target: { id: 'door' }, stage: { alias: 'root' } } as const;
    expect((await preview([move])).result.error.code).toBe('CANDIDATE_VALIDATION_FAILED');
    const p = await preview([
      move,
      { op: 'puzzle.update', target: { id: 'door' }, changes: { eventListeners: [] } },
    ]);
    expect(p.code).toBe(0);
    const output = await apply(p);
    expect(output.code).toBe(0);
    const after = JSON.parse(await readFile(output.out, 'utf8'));
    expect(after.project.nodes.door.stateMachineId).toBe('door-fsm');
    expect(after.project.nodes.door.stageId).toBe(project.stageTree.rootId);
  });
  it('Draft 删除、Implemented 标删、Marked 恢复；禁止状态参数绕过', async () => {
    const project = cliProject();
    project.scripts.scripts.spare = {
      ...project.scripts.scripts.effect,
      id: 'spare',
      name: 'Spare',
      assetName: 'Spare',
      state: 'Implemented',
    };
    await writeFile(source, serializeProject(project, undefined, FIXED_TIME));
    const p = await preview([
      { op: 'script.delete', target: { id: 'spare' } },
      { op: 'script.restore', target: { id: 'deleted' } },
      createEvent,
      { op: 'event.delete', target: { alias: 'newEvent' } },
    ]);
    expect(p.code).toBe(0);
    const output = await apply(p);
    const after = JSON.parse(await readFile(output.out, 'utf8'));
    expect(after.project.scripts.scripts.spare.state).toBe('MarkedForDelete');
    expect(after.project.scripts.scripts.deleted.state).toBe('Implemented');
    expect(Object.keys(after.project.blackboard.events)).toEqual(['open']);
  });
  it('脚本类别和生命周期目标必须匹配，更新脚本也不能破坏已有绑定', async () => {
    expect(
      (
        await preview([
          {
            op: 'puzzle.update',
            target: { id: 'door' },
            changes: { lifecycleScriptId: { id: 'effect' } },
          },
        ])
      ).result.data.newErrors,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ERR_SCRIPT_CATEGORY' })]));
    const wrong = await preview([
      {
        op: 'script.create',
        alias: 'life',
        data: {
          name: 'Stage lifecycle',
          assetName: 'StageLife',
          category: 'Lifecycle',
          lifecycleType: 'Stage',
        },
      },
      {
        op: 'puzzle.update',
        target: { id: 'door' },
        changes: { lifecycleScriptId: { alias: 'life' } },
      },
    ]);
    expect(wrong.result.data.newErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ERR_SCRIPT_TARGET' })]),
    );
    expect(
      (
        await preview([
          { op: 'script.update', target: { id: 'effect' }, changes: { category: 'Condition' } },
        ])
      ).result.error.code,
    ).toBe('CANDIDATE_VALIDATION_FAILED');
  });
  it('参数修改器与 GUI 共用类型规则，false/0 不丢失且 Toggle 不消费来源', async () => {
    const change = (
      operation: 'Add' | 'Set' | 'Toggle',
      value: unknown,
    ): Plan['commands'][number] => ({
      op: 'puzzle.update',
      target: { id: 'door' },
      changes: {
        eventListeners: [
          {
            eventId: { id: 'open' },
            action: {
              type: 'ModifyParameter',
              modifiers: [
                {
                  targetVariableId: { id: 'flag' },
                  targetScope: 'Global',
                  operation,
                  source: { type: 'Constant', value: value as boolean },
                },
              ],
            },
          },
        ],
      },
    });
    expect((await preview([change('Add', false)])).result.data.newErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ERR_MODIFIER_OPERATION' })]),
    );
    expect((await preview([change('Set', 0)])).result.data.newErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ERR_MODIFIER_SOURCE_TYPE' })]),
    );
    expect((await preview([change('Set', false)])).code).toBe(0);
    const plan = await planFile([change('Toggle', 0)]);
    expect((await run(['preview', source, '--plan', plan])).code).toBe(0);
  });
  it('旧错误同一位置不能换成另一个缺失目标', async () => {
    const project = cliProject();
    project.stageTree.stages.STAGE_1.onEnterPresentation = {
      type: 'Graph',
      graphId: 'missing-old',
    };
    await writeFile(source, cliFile(project));
    const p = await preview([
      {
        op: 'stage.update',
        target: { alias: 'root' },
        changes: { onEnterPresentation: { type: 'Graph', graphId: { id: 'missing-new' } } },
      },
    ]);
    expect(p.result.error.code).toBe('CANDIDATE_VALIDATION_FAILED');
    expect(await readdir(directory)).not.toContain('receipt.json');
  });
});

describe('C2 文件一致性与失败策略', () => {
  it('原型成员不能冒充实体 ID 或有效引用', async () => {
    expect(
      (await preview([{ op: 'event.delete', target: { id: 'toString' } }])).result.error.code,
    ).toBe('ENTITY_NOT_FOUND');
    expect(
      (await preview([{ op: 'stage.update', target: { id: 'valueOf' }, changes: { name: 'Bad' } }]))
        .result.error.code,
    ).toBe('ENTITY_NOT_FOUND');
    const p = await preview([
      {
        op: 'puzzle.update',
        target: { id: 'door' },
        changes: {
          eventListeners: [
            {
              eventId: { id: 'open' },
              action: {
                type: 'ModifyParameter',
                modifiers: [
                  {
                    targetVariableId: { id: 'toString' },
                    targetScope: 'Global',
                    operation: 'Set',
                    source: { type: 'Constant', value: false },
                  },
                ],
              },
            },
          ],
        },
      },
    ]);
    expect(p.result.error.code).toBe('CANDIDATE_VALIDATION_FAILED');
    expect(p.result.data.newErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ERR_VAR_MISSING' })]),
    );
    expect(await readdir(directory)).not.toContain('receipt.json');
  });
  it.each(['source', 'plan', 'receipt'] as const)('拒绝预览后的 %s 变化', async (changed) => {
    const p = await preview([createEvent]);
    expect(p.code).toBe(0);
    if (changed === 'source') await writeFile(source, (await readFile(source, 'utf8')) + '\n');
    else if (changed === 'plan') await writeFile(p.plan, (await readFile(p.plan, 'utf8')) + '\n');
    else {
      const receipt = JSON.parse(await readFile(p.receipt, 'utf8'));
      receipt.candidateHash = '0'.repeat(64);
      await writeFile(p.receipt, JSON.stringify(receipt));
    }
    const output = await apply(p);
    expect(output.code).toBe(4);
    expect(await readdir(directory)).not.toContain('edited.puzzle.json');
  });
  it('拒绝源/计划/回执别名、硬链接以及已有不同内容输出', async () => {
    const p = await preview([createEvent]);
    for (const path of [source, p.plan, p.receipt]) {
      // 后两者用 .puzzle.json 硬链接同时验证后缀保护与文件身份保护互不替代。
      const alias = join(directory, basename(path) + '.alias.puzzle.json');
      await link(path, alias);
      expect((await apply(p, alias)).result.error.code).toBe('INPUT_OUTPUT_COLLISION');
    }
    const out = join(directory, 'existing.puzzle.json');
    await writeFile(out, 'keep');
    expect((await apply(p, out)).result.error.code).toBe('OUTPUT_EXISTS');
    expect(await readFile(out, 'utf8')).toBe('keep');
  });
  it('已有目标、导出后缀与 IO 失败不覆盖任何输入', async () => {
    const before = await readFile(source);
    expect(
      (await run(['create', '--name', 'Bad', '--root-asset-name', 'Root', '--out', source])).result
        .error.code,
    ).toBe('OUTPUT_EXISTS');
    expect((await run(['export', source, '--out', source])).result.error.code).toBe(
      'INVALID_OUTPUT_EXTENSION',
    );
    const p = await preview([createEvent]),
      blocked = join(directory, 'file-as-parent');
    await writeFile(blocked, 'keep');
    expect((await apply(p, join(blocked, 'new.puzzle.json'))).code).toBe(5);
    expect(await readFile(source)).toEqual(before);
    expect((await readdir(directory)).some((n) => n.endsWith('.tmp'))).toBe(false);
  });
  it('计划严格 Schema 可导出且拒绝通用字段，未知文件字段仍只能完整读取', async () => {
    const description = await run(['describe']);
    expect(description.result.data.planSchema).toBeTruthy();
    expect(planSchema.safeParse({ ...creationPlan(), approved: true }).success).toBe(false);
    const raw = JSON.parse(await readFile(source, 'utf8'));
    raw.future = { preserve: true };
    await writeFile(source, JSON.stringify(raw));
    expect((await run(['json', 'read', source])).code).toBe(0);
    expect((await preview([createEvent])).result.error.code).toBe('PROJECT_STRUCTURE_INVALID');
  });
});
