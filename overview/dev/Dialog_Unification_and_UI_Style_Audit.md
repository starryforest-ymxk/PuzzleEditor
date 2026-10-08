# 内部弹窗统一与重复 UI 样式排查

## 任务范围与技术设计（2026-10-08，实施前）

统一未保存确认、删除确认、新建项目、项目设置和用户偏好五种内部弹窗。业务组件保留保存、删除、目录选择、表单状态等职责，公共组件只处理外观、键盘和焦点。系统文件选择器及渲染器不可用时的 Electron 原生关闭兜底继续由平台层负责。

对应 UX_Flow §1.1 的危险操作确认、§2.1 的项目操作与操作反馈、§2.4 的标签视觉规则和 §2.5 的设置入口。新建/设置保留字段、校验、保存失败反馈；描述框 Enter 换行；新建名称/目录 Enter 提交；设置及偏好 Ctrl+Enter 提交。所有产品文字保持英文。

### 公共组件契约

- `components/shared/Dialog.tsx`：标题、图标、语义色、确认/表单两档宽度、内容、固定操作区、忙碌状态、关闭回调、初始焦点和表单快捷键；使用 body Portal，脱离 Header 等父层叠上下文。
- 共享 CSS 使用已有主题变量，统一遮罩、边框、圆角、标题、正文、按钮、表单、设置卡片与错误提示。普通主操作用橙色；删除用红色；保存可用绿色，语义差异保持。
- 同一处维护弹窗栈。只有最上层响应 Escape/Tab，背景及下层弹窗暂时 inert；默认确认焦点为 Cancel，表单聚焦并选中名称。关闭后返回有效原焦点或下层弹窗。StrictMode 下注册/注销须对称。
- 忙碌时禁用内容字段与操作，Escape/快捷键不触发业务；遮罩不隐式关闭，避免丢失表单草稿。内容区超高滚动，标题和按钮始终可访问。
- 不改变工程 Session、Reducer 或 IPC 协议。偏好读写异常在原组件反馈并解除忙碌，避免统一的关闭禁用造成永久卡住。

### 迁移与验证计划

先实现基础组件，再迁移五种弹窗与偏好内重复开关；补充真实 React 表单与嵌套弹窗测试，适配既有 Portal 查询。运行完整质量门禁、生产构建和真实 Electron 工程/关闭回归。可用时通过浏览器实际点击、键盘操作、窗口尺寸检查统一外观，并记录证据。

## 其他重复维护情况（完成排查）

排查组件中的固定浮层、重复配色、表单边框/间距和语义提示。不能仅按相似颜色认定组件应合并；不同业务内容与紧凑度可以保留。

扫描 `components` 中 **97 个 TS/TSX 文件**；TypeScript AST 对跨文件、至少四个属性的内联样式进行规范化比对，得到 **19 组重复候选**。简单布局复用不等于缺陷；颜色映射、相似但不完全相同的样式另外人工核对。结果不是“19 个 bug”，也不声称覆盖所有运行时视觉差异。

可复跑：`node overview/dev/verification/ui-style-audit.mjs`；原始位置和样式见 [候选清单](./verification/ui-style-duplicates.json)。下表六类是人工确认的维护风险，尚未迁移；本次统一范围是内部弹窗及其表单、按钮、偏好开关。

| 类型 / 优先级 | 已确认位置 | 建议 |
| --- | --- | --- |
| 右键菜单 / P1 | [FSM 菜单](../../components/Canvas/Elements/CanvasContextMenu.tsx)、[演出图菜单](../../components/Canvas/shared/GraphContextMenu.tsx) 各自维护相同外壳与外部点击逻辑；Explorer/StageOverview 使用另一套 menu-item 类，z-index 1000/9999 不同 | 统一 MenuSurface、MenuItem、Separator，再迁移事件和定位；保留各业务菜单项，并测试边缘定位、取消和禁用项 |
| 检查器表单 / P1 | [ScriptBindingSection](../../components/Inspector/presentation/ScriptBindingSection.tsx) 多处复制输入/选择框样式；ValueSourceEditor、ParameterModifierEditor、VariableSelector 等有局部变体 | 统一紧凑 Field/Control 与密度变量，先迁移静态外观；保留 draft、blur 提交、布尔 false/数值 0 和键盘语义 |
| 语义颜色映射 / P1 | [VariableCard](../../components/Blackboard/VariableCard.tsx)、VariableInspector、Inspector/localVariable/LocalVariableCard 重复 getTypeColor；VariableSelector 对相同变量类型使用另一套颜色。ScriptCard、ScriptInspector 复制 categoryColors，而 root CSS 已有资源语义变量 | 先确定唯一变量类型/脚本类别色表，再集中维护语义 token；不能让 UI 组件互相导入私有工具。这是可观察的一致性差异 |
| 绑定错误与资源预览 / P2 | [GraphBindingSection](../../components/Inspector/presentation/GraphBindingSection.tsx) 与 [ScriptBindingSection](../../components/Inspector/presentation/ScriptBindingSection.tsx) 复制红色提示框；GraphBindingSection 与 ResourceSelect 复制预览网格/描述样式 | 复用已支持 error/warning/info 的 InspectorInfo；抽取共享资源预览外观，保留不同资源字段 |
| 分区标题与卡片框架 / P2 | FsmInspector、GraphInspector、PresentationNodeInspector 有相同分区标题；Event/Script/Variable 卡片与多个 Inspector 重复标题行、ID、描述排布 | 先将相同标题/卡片布局接入现有 inspector-section 与 Blackboard CSS；需要交互差异时只共享外观，不强合并业务组件 |
| 图节点与边标签 / P3 | [StateNode](../../components/Canvas/Elements/StateNode.tsx) 与 GraphNode 复制标题、状态标记、正文样式；ConnectionLine 与 GraphEdge 复制边标签外壳 | 共享 GraphNodeSurface/EdgeLabel 样式；单独验证命中测试、连线、选中/错误优先级，避免把几何和拖拽逻辑纳入一次视觉迁移 |

已有可复用基础并非缺失：主题变量、`search-input`、`inspector-section`、StateBadge、InspectorInfo、Blackboard CSS、condition CSS 和演出节点样式已经共享。后续应优先补齐调用方，避免再建平行的组件库。

建议分三小批继续：第一批菜单与语义色表；第二批检查器控件、提示和分区卡片；第三批图节点/边标签。每批保留业务逻辑，单独验证交互后再推进；不建议一次全仓替换内联样式。

## 实施结果与验证

### 完成项

- 五种弹窗全部接入 `Dialog` / `DialogButton` / `dialog.css`，各组件原有独立 palette、遮罩、标题和操作区样式已移除。
- 外壳统一：确认 440px、表单 520px，上限适配窗口；标题/按钮固定，内容区滚动。危险操作红色，未保存警告琥珀色，保存确认绿色，其余主操作橙色。
- 共用 Portal、弹窗栈、Tab/Shift+Tab、Escape、焦点恢复和背景 inert；busy 禁用字段与动作。只关闭最上层，保留下层表单草稿。
- 表单标签关联控件；偏好三组开关共用 DialogToggle。模型控件新增样式类和可访问标签入口，预设模型列表未变。
- 偏好持久化成功后才同步 Store；读写异常反馈并解除 busy，失败可重试。关闭遮罩不再丢弃偏好草稿；需明确 Cancel/Escape。
- Session、Reducer、IPC 协议没有因本次迁移改动。系统文件选择器和渲染器不可用时的原生兜底保留平台外观。

### 自动验证

| 验证 | 结果 |
| --- | --- |
| `npm run check` | 通过：18 文件 / **218 个用例**；其中新增 12 个真实 React DOM 场景覆盖嵌套、焦点循环、busy、快捷键、字段和偏好失败重试。原有引用删除、条件树删除、关闭草稿测试继续通过 |
| UTF-8、严格 TS、lint、格式与故意错误拦截 | 通过；最终范围 271 个源码/配置文件，格式 96 文件，10 lint/7 类型/3 编码/1 格式拦截探针 |
| `npm run build` | 通过：1884 模块，主 JS 622.76 kB / gzip 166.23 kB；保留原有超过 500 kB 告警 |
| 真实 Electron 文件会话 | 原 **11 项通过**；[原始结果](./verification/dialog-electron-session.json)，隔离目录 `D:\Temp\puzzle-batch2-electron-RxT7jg` |
| 真实 Electron 关闭 | **7 场景 / 32 项断言通过**；[原始结果](./verification/dialog-electron-close.json)，隔离目录 `D:\Temp\puzzle-close-electron-MNxQTP`。含保存、放弃、取消、失败重试、另存与 app.quit，并在关闭套件内构建当前生产页面 |

### 浏览器直接操作

- 实际编辑器：新建名称聚焦/选中，描述 Enter 换行，Tab 循环，成功创建；项目设置取消保留原项目；新建时叠加未保存确认，Escape 只关闭上层，名称 `Nested Draft Kept` 保留且重新获得焦点。
- 实际编辑器小窗口 **400×360**：设置内容可滚动（内容 492px / 可视 198px），底部操作仍可见，导出文件名字段可定位编辑。
- 独立 [手测夹具](../../tests/fixtures/dialogs-preview.html)：直接操作完整偏好表单、Auto Save、2 分钟间隔、OpenAI 自定义模型、自动翻译、Ctrl+Enter 保存及重开；**480×480** 下内容滚动、按钮固定。删除确认验证引用预览、Cancel 默认焦点、Tab 循环、Escape 取消、确认回调和触发点焦点恢复。
- 两个页面均未发现 Console warn/error。夹具模拟 IPC、只保存在内存；这不是桌面偏好真实写盘或原生目录选择器的手动验收。真实文件链路和关闭入口由上面的 Electron 回归验证。
- 截图：[新建](./verification/dialog-new.png)、[设置](./verification/dialog-settings.png)、[未保存叠加](./verification/dialog-unsaved.png)、[真实 Electron 关闭](./verification/dialog-close.png)、[偏好](./verification/dialog-preferences.png)、[删除](./verification/dialog-delete.png)、[设置小窗口](./verification/dialog-settings-small.png)、[偏好小窗口](./verification/dialog-preferences-small.png)。

### 边界与后续

本报告记录弹窗统一当时的范围；上表六类后续项已在下一轮全部迁移，见 [UI 统一实施报告](./UI_Consistency_Implementation.md) 和 [长期维护规范](./UI_Standards.md)。原始 97 文件/19 组数据为历史基线；最新扫描结果是 103 文件/4 组纯布局。安装包、系统文件选择器外观及真实 Windows X/Alt+F4 的人工验收未在此记为通过。不能据此承诺所有历史功能绝对零回归。

修改前基线备份：`D:\Temp\puzzle-dialog-baseline-ac1a3132`（374 文件）。保留此前 1–6 批及关闭保护的未提交工作，未创建提交。
