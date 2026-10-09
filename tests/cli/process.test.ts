import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, writeFile, stat, rm, cp } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { resultSchema } from '../../contracts/automation/schemas';
import { cliFile, cliProject } from './fixtures';

let directory: string;
let sourcePath: string;
const binary = resolve('dist-cli/cli.js');

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'puzzle-cli-c1-'));
  sourcePath = join(directory, '中文 项目.puzzle.json');
  await mkdir(join(directory, 'preferences'));
  await writeFile(sourcePath, cliFile(), 'utf8');
});
afterEach(async () => {
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('puzzle-cli-c1-'))
    throw new Error('Refusing cleanup outside the isolated test directory.');
  await rm(target, { recursive: true, force: true });
});

async function run(args: string[], entry = binary) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolveRun, reject) => {
      const child = spawn(process.execPath, [entry, ...args], {
        windowsHide: true,
        cwd: directory,
        env: {
          ...process.env,
          APPDATA: join(directory, 'preferences'),
          LOCALAPPDATA: join(directory, 'preferences'),
          NO_COLOR: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const stdout: Buffer[] = [],
        stderr: Buffer[] = [];
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('CLI did not terminate within 15 seconds.'));
      }, 15000);
      child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('close', (code) => {
        clearTimeout(timeout);
        resolveRun({
          code,
          stdout: Buffer.concat(stdout).toString('utf8'),
          stderr: Buffer.concat(stderr).toString('utf8'),
        });
      });
    },
  );
}
async function json(args: string[], entry = binary) {
  const output = await run([...args, '--json'], entry);
  expect(output.stderr).toBe('');
  const result = resultSchema.parse(JSON.parse(output.stdout));
  return { ...output, result, data: result.data as Record<string, unknown> };
}

describe('编译产物的真实命令行行为', () => {
  it('帮助、能力和权限如实区分领域写与 C6 聊天授权能力', async () => {
    expect((await run(['--help'])).stdout).toContain(CLI_PHASE + ' offline');
    const { code, data } = await json(['describe']);
    expect(code).toBe(0);
    expect(data.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'json read', implemented: true, permission: 'read' }),
        expect.objectContaining({
          operation: 'json apply',
          implemented: true,
          permission: 'raw_json_write',
          requiresDirectUserConfirmation: true,
        }),
      ]),
    );
    expect(data.namingContracts).toMatchObject({
      status: 'enforced-by-domain-plan-contracts',
      schemas: { projectIdentity: { required: ['name', 'rootAssetName'] } },
    });
  });

  it('完整读取保留未知字段、文件封装和 editorState，源文件/偏好零修改', async () => {
    const content =
      '\uFEFF' +
      JSON.stringify(
        { ...JSON.parse(cliFile()), future: { zero: 0, flag: false, text: '中文' } },
        null,
        3,
      ) +
      '\r\n';
    await writeFile(sourcePath, content, 'utf8');
    const before = await stat(sourcePath);
    const output = await json(['json', 'read', sourcePath]);
    expect(output.code).toBe(0);
    expect(output.data).toMatchObject({
      rawText: content,
      parsedAvailable: true,
      source: { sha256: createHash('sha256').update(content).digest('hex') },
      file: {
        fileType: 'puzzle-project',
        future: { zero: 0, flag: false },
        editorState: { currentNodeId: 'door' },
      },
    });
    expect(await readFile(sourcePath, 'utf8')).toBe(content);
    expect((await stat(sourcePath)).mtimeMs).toBe(before.mtimeMs);
    expect(await readdir(directory)).toEqual(['preferences', '中文 项目.puzzle.json']);
    expect(await readdir(join(directory, 'preferences'))).toEqual([]);
    const validation = await json(['validate', sourcePath]);
    expect(validation.code).toBe(3);
    expect(validation.result.error).toMatchObject({
      code: 'PROJECT_STRUCTURE_INVALID',
      path: '$.future',
    });
  });

  it('原文模式逐字输出，损坏 JSON 仍可读取且不追加换行', async () => {
    const text = '\uFEFF{"broken": false, "中文":';
    await writeFile(sourcePath, text, 'utf8');
    expect(await run(['json', 'read', sourcePath, '--raw'])).toEqual({
      code: 0,
      stdout: text,
      stderr: '',
    });
    const structured = await json(['json', 'read', sourcePath]);
    expect(structured.code).toBe(3);
    expect(structured.result.error?.code).toBe('INVALID_JSON');
  });

  it('结构歧义原文完整保留，结构化工程操作拒绝静默接受', async () => {
    const text = '{"a":1,"a":2,"value":9007199254740993}';
    await writeFile(sourcePath, text, 'utf8');
    const read = await json(['json', 'read', sourcePath]);
    expect(read.code).toBe(0);
    expect(read.data).toMatchObject({ rawText: text, file: null, parsedAvailable: false });
    expect(read.result.diagnostics.map((item) => item.code)).toEqual([
      'JSON_DUPLICATE_KEY',
      'JSON_NUMBER_PRECISION',
    ]);
    expect((await json(['inspect', sourcePath])).result.error?.code).toBe('AMBIGUOUS_JSON');
  });

  it('大文件经过 stdout 管道仍完整返回', async () => {
    const content = JSON.stringify({ text: '中文 field\n'.repeat(180000) });
    await writeFile(sourcePath, content, 'utf8');
    const raw = await run(['json', 'read', sourcePath, '--raw']);
    expect(raw.code).toBe(0);
    expect(raw.stdout).toBe(content);
    expect(raw.stderr).toBe('');
    const structured = await json(['json', 'read', sourcePath]);
    expect(structured.data.rawText).toBe(content);
  }, 20000);

  it('中文空格及长路径读取均不依赖 shell 拼接', async () => {
    let parent = directory;
    for (let index = 0; index < 5; index++)
      parent = join(parent, 'long segment 中文 ' + 'x'.repeat(45));
    await mkdir(parent, { recursive: true });
    const path = join(parent, '深层 工程.puzzle.json');
    await writeFile(path, cliFile(), 'utf8');
    expect((await json(['validate', path])).code).toBe(0);
  });

  it('非法 UTF-8 和不存在路径有稳定错误及原文错误通道', async () => {
    await writeFile(sourcePath, Buffer.from([0xc3, 0x28]));
    const result = await json(['json', 'read', sourcePath]);
    expect(result.code).toBe(3);
    expect(result.result.error?.code).toBe('INVALID_UTF8');
    const raw = await run(['json', 'read', sourcePath, '--raw']);
    expect(raw.stdout).toBe('');
    expect(JSON.parse(raw.stderr)).toMatchObject({ error: { code: 'INVALID_UTF8' } });
    const missing = await json(['inspect', join(directory, 'missing.puzzle.json')]);
    expect(missing.code).toBe(5);
    expect(missing.result.error?.code).toBe('IO_ERROR');
  });

  it.each([
    ['inspect', '--limit', '10'],
    ['inspect', '--view', 'unknown'],
    ['inspect', '--view', 'entities', '--limit', '-1'],
    ['inspect', '--view', 'tree', '--view', 'tree'],
    ['inspect', '--no-such-option'],
    ['validate', '--raw'],
  ])('非法参数退出 2 且不写文件 %j', async (...args) => {
    const [command, ...options] = args;
    const result = await json([command, sourcePath, ...options]);
    expect(result.code).toBe(2);
    expect(result.result.ok).toBe(false);
  });

  it.each([
    ['json', 'preview'],
    ['json', 'apply'],
  ])('备用入口拒绝未经定义的强制参数 %j', async (...command) => {
    const original = await readFile(sourcePath);
    expect((await json([...command, sourcePath, '--force'])).result.error?.code).toBe(
      'INVALID_ARGUMENT',
    );
    expect(await readFile(sourcePath)).toEqual(original);
    expect(await readdir(directory)).toHaveLength(2);
  });

  it('独立产物移出仓库，没有源码/node_modules/GUI 仍能运行', async () => {
    const isolated = join(directory, 'standalone');
    await cp(resolve('dist-cli'), isolated, { recursive: true });
    expect(await readdir(isolated)).toEqual(['cli.js', 'package.json']);
    const result = await json(['inspect', sourcePath], join(isolated, 'cli.js'));
    expect(result.code).toBe(0);
    expect(result.data).toMatchObject({ result: { counts: { stage: 2, puzzle: 2, fsm: 2 } } });
  });
});

describe('领域查询、上下文和机器诊断', () => {
  it('树深度/列表分页有明确边界，指纹变化后拒绝后续页', async () => {
    const tree = await json(['inspect', sourcePath, '--view', 'tree', '--depth', '0']);
    expect(tree.data.result).toMatchObject({
      total: 1,
      items: [{ depth: 0, truncated: true, childrenIds: ['room'] }],
    });
    const page = await json([
      'inspect',
      sourcePath,
      '--view',
      'entities',
      '--type',
      'state',
      '--limit',
      '1',
    ]);
    expect(page.data.result).toMatchObject({ total: 4, nextOffset: 1 });
    const hash = (page.data.source as { sha256: string }).sha256;
    expect(
      (
        await json([
          'inspect',
          sourcePath,
          '--view',
          'entities',
          '--type',
          'state',
          '--limit',
          '1',
          '--offset',
          '1',
          '--expected-hash',
          hash,
        ])
      ).code,
    ).toBe(0);
    await writeFile(sourcePath, cliFile() + '\n', 'utf8');
    const stale = await json([
      'inspect',
      sourcePath,
      '--view',
      'entities',
      '--offset',
      '1',
      '--expected-hash',
      hash,
    ]);
    expect(stale.code).toBe(4);
    expect(stale.result.error?.code).toBe('REVISION_CONFLICT');
  });

  it('相同局部 ID 返回歧义，指定 FSM 所属后准确定位', async () => {
    const ambiguous = await json([
      'inspect',
      sourcePath,
      '--view',
      'entities',
      '--type',
      'state',
      '--id',
      'idle',
    ]);
    expect(ambiguous.result.error?.code).toBe('AMBIGUOUS_ENTITY');
    expect(ambiguous.data.candidates).toHaveLength(2);
    const result = await json([
      'inspect',
      sourcePath,
      '--view',
      'entities',
      '--type',
      'state',
      '--id',
      'idle',
      '--owner-type',
      'fsm',
      '--owner-id',
      'door-fsm',
    ]);
    expect(result.data.result).toMatchObject({
      entity: { ref: { ownerId: 'door-fsm' }, value: { assetName: 'Idle' } },
    });
  });

  it('FSM/演出图详情保留完整字段，引用查询复用编辑器扫描', async () => {
    const fsm = await json(['inspect', sourcePath, '--view', 'fsm', '--id', 'door-fsm']);
    expect(fsm.data.result).toMatchObject({
      owners: [{ nodeId: 'door', stageId: 'room' }],
      entity: {
        value: {
          initialStateId: 'idle',
          transitions: { go: { priority: 0, condition: { right: { value: false } } } },
        },
      },
    });
    const graph = await json(['inspect', sourcePath, '--view', 'presentation', '--id', 'intro']);
    expect(graph.data.result).toMatchObject({
      entity: { value: { startNodeId: 'start', nodes: { start: { nextIds: [] } } } },
    });
    const refs = await json([
      'inspect',
      sourcePath,
      '--view',
      'references',
      '--type',
      'event',
      '--id',
      'open',
    ]);
    expect(refs.data.result).toMatchObject({ total: 2 });
  });

  it('可见变量保留实际所属、false/0，绑定目录排除待删除资源', async () => {
    const variables = await json([
      'inspect',
      sourcePath,
      '--view',
      'variables',
      '--node-id',
      'door',
    ]);
    expect(variables.data.result).toMatchObject({
      total: 2,
      items: expect.arrayContaining([
        expect.objectContaining({
          ref: { type: 'variable', id: 'shared', ownerType: 'stage', ownerId: 'room' },
          value: expect.objectContaining({ value: 1 }),
        }),
        expect.objectContaining({
          ref: expect.objectContaining({ id: 'flag' }),
          value: expect.objectContaining({ value: false }),
        }),
      ]),
    });
    const bindings = await json(['inspect', sourcePath, '--view', 'bindings', '--type', 'script']);
    expect(bindings.data.result).toMatchObject({
      requiresContextValidation: true,
      total: 1,
      items: [{ ref: { id: 'effect' } }],
    });
  });

  it('inspect 接受既有业务错误，validate 返回可定位的稳定代码和退出 3', async () => {
    const project = cliProject();
    delete project.stateMachines['door-fsm'].states.idle.assetName;
    await writeFile(sourcePath, cliFile(project), 'utf8');
    const inspect = await json(['inspect', sourcePath]);
    expect(inspect.code).toBe(0);
    const validation = await json(['validate', sourcePath]);
    expect(validation.code).toBe(3);
    expect(validation.result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'ASSET_NAME_REQUIRED',
        path: '/stateMachines/door-fsm/states/idle/assetName',
        entity: { type: 'state', id: 'idle', ownerType: 'fsm', ownerId: 'door-fsm' },
      }),
    );
  });

  it('警告默认成功，warnings-as-errors 只升级退出策略', async () => {
    const project = cliProject();
    delete project.stageTree.stages[project.stageTree.rootId].onEnterPresentation;
    await writeFile(sourcePath, cliFile(project), 'utf8');
    expect((await json(['validate', sourcePath])).code).toBe(0);
    const strict = await json(['validate', sourcePath, '--warnings-as-errors']);
    expect(strict.code).toBe(3);
    expect(strict.result.error?.code).toBe('WARNINGS_AS_ERRORS');
    expect(strict.data).toMatchObject({ valid: true, errors: 0, warnings: 1 });
  });

  it('父链/子链环不会让校验、变量或引用查询无限运行', async () => {
    const project = cliProject();
    const root = project.stageTree.stages[project.stageTree.rootId];
    root.parentId = 'room';
    project.stageTree.stages.room.childrenIds = [root.id];
    project.stateMachines['door-fsm'].transitions.go.condition = {
      type: 'Comparison',
      operator: '==',
      left: { type: 'VariableRef', variableId: 'absent', scope: 'StageLocal' },
      right: { type: 'Constant', value: 0 },
    };
    await writeFile(sourcePath, cliFile(project), 'utf8');
    const validation = await json(['validate', sourcePath]);
    expect(validation.result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'PROJECT_STRUCTURE_INVALID' }),
    );
    expect(
      (await json(['inspect', sourcePath, '--view', 'variables', '--node-id', 'door'])).code,
    ).toBe(3);
    expect(
      (
        await json([
          'inspect',
          sourcePath,
          '--view',
          'references',
          '--type',
          'variable',
          '--id',
          'shared',
          '--owner-type',
          'stage',
          '--owner-id',
          root.id,
        ])
      ).code,
    ).toBe(3);
    expect((await run(['json', 'read', sourcePath, '--raw'])).stdout).toBe(cliFile(project));
  });
});
import { CLI_PHASE } from '../../contracts/automation/capabilities';
