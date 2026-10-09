/** 面向人的语义说明；类型和默认值不在这里复制，由真实 Schema 提供。 */
import type { CommandName } from './argumentContract';

export const argumentDescriptions: Record<string, [string, string]> = {
  path: [
    '源文件路径，相对当前工作目录解析。',
    'Source file, relative to the caller working directory.',
  ],
  name: [
    '显示名称；skills read 的位置参数固定为 puzzle-editor。',
    'Display name; the skills read positional value is puzzle-editor.',
  ],
  rootAssetName: [
    '外部指定的根 Stage 资产名，不自动生成或转换。',
    'Explicit external root Stage asset name; never generated.',
  ],
  description: ['新工程的说明文字。', 'Description of the new project.'],
  out: [
    '明确的输出路径；默认只允许创建不存在的新文件。',
    'Explicit new output file; existing files are protected.',
  ],
  plan: [
    'UTF-8 领域计划文件；离线 create/preview/apply 可用 - 从 stdin 读取。',
    'UTF-8 domain plan; offline create/preview/apply also accept - for stdin.',
  ],
  receipt: [
    '同一次预览的回执文件；使用 --receipt-out 保存的文件。',
    'Receipt file produced by the matching preview.',
  ],
  receiptOut: [
    '把预览回执写入指定的新文件，不是工程输出。',
    'Write the preview receipt to a new file, not a project.',
  ],
  expectedHash: [
    '源文件原始字节的 SHA-256，来自 inspect/json read 的 data.source.sha256。',
    'Expected source byte SHA-256 from data.source.sha256.',
  ],
  operation: [
    '只返回指定完整命令名称的能力条目，例如 "session save"；其余共用 Schema 仍返回。',
    'Filter capability entries by full command name, e.g. "session save".',
  ],
  view: [
    '查询视图；可用参数因视图而异，见本页视图表。',
    'Query view; accepted filters depend on the view.',
  ],
  type: ['实体或绑定资源类型，不能用显示名称代替。', 'Entity or binding resource type.'],
  id: [
    '准确实体 ID；FSM/演出视图分别使用 FSM/Graph ID。',
    'Exact entity ID; use an FSM/Graph ID for those views.',
  ],
  ownerType: [
    '子实体所属对象类型，必须与 ownerId 一起提供。',
    'Owner kind; supply together with owner-id.',
  ],
  ownerId: [
    '所属对象 ID，避免不同 FSM/Graph/变量域中的同名 ID 混淆。',
    'Exact owner ID; supply together with owner-type.',
  ],
  search: ['列表名称/标识搜索，不能与 id 同用。', 'List search; mutually exclusive with id.'],
  stageId: ['variables 视图的 Stage 上下文 ID。', 'Stage context for the variables view.'],
  nodeId: ['variables 视图的 Puzzle 上下文 ID。', 'Puzzle context for the variables view.'],
  depth: ['tree 视图的最大遍历深度。', 'Maximum traversal depth for the tree view.'],
  offset: [
    '列表分页的起始偏移量；精确实体查询不能分页。',
    'List offset; unavailable for exact-entity queries.',
  ],
  limit: [
    '每页条目上限；精确实体查询不能分页。',
    'Maximum page size; unavailable for exact-entity queries.',
  ],
  warningsAsErrors: [
    '校验遇到 warning 也使用失败退出码。',
    'Treat validation warnings as failure.',
  ],
  raw: [
    '只输出原始 UTF-8 文本，不输出 JSON 信封；与 --json 互斥。',
    'Emit original text without an envelope; incompatible with --json.',
  ],
  inPlace: [
    '覆盖本次源工程；预览和提交须使用相同模式，不能与 out 同用。',
    'Overwrite this source project; incompatible with out.',
  ],
  allowOverwrite: [
    '声明已有本任务的聊天覆盖授权；该参数本身不授予权限。',
    'Declare existing chat authorization to overwrite; does not grant it.',
  ],
  allowPermanentDelete: [
    '声明已有受保护资源永久删除的聊天授权。',
    'Declare existing chat authorization for protected resource removal.',
  ],
  allowRawJsonWrite: [
    '声明已有直接修改工程 JSON 的聊天授权。',
    'Declare existing chat authorization for raw project JSON changes.',
  ],
  candidate: [
    '获授权后准备的完整工程 JSON 候选文件，不是领域计划或运行时导出。',
    'Authorized complete project JSON candidate, not a plan or runtime export.',
  ],
  names: [
    '导入的外部资产名映射 JSON；预览和应用必须使用同一份。',
    'External asset-name mapping JSON; reuse it unchanged for apply.',
  ],
  instance: [
    'session list 中用户明确选择的 instanceId，不能猜第一个窗口。',
    'Explicit instanceId selected from session list.',
  ],
  session: [
    '对应实例中的 sessionId；必须与 instance 配对。',
    'Session ID belonging to the selected instance.',
  ],
  token: [
    '保存最新 data.token 对象的 UTF-8 JSON 文件，不是完整命令结果。',
    'UTF-8 file containing the latest data.token object.',
  ],
  requestId: [
    '首次执行前保存的 13 位 Unix 毫秒:UUID；结果未知时重用相同 ID 和内容。',
    'Persist a 13-digit Unix millisecond:UUID before execution; reuse on uncertain retry.',
  ],
  entryId: [
    'history list 返回的当前方向顶部 undoEntryId/redoEntryId。',
    'Current top undoEntryId/redoEntryId from history list.',
  ],
  expectedDiskHash: [
    '覆盖保存的磁盘原文 SHA-256；从当前磁盘 json read 取得，不是 token.contentHash。',
    'Expected disk byte SHA-256 for save, not token.contentHash.',
  ],
  installRoot: [
    '受管安装根；省略时使用运行环境解析的安装根。',
    'Managed installation root; defaults to the resolved installation root.',
  ],
  source: [
    '已完整解压的 CLI 包根，包含 manifest.json 和随包运行时。',
    'Complete extracted CLI package containing manifest.json and runtime.',
  ],
  dryRun: [
    '只检查并返回计划，不执行安装、卸载或恢复写入。',
    'Validate and preview without installation/removal/recovery writes.',
  ],
  config: [
    '显式可选配置文件；优先于环境变量和默认位置。',
    'Explicit optional config file; overrides environment/default location.',
  ],
  agent: ['目标 Agent，目前只支持 codex。', 'Target Agent; currently codex only.'],
  scope: [
    'user 为用户级；project 为明确项目级，后者必须带 projectRoot。',
    'User or explicit project scope; project requires project-root.',
  ],
  projectRoot: [
    '已存在的项目目录；project 范围必填，user 范围禁止。',
    'Existing directory; required for project scope, forbidden for user scope.',
  ],
  offline: [
    '明确要求只做离线诊断，不能与 online 同用。',
    'Explicit offline diagnostics; incompatible with online.',
  ],
  online: [
    '对明确 instance/session 做在线诊断，不会启动桌面程序。',
    'Check an explicit instance/session; never start the desktop.',
  ],
  project: [
    'doctor 要额外校验的工程文件，不修改工程。',
    'Additional project to validate read-only in doctor.',
  ],
};

/** 每条入口的作用和可观察结果独立登记，不把帮助文字当成执行契约。 */
export const commandReference = {
  version: [
    '查询当前实际运行的产品、CLI、Node 及协议版本。',
    'data 中的 productVersion、apiVersion、onlineProtocol、executable 和 cliEntry。',
  ],
  describe: [
    '发现当前支持的命令、领域计划及权限契约。',
    'data.capabilities、planSchema、resultSchema、importNamesSchema、exitCodes。',
  ],
  inspect: [
    '读取规范化工程上下文并查询实体或引用，不保存。',
    'data.source.sha256、sourceFormat、importNotices、view 和 result；同时检查 diagnostics。',
  ],
  validate: [
    '检查工程结构和业务规则，不写入文件。',
    'diagnostics 的 level/code/path 及校验计数；退出码 3 表示校验失败。',
  ],
  'json read': [
    '读取完整工程包装和原始文本；含 fileType/editorVersion/savedAt/project/editorState。',
    'data.file、rawText、parsedAvailable 和 source；--raw 时 stdout 只有原文。',
  ],
  create: [
    '以指定工程名和根资产名创建新工程，可附领域计划。',
    'data 中的输出路径、hash、分配的实体和 remainingErrors；输出应再 validate。',
  ],
  preview: [
    '校验领域计划，计算候选、变化和权限要求，不写工程。',
    'data.receipt、changes、impacts、remainingErrors；receipt-out 保存可用于 apply 的回执。',
  ],
  apply: [
    '依据同一次预览原子应用领域计划，默认另存新文件。',
    '输出路径和 hash、changes、remainingErrors；覆盖时另有 backup 和 transaction。',
  ],
  export: [
    '校验并导出游戏运行时数据，不保留完整编辑器状态。',
    'data 的输出路径/hash 和源文件指纹；errors 阻止导出。',
  ],
  'json preview': [
    '检查获授权后准备的完整候选原文，预览差异及所需能力。',
    'data.receipt、output、changes、impacts、remainingErrors；候选须已符合保存格式。',
  ],
  'json apply': [
    '在已有聊天授权下按回执写入完整候选，保留候选原字节。',
    '目标文件指纹、变化和权限信息；覆盖模式返回备份/事务位置。',
  ],
  'import preview': [
    '识别兼容格式并预览转换为完整的新工程。',
    'detectedFormat、candidate、missingAssetNames、importNotices、remainingErrors、receipt。',
  ],
  'import apply': [
    '按同一源、映射和回执执行转换，只创建新工程。',
    '转换后输出路径/hash、remainingErrors；不改变源文件或 GUI 会话。',
  ],
  'session list': [
    '发现同一用户的本地桌面会话，供明确选择目标。',
    'data 中的实例和会话信息，以及不可用或不兼容状态；不要自动取第一项。',
  ],
  'session status': [
    '查询所选会话的最新内存版本和编辑状态。',
    'data.token、dirty、pendingEdits、保存限制；token 只在对应实例/会话有效。',
  ],
  'session inspect': [
    '查询已提交的内存工程；project 视图返回完整内存工程 JSON。',
    'data 中的查询结果；字段草稿尚未提交时应结合 status 的 pendingEdits 判断。',
  ],
  'session validate': [
    '校验所选桌面会话的当前内存工程。',
    '诊断和错误/警告计数；不代表已保存到磁盘。',
  ],
  'session preview': [
    '处理可提交草稿并预览指定内存 token 上的计划。',
    '候选变化、能力要求及 session receipt；草稿改变 token 时返回冲突。',
  ],
  'session apply': [
    '把预览计划作为一次原子事务应用到内存，产生一个共享 Undo 条目。',
    '更新后的 token、变更和保存限制；没有覆盖声明时暂停相关自动保存。',
  ],
  'session save': [
    '保存匹配 token 的内存内容，默认显式另存新路径。',
    '保存路径及 token/dirty 状态；失败保留内存；最新编辑不会被旧保存确认清除。',
  ],
  'history list': [
    '读取 GUI/CLI 共用的撤销与重做历史。',
    'data.token、data.history.undoEntryId/redoEntryId、history.past/future 和每条 requiredCapabilities。',
  ],
  'history undo': [
    '撤销当前顶部一条历史，只改内存。',
    '新的 token 和历史位置；这不是磁盘回滚，也不会跳过人工编辑。',
  ],
  'history redo': [
    '重做当前顶部一条历史，按实际效果重新检查能力声明。',
    '新的 token 和历史位置；永久删除可能建立不可恢复边界。',
  ],
  'setup install': [
    '把完整独立包安装或升级到当前用户的受管目录。',
    '安装根、激活版本、PATH 变化；预览只返回计划，实际升级保留旧版本。',
  ],
  'setup status': [
    '读取受管安装、版本及外部卸载入口。',
    'data.root、activeVersion、versions、path、uninstallEntry、recoveryRequired。',
  ],
  'setup uninstall': [
    '移除未被修改的受管 CLI 文件及对应用户 PATH 入口。',
    '预览结果或 EXTERNAL_UNINSTALLER_REQUIRED 提供的外部入口；配置和 Skill 单独管理。',
  ],
  'setup recover': [
    '恢复中断的受管安装或卸载事务。',
    '恢复状态；未知外部修改造成冲突时应保留文件并人工核对。',
  ],
  'config path': [
    '只查询可选配置的解析位置和存在状态。',
    '预期路径及是否存在；不解析配置正文，不创建配置。',
  ],
  'config show': [
    '读取严格配置及各字段的生效来源。',
    '原值、生效值、来源、运行环境；不会保存权限或执行 desktopExecutable。',
  ],
  'skills list': [
    '列出当前 CLI 随包提供的 Skill。',
    'data.skills 的名称、支持的 Agent 和安装范围；不代表已经安装。',
  ],
  'skills read': [
    '离线读取随包 Skill 及全部参考文件。',
    'data.files 是相对路径到 UTF-8 内容的映射；按任务选择具体参考页。',
  ],
  'skills status': [
    '核验指定位置的 Skill 安装及内容更新状态。',
    'installed、managed、updateAvailable、recoveryRequired、target；hostDiscovery 单独验证。',
  ],
  'skills install': [
    '安装或更新未被外部修改的受管 Skill。',
    'target、changed、installed 和 reloadHint；重复相同内容安装 changed=false。',
  ],
  'skills uninstall': [
    '卸载明确范围中未被修改的受管 Skill。',
    '移除结果；同名外部 Skill、未知文件和用户改动会阻止卸载。',
  ],
  'skills recover': [
    '恢复中断的 Skill 安装、升级或卸载。',
    '恢复结果和目标路径；使用原来的 agent/scope/project-root。',
  ],
  doctor: [
    '聚合只读环境诊断，可额外检查工程或明确桌面会话。',
    'data.healthy、checks 的 pass/warn/fail/skip；有 fail 退出 3，否则 0。',
  ],
} satisfies Record<CommandName, [string, string]>;

export function commandRules(name: CommandName): [string, string][] {
  const rules: [string, string][] = [];
  if (['inspect', 'session inspect'].includes(name))
    rules.push([
      '视图限制在下表列出；owner-type/owner-id 必须成对；id/search 互斥；精确实体不能分页。',
      'Use view-specific filters; pair owner-type/owner-id; id excludes search; exact entities cannot be paged.',
    ]);
  if (['apply', 'json apply', 'json preview'].includes(name))
    rules.push([
      'out 与 in-place 必须且只能选择一种；覆盖另需已有聊天授权和提交声明。',
      'Choose exactly one of out or in-place; overwrite requires existing chat authorization and an apply declaration.',
    ]);
  if (name.startsWith('json ') && name !== 'json read')
    rules.push([
      '准备候选之前即须取得范围内的聊天 JSON 编辑许可；预览不会授予许可，不能把领域失败自动降级为 raw。',
      'Obtain scoped chat authorization before preparing the raw candidate; preview grants no permission.',
    ]);
  if (
    ['preview', 'apply', 'json preview', 'json apply', 'import preview', 'import apply'].includes(
      name,
    )
  )
    rules.push([
      '源、计划/候选/映射、输出模式变动后重做预览；不要手工修改回执。已有业务错误可能保留，必须检查 remainingErrors。',
      'Re-preview after changing source, plan/candidate/mapping or output mode; inspect remainingErrors.',
    ]);
  if (name.startsWith('session ') || name.startsWith('history '))
    rules.push([
      '桌面必须运行且协议兼容，使用明确实例/会话；连接失败不能回退磁盘写入。',
      'Requires a running compatible desktop and explicit target; never fall back to disk writes after connection failure.',
    ]);
  if (['session apply', 'session save', 'history undo', 'history redo'].includes(name))
    rules.push([
      '结果未知时在 10 分钟内仅重试原 requestId 和原内容；超期先核对结果。忙碌/无效草稿先交由用户处理。',
      'For uncertain results, retry identical content with the same request ID within 10 minutes; otherwise inspect first.',
    ]);
  if (name === 'session save')
    rules.push([
      'out 创建新文件；省略 out 是覆盖当前文件，必须带 allow-overwrite 和 expected-disk-hash。两种模式都需要最新 token 和 request-id。',
      'out creates a new file; omitting it requires allow-overwrite and expected-disk-hash. Both modes require token and request-id.',
    ]);
  if (name.startsWith('skills ') && !['skills list', 'skills read'].includes(name))
    rules.push([
      '必须显式 agent/scope；project 范围必须提供已有 project-root，user 范围禁止该参数；外部修改拒绝覆盖。',
      'Explicit agent/scope required; project requires an existing project-root, user forbids it. Modified files are protected.',
    ]);
  if (name === 'setup uninstall')
    rules.push([
      '运行中的受管 Node/CMD 不能删除自身；实际卸载使用 setup status 返回的外部 PowerShell 入口。',
      'A managed runtime cannot delete itself; invoke the external PowerShell uninstaller from setup status.',
    ]);
  if (name === 'doctor')
    rules.push([
      '默认离线；online 与 offline 互斥；online 必须同时提供 instance/session，离线禁止提供。',
      'Offline by default; online excludes offline and requires both instance/session.',
    ]);
  return rules;
}

export function commandErrors(name: CommandName) {
  const errors = [
    'INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。',
  ];
  if (name.startsWith('setup ') || name.startsWith('skills '))
    errors.push(
      '安装冲突或恢复要求：核对返回路径和受管记录，使用同目标 recover；不强制覆盖未知文件。',
    );
  else if (name.startsWith('session ') || name.startsWith('history '))
    errors.push(
      '会话不可用、版本冲突、pending/busy：重新读取状态或处理桌面交互；未知写入结果遵守同 requestId 重试规则。',
    );
  else if (!['version', 'describe', 'config path', 'config show', 'doctor'].includes(name))
    errors.push(
      'REVISION_CONFLICT / 回执冲突：重读并重新预览；校验错误按 diagnostics 修正；已有输出应核验而不是换名字盲重试。',
    );
  if (
    [
      'apply',
      'json apply',
      'session apply',
      'session save',
      'history redo',
      'history undo',
    ].includes(name)
  )
    errors.push(
      '退出码 6：缺少能力声明。先确认已有聊天授权及其范围，再声明相应能力；flag 不构成授权。',
    );
  return errors;
}
