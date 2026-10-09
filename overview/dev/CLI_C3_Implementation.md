# CLI C3：完整 FSM 领域编辑

日期：2026-10-08。状态：已完成。本批对应用户所称 C03，即 [CLI 计划](./CLI_Implementation_Plan.md)中的 C3。按照本次顺序，先将前置 C1/C2 提交并推送到 `origin/main`：`511701b`（已核对远端提交）；随后实施 C3。C3 改动保留在当前工作区，尚未另行提交或推送。

## 目标与 UX 对照

在 C2 的 create/preview/apply/export 事务上，补齐状态、迁移、初始状态、布局坐标、优先级、多触发器、递归条件、参数修改、事件调用和演出绑定。新增状态 assetName 必须外部输入；FSM/Transition 当前没有 assetName 字段，不擅自改变文件模型。完整 JSON 读取保留，备用 JSON 写入仍待 C5 的逐次人工确认。

对照 UX_Flow §5.2–5.5、§7：状态生命周期和监听器；迁移触发器/条件/演出/参数修改；状态位置、初始项和连线端点。删除连线应保留其他配置；删除状态须明确关联连线影响。Task_Breakdown 的 P3-T08 曾提到 State 直接演出，当前 UX §1.3/§5.4 及领域模型仅在 Transition 上支持此绑定，因此不新增 State.presentation。Task_Breakdown 的空触发器“警告”与当前共用校验器的 error 不一致，本批沿用已实现的 error 约束，不降低校验强度。

## 技术设计（编码前）

1. **契约**：新增 `state.create/update/delete`、`fsm.setInitial/update`、`transition.create/update/delete/redirect` 共 9 种操作。复用已有触发器、条件、监听器、参数修改器和演出绑定 Schema。状态创建必须有 name/assetName/position；迁移创建明确 name/from/to/priority/triggers，其他效果可省略。状态更新可修改 name/assetName/description/position/lifecycleScriptId/eventListeners；迁移更新只修改属性和效果，改端点使用 redirect；FSM update 仅开放 displayOrder。内部 ID、整份 states/transitions、未知字段拒绝。
2. **所属定位**：每条 FSM 操作明确 `fsm: {id}` 或 `fsm: {puzzle: {id|alias}}`。状态/迁移 target 和端点使用 `{id|alias}`；已有局部 ID 只在给定 FSM 查找，alias 分配记录包含 fsmId 并核对归属。FSM 必须恰有一个 Puzzle owner，修改权限继承该 Puzzle；缺失/多重 owner、跨 FSM 引用及 scope 越界明确失败。
3. **创建依赖**：继续整批预留 ID 后按依赖创建。Puzzle 的 `initialState` 增加可选声明 alias，用于同批引用自动初始状态；它不进入工程文件。状态和迁移可前向引用新 Puzzle、新 State、新脚本或资源。删除不释放源或同批 ID；缺失端点不靠 reducer 静默忽略。
4. **共用领域入口**：在 `store/commands/automation/fsm.ts` 实现 FSM 操作，主 executor 负责调度，context 注册 fsmSlice。抽出纯 FSM 创建工厂供画布、Puzzle 初始模板和 CLI 共用，保持 GUI 原有默认值。没有新增页面、路由、UI 规格或并行模型。
5. **删除保护**：最后一个状态不能删除。删除当前初始状态要求显式提供同 FSM 的 replacementInitialState，或先执行 setInitial。存在关联迁移时默认拒绝，只有 `deleteTransitions: true` 才复用 Slice 连带删除；所有消失状态/边在 preview 差异中可见。不会自动选择替代初始状态，也不会自动重定向连线。
6. **部分更新**：省略保持；condition/presentation/lifecycleScriptId/端口可用 null 清空，列表用 [] 清空。redirect 默认保留条件、效果、优先级及未指定端口；自环按现有模型允许。多条同端点迁移保留各自 ID/priority，不通过排序数组或合并边改变语义。
7. **校验与影响**：共用结构/脚本类别/生命周期目标/变量作用域/参数规则继续执行。覆盖 false/0、递归条件、Temporary 元数据与来源、事件引用和已标删资源。必要修复进入共用校验器，不在 CLI 内复制业务校验。最终候选才校验，允许同一批显式完成资源/引用修复；事务失败不产生目标文件。
8. **可发现性**：describe/help 标记 C3，输出机器可读 FSM 操作契约、引用/删除规则和使用示例。保持 C2 sourceHash/scope、固定回执和新文件发布方式，不增加任意 JSON Patch、Action 或直接写源入口。

## 验证计划

- 真实 CLI 子进程新建完整正常/失败/重试 FSM：四类触发器、多层逻辑条件、State 监听器、三种变量作用域、演出参数/Temporary、事件调用与参数修改；preview/apply/validate/export 往返。
- 跨 FSM 同名 ID 定位、alias 前向引用/错误类型/归属、重复 assetName、非法保留字段、scope、空触发器、缺失端点、初始/最后状态删除、关联边删除确认和末步失败。
- 改名保留 assetName；布局/优先级/重定向/效果局部更新保持无关字段；新增/删除 ID 不复用；错误诊断带所属 FSM，源文件/editorState 保留，重试不重复创建。
- 运行全量 check、前端构建及必要 Electron 回归。直接在浏览器打开 CLI 构建的 FSM，检查状态/连线与 Inspector，手工修改保存，再由 CLI 校验，比较 GUI/CLI 导出内容。

## 完成记录

### 实际交付

- `planSchemas.ts` 增加 9 种操作，累计 **31 种**；输入与 `describe` 中的 JSON Schema 同源。全程仍走既有 create/preview/apply/export，执行层新增 `automation/fsm.ts`，通过 fsmSlice 更新隔离候选。
- 新状态强制外部 name/assetName/position；新迁移明确 name/from/to/priority/triggers。新增 `initialState.alias`，支持先写迁移、后声明 FSM/端点/脚本的计划；alias 仅进入分配回执，不写入工程。
- `fsm` 明确 ID 或 Puzzle 引用，验证唯一 Puzzle owner、scope、局部 ID 和 alias 的 FSM 归属。重定向保持效果；部分更新保持未指定数据和资产名；`null`/`[]` 明确清空；删除初始状态和关联边分别要求明确意图。
- 画布、Puzzle 初始模板、CLI 共用 `utils/fsmFactories.ts`。触发器/条件/监听器/演出转换仍由 `automation/bindings.ts` 维护；C2/C3 子进程测试共用 `processHarness.ts`，不复制驱动逻辑。

### 实测中补齐的共用规则与设计细化

1. **Temporary 来源**：UX §6 及现有编辑器允许 Constant 或 VariableRef，本批把 C2 的 Constant-only 契约扩展到两者。共用校验器新增 `ERR_TEMP_VALUE_TYPE`（常量声明类型不匹配）、`ERR_TEMP_SOURCE_TYPE`（当前调用上下文的变量类型不匹配）；false/0 保留。整数声明值和 Temporary 常量共用 `variableValueMatches`，不在 CLI 偷做类型转换。
2. **画布运算误报**：局部画布曾只接受 Set/Add/Subtract。现在同 Inspector、全局校验复用 `modifierOperations/modifierSourceTypes/constantVariableType`，接受合法 Multiply/Divide/Toggle，Toggle 不读取占位 source。变量标删检查沿当前 Puzzle 的祖先 Stage 链，避免把其他层同 ID 变量的标删状态误用到当前变量；父链环终止。
3. **优先级**：既有 GUI 输入接受有限数值，但导出器会把负数、小数转换为非负整数。C3 契约因此要求显式设置的 priority 为**非负安全整数**，尽早拒绝会在导出时被改变的值；未改变旧 GUI 输入与导出规则。坐标仍支持负数和小数。
4. **可发现性与权限**：help/describe 标记 C3，新增 FSM 定位和删除规则，使用说明提供可执行的创建计划。完整原始 JSON 读取继续开放；没有通用 Patch、整 FSM 替换或 raw JSON 写绕过通道。

### 自动回归

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| `npm run check` | **24 文件 / 364 用例通过**；包括 C1 43、C2 41、C3 54 及既有 226 项 | [完整日志](./evidence/CLI_C3/check.log) |
| 编码/类型/lint/格式/UI/反向探针 | UTF-8 319 文件；格式 220 文件；UI 110 文件；全部门禁通过 | 同上 |
| `npm run build` | 通过；保留既有主 JS >500 kB 提示 | [构建日志](./evidence/CLI_C3/build.log) |
| `npm run test:electron` | 文件会话 **11 项**；关闭 **7 场景 / 32 断言**通过 | [Electron 日志](./evidence/CLI_C3/electron.log) |

C3 的 54 项包含 53 项真实编译 CLI 子进程场景和 1 项局部画布/共用校验回归：完整正常/失败/重试构造；四类触发器、多层条件、状态生命周期/监听器、三种变量范围、Script/Graph 绑定、临时参数、事件与参数效果；部分更新、清空、自环、同端点独立迁移；删除初始/最后状态与连带边；源字节/editorState 保留及幂等重试；非法字段/优先级、跨 FSM alias、scope、缺失/多重 owner、错误脚本类别/目标、缺失和已标删引用、重复资产名、Temporary 值/来源/跨位置类型冲突。

首轮发现的三项失败均已定位并修正测试预期/夹具：磁盘 JSON 对照需排除 undefined 与 -0 的内存差异；新建 scope 夹具不得复用已有工程的同名资产；缺失变量错误码为 `ERR_VAR_MISSING`。同时根据优先级导出差异收紧输入契约，增加负数/小数拒绝用例。最终全量日志为上表结果。

### 浏览器直接验收（UX §5.2–5.5、§6–7）

在本地 Vite 页面通过真实界面完成：

1. 打开 [CLI 创建并增量编辑的工程](./evidence/CLI_C3/c3-edited.puzzle.json)，进入 Root → Room → Inner → Door；显示 Locked、Unlocked、Failed 和 Unlock、Failure、Retry。
2. 在 State Inspector 核对 State lifecycle 与 InvokeScript 监听器，修改 Unlocked 描述。在 Transition Inspector 核对四种触发器、And/Or/Not/ScriptRef、Global/StageLocal/NodeLocal 来源、Temporary 0/false/变量引用、事件调用、Set/Multiply/Toggle，将 priority 从 12 改为 13。
3. 执行 Validate Project：**0 Errors / 0 Warnings**。保存项目并导出运行时文件；实际下载文件中的描述、优先级均保留，另一 FSM 未变化。
4. 用 CLI 校验 GUI 保存文件和导出文件，均为 **0 errors / 0 warnings**。再由 CLI 导出 GUI 保存文件，比较 GUI 与 CLI 的 `data` 载荷：**完全一致**。浏览器 Console warn/error 为 **0**。

证据：[界面校验截图](./evidence/CLI_C3/browser-validation.jpg)、[完整画布截图](./evidence/CLI_C3/browser-fsm.jpg)、[界面字段记录](./evidence/CLI_C3/browser-state.txt)、[往返核对结果](./evidence/CLI_C3/browser-roundtrip-summary.json)、[Console](./evidence/CLI_C3/browser-console.json)、[SHA-256 清单](./evidence/CLI_C3/manifest.json)。创建计划、预览/回执、apply、GUI 保存和两种导出均在同目录；链接和指纹最后复核。

### 边界与后续

- 本批完成 C3 的离线 FSM 编辑；**C4 演出图结构编辑、C5 逐次人工确认的备用 JSON 写入及发行仍未完成**，MCP/在线桥另列后续。
- 验证的是结构、引用、值类型、编辑器往返和运行时导出一致性；没有执行 Unity 实际玩法/脚本，不承诺任意谜题可解或任意历史功能绝对无回归。
- 已执行真实 Electron 文件会话/关闭回归；本批手工操作的是浏览器，未打新 release 或验收新安装包。CLI 构建中的 Zod PURE 注解提示及前端大 chunk 提示不影响本次检查通过。
- 多条同端点迁移按文件模型保留各自 ID；GUI 现有“新拉一条相同边”手势仍有重复保护。本批不定义同优先级的引擎执行顺序。
