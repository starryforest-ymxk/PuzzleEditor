# 其余共享 UI 收敛设计与实施报告

## 实施前设计（2026-10-08）

目标：完成弹窗排查报告剩余六类格式收敛，建立可执行的唯一维护来源。对应 UX_Flow §2.4 Inspector Section、§3 黑板卡片与语义状态、§4 阶段菜单、§5 FSM/演出图节点/连线交互。UI 保持英文，业务状态、保存协议、导入格式和几何命中逻辑保持现有职责。

### 公共职责与迁移

1. `components/shared/theme.css` 与 `uiTokens.ts`：主题和变量类型/作用域/脚本类别/资源状态唯一色表；移除各视图 getTypeColor/categoryColors/局部 palette。紧凑和标准控件是共享密度变体，不能复制新的边框/字体规格。
2. `components/shared/Menu.tsx` 与共享 CSS：菜单框架、菜单项、分隔线、禁用/危险、关闭与 Escape；FSM、演出、Explorer、Stage 概览业务菜单只保留项目内容、定位和回调。保留画布相对坐标与屏幕固定坐标两种定位模式及子菜单。
3. 共享控件/Section/卡片样式：统一原生 input/select/textarea、选择器外观、Inspector 标题、卡片标题行/ID/描述；现有 draft/blur/false/0、变量筛选、参数类型规则原样使用。
4. `ResourcePreview` 与 `InspectorInfo`：复用预览排布和提示等级。资源类型可通过 rows/children 表达不同字段，不能复制提示框/预览框样式。
5. 图节点使用现有 `GraphNode` 作为唯一外壳，FSM `StateNode` 仅做 State 适配；FSM/演出保留蓝/粉语义变体，位置/尺寸来自领域几何。边标签共用组件，曲线路径、端点、剪线逻辑分别留在业务层。
6. `overview/dev/UI_Standards.md` 建立唯一规范：按元素查组件/样式/语义 token，允许局部位置/布局与几何，禁止复制公共外观和语义映射。更新 AGENTS.md 和架构文档入口。

### 防回退检查

扩展现有质量门禁：用 TypeScript AST 检查已收敛的局部色表、原生控件外观覆盖、已知重复装饰规格，以及受保护公共类的重复定义；共享实现与业务坐标允许独立维护。检查必须以故意错误和合法变体验证，不能只靠文档提醒。禁止依赖大段历史豁免绕过本次迁移。

### 验证与边界

逐类迁移后运行类型/lint 和相关交互回归；补充菜单关闭/禁用与坐标、跨视图语义一致、FSM 适配和共用标签事件测试。最后全量 check、生产构建、真实 Electron 文件/关闭回归；浏览器直接检查菜单、字段、提示、图节点与黑板。保留先前全部未提交成果，先备份当前基线。系统原生选择器仍由平台维护，纯布局相似不要求合并不同业务组件。

## 实施与验证结果

### 完成范围

六类重复维护项均已迁移：

- FSM/演出图、Stage/Node 浏览器、概览创建、项目菜单与脚本创建菜单统一 `MenuSurface/MenuItem/MenuSeparator`；保留各自定位，统一危险/禁用态和键盘导航。外部点击、Escape 和触发器焦点恢复由 `useLayerDismissal` 维护，变量选择器也复用。
- 80 个原生表单控件接入 `.ui-control`；旧 CSS 控件类移除基础视觉。标准/紧凑/条件/弹窗字段保持 30/24/26/38px 密度；非法参数名称和已删除资源使用统一错误态。事件提交、草稿、false/0 和只读行为保持。
- 类型、作用域、脚本类别、资源状态颜色归入 `uiTokens.ts/theme.css`；变量卡片与选择器的差异配色已消除，徽章复用 Badge。
- 资源详情和图绑定使用 ResourcePreview；脚本/图丢失引用、已删除资源提示使用 InspectorInfo。同一预览的名称/ID/状态/描述/附加行不再分别维护。
- 小节标题、实体头部、ID、描述、资源卡片密度由 `ui.css` 维护；旧卡片类为同一规则的别名。
- StateNode 只适配 State 与尺寸，节点外壳由 GraphNode 维护蓝/粉变体；两类边标签使用 EdgeLabel，路径、命中、手柄和剪线仍留在业务层。

建立 [UI 规范](./UI_Standards.md)，并接入根 AGENTS、架构指南和手工复测指南。AGENTS 原为 Windows-1252，保留原规则并规范为 UTF-8。格式门禁扩展到全部 UI 源码，避免不同子系统继续采用多种格式。

### 防回退与扫描

`npm run check:ui` 已接入 `check`；检查公共组件所属、原生控件 class/外观覆盖、旧菜单入口、私人语义色表、公共选择器/变量的重复定义及跨文件装饰规格。10 个故意错误和 2 个合法探针通过；不使用历史文件/行号豁免。

扫描组件文件由 97 个变为 103 个，机械重复候选 **19 → 4 组**。剩余为 flex/grid/尺寸/只读透明度等布局组合，已检查无重复装饰规格；不能将“4 组布局相似”解释为四类外观尚未完成。原始扫描见 [ui-style-duplicates.json](./verification/ui-style-duplicates.json)。

### 自动验证

| 验证 | 当前结果 |
| --- | --- |
| `npm run check` | **19 个文件 / 226 个用例全部通过**，新增 8 个统一组件交互用例 |
| 编码/类型/lint/格式 | 通过；UTF-8 282 文件，格式 173 文件 |
| UI 所属检查 | 110 个组件/样式文件通过，跨文件重复装饰规格为 0 |
| 门禁反向探针 | 原 10 lint、7 类型、3 编码、1 格式探针通过；新增 10 错误 UI、2 合法探针通过 |
| 生产构建 | 通过，1891 模块、主 JS 608.97 kB / gzip 164.74 kB；仍有主 JS 超过 500 kB 的既有告警 |
| 真实 Electron 文件链路 | 原 **11 项通过**，见 [原始结果](./verification/ui-consistency-electron-session.json) |
| 真实 Electron 关闭 | **7 场景 / 32 项断言通过**，见 [原始结果](./verification/ui-consistency-electron-close.json) |

交互用例覆盖方向键跳过禁用项、子菜单/StrictMode 外部关闭、Escape 焦点返回/触发器收起、FSM ID/鼠标回调/校验优先级、两类边标签/只读手柄、当前已删除选项保护、图摘要/跳转/丢失引用、变量选择/清空/跨视图颜色。原条件树、画布手势和编辑历史回归继续通过。

### 浏览器直接操作与 UX 对照

以 `batch6-browser-saved.puzzle.json` 独立回归夹具载入实际编辑器，没有修改用户工作工程。核对 UX_Flow 的黑板浏览/资源检查、Stage/Node 浏览器、概览创建入口、FSM/演出图选择与右键、条件/值来源与演出绑定流程：

- 黑板全局/局部类型色一致，检查器文本/数值/select 为相同背景、描边及 30px 高度，textarea 保留多行。
- 实际 FSM/演出图右键动作可见，Escape 关闭；Stage/Node 浏览器菜单及概览创建菜单复用相同外观。
- 条件变量选择器搜索 `Counter` 后筛选出对应变量，类型/作用域徽章使用相同 token；Escape 收起并将焦点返回触发器。
- 演出 Call 的脚本预览和 5 个参数控件可见，全部为 24px，布尔 `false` 保留；图节点蓝/粉差异通过变体保留。
- Stage OnEnter 图预览显示状态、2 个节点及起始 Call；Edit Graph 跳转到对应画布。页面 Console 没有 warn/error。

截图：[FSM 菜单](./verification/ui-consistency-fsm.png)、[脚本子菜单](./verification/ui-consistency-script-menu.png)、[条件选择器](./verification/ui-consistency-controls.png)、[演出脚本](./verification/ui-consistency-presentation.png)、[概览菜单](./verification/ui-consistency-stage-preview.png)、[图资源预览](./verification/ui-consistency-resource-preview.png)。

### 边界

静态门禁和规范能够拦截已登记模式，近似/间接生成的重复仍需代码审查。安装包、引擎联调和 Windows X/Alt+F4 的人工验收没有在此记为通过；既有独立画布缩放等历史待办不属于本轮范围。不能据测试承诺所有历史功能绝对零回归。

本轮基线备份：`D:\Temp\puzzle-ui-baseline-8b55933e`，393 文件。真实 Electron 最终隔离目录为 `D:\Temp\puzzle-batch2-electron-WzKtnT` / `D:\Temp\puzzle-close-electron-eEdmz8`。此前修复保留，未创建提交。
