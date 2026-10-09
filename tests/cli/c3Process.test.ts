import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, readdir, rm, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import type { Plan, Operation } from '../../contracts/automation/planSchemas';
import type { ProjectData } from '../../types/project';
import { importProject } from '../../utils/projectImport';
import { createEmptyProject } from '../../utils/projectFactory';
import { validateProject } from '../../utils/validation/validator';
import { validateStateMachine } from '../../utils/validation/fsmValidation';
import { prepareRuntimeExport } from '../../services/projectExportPreparation';
import { runCli } from './processHarness';
import { cliFile, cliProject, FIXED_TIME } from './fixtures';
import { fsmCreationPlan } from './c3Fixtures';

let directory: string, source: string, sequence: number;
const fsm = { puzzle: { id: 'door' } };
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const stateCreate: Operation = {
  op: 'state.create',
  alias: 'extra',
  fsm,
  data: { name: 'Extra', assetName: 'Extra', position: { x: 440, y: -30 } },
};
const transitionCreate: Operation = {
  op: 'transition.create',
  alias: 'edge',
  fsm,
  from: { id: 'done' },
  to: { id: 'idle' },
  data: { name: 'Back', priority: 0, triggers: [{ type: 'Always' }] },
};
const run = (args: string[]) => runCli(directory, args);
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'puzzle-cli-c3-'));
  source = join(directory, '源 工程.puzzle.json');
  sequence = 0;
  await writeFile(source, cliFile(), 'utf8');
  await mkdir(join(directory, 'prefs'));
});
afterEach(async () => {
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('puzzle-cli-c3-'))
    throw new Error('Unsafe cleanup path');
  await rm(target, { recursive: true, force: true });
});
async function preview(commands: unknown[], scope: Plan['scope'] = { puzzles: [{ id: 'door' }] }) {
  const plan = join(directory, `plan-${++sequence}.json`),
    receipt = join(directory, `receipt-${sequence}.json`);
  await writeFile(
    plan,
    JSON.stringify({
      apiVersion: '1.0.0',
      sourceHash: hash(await readFile(source, 'utf8')),
      scope,
      commands,
    }),
  );
  return {
    ...(await run(['preview', source, '--plan', plan, '--receipt-out', receipt])),
    plan,
    receipt,
  };
}
async function apply(
  prepared: { plan: string; receipt: string },
  out = join(directory, `edited-${sequence}.puzzle.json`),
) {
  const response = await run([
    'apply',
    source,
    '--plan',
    prepared.plan,
    '--receipt',
    prepared.receipt,
    '--out',
    out,
  ]);
  expect(response.result.error).toBeUndefined();
  expect(response.code).toBe(0);
  return { ...response, out, file: JSON.parse(await readFile(out, 'utf8')) };
}
async function accepted(commands: Operation[], scope?: Plan['scope']) {
  const p = await preview(commands, scope);
  expect(p.result.error).toBeUndefined();
  expect(p.code).toBe(0);
  return { ...(await apply(p)), preview: p };
}

describe('C3 完整 FSM 的真实 CLI 往返', () => {
  it('新工程前向 alias、完整效果、画布校验、保存导出及重导入一致', async () => {
    const plan = join(directory, 'complete.json'),
      out = join(directory, 'complete.puzzle.json');
    await writeFile(plan, JSON.stringify(fsmCreationPlan()));
    const created = await run([
      'create',
      '--name',
      'C3 FSM Workflow',
      '--root-asset-name',
      'C3Root',
      '--plan',
      plan,
      '--out',
      out,
    ]);
    expect(created.result.error).toBeUndefined();
    expect(created.code).toBe(0);
    expect(created.result.data.remainingErrors).toBe(0);
    const aliases = created.result.data.aliases;
    const project = importProject(await readFile(out, 'utf8')).project;
    const graph = project.stateMachines[aliases.door.fsmId];
    expect(graph.initialStateId).toBe(aliases.locked.id);
    expect(graph.states[aliases.locked.id]).not.toHaveProperty('alias');
    expect(aliases.locked).toMatchObject({ type: 'state', fsmId: graph.id });
    expect(Object.keys(graph.states)).toHaveLength(3);
    expect(Object.keys(graph.transitions)).toHaveLength(3);
    expect(graph.transitions[aliases.unlock.id].triggers).toHaveLength(4);
    expect(graph.transitions[aliases.unlock.id].parameterModifiers.map((m) => m.operation)).toEqual(
      ['Set', 'Multiply', 'Toggle'],
    );
    expect(graph.transitions[aliases.retry.id].priority).toBe(2);
    const pres = graph.transitions[aliases.unlock.id].presentation;
    expect(pres?.type).toBe('Script');
    if (pres?.type === 'Script')
      expect(pres.parameters.map((p) => p.source)).toEqual([
        { type: 'VariableRef', scope: 'StageLocal', variableId: aliases.key.id },
        { type: 'Constant', value: 0 },
        { type: 'Constant', value: false },
        { type: 'VariableRef', scope: 'NodeLocal', variableId: aliases.found.id },
      ]);
    const local = validateStateMachine(graph.id, project, aliases.door.id);
    expect(
      Object.values(local.states)
        .flatMap((v) => v.issues)
        .filter((i) => i.type === 'error'),
    ).toEqual([]);
    expect(
      Object.values(local.transitions)
        .flatMap((v) => v.issues)
        .filter((i) => i.type === 'error'),
    ).toEqual([]);
    expect((await run(['validate', out])).code).toBe(0);
    const runtime = join(directory, 'complete.export.json');
    expect((await run(['export', out, '--out', runtime])).code).toBe(0);
    const exported = JSON.parse(await readFile(runtime, 'utf8'));
    expect(exported.data).toEqual(
      JSON.parse(prepareRuntimeExport(project, FIXED_TIME).content!).data,
    );
    expect(
      importProject(JSON.stringify(exported)).project.stateMachines[graph.id].transitions,
    ).toHaveProperty(aliases.unlock.id);
    expect(await readdir(join(directory, 'prefs'))).toEqual([]);
  });
  it('局部 ID 只在指定 FSM 更新，编辑状态与源文件保留，apply 重试无重复', async () => {
    const original = await readFile(source, 'utf8'),
      initial = JSON.parse(original),
      stamp = await stat(source);
    const result = await accepted([
      stateCreate,
      transitionCreate,
      {
        op: 'state.update',
        fsm,
        target: { id: 'idle' },
        changes: { name: 'Renamed', position: { x: -50, y: 17.5 } },
      },
      { op: 'fsm.setInitial', fsm, state: { alias: 'extra' } },
      { op: 'fsm.update', fsm, changes: { displayOrder: 4 } },
      {
        op: 'transition.update',
        fsm,
        target: { id: 'go' },
        changes: { priority: 4, description: 'Reprioritized', fromSide: 'bottom' },
      },
      {
        op: 'transition.redirect',
        fsm,
        target: { id: 'go' },
        from: { alias: 'extra' },
        to: { id: 'done' },
      },
    ]);
    const after = result.file.project.stateMachines['door-fsm'];
    expect(after.states.idle).toMatchObject({
      name: 'Renamed',
      assetName: 'Idle',
      position: { x: -50, y: 17.5 },
    });
    expect(after.initialStateId).toBe(result.preview.result.data.aliases.extra.id);
    expect(after.transitions.go).toMatchObject({
      ...initial.project.stateMachines['door-fsm'].transitions.go,
      fromStateId: after.initialStateId,
      priority: 4,
      description: 'Reprioritized',
      fromSide: 'bottom',
    });
    expect(result.file.project.stateMachines['lock-fsm']).toEqual(
      initial.project.stateMachines['lock-fsm'],
    );
    expect(result.file.editorState).toEqual(initial.editorState);
    const written = await stat(result.out);
    expect((await apply(result.preview, result.out)).result.data.status).toBe('already-applied');
    expect((await stat(result.out)).mtimeMs).toBe(written.mtimeMs);
    expect(await readFile(source, 'utf8')).toBe(original);
    expect((await stat(source)).mtimeMs).toBe(stamp.mtimeMs);
  });
  it('清空字段、事件和演出绑定可往返；Graph 绑定复用现有资源', async () => {
    const result = await accepted([
      {
        op: 'state.update',
        fsm,
        target: { id: 'idle' },
        changes: { lifecycleScriptId: null, eventListeners: [] },
      },
      {
        op: 'transition.update',
        fsm,
        target: { id: 'go' },
        changes: {
          condition: null,
          presentation: { type: 'Graph', graphId: { id: 'intro' } },
          invokeEventIds: [{ id: 'open' }],
          parameterModifiers: [],
          fromSide: null,
          toSide: 'top',
        },
      },
    ]);
    const edge = result.file.project.stateMachines['door-fsm'].transitions.go;
    expect(edge).not.toHaveProperty('condition');
    expect(edge).not.toHaveProperty('fromSide');
    expect(edge.presentation).toEqual({ type: 'Graph', graphId: 'intro' });
    source = result.out;
    const cleared = await accepted([
      {
        op: 'transition.update',
        fsm,
        target: { id: 'go' },
        changes: { presentation: null, invokeEventIds: [], toSide: null },
      },
    ]);
    expect(cleared.file.project.stateMachines['door-fsm'].transitions.go).not.toHaveProperty(
      'presentation',
    );
    expect(cleared.file.project.stateMachines['door-fsm'].transitions.go.invokeEventIds).toEqual(
      [],
    );
  });
  it('并行边和自环保持独立身份，redirect 保留原效果', async () => {
    const result = await accepted([
      { ...transitionCreate, from: { id: 'idle' }, to: { id: 'done' } },
      {
        op: 'transition.redirect',
        fsm,
        target: { alias: 'edge' },
        from: { id: 'done' },
        to: { id: 'done' },
        toSide: 'right',
      },
    ]);
    const edges = result.file.project.stateMachines['door-fsm'].transitions;
    expect(Object.keys(edges)).toHaveLength(2);
    expect(edges[result.preview.result.data.aliases.edge.id]).toMatchObject({
      fromStateId: 'done',
      toStateId: 'done',
      triggers: [{ type: 'Always' }],
    });
  });
  it('显式替换初始状态并删除关联边，preview 披露所有删除', async () => {
    const result = await accepted([
      {
        op: 'state.delete',
        fsm,
        target: { id: 'idle' },
        replacementInitialState: { id: 'done' },
        deleteTransitions: true,
      },
    ]);
    const graph = result.file.project.stateMachines['door-fsm'];
    expect(graph.initialStateId).toBe('done');
    expect(Object.keys(graph.states)).toEqual(['done']);
    expect(graph.transitions).toEqual({});
    expect(result.preview.result.data.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/project/stateMachines/door-fsm/states/idle',
          kind: 'remove',
        }),
        expect.objectContaining({
          path: '/project/stateMachines/door-fsm/transitions/go',
          kind: 'remove',
        }),
      ]),
    );
  });
  it('先切换初始、删边再删状态按顺序执行，同批资源修复只校验最终候选', async () => {
    const result = await accepted([
      {
        op: 'transition.update',
        fsm,
        target: { id: 'go' },
        changes: { triggers: [{ type: 'OnEvent', eventId: { id: 'missing' } }] },
      },
      { op: 'transition.delete', fsm, target: { id: 'go' } },
      { op: 'fsm.setInitial', fsm, state: { id: 'done' } },
      { op: 'state.delete', fsm, target: { id: 'idle' } },
    ]);
    expect(result.file.project.stateMachines['door-fsm'].initialStateId).toBe('done');
  });
  it('新建再删除编号不复用，已删除 alias 不能再次成为目标', async () => {
    const result = await accepted([
      stateCreate,
      { op: 'state.delete', fsm, target: { alias: 'extra' } },
      { ...stateCreate, alias: 'next', data: { ...stateCreate.data, assetName: 'Next' } },
    ]);
    expect(result.preview.result.data.aliases.next.id).not.toBe(
      result.preview.result.data.aliases.extra.id,
    );
    const rejected = await preview([
      stateCreate,
      { op: 'state.delete', fsm, target: { alias: 'extra' } },
      { op: 'fsm.setInitial', fsm, state: { alias: 'extra' } },
    ]);
    expect(rejected.result.error.code).toBe('ENTITY_NOT_FOUND');
  });
});

describe('C3 契约和归属边界', () => {
  it.each([
    ['missing assetName', { ...stateCreate, data: { name: 'Unnamed', position: { x: 0, y: 0 } } }],
    ['invalid assetName', { ...stateCreate, data: { ...stateCreate.data, assetName: ' 有空格 ' } }],
    ['missing position', { ...stateCreate, data: { name: 'A', assetName: 'A' } }],
    [
      'infinite position',
      { ...stateCreate, data: { ...stateCreate.data, position: { x: null, y: 0 } } },
    ],
    [
      'state id injection',
      { op: 'state.update', fsm, target: { id: 'idle' }, changes: { id: 'hijack' } },
    ],
    [
      'state presentation injection',
      { op: 'state.update', fsm, target: { id: 'idle' }, changes: { presentation: {} } },
    ],
    ['whole FSM injection', { op: 'fsm.update', fsm, changes: { states: {} } }],
    ['FSM initial bypass', { op: 'fsm.update', fsm, changes: { initialStateId: 'done' } }],
    [
      'endpoint bypass',
      { op: 'transition.update', fsm, target: { id: 'go' }, changes: { toStateId: 'missing' } },
    ],
    [
      'transition assetName',
      { ...transitionCreate, data: { ...transitionCreate.data, assetName: 'NoField' } },
    ],
    [
      'missing priority',
      { ...transitionCreate, data: { name: 'A', triggers: [{ type: 'Always' }] } },
    ],
    [
      'negative priority',
      { ...transitionCreate, data: { ...transitionCreate.data, priority: -1 } },
    ],
    [
      'fractional priority',
      { ...transitionCreate, data: { ...transitionCreate.data, priority: 0.5 } },
    ],
    [
      'partial redirect',
      { op: 'transition.redirect', fsm, target: { id: 'go' }, to: { id: 'done' } },
    ],
    [
      'missing trigger event',
      { ...transitionCreate, data: { ...transitionCreate.data, triggers: [{ type: 'OnEvent' }] } },
    ],
    [
      'malformed condition',
      {
        op: 'transition.update',
        fsm,
        target: { id: 'go' },
        changes: { condition: { type: 'And', children: [] } },
      },
    ],
  ])('拒绝非法契约：%s', async (_name, operation) => {
    const original = await readFile(source);
    const p = await preview([operation]);
    expect(p.code).toBe(2);
    expect(await readdir(directory)).not.toContain(basename(p.receipt));
    expect(await readFile(source)).toEqual(original);
  });
  it.each([
    [
      { op: 'state.update', fsm, target: { id: 'missing' }, changes: { name: 'No' } },
      'ENTITY_NOT_FOUND',
    ],
    [{ op: 'transition.delete', fsm, target: { id: 'missing' } }, 'ENTITY_NOT_FOUND'],
    [{ op: 'fsm.setInitial', fsm, state: { id: 'missing' } }, 'ENTITY_NOT_FOUND'],
    [{ ...transitionCreate, to: { id: 'missing' } }, 'ENTITY_NOT_FOUND'],
    [
      { op: 'state.update', fsm: { id: 'missing' }, target: { id: 'idle' }, changes: {} },
      'ENTITY_NOT_FOUND',
    ],
    [{ op: 'state.update', fsm, target: { alias: 'root' }, changes: {} }, 'ALIAS_TYPE_MISMATCH'],
    [{ op: 'state.update', fsm, target: { alias: 'unknown' }, changes: {} }, 'UNKNOWN_ALIAS'],
    [
      { op: 'state.delete', fsm, target: { id: 'idle' }, deleteTransitions: true },
      'INITIAL_STATE_REPLACEMENT_REQUIRED',
    ],
    [
      {
        op: 'state.delete',
        fsm,
        target: { id: 'idle' },
        replacementInitialState: { id: 'idle' },
        deleteTransitions: true,
      },
      'INITIAL_STATE_REPLACEMENT_REQUIRED',
    ],
    [{ op: 'state.delete', fsm, target: { id: 'done' } }, 'STATE_HAS_TRANSITIONS'],
    [
      { op: 'state.delete', fsm, target: { id: 'idle' }, replacementInitialState: { id: 'done' } },
      'STATE_HAS_TRANSITIONS',
    ],
    [
      {
        op: 'state.delete',
        fsm,
        target: { id: 'done' },
        replacementInitialState: { id: 'idle' },
        deleteTransitions: true,
      },
      'INVALID_INITIAL_REPLACEMENT',
    ],
  ])('失败事务不留输出：%j', async (operation, code) => {
    const original = await readFile(source);
    const p = await preview([stateCreate, operation]);
    expect(p.code).toBe(3);
    expect(p.result.error.code).toBe(code);
    expect(p.result.diagnostics[0].operationIndex).toBe(1);
    expect(await readdir(directory)).not.toContain(basename(p.receipt));
    expect(await readFile(source)).toEqual(original);
  });
  it('最后状态、独立 Puzzle 范围、跨 FSM alias、重复嵌套 alias 都被保护', async () => {
    const project = cliProject();
    delete project.stateMachines['door-fsm'].states.done;
    project.stateMachines['door-fsm'].transitions = {};
    await writeFile(source, cliFile(project));
    expect(
      (await preview([{ op: 'state.delete', fsm, target: { id: 'idle' } }])).result.error.code,
    ).toBe('LAST_STATE_PROTECTED');
    expect((await preview([stateCreate], { puzzles: [{ id: 'lock' }] })).result.error.code).toBe(
      'SCOPE_VIOLATION',
    );
    expect(
      (
        await preview(
          [
            stateCreate,
            {
              op: 'state.update',
              fsm: { id: 'lock-fsm' },
              target: { alias: 'extra' },
              changes: { name: 'Wrong' },
            },
          ],
          { project: true },
        )
      ).result.error.code,
    ).toBe('FSM_REFERENCE_MISMATCH');
    const nested = {
      op: 'puzzle.create',
      alias: 'newPuzzle',
      stage: { id: 'room' },
      data: { name: 'New', assetName: 'New' },
      initialState: { name: 'Idle', assetName: 'Idle', alias: 'newPuzzle' },
    };
    expect((await preview([nested], { project: true })).result.error.code).toBe('DUPLICATE_ALIAS');
  });
  it.each(['orphan', 'shared'])('拒绝 %s FSM 的不明确 owner', async (variant) => {
    const project = cliProject();
    if (variant === 'orphan') project.nodes.door.stateMachineId = 'lock-fsm';
    else project.nodes.lock.stateMachineId = 'door-fsm';
    await writeFile(source, cliFile(project));
    const p = await preview(
      [
        {
          op: 'state.update',
          fsm: { id: 'door-fsm' },
          target: { id: 'idle' },
          changes: { name: 'Unsafe' },
        },
      ],
      { project: true },
    );
    expect(p.result.error.code).toBe('FSM_OWNER_INVALID');
  });
  it('新 FSM 继承 Stage 范围，后创建的其他 FSM alias 不能作为连线端点', async () => {
    const project = createEmptyProject('Scoped FSM');
    project.stageTree.stages[project.stageTree.rootId].assetName = 'ScopedRoot';
    await writeFile(source, cliFile(project));
    const plan = fsmCreationPlan();
    const result = await preview(plan.commands, {
      stages: [{ alias: 'root' }],
      globals: ['variable', 'event', 'script'],
    });
    expect(result.result.error).toBeUndefined();
    expect(result.code).toBe(0);
    await writeFile(source, cliFile());
    const commands = [transitionCreate, { ...stateCreate, fsm: { puzzle: { id: 'lock' } } }];
    commands[0] = { ...transitionCreate, to: { alias: 'extra' } };
    expect((await preview(commands, { project: true })).result.error.code).toBe(
      'FSM_REFERENCE_MISMATCH',
    );
    expect(
      (
        await preview(
          [
            transitionCreate,
            { op: 'transition.delete', fsm: { id: 'lock-fsm' }, target: { alias: 'edge' } },
          ],
          { project: true },
        )
      ).result.error.code,
    ).toBe('FSM_REFERENCE_MISMATCH');
  });
});

describe('C3 复用工程校验，定位错误的所属 FSM', () => {
  it('新绑定拒绝已标删的事件和变量，Temporary 在同脚本各位置声明类型必须一致', async () => {
    const project = cliProject();
    project.blackboard.events.gone = {
      id: 'gone',
      name: 'Gone',
      assetName: 'Gone',
      state: 'MarkedForDelete',
    };
    project.blackboard.globalVariables.gone = {
      id: 'gone',
      name: 'GoneVar',
      assetName: 'GoneVar',
      scope: 'Global',
      type: 'boolean',
      value: false,
      state: 'MarkedForDelete',
    };
    await writeFile(source, cliFile(project));
    const p = await preview([
      {
        op: 'transition.update',
        fsm,
        target: { id: 'go' },
        changes: {
          triggers: [{ type: 'OnEvent', eventId: { id: 'gone' } }],
          invokeEventIds: [{ id: 'gone' }],
          parameterModifiers: [
            {
              targetVariableId: { id: 'gone' },
              targetScope: 'Global',
              operation: 'Set',
              source: { type: 'Constant', value: false },
            },
          ],
        },
      },
    ]);
    expect(p.code).toBe(3);
    expect(p.result.data.newErrors.map((d: { code: string }) => d.code)).toEqual(
      expect.arrayContaining(['ERR_TRIGGER_EVT_DEL', 'ERR_INVOKE_DEL', 'ERR_VAR_DEL']),
    );
    const temp = (type: 'boolean' | 'integer', value: boolean | number) => ({
      type: 'Script',
      scriptId: { id: 'effect' },
      parameters: [
        {
          paramName: 'Arg',
          kind: 'Temporary',
          tempVariable: { name: 'Arg', type },
          source: { type: 'Constant', value },
        },
      ],
    });
    const conflict = await preview(
      [
        {
          op: 'transition.update',
          fsm,
          target: { id: 'go' },
          changes: { presentation: temp('boolean', false) },
        },
        {
          op: 'stage.update',
          target: { alias: 'root' },
          changes: { onExitPresentation: temp('integer', 0) },
        },
      ],
      { project: true },
    );
    expect(conflict.result.data.newErrors.map((d: { code: string }) => d.code)).toContain(
      'ERR_TEMP_TYPE_CONFLICT',
    );
  });
  it.each([
    [{ triggers: [] }, 'ERR_TRANS_NO_TRIGGER'],
    [{ triggers: [{ type: 'OnEvent', eventId: { id: 'missing' } }] }, 'ERR_TRIGGER_EVT'],
    [{ triggers: [{ type: 'CustomScript', scriptId: { id: 'effect' } }] }, 'ERR_SCRIPT_CATEGORY'],
    [{ invokeEventIds: [{ id: 'missing' }] }, 'ERR_INVOKE'],
    [
      {
        condition: {
          type: 'And',
          children: [{ type: 'Not', operand: { type: 'ScriptRef', scriptId: { id: 'effect' } } }],
        },
      },
      'ERR_SCRIPT_CATEGORY',
    ],
    [
      { presentation: { type: 'Script', scriptId: { id: 'deleted' }, parameters: [] } },
      'ERR_SCRIPT_DEL',
    ],
    [{ presentation: { type: 'Graph', graphId: { id: 'missing' } } }, 'ERR_PRES_GRAPH'],
    [
      {
        parameterModifiers: [
          {
            targetVariableId: { id: 'flag' },
            targetScope: 'NodeLocal',
            operation: 'Set',
            source: { type: 'Constant', value: false },
          },
        ],
      },
      'ERR_VAR_MISSING',
    ],
    [
      {
        parameterModifiers: [
          {
            targetVariableId: { id: 'flag' },
            targetScope: 'Global',
            operation: 'Multiply',
            source: { type: 'Constant', value: 2 },
          },
        ],
      },
      'ERR_MODIFIER_OPERATION',
    ],
    [
      {
        parameterModifiers: [
          {
            targetVariableId: { id: 'flag' },
            targetScope: 'Global',
            operation: 'Set',
            source: { type: 'Constant', value: 0 },
          },
        ],
      },
      'ERR_MODIFIER_SOURCE_TYPE',
    ],
    [
      {
        presentation: {
          type: 'Script',
          scriptId: { id: 'effect' },
          parameters: [
            {
              paramName: 'Enabled',
              kind: 'Temporary',
              tempVariable: { name: 'Enabled', type: 'boolean' },
              source: { type: 'Constant', value: 0 },
            },
          ],
        },
      },
      'ERR_TEMP_VALUE_TYPE',
    ],
    [
      {
        presentation: {
          type: 'Script',
          scriptId: { id: 'effect' },
          parameters: [
            {
              paramName: 'Count',
              kind: 'Temporary',
              tempVariable: { name: 'Count', type: 'integer' },
              source: { type: 'VariableRef', scope: 'Global', variableId: { id: 'flag' } },
            },
          ],
        },
      },
      'ERR_TEMP_SOURCE_TYPE',
    ],
  ])('拒绝非法迁移绑定 %j', async (changes, code) => {
    const p = await preview([{ op: 'transition.update', fsm, target: { id: 'go' }, changes }]);
    expect(p.code).toBe(3);
    expect(p.result.error.code).toBe('CANDIDATE_VALIDATION_FAILED');
    const diagnostic = p.result.data.newErrors.find((d: { code: string }) => d.code === code);
    expect(diagnostic).toBeDefined();
    expect(diagnostic.entity).toMatchObject({ id: 'go', ownerType: 'fsm', ownerId: 'door-fsm' });
    expect(await readdir(directory)).not.toContain(basename(p.receipt));
  });
  it('拒绝状态的重复资产名、错误生命周期目标、无脚本 InvokeScript；允许合法同名跨 FSM', async () => {
    const duplicate = await preview([
      { op: 'state.update', fsm, target: { id: 'done' }, changes: { assetName: 'Idle' } },
    ]);
    expect(duplicate.code).toBe(3);
    const project = cliProject();
    project.scripts.scripts.nodeLife = {
      id: 'nodeLife',
      name: 'Node life',
      assetName: 'NodeLife',
      category: 'Lifecycle',
      lifecycleType: 'Node',
      state: 'Draft',
    };
    await writeFile(source, cliFile(project));
    const invalid = await preview([
      {
        op: 'state.update',
        fsm,
        target: { id: 'idle' },
        changes: { lifecycleScriptId: { id: 'nodeLife' } },
      },
    ]);
    expect(invalid.result.data.newErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ERR_SCRIPT_TARGET' })]),
    );
    const invoke = await preview([
      {
        op: 'state.update',
        fsm,
        target: { id: 'idle' },
        changes: {
          eventListeners: [{ eventId: { id: 'open' }, action: { type: 'InvokeScript' } }],
        },
      },
    ]);
    expect(invoke.result.data.newErrors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ERR_LISTENER_INVOKE_FAIL' })]),
    );
    expect(
      (
        await preview([
          { op: 'state.update', fsm, target: { id: 'idle' }, changes: { assetName: 'Idle' } },
        ])
      ).code,
    ).toBe(0);
  });
  it('临时变量和画布参数运算规则与全局校验一致，祖先同 ID 不产生错误删除标记', () => {
    const project: ProjectData = cliProject();
    project.stageTree.stages.STAGE_1.localVariables.shared.state = 'MarkedForDelete';
    project.stateMachines['door-fsm'].transitions.go.parameterModifiers = [
      {
        targetVariableId: 'shared',
        targetScope: 'StageLocal',
        operation: 'Divide',
        source: { type: 'Constant', value: 2 },
      },
      {
        targetVariableId: 'flag',
        targetScope: 'Global',
        operation: 'Toggle',
        source: { type: 'VariableRef', scope: 'Global', variableId: 'unused-missing' },
      },
    ];
    expect(validateProject(project).filter((d) => d.level === 'error')).toEqual([]);
    expect(validateStateMachine('door-fsm', project, 'door').transitions.go.hasError).toBe(false);
    project.stateMachines['door-fsm'].transitions.go.parameterModifiers[0].source = {
      type: 'Constant',
      value: false,
    };
    expect(validateProject(project).some((d) => d.code === 'ERR_MODIFIER_SOURCE_TYPE')).toBe(true);
    expect(validateStateMachine('door-fsm', project, 'door').transitions.go.hasError).toBe(true);
  });
});
