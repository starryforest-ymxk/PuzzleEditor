# CLI C2：工程、层级、资源与离线事务

日期：2026-10-08。状态：**已完成**。前置为已完成的 [C1](./CLI_C1_Implementation.md)，范围依据 [开发计划 C2](./CLI_Implementation_Plan.md)。

## 目标与 UX 约束

交付 `create/preview/apply/export`，支持工程元数据、Stage 创建/属性/移动/重排，Puzzle 创建（连带 FSM/初始状态）/属性/移动/重排，以及全局、Stage、Node 变量、事件、四类脚本的声明/更新/删除/恢复。所有新增资产名由外部提供，更新省略时保留；不开放任意 Action、JSON Pointer 或完整 JSON 替换。完整 FSM、演出图编辑及最高权限备用 JSON 编辑仍分别属于 C3/C4/C5。

UX 对照：§1.1/§3 保留 Draft 删除、Implemented 标删、Marked 恢复；本批不开放非 Draft 的永久删除。§1.2/§1.4/§1.5 保留脚本分类、监听器和变量作用域；脚本只声明元数据。§2.1/§4 保留完整 Stage 层级、首项初始、Stage/Puzzle Inspector 属性，初始 Stage 禁止设置解锁配置。CLI 输出机器诊断，GUI 继续使用原有面板和消息，无新增 UI。

## 技术设计（编码前）

1. **契约**：在 `contracts/automation` 增加严格、版本化的领域计划/请求/回执与类型化配置 Schema。计划要求明确 `scope`；编辑已有文件必须绑定 `sourceHash`，新建计划不得伪装已有源。字段省略为保留，可清空的可选绑定用 `null`，列表用 `[]`；内部 ID、资源实现状态、任意对象替换不对普通更新开放。输入约束从共用命名片段继承。
2. **引用与分配**：使用 `{id}` / `{alias}` 区分已有实体与本批别名，保留内置 `root` 别名。先为全部创建声明预留 ID 与类型，再按父级依赖装配创建对象，最后按原序执行更新/移动/删除。创建声明可以前向引用其他声明；父级依赖成环或不可解析时整批失败。分配器保留全部源 ID 和本批预留 ID，删除不释放 ID；Puzzle 的初始状态必须单独外部命名。
3. **领域执行**：`store/commands/automation` 为不依赖 React/IO 的共用候选执行入口，复用 GUI 使用的工厂、Slice、生命周期和作用域规则。只在临时候选上使用领域 Slice，不进入真实 Store 或历史。提前检查目标、根保护、移动环、索引、重排列举完整性与资源状态，避免 Slice 的静默 no-op 掩盖错误。必要的共用保护同时接入 GUI 已使用的规则入口。
4. **修改范围**：`scope.project: true` 显式允许整个新/既有工程；局部计划按现有 Stage 子树、Puzzle 及全局资源类别授权。权限根据源快照建立，新增子对象继承父级范围，移动不能扩大范围；父子/排序副作用也需要对应父级权限。读取依赖不等于获得修改依赖的权限。
5. **候选校验**：先复用导入边界，再执行候选，最终结构与领域校验。现有错误按稳定 code/对象/上下文及具体规则实例计数比较，允许保留原有错误但拒绝新增/加重错误；创建必须无 error。补齐共用局部变量命名检查；新增/修改名称、变量值类型及新绑定等输入不能借错误基线跳过。导出仍要求全部 error 清零。
6. **预览与回执**：预览返回完整语义差异（包括顺序、首项切换引起的解锁清理）、诊断、alias 映射及回执。回执绑定 API、规范源路径/字节 hash、计划 hash、固定时间、ID 分配、候选 hash；普通回执仅用于重建一致候选，不是人工授权。默认零文件写入，显式 `--receipt-out` 才排他保存回执。
7. **文件提交**：只输出到显式新目标；检查源/计划/回执路径别名及后缀，排他发布和重读核验，返回保存身份。已有同内容 apply 输出允许查询确认 `already-applied`，不同内容冲突，不随机换目标；创建/导出遇已有目标拒绝。确认结果前核验源和计划仍满足前提，源文件永不原地覆盖。若发布后核验异常，报告提交可能完成及目标，不能声称零写入。
8. **兼容边界**：C2 的 `preview/apply` 接受完整 `puzzle-project`；其他格式继续可由 C1 读取并经 GUI 明确另存后编辑。未知字段、歧义 JSON 沿用已有严格导入边界拒绝，不能静默丢弃。保留已存 `editorState`；兼容规范化变化在预览中显示。无候选进入用户当前 GUI，会话桥另行开发。
9. **构建与维护**：沿用 C1 独立 Node 构建与共用 IO；将唯一候选执行入口加入受限依赖白名单，禁止 UI、Hook、Electron 或平台实例进入 CLI。能力表、帮助、Schema、示例及开发文档同步。代码注释中文，工具消息英文，UTF-8。

## 验证计划

- 真实 Node 子进程完成新建 → 前向 alias/多层 Stage/不同层 Puzzle/三种变量作用域/四类脚本 → preview → apply 新副本 → validate → export。
- 缺根/初始状态/局部变量 assetName、非法/重复名称、类型不符、保留字段、别名重复/类型不符/环、越界、根移动、非法索引、目标不存在、末步失败、移出作用域、新增引用到标删资源全部拒绝且无目标文件。
- 旧源/计划/回执、换候选、目标已存在、输入输出重合、硬链接/路径别名、IO 失败、重试、stdin 计划及源/偏好不变；核对完整差异、已存编辑状态、false/0、无关 FSM/演出字段不变。
- 检查既有错误修复与保留策略、Draft 删除、Implemented 标删、Marked 恢复和永久删除禁用；检查移动/重排的初始项副作用。
- 全量质量检查、前端构建、Electron 文件会话/关闭回归；浏览器直接打开 CLI 文件，核对层级/FSM/黑板，手工修改并保存，再由 CLI 校验与导出。

## 完成记录

### 实际交付与共用入口

- `contracts/automation/planSchemas.ts` 定义 22 种受限领域操作及创建/预览/提交/导出请求；基本命名片段统一到 `primitives.ts`。`describe` 同时提供完整 plan/receipt JSON Schema，能力表和帮助标记当前 C2。
- `store/commands/automation/context.ts` 管理隔离状态、源快照权限和整批 ID 预留；`bindings.ts` 仅解析指定引用字段；`execute.ts` 复用 Stage/Puzzle 工厂、四个领域 Slice 与资源生命周期。域 ID 收集只扫描实体集合，不把任意 JSON 常量的 `id` 当资源。
- `services/automation/writeService.ts` 协调严格解析、源 hash、候选错误基线和固定回执重建；`transactionData.ts` 提供完整差异；`fileCommit.ts` 检查后缀/规范路径/硬链接，使用 C1 共用 Node IO 排他发布并重读核验。没有新增 UI 会话副本或格式副本。
- 共用规则补齐局部变量 assetName 的所属容器检查、脚本类别及生命周期目标、参数运算和来源类型。`parameterCompatibility.ts` 同时供 GUI 参数编辑器与领域校验器使用；布尔只允许 Set/Toggle，数值允许算术并接受两种数值来源，字符串接受现有 UI 支持的四种标量。
- `recordLookup.ts` 保证外部 ID 只命中实体字典自身条目，`toString/valueOf` 等原型成员不能冒充存在的资源。Stage 移动的防环检查也进入 GUI 共用 Slice，后代遍历带 visited 集合。
- 错误基线除规则/实体/上下文/数量外，还比较完整诊断详情，不解析英文消息；同一位置换成另一个缺失目标不能当作保留旧错误。若旧错误详情随编辑改变，会保守拒绝并要求同批修复。

### 验收结果

| 验证 | 结果与证据 |
| --- | --- |
| `npm run check` | **23 文件 / 310 用例通过**；包含新增 41 项 C2 子进程用例、当前 43 项 C1 用例和既有 226 项。C1 的占位写命令拒绝测试随 C2 开放而调整，因此不能按 271 + 41 直接相加。类型、lint、UTF-8、215 文件格式、UI 所属检查和反向探针均通过。[日志](./evidence/CLI_C2/quality-check.log) |
| CLI 实际写入闭环 | 创建 → inspect → 窄范围计划 → preview 回执 → apply 新副本 → validate → export；[创建计划](./evidence/CLI_C2/create-plan.json)、[编辑计划](./evidence/CLI_C2/edit-plan.json)、[预览结果](./evidence/CLI_C2/preview-result.json)、[提交结果](./evidence/CLI_C2/apply-result.json) |
| 非法命令/文件保护 | 缺名、非法/重复名称、alias 冲突/环、越界、根保护、索引、错误脚本类别、变量类型/作用域、原型成员 ID、新增错误、旧源/计划/回执、目标冲突/硬链接、IO 失败均拒绝；默认预览零写入，源字节与 mtime 不变；固定回执重复提交确认已有结果 |
| 层级与资源行为 | 前向 alias、多层 Stage、两层 Puzzle、Stage 重排/移动更新初始项、Puzzle 排序、变量搬移保持身份、同批删除不复用编号、Draft 删除/Implemented 标删/Marked 恢复、编辑状态与无关 FSM/演出字段保留均通过 |
| 前端构建 | `npm run build` 通过；保留既有单包超过 500 kB 的体积提示，未增加发布包或安装器 |
| Electron 回归 | 文件会话 **11 项**通过；关闭保护 **7 场景 / 32 断言**通过，包含保存失败和取消等路径。[日志](./evidence/CLI_C2/electron-check.log) |
| 浏览器直接操作 | 打开 CLI 提交文件，逐层进入 Root Stage → Room → Inner → Entry Door；确认 Locked 初始状态、Node 生命周期、StageLocal Keys=0 监听器、NodeLocal Found=false，黑板 Power=true 与四类脚本均正常显示 |
| GUI 手工编辑与往返 | 将显示名改为 Entry Door Reviewed，assetName 仍为 Door；保存下载后 CLI 校验 **0 错误 / 0 警告**，GUI 和 CLI 导出的内容除 exportedAt 外完全一致；浏览器控制台 0 error/0 warning。[结果](./evidence/CLI_C2/browser-result.json)、[下载工程](./evidence/CLI_C2/browser-saved.puzzle.json)、[CLI 校验](./evidence/CLI_C2/browser-cli-validation.json)、[截图](./evidence/CLI_C2/browser-validation.jpg) |

满足 UX_Flow 中 Stage 首项初始、属性编辑、黑板分类/作用域、Draft/Implemented/Marked 生命周期及 GUI 保存/导出路径的本批范围。普通写命令在 Node 中执行，不打开 GUI，也不调用翻译或 AI 服务。所有工具消息维持 English。

全量回归发现性能夹具中的 Stage/Node 局部变量此前未设置 assetName；本批给测试夹具明确补名，保留“合法夹具无 error”的断言，没有降低断言或忽略新增诊断。旧工程若存在局部缺名、脚本类别/目标或参数运算不兼容，GUI 校验现在会报告；需修复后才能导出。

### 范围与后续

- **C2 已完成，首版 CLI 尚未全部完成**：C3 补齐状态/迁移编辑，C4 补齐演出图和共享引用上下文，C5 完成需逐次人工确认的备用完整 JSON 编辑、审批宿主及 Windows companion 发行物。
- `json read` 完整读取继续开放；`json preview/json apply` 不可用，普通计划不接受通用 Patch/Action/完整对象替换，不能自行填入批准字段启用备用写入。
- 离线副本不锁定第三方写入，不修改已打开 GUI 的 Store/dirty/Undo。没有原地覆盖、自动合并、在线桥或 MCP。新建脚本只是声明，未验证 Unity 运行时玩法。
- 尚未覆盖所有真实用户工程、磁盘掉电或多程序持续竞争场景；测试通过不构成“所有旧功能绝对不受影响”的保证。
- 本批没有打 release、提交或推送 Git，保留 C1 与 C2 的工作区改动。
