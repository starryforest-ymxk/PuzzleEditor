/** 公开资料的示例通过真实编译 CLI 执行，断言工程效果、授权拒绝和源文件保留。 */
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { capabilities } from '../../contracts/automation/capabilities';
import { commandExamples } from '../../contracts/automation/commandExamples';
import { commandArguments, type CommandName } from '../../cli/argumentContract';
import { parseCommand, helpText } from '../../cli/arguments';
import { operationExamples, exampleFile } from '../../scripts/cli-reference-examples';
import { generatedReferenceFiles } from '../../scripts/cli-docs';
import { publicSkillFiles, validateReferenceLinks } from '../../services/cliTooling/referenceFiles';
import { runCli } from './processHarness';

let directory: string;
const content = exampleFile();
const hash = createHash('sha256').update(content).digest('hex');
beforeAll(async () => {
  directory = await fs.mkdtemp(path.join(tmpdir(), 'puzzle-reference 中文 '));
  await fs.writeFile(path.join(directory, 'sample.puzzle.json'), content);
});
afterAll(async () => {
  expect(await fs.readFile(path.join(directory, 'sample.puzzle.json'), 'utf8')).toBe(content);
  if (
    path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) ||
    !path.basename(directory).startsWith('puzzle-reference ')
  )
    throw new Error('Unsafe example cleanup');
  await fs.rm(directory, { recursive: true, force: true });
});

describe('公开命令契约和帮助', () => {
  it.each(capabilities.map((entry) => entry.operation as CommandName))(
    '%s 示例通过实际参数解析，帮助包含同一语法',
    (name) => {
      const values: Record<string, string> = {
        $instance: '11111111-1111-4111-8111-111111111111',
        $session: '1',
        $requestId: Date.now() + ':11111111-1111-4111-8111-111111111111',
        $entryId: '1:1',
      };
      const args = (commandExamples[name].match(/"[^"]*"|\S+/gu) ?? [])
        .slice(1)
        .map((value) => values[value] ?? value.replace(/^"|"$/gu, ''));
      expect(parseCommand(args)).toMatchObject({ kind: 'command', operation: name });
      const help = helpText(name);
      for (const argument of commandArguments(name)) expect(help).toContain(argument.flag + ':');
      if (name === 'skills read') expect(help).not.toContain('--name');
      expect(parseCommand([...name.split(' '), '--help'])).toEqual({
        kind: 'help',
        operation: name,
      });
    },
  );
  it('生成页、整个安装文件集合和链接保持一致', async () => {
    for (const [name, text] of Object.entries(generatedReferenceFiles()))
      expect(await fs.readFile(path.join('overview/dev/cli-reference', name), 'utf8')).toBe(text);
    const files = await publicSkillFiles(path.resolve('.'));
    expect(() => validateReferenceLinks(files)).not.toThrow();
    expect(() =>
      validateReferenceLinks({ ...files, 'SKILL.md': '[escape](../../private.md)' }),
    ).toThrow();
    expect(() =>
      validateReferenceLinks({
        ...files,
        'SKILL.md': '[missing](references/workflows.md#missing)',
      }),
    ).toThrow();
  });
});

describe('全部领域文档示例的真实结果', () => {
  it.each(Object.entries(operationExamples))('%s', async (name, example) => {
    const plan = {
      apiVersion: '1.0.0',
      sourceHash: hash,
      scope: { project: true },
      commands: example.commands,
    };
    const planPath = name + '.plan.json',
      receipt = name + '.receipt.json',
      output = name + '.puzzle.json';
    await fs.writeFile(path.join(directory, planPath), JSON.stringify(plan));
    const preview = await runCli(directory, [
      'preview',
      'sample.puzzle.json',
      '--plan',
      planPath,
      '--receipt-out',
      receipt,
    ]);
    expect(preview.code, JSON.stringify(preview.result)).toBe(0);
    const args = [
      'apply',
      'sample.puzzle.json',
      '--plan',
      planPath,
      '--receipt',
      receipt,
      '--out',
      output,
    ];
    if (name.endsWith('.purge')) {
      const denied = await runCli(directory, args);
      expect(denied.code).toBe(6);
      expect(await fs.stat(path.join(directory, output)).catch(() => null)).toBe(null);
      args.push('--allow-permanent-delete'); // 测试夹具的能力声明，不授权真实用户工程。
    }
    const applied = await runCli(directory, args);
    expect(applied.code, JSON.stringify(applied.result)).toBe(0);
    const file = JSON.parse(await fs.readFile(path.join(directory, output), 'utf8'));
    const parts = example.expected.pointer
      .slice(1)
      .split('/')
      .map((part) =>
        part.startsWith('$') ? preview.result.data.receipt.allocations[part.slice(1)].id : part,
      );
    let actual: unknown = file.project;
    for (const part of parts)
      actual = actual === undefined ? undefined : (actual as Record<string, unknown>)[part];
    if (example.expected.absent) expect(actual).toBeUndefined();
    else expect(actual).toEqual(example.expected.value);
    if (name === 'stage.delete') {
      expect(file.project.stageTree.stages.child).toBeUndefined();
      expect(file.project.nodes.door).toBeUndefined();
      expect(file.project.stateMachines['door-fsm']).toBeUndefined();
      expect(file.project.presentationGraphs.show).toBeDefined();
    }
    if (name === 'puzzle.delete') expect(file.project.stateMachines['door-fsm']).toBeUndefined();
    const validation = await runCli(directory, ['validate', output]);
    expect(validation.code, JSON.stringify(validation.result)).toBe(0);
  });
});

describe.skipIf(process.platform !== 'win32')('随包 PowerShell 教程', () => {
  it.each([
    'quick-start',
    'advanced',
    'domain-operation',
    'mark-restore',
    'overwrite',
    'raw',
    'raw-overwrite',
  ])(
    '%s 可直接执行，源工程另存',
    async (name) => {
      const runner = path.join(directory, 'puzzle.cmd');
      await fs.writeFile(
        runner,
        '@echo off\r\n"%PUZZLE_DOC_NODE%" "%PUZZLE_DOC_ENTRY%" %*\r\nexit /b %errorlevel%\r\n',
      );
      const authorized = ['mark-restore', 'overwrite', 'raw', 'raw-overwrite'].includes(name);
      const args = [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.resolve(
          'overview/dev/cli-reference/examples/' + (authorized ? 'authorized' : name) + '.ps1',
        ),
        '-Puzzle',
        runner,
        '-WorkDirectory',
        path.join(directory, name),
      ];
      if (authorized) args.push('-Mode', name);
      if (name.includes('overwrite')) args.push('-AllowOverwrite');
      if (name.startsWith('raw')) args.push('-AllowRawJsonWrite');
      if (name === 'domain-operation') args.push('-Operation', 'stage.move');
      const result = spawnSync('powershell.exe', args, {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
        env: {
          ...process.env,
          PUZZLE_DOC_NODE: process.execPath,
          PUZZLE_DOC_ENTRY: path.resolve('dist-cli/cli.js'),
        },
      });
      expect(result.status, result.stderr + result.stdout).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report.validated).toBe(true);
      const file = JSON.parse(await fs.readFile(report.output, 'utf8'));
      if (name === 'mark-restore') {
        expect(file.project.blackboard.globalVariables.implemented.state).toBe('Implemented');
        const marked = JSON.parse(
          await fs.readFile(path.join(directory, name, 'variable.delete.puzzle.json'), 'utf8'),
        );
        expect(marked.project.blackboard.globalVariables.implemented.state).toBe('MarkedForDelete');
      }
      if (name.startsWith('raw'))
        expect(file.project.meta.description).toBe('Authorized raw tutorial');
      if (name === 'overwrite')
        expect(file.project.meta.description).toBe('Authorized overwrite tutorial');
      if (name.includes('overwrite')) expect(report.result.backup.path).toBeTruthy();
      if (name === 'quick-start') {
        expect(file.project.stageTree.stages[file.project.stageTree.rootId].description).toBe(
          'Edited through the CLI',
        );
        const original = JSON.parse(await fs.readFile(report.source, 'utf8'));
        expect(
          original.project.stageTree.stages[original.project.stageTree.rootId].description,
        ).not.toBe('Edited through the CLI');
      }
      if (name === 'advanced') {
        const aliases = report.aliases;
        expect(file.project.stageTree.stages[aliases.room.id].parentId).toBe(aliases.floor.id);
        expect(file.project.nodes[aliases.door.id].stageId).toBe(aliases.room.id);
        const fsm = file.project.stateMachines[file.project.nodes[aliases.door.id].stateMachineId];
        expect(fsm.transitions[aliases.go.id].condition.type).toBe('And');
        const graph = file.project.presentationGraphs[aliases.intro.id];
        expect(graph.nodes[aliases.branch.id].nextIds).toHaveLength(2);
        expect(graph.nodes[aliases.parallel.id].nextIds).toHaveLength(2);
        const imported = JSON.parse(await fs.readFile(report.converted, 'utf8'));
        expect(imported.project.stageTree.stages[imported.project.stageTree.rootId].assetName).toBe(
          'ImportedRoot',
        );
      }
    },
    60000,
  );
});
