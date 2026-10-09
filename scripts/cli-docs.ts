/** 结构从真实契约生成；语义和示例保留唯一来源，检查模式不会写入受管文档。 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { capabilities, describeCapabilities } from '../contracts/automation/capabilities';
import { jsonSchema, inputSchemas } from '../contracts/automation/schemas';
import { operationSchema, planSchema } from '../contracts/automation/planSchemas';
import { commandExamples } from '../contracts/automation/commandExamples';
import {
  commandReference,
  argumentDescriptions,
  commandRules,
  commandErrors,
} from '../cli/referenceMetadata';
import {
  commandUsage,
  commandArguments,
  schemaLabel,
  schemaConstraints,
  inspectViewArguments,
  flagName,
  type CommandName,
  type JsonShape,
} from '../cli/argumentContract';
import { exampleFile, operationExamples } from './cli-reference-examples';

const root = path.resolve('overview/dev/cli-reference');
const tableCell = (value: string) => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
const fence = (language: string, content: string) =>
  '\n```' + language + '\n' + content + '\n```\n';
const anchor = (name: string) => name.replaceAll(' ', '-').replaceAll('.', '-');
const commandGroup = (name: string) =>
  /^(session|history) /.test(name)
    ? 'session'
    : /^(setup|skills|config) /.test(name) || ['doctor', 'version'].includes(name)
      ? 'tooling'
      : 'files';
const operationGroup = (name: string) =>
  /^(project|stage|puzzle)\./.test(name)
    ? 'hierarchy'
    : /^(variable|event|script)\./.test(name)
      ? 'resources'
      : /^(state|fsm|transition)\./.test(name)
        ? 'fsm'
        : 'presentation';

const fieldMeaning: Record<string, string> = {
  op: '操作类型，使用这里的固定值。',
  alias: '同计划新实体的唯一引用名；不是 assetName。',
  target: '要修改的现有实体或同计划 alias。',
  parent: '目标父 Stage。',
  stage: '所属或目标 Stage。',
  owner: '变量当前所属作用域。',
  destination: '变量移动后的作用域。',
  fsm: 'FSM ID，或通过所属 Puzzle 定位。',
  graph: '所属演出图。',
  state: '本 FSM 中的初始状态。',
  node: '本图起点节点，null 表示清空。',
  from: '来源状态或图节点。',
  to: '目标状态或图节点。',
  index: '从 0 开始的位置。',
  order: '完整顺序，必须包括该归属下所有成员。',
  data: '创建内容，必须提供其中的必填字段。',
  changes: '白名单修改；省略保留，数组完整替换，只有允许 null 的字段可用 null 清除。',
  initialState: '随 Puzzle 创建的初始状态；名称和资产名必须明确。',
  cascade: '明确允许删除非空 Stage 的子内容。',
  replacementInitialState: '删除初始状态时指定仍存在的替代状态。',
  deleteTransitions: '明确删除该状态关联的迁移。',
  replacementStart: '删除起点时指定替代节点。',
  deleteEdges: '明确删除节点关联的边。',
  slot: '普通节点 next；分支 true/false；并行节点使用从 0 开始的索引。',
  style: '连线方向属性。',
  fromSide: '来源连接方向；null 清除。',
  toSide: '目标连接方向；null 清除。',
  id: '现有实体 ID；不同 owner 下不能互换。',
  ref: '作用域所属实体引用。',
  name: '显示名称。',
  assetName: '调用方明确给定的资产名，禁止自动生成或翻译。',
  description: '说明文字。',
  version: '工程展示版本，不是文件协议版本。',
  exportFileName: '导出文件名称偏好。',
  exportPath: '导出目录偏好。',
  lifecycleScriptId: '分类和目标匹配的生命周期脚本引用。',
  eventListeners: '事件监听器完整数组。',
  unlockTriggers: '解锁触发器完整数组。',
  unlockCondition: '解锁条件表达式；null 清除。',
  onEnterPresentation: '进入 Stage 的演出绑定；null 清除。',
  onExitPresentation: '退出 Stage 的演出绑定；null 清除。',
  type: '此对象的判别类型，按列出的枚举选择。',
  value: '变量值或常量；变量值须与声明类型相容。',
  displayOrder: '非负显示排序序号。',
  category: '脚本分类，必须与调用位置匹配。',
  lifecycleType: 'Lifecycle 脚本的 Stage/Node/State 目标。',
  position: '画布坐标；不控制导航或用户偏好。',
  x: '水平坐标。',
  y: '垂直坐标。',
  priority: '迁移优先级，非负整数。',
  triggers: '触发器完整数组。',
  condition: '条件表达式，详见共用结构。',
  presentation: 'Script/Graph 演出绑定。',
  invokeEventIds: '迁移调用的事件引用完整数组。',
  parameterModifiers: '变量修改器完整数组。',
  duration: 'Wait 节点等待时间，非负。',
  children: 'And/Or 子表达式数组，不为空。',
  operand: 'Not 的单一表达式。',
  operator: '比较运算符。',
  left: '比较左操作数。',
  right: '比较右操作数。',
  scriptId: '匹配类别的脚本引用。',
  variableId: '变量引用，结合 scope 判断可见性。',
  scope: '变量读取/写入的作用域类别。',
  eventId: '事件引用。',
  targetVariableId: '被修改变量引用。',
  targetScope: '被修改变量作用域。',
  operation: '参数运算；必须适用于变量类型。',
  source: '常量或变量来源。',
  action: '事件响应动作。',
  modifiers: '变量修改器数组。',
  parameters: '脚本参数完整数组。',
  paramName: '参数名，遵守资产标识格式。',
  kind: 'Temporary 参数判别标记。',
  tempVariable: '临时参数声明。',
  graphId: '共享演出图引用。',
  puzzle: '通过 Puzzle 引用定位其 FSM。',
};

function fieldsTable(schema: JsonShape, prefix = '', depth = 0): string[] {
  if (depth > 7) return [];
  const lines: string[] = [];
  for (const [field, value] of Object.entries(schema.properties ?? {})) {
    const meaning = fieldMeaning[field];
    if (!meaning) throw new Error('Missing field explanation: ' + prefix + field);
    lines.push(
      '| `' +
        prefix +
        field +
        '` | ' +
        tableCell(schemaLabel(value)) +
        ' | ' +
        (schema.required?.includes(field) ? '必填' : '可选') +
        ' | ' +
        tableCell(meaning + ' ' + schemaConstraints(value)) +
        ' |',
    );
    if (value.properties) lines.push(...fieldsTable(value, prefix + field + '.', depth + 1));
    // 递归/联合结构另附原始 Schema 和共用结构参考，不无限展开条件树。
  }
  return lines;
}

export function generatedReferenceFiles() {
  const files: Record<string, string> = {};
  const names = capabilities.map((entry) => entry.operation).sort();
  if (
    JSON.stringify(names) !== JSON.stringify(Object.keys(commandReference).sort()) ||
    JSON.stringify(names) !== JSON.stringify(Object.keys(commandExamples).sort())
  )
    throw new Error('Command documentation coverage differs from capabilities.');
  for (const group of ['tooling', 'files', 'session']) {
    let doc =
      '# ' +
      { tooling: '环境与工具命令', files: '工程文件命令', session: '桌面会话与历史命令' }[group] +
      '\n\n[返回使用指南](cli-guide.md) · [权限与错误](permissions-errors.md)\n\n';
    doc +=
      '每个示例列出一次调用。需要的工程、计划、token、回执和 PowerShell 变量须按[快速入门](quick-start.md)或[完整教程](workflows.md)准备。示例路径按实际包位置替换；高权限示例仅在已有相应聊天授权时执行。\n\n';
    const entries = capabilities.filter((entry) => commandGroup(entry.operation) === group);
    doc +=
      entries
        .map((entry) => '- [' + entry.operation + '](#' + anchor(entry.operation) + ')')
        .join('\n') + '\n';
    for (const entry of entries) {
      const name = entry.operation as CommandName;
      doc +=
        '\n<a id="' +
        anchor(name) +
        '"></a>\n## ' +
        name +
        '\n\n' +
        commandReference[name][0] +
        '\n';
      doc += fence('text', commandUsage(name));
      doc += '\n| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |\n|---|---|---|---|\n';
      for (const arg of commandArguments(name)) {
        if (!argumentDescriptions[arg.field])
          throw new Error('Missing argument explanation: ' + arg.field);
        doc +=
          '| `' +
          arg.flag +
          '` | ' +
          tableCell(schemaLabel(arg.definition)) +
          ' | ' +
          (arg.required ? '必填' : '可选') +
          (arg.definition.default === undefined
            ? ''
            : '；默认 `' + JSON.stringify(arg.definition.default) + '`') +
          ' | ' +
          tableCell(argumentDescriptions[arg.field][0] + ' ' + schemaConstraints(arg.definition)) +
          ' |\n';
      }
      doc +=
        '| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |\n| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |\n';
      const rules = commandRules(name);
      if (rules.length)
        doc += '\n前置条件与组合规则：\n\n' + rules.map(([rule]) => '- ' + rule).join('\n') + '\n';
      doc +=
        '\n权限与副作用：`' +
        entry.permission +
        '`。' +
        (entry.permission === 'environment_write'
          ? '明确修改工具安装、Skill 或用户 PATH；dry-run 不写入。'
          : entry.permission === 'read'
            ? '不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。'
            : '操作效果见本条用途；提交必须检查实际 requiredCapabilities，普通编辑许可不包含三项最高权限。') +
        '\n';
      doc += fence('powershell', commandExamples[name]);
      doc +=
        '\n结果检查：' +
        commandReference[name][1] +
        '\n\n常见失败与处理：\n\n' +
        commandErrors(name)
          .map((error) => '- ' + error)
          .join('\n') +
        '\n';
      if (name === 'inspect' || name === 'session inspect') {
        doc += '\n| view | 允许的查询选项 |\n|---|---|\n';
        for (const [view, fields] of Object.entries(inspectViewArguments)) {
          if (view === 'project' && name === 'inspect') continue;
          doc +=
            '| `' +
            view +
            '` | ' +
            (fields.map((field) => '`--' + flagName(field) + '`').join('、') || '无过滤参数') +
            ' |\n';
        }
        doc +=
          '\nreferences 要求 type/id；bindings 的 type 只接受 script/event/presentation。默认值由 Schema 注入不表示可以在其他视图显式传入这些选项。\n';
      }
    }
    if (group === 'tooling')
      doc +=
        '\n## 配置、升级与卸载说明\n\n默认受管根为 %LOCALAPPDATA%/StarryTree/PuzzleEditorCLI，自定义安装使用 --install-root。安装只追加稳定 bin 入口到当前用户 PATH；不要单独移动启动器。升级使用完整新包，核验后激活，保留旧版本。启动器损坏时从完整解压包执行修复。\n\n可选配置是安装根下 config.json，唯一格式为 {"schemaVersion":1,"desktopExecutable":"..."}，desktopExecutable 可省略。优先级：--config > PUZZLE_EDITOR_CLI_CONFIG > 默认路径；PUZZLE_EDITOR_DESKTOP_EXECUTABLE > 配置字段。配置内相对路径按配置目录解析。只用于诊断，不启动桌面，不存授权或 secret，无 config set/unset；普通工程命令不加载可选配置。会话目录沿用 PUZZLE_EDITOR_SESSION_DIR。\n\n实际卸载使用外部 PowerShell：\n' +
        fence(
          'powershell',
          '$entry = (puzzle setup status --json | ConvertFrom-Json).data.uninstallEntry\npowershell -NoProfile -ExecutionPolicy Bypass -File $entry',
        ) +
        '\n未安装的便携包也可使用 uninstall-cli.ps1 --install-root 指定根。卸载保留用户配置及独立 Skill 记录；Skill 使用 skills uninstall 单独管理。doctor 可选项目未配置显示 skip，不等同失败；有 fail 才退出 3。\n';
    files['commands-' + group + '.md'] = doc;
  }
  const sample = exampleFile();
  const hash = createHash('sha256').update(sample).digest('hex');
  const plans: Record<string, unknown> = {};
  const operationJson = jsonSchema(operationSchema) as JsonShape;
  const variants = operationJson.oneOf ?? operationJson.anyOf ?? [];
  if (
    JSON.stringify(variants.map((v) => v.properties?.op.const).sort()) !==
    JSON.stringify(Object.keys(operationExamples).sort())
  )
    throw new Error('Domain operation documentation coverage differs from schema.');
  for (const group of ['hierarchy', 'resources', 'fsm', 'presentation']) {
    let doc =
      '# ' +
      {
        hierarchy: '工程与层级操作',
        resources: '变量、事件和脚本操作',
        fsm: 'FSM 操作',
        presentation: '演出图操作',
      }[group] +
      '\n\n[返回使用指南](cli-guide.md) · [共用数据结构](data-structures.md) · [执行示例](workflows.md#domain-examples)\n\n';
    doc +=
      '以下是领域计划中的操作，交给 preview/apply 执行，不是独立 shell 子命令。每个完整计划都以随包 [sample.puzzle.json](examples/sample.puzzle.json) 为源，使用固定的虚构资产名称。真实工程先 inspect，再替换目标和 sourceHash，收紧 scope。不要把示例 ID 当作任意工程的 ID。\n\n';
    const examples = Object.entries(operationExamples).filter(
      ([name]) => operationGroup(name) === group,
    );
    doc += examples.map(([name]) => '- [' + name + '](#' + anchor(name) + ')').join('\n') + '\n';
    for (const [name, example] of examples) {
      const plan = {
        apiVersion: '1.0.0',
        sourceHash: hash,
        scope: { project: true },
        commands: example.commands,
      };
      planSchema.parse(plan);
      plans[name] = plan;
      const shape = variants.find((value) => value.properties?.op.const === name)!;
      doc +=
        '\n<a id="' +
        anchor(name) +
        '"></a>\n## ' +
        name +
        '\n\n' +
        example.purpose +
        '\n\n' +
        example.notes +
        '\n\n';
      doc +=
        '作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。\n\n';
      doc +=
        '权限：' +
        (name.endsWith('.purge')
          ? '需要已有 permanent_resource_delete 聊天授权，apply 声明 --allow-permanent-delete。'
          : '普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。') +
        '\n\n';
      doc +=
        '| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |\n|---|---|---|---|\n' +
        fieldsTable(shape).join('\n') +
        '\n';
      doc +=
        '\n联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。\n';
      doc += '\n完整示例计划：\n' + fence('json', JSON.stringify(plan, null, 2));
      doc +=
        '\n预期结果：工程内 `' +
        example.expected.pointer +
        '` ' +
        (example.expected.absent
          ? '不存在。'
          : '变为 `' + JSON.stringify(example.expected.value) + '`。') +
        ' `$alias` 表示预览回执 allocations 中该别名的实际 ID。\n';
    }
    files['operations-' + group + '.md'] = doc;
  }
  files['examples/sample.puzzle.json'] = sample;
  files['examples/operation-schema.json'] = JSON.stringify(operationJson, null, 2) + '\n';
  files['examples/operations.json'] = JSON.stringify(plans, null, 2) + '\n';
  return files;
}

export async function generateReference(check: boolean) {
  const generated = generatedReferenceFiles();
  for (const [name, content] of Object.entries(generated)) {
    const target = path.join(root, name);
    if (check) {
      if ((await fs.readFile(target, 'utf8')) !== content)
        throw new Error('Reference is stale; run npm run docs:cli: ' + name);
    } else {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, 'utf8');
    }
  }
  // 额外验证整个公开资料集合，而非仅检查生成页标题。
  const { publicSkillFiles, validateReferenceLinks } =
    await import('../services/cliTooling/referenceFiles');
  const files = await publicSkillFiles(path.resolve('.'));
  validateReferenceLinks(files);
  const description = describeCapabilities();
  if (Object.keys(inputSchemas).length !== description.capabilities.length)
    throw new Error('Unregistered input schema');
  console.log(
    'CLI reference ' +
      (check ? 'check' : 'generation') +
      ' passed: ' +
      capabilities.length +
      ' commands, ' +
      Object.keys(operationExamples).length +
      ' operations, ' +
      Object.keys(files).length +
      ' Skill files.',
  );
}
