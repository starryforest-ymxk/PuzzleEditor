# 项目实现状态（Implementation Status）

> **版本**: 1.0.0-beta | **更新时间**: 2026-10-08 | **最近核对范围**: 六类 UI 统一、226 个回归、Electron 11 项及 7 个关闭场景、Windows x64 NSIS 与真实打包程序冒烟

---

## 1. 总体进度

### Windows release 打包和提交交付（2026-10-08）

- 沿用 `1.0.0-beta`，生成 `release/2026-10-08/` 内的 Windows x64 NSIS 安装包，保留旧产物。全量 226 用例、Electron 11 项和 7 个关闭场景通过；新增发布程序冒烟脚本及复跑说明。
- 实际 ASAR 打包程序两次启动 / 17 项检查通过，覆盖恢复、编辑、取消关闭、保存退出及重启恢复；安装包提取的程序/ASAR 与该产物 SHA-256 一致，15 个构建文件与源码生成物一致。编码 283 文件、格式 174 文件通过。
- 安装包仍未签名；安装/卸载/升级和跨机器验收未执行。修复、测试与规范随源码提交，产物留在本地忽略目录，详见 [发布记录](./Release_2026-10-08.md)。

### 剩余六类 UI 重复维护统一完成（2026-10-08）

- 菜单、表单控件、语义配色、提示/资源预览、标题/卡片及图节点/边标签均迁入唯一维护入口；80 个表单控件接入共享规格，保留密度、业务事件与画布几何。菜单及选择器的外部点击/Escape/焦点返回共用 Hook。
- 建立 [UI 规范](./UI_Standards.md)，在 AGENTS 与架构指南登记。`check:ui` 加入全量检查，10 个错误 UI 探针和 2 个合法探针确认规则生效；全部 UI 纳入格式门禁。扫描 103 个组件，19 组重复候选降为 4 组纯布局，重复装饰规格为 0。
- 全量 **19 文件 / 226 用例**、生产构建、真实 Electron **11 项**和 **7 个关闭场景 / 32 断言**通过。UTF-8 282 文件、格式 173 文件、UI 所属检查 110 文件通过；既有 500 kB 构建告警保留。
- 浏览器在独立回归夹具核对黑板/检查器、两种图画布、Stage/Node/概览菜单、变量搜索、24px 参数/false、脚本和图摘要/跳转，未见 Console warn/error。规范仍需审查补充，不能保证静态规则穷举一切近似重复。详见 [实施报告](./UI_Consistency_Implementation.md)。

### 内部弹窗统一及 UI 重复维护排查完成（2026-10-08）

- 未保存、删除、新建、项目设置、偏好五种弹窗统一共享外壳、标题、按钮、表单与偏好开关；Portal/弹窗栈统一 Escape、Tab、busy 和焦点恢复。叠加保存确认取消后保留新建草稿；短窗口内容滚动、按钮可见。
- 偏好读写异常反馈、busy 解除及失败重试补齐；持久化成功后才同步运行设置。系统文件选择器和原生关闭兜底保留平台实现。
- 全量质量检查 **218 个用例**通过；新增 12 个弹窗行为场景。真实 Electron 原 **11 项**及 **7 个关闭场景 / 32 项断言**通过，生产构建通过。最终 UTF-8 范围 271 文件，格式范围 96 文件。
- 浏览器直接验证实际新建/设置/未保存叠加，隔离夹具验证完整偏好和引用删除确认；包含小窗口、取消、快捷键、焦点及重开值核对。偏好夹具 IPC 为模拟，安装包和 X/Alt+F4 人工验收不计为通过。
- 当时扫描 97 个组件文件，19 组机械重复候选归纳六类后续项；这些项已在下一轮全部收敛，见上方最新状态。原始排查保留于 [统一与排查报告](./Dialog_Unification_and_UI_Style_Audit.md)。

### 未保存项目的关闭保护完成（2026-10-08）

- Electron 原生窗口关闭及应用退出接入同一项目会话：未保存时提供 `Save & Close`、`Discard & Close`、`Cancel`；干净或空会话直接关闭。保存失败、取消文件选择、保存途中新增内容均不能默默关闭。
- 复用已有保存队列与版本确认；主进程校验请求 ID 和窗口来源，重复关闭合并，取消 app.quit 后清除退出意图。补齐后台窗口未触发 blur 时的 Inspector 草稿提交。
- 全量检查通过：17 个测试文件 / **206 个用例**；格式范围 85 文件。原 11 项 Electron 文件链路和新增 **7 个真实关闭场景（32 项断言）**通过；生产页面截图核对三按钮和提示可见。
- 已尝试使用桌面工具手动检查；同步用户输入后测试窗口关闭，未完成独立的 X / Alt+F4 手动验收，不把这部分记为通过。真实 `BrowserWindow.close()`、`app.quit()`、写盘与销毁先后关系由隔离自动化验证。详见 [关闭保护设计及报告](./Window_Close_Protection.md)。

### 手工功能测试指南（2026-10-08）

- [编辑器手工功能测试清单](./Manual_Functional_Test_Guide.md) 包含当前源码 Electron 启动、独立副本准备、10 项完整流程、22 项模块/异常检查、通过标准及问题记录模板；M20/M21/M22 分别为关闭确认、弹窗统一与六类 UI 规范复测。
- 清单明确浏览器下载与桌面落盘的差别、输入框外 Undo/Redo、已知缩放/引用范围缺口，以及需要专项环境的验证。清单供后续执行，不能把未填写的项目记为通过。

### 第六批性能与回归工作完成（2026-10-08）

- 新增 `npm run bench`：真实 BubbleHorror 示例和中/大型固定夹具，React 生产模式下分别测首次值、预热 p50/p95/max、组件同步提交、加载/序列化/校验、DOM 与 50 条历史的 GC 后 JS 堆。保留旧 Hook 对照及原始 JSON，可用相同夹具和测量入口复跑。
- 引用统计改为 `utils/blackboardReferences.ts` 一次按实体汇总，由 `useBlackboardData` 按不可变 project 身份缓存；Inspector 详细查询、导航和业务语义保持。大型项目 Blackboard 挂载 p50 **302.6 → 17.0 ms**、内容编辑 **276.0 → 6.3 ms**，首次挂载 **285.0 → 16.8 ms**；在本机已测规模内达到本批预算，不代表端到端延迟或 FPS。
- 全量 `npm run check`、生产构建通过；16 个测试文件 / **187 个用例**，格式覆盖 80 文件；真实 Electron **11 项**通过。构建仍有主 JS 超过 500 kB 的既有告警。
- 浏览器实际完成大工程筛选、四类引用抽查和导航，小工程创建/重排、删除标记与恢复、条件编辑、引用随 Undo/Redo 更新、FSM/演出拖动、取消项目切换、保存重开与运行时导出再导入。最终校验 0 Errors / 0 Warnings，临时布尔 false 保留，无页面 warn/error。
- 第五批原验收中的独立画布缩放仍未闭环；多节点整体撤销、原生关闭保护、CI、安装包/引擎联调仍待后续处理。真实示例本身的 7 条业务 error 未修改，不算校验通过。完整方法、证据和未覆盖范围见 [Architecture_Repair_Batch6.md](./Architecture_Repair_Batch6.md)。

### 第五批主体修复完成，缩放验收待补齐（2026-10-07）

- Blackboard 拆出工具栏、四页签、数据/操作与重排 Hook；PresentationCanvas 拆出交互协调、命令、节点/边/手柄与几何；ConditionEditor 拆出递归组合、组操作和布局。固定样式迁入目标组件 CSS 与主题变量。
- 项目诊断契约归入 types，FSM/演出图校验只接收 ProjectData；引用/诊断导航归入 Store 应用层。移除无调用的 api/旧 Electron Hook，IPC 封装迁到 platform，导出经 ProjectSession/ProjectPlatform，网络翻译归入 services。
- 修复作用域 ID 含连字符时排序失效、筛选状态重复维护、生命周期菜单悬停后点击收起、连线后目标节点继续漂移等问题。
- `npm run check`、生产构建与真实 Electron 11 项检查通过；14 个文件 / 180 个用例，格式覆盖 72 文件，lint/依赖失败探针扩至 10 项。此前批次结果与源码均保留。
- 浏览器实测筛选、排序、声明/引用导航、创建与撤销、框选多拖、连线/端点/删除、Not 条件及保存/导出/重开；Temporary false 与图端点完整保留。相同基线的黑板/画布前后截图字节一致；控制台无 warn/error，孤立测试 Branch 的 1 条业务 warning 符合预期。
- 设计、证据和覆盖边界见 [Architecture_Repair_Batch5.md](./Architecture_Repair_Batch5.md)。本节保留当批结果，第六批最新进展见上节；独立画布缩放核实为现有功能缺口，多节点拖动仍逐节点撤销，原生关闭保护及安装包/引擎联调待后续处理。

### 第四批修复完成（2026-10-07）

- 安装匹配 React 19 的类型包，前端及 Electron 均通过 strict；收紧 JSON/编辑值、Inspector 更新、画布节点、Action 和引用接口，变量作用域收集直接接收 ProjectData。
- 建立 `npm run check`，涵盖类型、lint、UTF-8、渐进格式、反向拦截和回归测试；错误 Action/载荷、漏配策略及非法编码等反例已验证会失败。当批格式覆盖 14 个配置/工具/新增文件，不代表现有所有组件完成排版统一。
- 修复条件 Hook、依赖数组、废弃字段访问和名称草稿同步。Provider 与 Context 分离，并在开发热更新期间保留 Context 身份，避免模块刷新时会话丢失。
- 11 个测试文件 / 154 个用例、生产构建、真实 Electron 11 项检查通过。浏览器实际验证局部/全局变量、Temporary 参数、FSM 搜索与拖拽、优先级/Wait 编辑、Undo/Redo、Context 热更新、下载和重开；最终工程为 0 error / 0 warning，修复后复测无新增 warn/error。
- 完整设计、工具版本、范围、证据与截图见 [Architecture_Repair_Batch4.md](./Architecture_Repair_Batch4.md)。本节保留第四批结果；组件与依赖整理的最新状态以上方第五批为准。

### 第三批修复完成（2026-10-07）

- 导入入口拆为明确封装识别、结构校验、有依据的旧格式迁移、辅助字段恢复、业务校验及候选提交；未知/损坏文件给出字段路径，保留旧项目、路径、历史、导航、dirty 和问题列表。
- 当前工程、运行时导出、原始 ProjectData、旧 ExportManifest 与真实历史条件 AST 纳入兼容和往返测试。运行时/历史导入要求另存，保留 ID、引用、顺序和参数语义；不把 meta.version 当作格式版本。
- 业务问题允许加载修复；诊断导航可定位 FSM、演出图、黑板及局部变量拥有者。增加 Project → Validate Project 和 Recheck，导出刷新问题列表并保留 error 阻断规则。
- 修复导入后节点点击产生虚假 dirty、Breadcrumb 同名 ID key 冲突，以及乱序阶段映射绕过深度限制、已删除演出节点诊断误选等边界问题。
- 9 个测试文件 / 140 个用例通过，前端与 Electron 类型检查、Vite 构建通过；真实 Electron 11 项检查验证另存副本重开及源文件不变。浏览器实际完成拒绝损坏导入、定位修复、重新校验、下载/重开、真实旧格式导入，最终重载后的检查无新增 warn/error。
- 设计、兼容来源、实际验收及截图见 [Architecture_Repair_Batch3.md](./Architecture_Repair_Batch3.md)。本节保留第三批结果；最新类型、检查与模块状态以上方完成记录为准。原生选择器没有手动操作，原生关闭确认仍待处理。

### 第二批修复完成（2026-10-07）

- 保存、新建、打开、最近项目、启动恢复、项目设置和自动保存使用每个 Provider 唯一的会话协调器。候选准备失败或取消保留原项目；成功提交时一次更新内容、路径、UI、历史和保存基线。
- Save & Continue 等待真实保存结果，失败/取消/保存期间新编辑都不会继续替换。浏览器下载保留 dirty，并使用 Download Copy 提示；项目设置保存完整内存内容。
- 同一队列协调写入顺序；自动保存周期不随持续编辑重启。原生写入采用临时文件替换与排他新建；候选读取不提前切换监听，自身写入用指纹过滤。
- 7 个测试文件 / 84 个用例通过，前端及 Electron 类型检查、Vite 构建通过；`npm run test:electron` 通过真实创建、编辑保存、重开、设置保存、失败保护和文件监听等 8 项验收。测试使用隔离目录，没有写入用户项目或偏好。
- 浏览器验证下载、取消/放弃切换、新建保护、设置完整下载与重开、解析错误保留原项目；最终重载后的检查无新增 warn/error。
- 完整设计与边界见 [Architecture_Repair_Batch2.md](./Architecture_Repair_Batch2.md)。本节保留第二批交付结果；导入边界和后续验证以上方第三批为准。原生关闭确认尚未接入；原生选择器未手动操作。

### 第一批修复完成（2026-10-07）

- 所有 Action 的领域、历史和只读策略集中管理；演出图级 CRUD、边属性、排序等内容操作统一进入版本与历史。只读模式也拒绝 Undo/Redo。
- 保存基线与编辑版本分离；保存后 Undo 为 dirty，Redo 回到已保存版本为 clean。保存期间继续编辑不会被旧保存确认清除 dirty，旧会话和旧路径结果被忽略。
- 同值操作不消耗历史；永久删除与外部资源同步形成历史边界；历史恢复同时清理失效选择和导航。
- Store Hook 增加显式返回类型，并修复因此暴露的 6 处类型问题；`stageDrag.ts` 已转换为 UTF-8。完整 React 类型、strict、lint 仍属于第四批。
- 新增 Vitest 入口，4 个文件 / 58 个用例通过；前端及 Electron 类型检查、Vite 构建通过。浏览器实际验证图 CRUD、保存后的 Undo/Redo、阶段拖入层级、下载并重新打开；完整重载后的复测无新增 warn/error。
- 完整设计、检查及限制见 [Architecture_Repair_Batch1.md](./Architecture_Repair_Batch1.md)。本节保留第一批交付结果；保存/切换与 Electron 验证的后续进展以上方第二批为准。以下审查与熟悉项目记录为修复前基线。

### 修复计划（2026-10-07）

- 已编写 [Architecture_Repair_Plan.md](./Architecture_Repair_Plan.md)，建议按六批实施：状态一致性 → 保存与切换 → 导入边界 → 类型与自动检查 → 模块及组件整理 → 性能测量与完整验收。
- 关键行为测试从第一批开始；每批都有明确的修改范围、技术方向和验收条件。
- 第一至四批完成；第五批主体完成但缩放验收未闭环；第六批性能测量、引用统计优化及已实现功能回归完成。具体剩余范围见最新批次记录，不能笼统认为全部产品功能已经完成。

### 架构与规范审查（2026-10-07）

- 目录与领域划分清楚，现有架构具备维护基础；跨模块约束和自动检查尚不完整。
- 独立场景确认：演出图级增删改未进入撤销历史，也未标记未保存；保存后的 Undo/Redo 同样未更新未保存标记。
- 保存确认回调未等待保存成功，Project 菜单的加载入口也没有统一复用切换前保护流程。
- 默认类型检查通过，但前端缺失 React 类型声明，当前 Store 访问 Hook 推断为 `any`；临时严格检查失败，大量诊断为类型缺失的连锁结果。
- 179 个 TypeScript 源文件中，`utils/stageDrag.ts` 未使用 UTF-8；规范检查和关键行为回归尚需建立。
- 完整证据、验证边界及改进顺序见 [Architecture_Review_2026-10-07.md](./Architecture_Review_2026-10-07.md)。本节保留修复前结论；首批已关闭的状态、撤销和编码问题以上方完成记录为准。

### 修复前核对（2026-10-07）：项目熟悉与现状确认

本次完成项目概览、UX 流程、领域模型、开发状态及关键代码的阅读，并核对当前 `main` 分支（HEAD：`73e5538`）。未修改业务代码；本节记录当前实现和验证边界。后文保留历史记录，其中与本节冲突的旧统计、旧待办不能作为当前完成度依据。

#### 当前架构与主要能力

- 编辑器核心为 React 19 + TypeScript + Vite 前端；现有 Electron 主进程、preload 与 IPC 服务承担本地项目读写、原生对话框、偏好和文件监听。浏览器环境保留文件选择与下载路径。
- 核心领域链路为 Stage Tree → PuzzleNode → FSM；Blackboard 管理全局变量、事件与四类脚本；PresentationGraph 管理脚本调用、等待、分支与并行节点的定义。
- 业务数据集中于 `ProjectData`，Stage、PuzzleNode、FSM、演出图通过 ID 关联；显示名称与用于引擎对接的 `assetName` 分离。当前 ID 类型为 `string`，新建资源使用 `resourceIdGenerator` 的类型前缀加计数格式，不能沿用旧文档的模板字符串强约束描述。
- Store 使用状态/派发双 Context 与 Reducer；当前有 9 个领域切片，包含 `projectMetaSlice` 与 `runtimeSlice`。撤销历史上限为 50 条。
- Stage 与 Node 的局部变量编辑、引用追踪均已有实现；Stage 变量可见性沿父级链收集。Branch 节点已有条件与 TRUE/FALSE 路径配置；Parallel 的专用 Inspector 当前为说明区域。
- `.puzzle.json` 保存完整项目及编辑器 UI 状态；`.export.json` 导出运行时数据。`useProjectActions` 在导出前调用六组工程校验，error 阻止导出，warning 写入消息堆栈后允许继续。
- `normalizeForExport` 深拷贝后清除画布位置、端口方向、阶段展开及参数绑定辅助字段，并规范化变量与常量值。当前实现保留 `displayOrder` 和参数绑定 `description`，与 [Export_Format_Changes.md](./Export_Format_Changes.md) 一致；下方 2026-03-04 历史摘要的相关剥离说明已不准确。
- 自动保存、上次项目恢复与外部文件变化监听均已有代码；外部同步用于资源状态合并，并非整个项目内容的自动重载。
- 仓库示例 `overview/example_project/BubbleHorror.puzzle.json` 可解析，包含 8 个 Stage、17 个 PuzzleNode / FSM、40 个 State、25 个 Transition、2 个演出图、28 个脚本、4 个全局变量与 8 个事件；该统计不代表示例已通过完整工程校验或引擎验证。

#### 本次验证与尚未验证的范围

- 前端：`node_modules/.bin/tsc.cmd --noEmit --pretty false`，退出码 0。
- Electron：`node_modules/.bin/tsc.cmd -p electron/tsconfig.json --noEmit --pretty false`，退出码 0。根 `tsconfig.json` 尚未启用 `strict`，Electron 配置已启用；旧文档的“TypeScript 严格模式”不能理解为整个仓库均已开启。
- 启动 Vite 并在浏览器检查编辑器空态、三栏布局、Editor/Blackboard 切换、Variables/Graphs 页签及项目菜单；检查期间未捕获到页面 warn/error 日志。
- 本次未进行项目创建或导入、复杂图编辑、保存/导出实际文件、Electron 原生窗口、打包、Unity 联调或大工程性能回归。代码入口存在不等于这些链路均已验收。
- `package.json` 当前没有自动化测试或 lint 脚本；Phase 5 的可靠性、性能和交付工作仍需按具体任务验证，不能据旧文档的阶段百分比推定全部完成。

### 最近更新（2026-03-04）

✅ **导出数据规范化（Export Data Normalization）**
- 新增 `utils/exportNormalizer.ts`，在导出前对数据深拷贝 + 清洗
- 值类型规范化：boolean/integer/float/string 值按声明类型强制修正
- 剥离 UI 专用字段：`isExpanded`、`displayOrder`、`position`（State/PresentationNode）、`fromSide`/`toSide`、`edgeProperties`
- 剥离 ParameterBinding 前端辅助字段：`id`、`kind`、`description`
- ConditionExpression 递归规范化（Literal.value 确保为 boolean、Comparison 补齐 operator）
- 数值字段规范化：`Transition.priority` 确保非负整数、`PresentationNode.duration` 确保正数
- 导出入口 `useProjectActions.ts` 已集成 `normalizeForExport()`
- 设计文档：`overview/dev/ExportNormalizer_Design.md`

### 历史更新（2026-02-23）

✅ **Preferences 自动保存功能（新增）**
- 在 Preferences 面板新增 `Auto Save` 开关与 `Interval (minutes)` 输入（默认 1 分钟）
- 新增全局自动保存调度 Hook（仅 Electron 生效，且仅在 `isDirty=true` 时触发）
- 偏好设置持久化新增 `autoSave` 字段，并兼容旧版 `preferences.json` 的默认值合并
- `Confirm Save` 流程统一改为调用 `saveProject`（不再误调用导出）


### 已完成阶段

✅ **Phase 1: 基础框架与数据浏览**（完成度: 100%）
- 视图切换（Editor ↔ Blackboard）
- Undo/Redo 历史管理
- 多画布导航（FSM/Presentation）

✅ **Phase 3: FSM 完整编辑功能**（完成度: 100%）
- 状态节点 CRUD
- 连线创建与编辑
- 触发器配置
- 条件表达式编辑器
- 参数修改器
- 演出绑定与参数传递
- 画布交互优化（框选、剪线、拖拽）

✅ **Phase 4: Stage 级别编辑与 Electron 集成**（完成度: 100%）
- [x] 黑板资源全功能编辑（变量/脚本/事件）
- [x] Stage 阶段树编辑（创建/删除/重命名/拖拽/局部变量）
- [x] PresentationGraph 编辑器基础功能集成
- [x] Electron 双进程架构与本地 I/O
- [x] v1.0.0-alpha 版本打包与发布

---

## 2. 代码库统计

### 2.1 目录结构（文件数量）

```
types/              9 个类型定义文件
store/
  ├─ slices/        7 个 Slice + 1 个索引文件
  └─ 核心文件        3 个（context, reducer, types）
api/                4 个文件
components/
  ├─ Layout/        5 个文件
  ├─ Explorer/      2 个文件
  ├─ Canvas/        ~8 个文件
  │  └─ Elements/   7 个文件
  ├─ Inspector/     ~32 个文件（合并 ConfirmDialog 后减少 1 个）
  │  ├─ condition/  多个子组件（已移除重复 ConfirmDialog）
  │  ├─ localVariable/  2 个文件
  │  └─ presentation/   2 个文件
  └─ Blackboard/    9 个文件
hooks/              4 个自定义 Hooks（合并 useKeyboardShortcuts 后减少 1 个）
utils/              13+ 个工具文件（新增 referenceNavigation、resourceFilters）
```

### 2.2 核心模块行数估算

| 模块 | 主要文件 | 行数范围 |
|------|---------|---------|
| StateMachineCanvas | StateMachineCanvas.tsx | ~520 行 |
| LocalVariableEditor | 主文件 + 2 个子组件 | ~400 行（已拆分） |
| PresentationBindingEditor | 主文件 + 2 个子组件 | ~450 行（已拆分） |
| ConditionEditor | 多层嵌套组件 | ~300 行 |
| Inspector 总计 | 33 个文件 | ~3000+ 行 |

---

## 3. 技术栈与工具

### 3.1 核心技术

- **框架**: React 18+ with TypeScript
- **状态管理**: Context API + Reducer（类 Redux 架构）
- **构建工具**: Vite
- **样式**: 全局 CSS（styles.css）

### 3.2 开发工具

- **调试**: `utils/debug.ts` 统一日志工具
- **校验**: `utils/validation/` 目录集中校验逻辑
- **常量**: `utils/constants.ts` 统一常量定义

### 3.3 代码质量工具

- 前端与 Electron TypeScript strict；ESLint 基本正确性、显式 any、Hook 与基础导入边界。
- Vitest + jsdom + React DOM：当前 187 个回归；另有真实 Electron 文件链路冒烟和生产模式性能基准。
- Prettier 渐进格式、UTF-8 检查与反向拦截测试；提交前执行 `npm run check`，构建与 Electron 冒烟单独执行。

---

## 4. 已实现核心功能清单

### 4.1 数据模型

? 完整的类型定义系统：
- ID 模板字符串类型（`stage-*`、`node-*` 等）
- 软删除状态机（Draft → Implemented → MarkedForDelete）
- 变量作用域系统（Global/StageLocal/NodeLocal/Temporary）
- 条件表达式 AST
- 演出绑定机制

### 4.2 状态管理

? 7 个领域 Slice：
- **fsmSlice**: 状态机 CRUD
- **presentationSlice**: 演出图 CRUD
- **nodeParamsSlice**: 节点局部变量
- **blackboardSlice**: 全局资源管理
- **navigationSlice**: 导航与视图
- **projectSlice**: Stage 树与 Node 更新
- **uiSlice**: 选择、消息、面板

? Undo/Redo 机制：
- 基于快照的历史管理
- 支持多级撤销/重做

### 4.3 UI 组件

? 布局系统：
- 三栏布局（Explorer + Canvas + Inspector）
- 可调整面板大小
- 响应式设计

? 画布编辑器：
- FSM 画布（状态节点、连线、框选、剪线）
- Presentation 画布（基础实现，修正节点吸附）
- 画布平移导航；独立缩放尚未实现
- 上下文菜单

? Inspector 面板：
- 33 个专用编辑器组件
- 条件表达式可视化编辑
- 参数绑定与修改器配置
- 触发器编辑
- 统一的删除保护逻辑与样式 (Refined)
- 智能属性面板 (Inspector Fallback: FSM & Presentation Node)
- PuzzleNode 快捷键删除修复 (Fixed Action Type & Simplified Confirmation Dialog - Fixed Redux State Retention)
- 智能属性面板 (Inspector Fallback Mechanism)
- PuzzleNode 快捷键删除修复 (Fixed Action Type & Added Confirmation Dialog)

? Blackboard 管理：
- 全局变量/事件/脚本浏览
- 按状态/类型筛选
- 按状态/类型筛选
- 快捷键删除支持 (Presentation Graphs now deletable in Blackboard view)
- 软删除确认流程
- 资源拖拽排序（Drag-and-Drop Reordering）

### 4.4 交互功能

? 快捷键系统：
- Ctrl+Z / Ctrl+Y (Undo/Redo)
- Delete (删除选中元素)
- Ctrl+拖拽 (剪线模式)
- 双击/Backspace (导航返回)

? 画布交互：
- 单击选中
- 拖拽移动
- 框选多选
- 连线创建（拖拽端点）

? 校验与提示：
- FSM 拓扑校验（环检测、孤岛检测）
- 变量引用检查
- 全局消息堆栈（info/warning/error）

---

## 4.5 代码复用重构（P1/P2）

✅ **P1-1: 提取 navigateToReference 工具函数**
- 新增 `utils/referenceNavigation.ts`，集中处理 6 种 targetType 的引用导航逻辑
- 替换了 5 个 Inspector 文件中 ~392 行重复的 switch-case 代码：
  - VariableInspector、ScriptInspector、EventInspector、PresentationGraphInspector、LocalVariableEditor
- 每个文件的 `handleReferenceClick` 从 50-120 行缩减为 2-3 行

✅ **P1-2: 合并重复 ConfirmDialog 组件**
- 删除 `components/Inspector/condition/ConfirmDialog.tsx`（104 行）
- ConditionEditor 改用共享的 `components/Inspector/ConfirmDialog.tsx`
- 从 `condition/index.ts` 中移除无用的 re-export

✅ **P2-1: 合并键盘快捷键 Hook**
- 删除 `hooks/useKeyboardShortcuts.ts`（98 行）
- StateMachineCanvas 改用 `hooks/useGraphKeyboardShortcuts.ts`（参数适配）
- 两个 Hook 功能完全重叠：Escape 清除多选、Ctrl 切线模式、Shift 连线键

✅ **P2-2: 提取 MarkedForDelete 过滤工具函数**
- 新增 `utils/resourceFilters.ts`，导出 `filterActiveResources<T>()` 和 `filterActiveOrSelected<T>()`
- 替换了 9 个文件共 10 处的内联 `.filter(v => v.state !== 'MarkedForDelete')` 调用

---

## 5. 已知限制与待完善项

### 5.1 待完善功能

**Stage 局部变量**：已支持 Stage 与 Node 的声明、作用域选择及引用导航，不再作为未实现项。

? **Stage Inspector 滚动记忆**:
- 已修复 Stage Inspector 切换时不保留滚动位置的问题（与 PuzzleNode Inspector 行为一致）

**PresentationGraph 编辑器**：基础画布及 Branch 条件/分支已有实现；Parallel 专用 Inspector 仍需完善。独立画布缩放与多节点整体撤销待补齐。

**自动化测试（第六批更新）**:
- 当前 187 个回归覆盖 Store、会话、导入、诊断/引用导航、变量作用域、图交互/几何、条件与引用统计；另有 11 项 Electron 实际链路检查。
- CI 尚未接入；性能基准手动运行，不将机器相关毫秒阈值作为普通单测断言。

? **高级校验**:
- 跨资源循环引用检测
- 变量类型兼容性检查

### 5.3 性能测量与后续边界

- 第六批已测至单 FSM 300 状态、单演出图 160 节点、全工程 1,824 状态；批量引用统计解决本轮黑板超预算问题，尚无依据强制引入虚拟化或更换 Store。
- 已测 50 次位置修改后的 GC 堆趋势；混合大对象编辑、长期会话与更大规模仍需独立测量。
- 独立画布缩放先补齐功能再测性能；主 JS 包体告警、整窗绘制/FPS 和安装包冷启动尚未关闭。

---

## 6. 文档同步状态

? **已同步文档**:
- `Architecture_Guide.md` - 反映 7 个 Slice 和最新组件结构
- `Domain_Model.md` - 包含完整的 Store 状态结构
- `Implementation_Status.md` - 本文档

? **保持更新的文档**:
- `Phase3/P3_Code_Review_3.md` - 最新代码审查结果
- `UX_Flow.md` - 用户交互流程规范

?? **可能过时的文档**:
- `Phase2_Guide.md` - 部分内容可能与当前实现有差异

---

## 7. 下一步计划

当前架构与规范修复顺序以 [Architecture_Repair_Plan.md](./Architecture_Repair_Plan.md) 为准。以下保留历史阶段待办，实施前需核对当前源码及最新审查结果。

### Phase 4 优先级排序

1. **Stage 局部变量支持**: 扩展 LocalVariableEditor
2. **PresentationGraph 编辑器**: 完善节点类型支持
3. **单元测试基础设施**: 添加 Vitest + React Testing Library
4. **高级校验**: 跨资源引用检测

---

## 8. 贡献指南

### 添加新功能前

1. 阅读 `Architecture_Guide.md` 了解分层规则
2. 阅读 `Domain_Model.md` 了解数据模型
3. 检查 `UX_Flow.md` 确认交互规范

### 代码规范

- 所有重要代码必须包含中文注释
- 组件超过 400 行需考虑拆分
- 禁止内联样式，使用全局 CSS
- React.memo 组件必须添加 displayName
- 新增工具函数必须放在 `utils/` 下

### 提交前检查

- [ ] TypeScript 编译无错误
- [ ] 核心逻辑包含中文注释
- [ ] 更新相关文档（如修改了类型或架构）
- [ ] 测试 Undo/Redo 功能
- [ ] 检查浏览器控制台无错误

---

**文档维护**: 本文档应在每个 Phase 完成后更新，确保反映最新的项目状态。
