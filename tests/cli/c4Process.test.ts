import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, readdir, rm, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import type { Plan, Operation } from '../../contracts/automation/planSchemas';
import { importProject } from '../../utils/projectImport';
import { prepareRuntimeExport } from '../../services/projectExportPreparation';
import { runCli } from './processHarness';
import { cliFile, FIXED_TIME } from './fixtures';
import { presentationProject, presentationCreationPlan } from './c4Fixtures';

let directory: string, source: string, sequence: number;
const graph = { id: 'intro' },
  leaf = { id: 'leaf' };
const id = (id: string) => ({ id });
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const run = (args: string[]) => runCli(directory, args);
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'puzzle-cli-c4-'));
  source = join(directory, '演出 工程.puzzle.json');
  sequence = 0;
  await writeFile(source, cliFile(presentationProject()), 'utf8');
  await mkdir(join(directory, 'prefs'));
});
afterEach(async () => {
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('puzzle-cli-c4-'))
    throw new Error('Unsafe cleanup path');
  await rm(target, { recursive: true, force: true });
});
async function preview(
  commands: unknown[],
  scope: Plan['scope'] = { presentations: [graph, leaf] },
) {
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
async function accepted(commands: Operation[], scope?: Plan['scope']) {
  const prepared = await preview(commands, scope);
  expect(prepared.result.error).toBeUndefined();
  expect(prepared.code).toBe(0);
  const out = join(directory, `edited-${sequence}.puzzle.json`);
  const result = await run([
    'apply',
    source,
    '--plan',
    prepared.plan,
    '--receipt',
    prepared.receipt,
    '--out',
    out,
  ]);
  expect(result.result.error).toBeUndefined();
  expect(result.code).toBe(0);
  return {
    ...result,
    prepared,
    out,
    file: JSON.parse(await readFile(out, 'utf8')),
    project: importProject(await readFile(out, 'utf8')).project,
  };
}
const disconnect: Operation = {
  op: 'presentationEdge.disconnect',
  graph,
  from: id('branch'),
  slot: 'true',
};
const callUpdate = (presentation: unknown) => ({
  op: 'presentationNode.update',
  graph: leaf,
  target: id('call'),
  changes: { presentation },
});

describe('C4 真实 CLI 演出图事务与查询', () => {
  it('从新工程创建完整图、前向 alias、共享子图、零值/布尔参数并导出往返', async () => {
    const plan = join(directory, 'create.json'),
      out = join(directory, 'new.puzzle.json');
    await writeFile(plan, JSON.stringify(presentationCreationPlan()));
    const created = await run([
      'create',
      '--name',
      'C4 Presentation',
      '--root-asset-name',
      'C4Root',
      '--plan',
      plan,
      '--out',
      out,
    ]);
    expect(created.result.error).toBeUndefined();
    expect(created.code).toBe(0);
    const aliases = created.result.data.aliases,
      project = importProject(await readFile(out, 'utf8')).project;
    const show = project.presentationGraphs[aliases.show.id];
    expect(aliases.choose).toMatchObject({ type: 'presentationNode', graphId: show.id });
    expect(show.startNodeId).toBe(aliases.choose.id);
    expect(show.nodes[aliases.choose.id].nextIds).toEqual([aliases.yes.id, aliases.no.id]);
    expect(show.nodes[aliases.yes.id].duration).toBe(0);
    expect(show.nodes[aliases.both.id].nextIds).toEqual([
      aliases.effectCall.id,
      aliases.childCall.id,
    ]);
    expect(show.nodes[aliases.effectCall.id].presentation).toMatchObject({
      parameters: [
        { source: { value: { alias: 'choose', value: false } } },
        { tempVariable: { type: 'integer' } },
      ],
    });
    expect(show).not.toHaveProperty('assetName');
    expect(show.nodes[aliases.choose.id]).not.toHaveProperty('assetName');
    const inspected = await run([
      'inspect',
      out,
      '--view',
      'presentation',
      '--id',
      aliases.leaf.id,
    ]);
    expect(inspected.result.data.result.callingContexts).toHaveLength(2);
    expect(inspected.result.data.result.callingContexts[0].graphPath).toEqual([
      aliases.show.id,
      aliases.child.id,
      aliases.leaf.id,
    ]);
    expect((await run(['validate', out])).code).toBe(0);
    const runtime = join(directory, 'new.export.json');
    expect((await run(['export', out, '--out', runtime])).code).toBe(0);
    const exported = JSON.parse(await readFile(runtime, 'utf8'));
    expect(exported.data).toEqual(
      JSON.parse(prepareRuntimeExport(project, FIXED_TIME).content!).data,
    );
    expect(
      importProject(JSON.stringify(exported)).project.presentationGraphs[show.id].nodes[
        aliases.choose.id
      ].nextIds,
    ).toEqual([aliases.yes.id, aliases.no.id]);
    expect(await readdir(join(directory, 'prefs'))).toEqual([]);
  });
  it('断开 True 不移动 False、清理对应样式，源字节/时间/编辑状态保留并可重试', async () => {
    const original = await readFile(source, 'utf8'),
      stamp = await stat(source);
    const result = await accepted([disconnect]);
    const changed = result.project.presentationGraphs.intro;
    expect(changed.nodes.branch.nextIds).toEqual(['', 'no']);
    expect(changed.edgeProperties).not.toHaveProperty('branch->yes');
    expect(changed.edgeProperties?.['branch->no']).toEqual({ fromSide: 'bottom', toSide: 'top' });
    expect(changed.nodes.finish).toEqual(
      importProject(original).project.presentationGraphs.intro.nodes.finish,
    );
    expect(result.file.editorState).toEqual(JSON.parse(original).editorState);
    expect(await readFile(source, 'utf8')).toBe(original);
    expect((await stat(source)).mtimeMs).toBe(stamp.mtimeMs);
    const published = await readFile(result.out, 'utf8');
    const repeated = await run([
      'apply',
      source,
      '--plan',
      result.prepared.plan,
      '--receipt',
      result.prepared.receipt,
      '--out',
      result.out,
    ]);
    expect(repeated.code).toBe(0);
    expect(await readFile(result.out, 'utf8')).toBe(published);
  });
  it('改接原槽保留另一端样式；样式 null 只清除指定项', async () => {
    const result = await accepted([
      {
        op: 'presentationEdge.redirect',
        graph,
        from: id('branch'),
        slot: 'true',
        to: id('finish'),
        style: { toSide: 'bottom' },
      },
      {
        op: 'presentationEdge.update',
        graph,
        from: id('branch'),
        slot: 'false',
        style: { fromSide: null },
      },
    ]);
    const changed = result.project.presentationGraphs.intro;
    expect(changed.nodes.branch.nextIds).toEqual(['finish', 'no']);
    expect(changed.edgeProperties?.['branch->finish']).toEqual({
      fromSide: 'right',
      toSide: 'bottom',
    });
    expect(changed.edgeProperties?.['branch->no']).toEqual({ toSide: 'top' });
    expect(changed.edgeProperties).not.toHaveProperty('branch->yes');
    expect(changed.nodes.call.position).toEqual({ x: 730, y: 0 });
  });
  it('Parallel 插入、删除、改接保留显式顺序', async () => {
    const result = await accepted([
      { op: 'presentationEdge.connect', graph, from: id('parallel'), slot: 1, to: id('no') },
      { op: 'presentationEdge.disconnect', graph, from: id('parallel'), slot: 0 },
      { op: 'presentationEdge.redirect', graph, from: id('parallel'), slot: 1, to: id('yes') },
    ]);
    expect(result.project.presentationGraphs.intro.nodes.parallel.nextIds).toEqual(['no', 'yes']);
  });
  it('断开后的 False 单独存在可被导出、再导入，不压缩空 True', async () => {
    const result = await accepted([disconnect]);
    const out = join(directory, 'branch.export.json');
    expect((await run(['export', result.out, '--out', out])).code).toBe(0);
    const restored = importProject(await readFile(out, 'utf8')).project;
    expect(restored.presentationGraphs.intro.nodes.branch.nextIds).toEqual(['', 'no']);
  });
  it('图内重复局部 ID 只修改指定图，入口和元数据显式编辑', async () => {
    const result = await accepted([
      {
        op: 'presentationNode.update',
        graph: leaf,
        target: id('call'),
        changes: { name: 'Renamed' },
      },
      { op: 'presentation.update', graph, changes: { description: 'Reviewed', displayOrder: 3 } },
      { op: 'presentation.setStart', graph, node: id('parallel') },
    ]);
    expect(result.project.presentationGraphs.child.nodes.call.name).toBe('Leaf Call');
    expect(result.project.presentationGraphs.leaf.nodes.call).toMatchObject({
      name: 'Renamed',
      position: { x: 20, y: 40 },
      presentation: { type: 'Script', scriptId: 'effect' },
    });
    expect(result.project.presentationGraphs.intro).toMatchObject({
      startNodeId: 'parallel',
      description: 'Reviewed',
      displayOrder: 3,
    });
  });
  it('删除节点显式清理入出边和入口；最后节点删除后为空图', async () => {
    const result = await accepted([
      {
        op: 'presentationNode.delete',
        graph,
        target: id('branch'),
        replacementStart: id('parallel'),
        deleteEdges: true,
      },
      { op: 'presentationNode.delete', graph: leaf, target: id('call') },
    ]);
    expect(result.project.presentationGraphs.intro.startNodeId).toBe('parallel');
    expect(result.project.presentationGraphs.intro.edgeProperties).not.toHaveProperty('branch->no');
    expect(result.project.presentationGraphs.leaf).toMatchObject({ startNodeId: null, nodes: {} });
  });
  it('删除 True 目标保留 False；创建图使用显式 alias scope', async () => {
    const result = await accepted([
      { op: 'presentationNode.delete', graph, target: id('yes'), deleteEdges: true },
    ]);
    expect(result.project.presentationGraphs.intro.nodes.branch.nextIds).toEqual(['', 'no']);
    const created = await accepted(
      [{ op: 'presentation.create', alias: 'newGraph', data: { name: 'New' } }],
      { presentations: [{ alias: 'newGraph' }] },
    );
    expect(created.result.data.aliases.newGraph.type).toBe('presentation');
  });
  it('显式清空类型相关字段可转换类型，不修改其坐标', async () => {
    const result = await accepted([
      {
        op: 'presentationNode.update',
        graph: leaf,
        target: id('call'),
        changes: { type: 'Wait', presentation: null, duration: 0.25 },
      },
    ]);
    expect(result.project.presentationGraphs.leaf.nodes.call).toMatchObject({
      type: 'Wait',
      duration: 0.25,
      position: { x: 20, y: 40 },
    });
  });
  it('共享子图预览列出所有直接/间接调用者和资源影响', async () => {
    const prepared = await preview([
      {
        op: 'presentationNode.update',
        graph: leaf,
        target: id('call'),
        changes: { name: 'Changed' },
      },
    ]);
    expect(prepared.code).toBe(0);
    const impact = prepared.result.data.impacts.graphs.find(
      (g: { graphId: string }) => g.graphId === 'leaf',
    );
    expect(impact).toMatchObject({ sharedBefore: true, sharedAfter: true, graphChanged: true });
    expect(impact.contextsBefore).toHaveLength(2);
    expect(impact.contextsAfter).toHaveLength(2);
    expect(impact.contextsAfter[1].caller).toMatchObject({
      nodeId: 'door',
      fsmId: 'door-fsm',
      transitionId: 'go',
    });
    expect(impact.directReferencesAfter).toHaveLength(1);
    const resource = await preview(
      [{ op: 'script.update', target: id('effect'), changes: { description: 'Changed' } }],
      { globals: ['script'] },
    );
    expect(resource.result.data.impacts.resources[0].referencesAfter).toHaveLength(2);
    expect(
      resource.result.data.impacts.graphs.map((g: { graphId: string }) => g.graphId),
    ).toContain('leaf');
  });
  it('引用查询包括嵌套条件脚本及事件派发，并报告局部变量的真正所有者', async () => {
    const project = presentationProject();
    project.presentationGraphs.leaf.nodes.call.presentation = {
      type: 'Script',
      scriptId: 'effect',
      parameters: [
        {
          paramName: 'Value',
          source: { type: 'VariableRef', scope: 'StageLocal', variableId: 'shared' },
        },
      ],
    };
    project.presentationGraphs.intro.nodes.branch.condition = {
      type: 'Not',
      operand: { type: 'And', children: [{ type: 'ScriptRef', scriptId: 'check' }] },
    };
    project.stateMachines['door-fsm'].transitions.go.invokeEventIds = ['open'];
    await writeFile(source, cliFile(project));
    const script = await run([
      'inspect',
      source,
      '--view',
      'references',
      '--type',
      'script',
      '--id',
      'check',
    ]);
    expect(script.result.data.result.total).toBe(1);
    expect(script.result.data.result.items[0].path).toContain(
      '/condition/operand/children/0/scriptId',
    );
    const event = await run([
      'inspect',
      source,
      '--view',
      'references',
      '--type',
      'event',
      '--id',
      'open',
    ]);
    expect(event.result.data.result.total).toBe(3);
    for (const owner of [project.stageTree.rootId, 'room']) {
      const result = await run([
        'inspect',
        source,
        '--view',
        'references',
        '--type',
        'variable',
        '--id',
        'shared',
        '--owner-type',
        'stage',
        '--owner-id',
        owner,
      ]);
      expect(result.result.data.result.total).toBe(1);
      const ref = result.result.data.result.items[0];
      expect(ref.ownerId).toBe(owner);
      expect(ref.contexts).toHaveLength(1);
    }
  });
});

describe('C4 拒绝非法编辑并保留源文件', () => {
  it.each([
    ['scope', [disconnect], { puzzles: [id('door')] }, 'SCOPE_VIOLATION'],
    [
      'missing node',
      [{ op: 'presentationNode.update', graph, target: id('missing'), changes: { name: 'X' } }],
      undefined,
      'ENTITY_NOT_FOUND',
    ],
    [
      'occupied True',
      [
        {
          op: 'presentationEdge.connect',
          graph,
          from: id('branch'),
          slot: 'true',
          to: id('finish'),
        },
      ],
      undefined,
      'EDGE_SLOT_OCCUPIED',
    ],
    [
      'Branch numeric slot',
      [{ op: 'presentationEdge.disconnect', graph, from: id('branch'), slot: 0 }],
      undefined,
      'EDGE_SLOT_INVALID',
    ],
    [
      'Parallel named slot',
      [{ op: 'presentationEdge.disconnect', graph, from: id('parallel'), slot: 'true' }],
      undefined,
      'EDGE_SLOT_INVALID',
    ],
    [
      'Parallel out of range',
      [{ op: 'presentationEdge.connect', graph, from: id('parallel'), slot: 9, to: id('no') }],
      undefined,
      'EDGE_SLOT_INVALID',
    ],
    [
      'ordinary named slot',
      [{ op: 'presentationEdge.disconnect', graph, from: id('yes'), slot: 'false' }],
      undefined,
      'EDGE_SLOT_INVALID',
    ],
    [
      'missing edge',
      [{ op: 'presentationEdge.disconnect', graph, from: id('finish'), slot: 'next' }],
      undefined,
      'EDGE_NOT_FOUND',
    ],
    [
      'duplicate target',
      [{ op: 'presentationEdge.redirect', graph, from: id('branch'), slot: 'true', to: id('no') }],
      undefined,
      'DUPLICATE_EDGE',
    ],
    [
      'start deletion',
      [{ op: 'presentationNode.delete', graph, target: id('branch'), deleteEdges: true }],
      undefined,
      'START_REPLACEMENT_REQUIRED',
    ],
    [
      'incident edges',
      [{ op: 'presentationNode.delete', graph, target: id('yes') }],
      undefined,
      'NODE_HAS_EDGES',
    ],
    ['in-use graph', [{ op: 'presentation.delete', graph: leaf }], undefined, 'GRAPH_IN_USE'],
    [
      'clear nonempty start',
      [{ op: 'presentation.setStart', graph, node: null }],
      undefined,
      'GRAPH_START_REQUIRED',
    ],
    [
      'type loses binding',
      [
        {
          op: 'presentationNode.update',
          graph: leaf,
          target: id('call'),
          changes: { type: 'Wait' },
        },
      ],
      undefined,
      'NODE_FIELDS_INCOMPATIBLE',
    ],
    [
      'type loses outputs',
      [{ op: 'presentationNode.update', graph, target: id('parallel'), changes: { type: 'Wait' } }],
      undefined,
      'NODE_OUTPUTS_INCOMPATIBLE',
    ],
    [
      'direct nodes write',
      [{ op: 'presentation.update', graph, changes: { nodes: {} } }],
      undefined,
      'INVALID_CONTRACT',
    ],
    [
      'direct outputs write',
      [
        {
          op: 'presentationNode.update',
          graph,
          target: id('branch'),
          changes: { nextIds: ['no'] },
        },
      ],
      undefined,
      'INVALID_CONTRACT',
    ],
    [
      'negative duration',
      [{ op: 'presentationNode.update', graph, target: id('yes'), changes: { duration: -1 } }],
      undefined,
      'INVALID_CONTRACT',
    ],
    [
      'invented asset name',
      [{ op: 'presentation.create', alias: 'g', data: { name: 'G', assetName: 'G' } }],
      { project: true },
      'INVALID_CONTRACT',
    ],
  ] as const)('%s', async (_name, commands, scope, code) => {
    const original = await readFile(source, 'utf8');
    const result = await preview([...commands], scope as Plan['scope'] | undefined);
    expect(result.code).not.toBe(0);
    expect(result.result.error.code).toBe(code);
    expect(await readFile(source, 'utf8')).toBe(original);
    expect(await readdir(directory)).not.toContain(basename(result.receipt));
  });
  it('跨图 alias、缺少新图权限明确拒绝', async () => {
    const create: Operation = {
      op: 'presentationNode.create',
      alias: 'newNode',
      graph: leaf,
      data: { name: 'New', type: 'Wait', position: { x: 0, y: 0 } },
    };
    const result = await preview([
      create,
      { op: 'presentation.setStart', graph, node: { alias: 'newNode' } },
    ]);
    expect(result.result.error.code).toBe('GRAPH_REFERENCE_MISMATCH');
    const denied = await preview(
      [{ op: 'presentation.create', alias: 'newGraph', data: { name: 'New' } }],
      {},
    );
    expect(denied.result.error.code).toBe('SCOPE_VIOLATION');
  });
  it.each([
    [
      'script category',
      { type: 'Script', scriptId: id('check'), parameters: [] },
      'ERR_SCRIPT_CATEGORY',
    ],
    [
      'missing script',
      { type: 'Script', scriptId: id('missing'), parameters: [] },
      'ERR_SCRIPT_MISSING',
    ],
    [
      'deleted script',
      { type: 'Script', scriptId: id('deleted'), parameters: [] },
      'ERR_SCRIPT_DEL',
    ],
    ['missing graph', { type: 'Graph', graphId: id('missing') }, 'ERR_PRES_GRAPH'],
    [
      'local parameter scope',
      {
        type: 'Script',
        scriptId: id('effect'),
        parameters: [
          {
            paramName: 'Value',
            source: { type: 'VariableRef', scope: 'NodeLocal', variableId: id('missing') },
          },
        ],
      },
      'ERR_VAR_MISSING',
    ],
    [
      'temporary source type',
      {
        type: 'Script',
        scriptId: id('effect'),
        parameters: [
          {
            paramName: 'Value',
            kind: 'Temporary',
            tempVariable: { name: 'Value', type: 'integer' },
            source: { type: 'VariableRef', scope: 'Global', variableId: id('flag') },
          },
        ],
      },
      'ERR_TEMP_SOURCE_TYPE',
    ],
    [
      'temporary constant type',
      {
        type: 'Script',
        scriptId: id('effect'),
        parameters: [
          {
            paramName: 'Value',
            kind: 'Temporary',
            tempVariable: { name: 'Value', type: 'integer' },
            source: { type: 'Constant', value: false },
          },
        ],
      },
      'ERR_TEMP_VALUE_TYPE',
    ],
    [
      'duplicate param',
      {
        type: 'Script',
        scriptId: id('effect'),
        parameters: [
          { paramName: 'Value', source: { type: 'Constant', value: 0 } },
          { paramName: 'Value', source: { type: 'Constant', value: 1 } },
        ],
      },
      'ERR_PARAM_DUPLICATE',
    ],
  ])('%s', async (_name, binding, code) => {
    const result = await preview([callUpdate(binding)]);
    expect(result.result.error.code).toBe('CANDIDATE_VALIDATION_FAILED');
    expect(result.result.data.newErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code,
          entity: {
            type: 'presentation-node',
            id: 'call',
            ownerType: 'presentation',
            ownerId: 'leaf',
          },
        }),
      ]),
    );
    expect(await readdir(directory)).not.toContain(basename(result.receipt));
  });
  it('递归条件中的局部变量逐个调用者验证；第二个错误不能被旧错误基线掩盖', async () => {
    const change = {
      op: 'presentationNode.update',
      graph,
      target: id('branch'),
      changes: {
        condition: {
          type: 'Not',
          operand: {
            type: 'And',
            children: [
              {
                type: 'Comparison',
                operator: '==',
                left: { type: 'VariableRef', scope: 'StageLocal', variableId: id('shared') },
                right: { type: 'Constant', value: 0 },
              },
            ],
          },
        },
      },
    };
    expect((await preview([change])).code).toBe(0);
    const project = presentationProject();
    delete project.stageTree.stages[project.stageTree.rootId].localVariables.shared;
    await writeFile(source, cliFile(project));
    expect((await preview([change])).result.error.code).toBe('CANDIDATE_VALIDATION_FAILED');
    project.presentationGraphs.intro.nodes.branch.condition = {
      type: 'Comparison',
      operator: '==',
      left: { type: 'VariableRef', scope: 'NodeLocal', variableId: 'missing' },
      right: { type: 'Constant', value: 0 },
    };
    await writeFile(source, cliFile(project));
    const result = await preview(
      [
        {
          op: 'transition.update',
          fsm: { puzzle: id('lock') },
          target: id('go'),
          changes: { presentation: { type: 'Graph', graphId: graph } },
        },
      ],
      { puzzles: [id('lock')] },
    );
    expect(
      result.result.data.newErrors.some((error: { message: string }) =>
        error.message.includes('lock-fsm'),
      ),
    ).toBe(true);
  });
  it('解除绑定后删除图、跨范围调用者修改仍需其自身权限', async () => {
    const commands: Operation[] = [
      {
        op: 'presentationNode.update',
        graph: id('child'),
        target: id('call'),
        changes: { presentation: null },
      },
      { op: 'presentation.delete', graph: leaf },
    ];
    expect((await preview(commands)).result.error.code).toBe('SCOPE_VIOLATION');
    const result = await accepted(commands, { presentations: [id('child'), leaf] });
    expect(result.project.presentationGraphs).not.toHaveProperty('leaf');
  });
  it('后续失败时不生成项目/回执；回执修改和源文件过期均拒绝 apply', async () => {
    const failure = await preview([
      disconnect,
      { op: 'presentationNode.update', graph, target: id('missing'), changes: { name: 'X' } },
    ]);
    expect(failure.result.diagnostics[0].operationIndex).toBe(1);
    expect(await readdir(directory)).not.toContain(basename(failure.receipt));
    const prepared = await preview([disconnect]),
      out = join(directory, 'denied.puzzle.json');
    const receipt = JSON.parse(await readFile(prepared.receipt, 'utf8'));
    receipt.candidateHash = '0'.repeat(64);
    await writeFile(prepared.receipt, JSON.stringify(receipt));
    expect(
      (
        await run([
          'apply',
          source,
          '--plan',
          prepared.plan,
          '--receipt',
          prepared.receipt,
          '--out',
          out,
        ])
      ).code,
    ).toBe(4);
    await writeFile(source, (await readFile(source, 'utf8')) + ' ');
    expect(
      (
        await run([
          'apply',
          source,
          '--plan',
          prepared.plan,
          '--receipt',
          prepared.receipt,
          '--out',
          out,
        ])
      ).code,
    ).toBe(4);
    expect(await readdir(directory)).not.toContain(basename(out));
  });
});
