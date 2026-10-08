# UI 组件与样式维护规范

更新：2026-10-08。适用于全部编辑器 UI。**相同语义的元素只能有一个外观和基础交互的维护入口。** 产品文字使用英文，设计说明与关键代码注释使用中文，文件为 UTF-8。

## 唯一维护入口

| 元素 | 所属实现/样式 | 业务组件的职责 |
| --- | --- | --- |
| 内部弹窗、标题、按钮、字段、开关 | `components/shared/Dialog.tsx`、`dialog.css` | 文本、草稿、校验、保存/删除动作 |
| 菜单外壳、菜单项、分隔符 | `components/shared/Menu.tsx`、`ui.css` | 项目/Stage/Node/图的动作和坐标 |
| 外部点击、Escape、恢复触发器焦点 | `components/shared/useLayerDismissal.ts` | 层引用、触发区域、关闭回调；子菜单交给父层 |
| 文本/数字/select/textarea | `ui.css` 的 `.ui-control` | value、change/blur/键盘提交、disabled、布局和高度 |
| 选择器浮层 | `ui.css` 的 `.ui-popover` | 搜索、过滤、列表数据，复用共享关闭 Hook |
| 变量类型、作用域、脚本类别、资源状态颜色 | `components/shared/uiTokens.ts` + `theme.css` | 按领域类型获取 token，不自行指定色值 |
| 徽章 | `components/shared/Badge.tsx` | 文本、语义颜色、紧凑变体；Blackboard/StateBadge 是兼容入口 |
| 信息/警告/错误框 | `Inspector/InspectorInfo.tsx` + `ui.css` | 等级、消息、图标、紧凑变体和位置 |
| 资源预览 | `components/shared/ResourcePreview.tsx` | name/id/state/description、附加 rows、footer 动作 |
| 小节标题、实体头部、ID、说明、资源卡片 | `ui.css` 的 `.inspector-section-title/.ui-entity-heading/.ui-id/.ui-description/.ui-resource-card` | 内容与排序；旧 `card-header/card-key/card-description` 是同一规则的兼容别名 |
| FSM/演出图节点外壳 | `Canvas/shared/GraphNode.tsx` + `ui.css` | 领域数据、坐标/尺寸、内容、鼠标回调；StateNode 只做适配 |
| 图边 HTML 标签 | `Canvas/shared/EdgeLabel.tsx` + `ui.css` | 中点、文本、选择/右键回调 |

上表省略 `components/` 的路径均相对于该目录。`theme.css` 是全局主题及已登记语义色值的唯一来源；`uiTokens.ts` 只映射 CSS 变量，不再保存一份平行色表。`styles.css` 引入共享样式并负责应用布局，旧控件类只保留宽度、间距等布局。

现有条件块的 And/Or/Not/Comparison/ScriptRef 专属样式只有 `Inspector/condition/conditionStyles.ts` 一个维护入口；其通用颜色引用主题，类型控件继续使用 `.ui-control`，用 `ControlStyle` 的语义变量表达颜色。专属样式不能复制到其他组件。

## 开发规则

1. 改 UI 前查上表及实际共享实现。存在对应元素时必须复用，不新增第二个弹窗、菜单、预览或图节点外壳，不从其他业务组件复制样式/色表。
2. 业务组件维护业务数据和特有交互。hover/focus/disabled/危险态、字体、描边、阴影和内部间距在共享入口维护。禁止事件处理器为公共组件另写 DOM 外观。
3. 差异通过有名变体表达：菜单 `danger/disabled/submenu`，提示 `level/compact`，徽章 `compact`，图节点 `variant="fsm" | "presentation"`。控件标准高度 30px，脚本参数 24px、条件行 26px、弹窗字段 38px；密度不同仍共用基础外观。
4. 原生文本、数字、选择和多行控件必须含 `.ui-control`；数字字体按 `type="number"` 统一。搜索图标缩进使用 `.ui-control--search`，条件箭头使用 `.ui-control--kind`。错误态使用 `data-invalid`，展开态使用 `data-open`。
5. 相同语义跨视图必须同色：调用 `variableTypeColor/variableScopeColor/scriptCategoryColor/resourceStateColor`。新增语义先扩展主题和映射，不在调用方建立私人配色。
6. 局部样式允许坐标、尺寸、布局，例如 left/top/width/height、flex/grid、margin、overflow。禁止调用方覆盖共享 background/border/radius/font/padding/shadow。确需视觉变体时在所属实现中新增，补齐规范和验证。
7. 菜单项默认是原生 button；仅当内部容纳子菜单或另一按钮时用 `as="div"` 并保留共享键盘行为。子菜单在父菜单内设置 `submenu`。菜单外的触发器传 `boundaryRef`，画布可用 `consumeOutside` 防止关闭菜单同时启动拖动。
8. 图节点错误优先于警告/初始态，选中框允许叠加校验边框；蓝/粉主题由 variant 表达。锚点、命中区、路径、手柄、剪线、Undo/Redo 不迁入外观组件。
9. 共享基础不依赖 Store 或业务服务。ResourceDetailsCard/StateNode 等适配器不能重新定义外壳。系统原生文件选择器由平台维护。

```tsx
// 业务提交方式保持原位，外观由共享规则和错误态决定。
<input className="ui-control" value={draft} onChange={handleChange}
  onBlur={commit} data-invalid={invalid} style={{ width: '100%', height: 24 }} />

// 资源绑定只构造数据和业务行，不复制预览网格或边框。
<ResourcePreview {...resource} rows={[{ label: 'Nodes:', value: count }]}
  footer={<button className="btn-ghost" onClick={navigate}>Edit Graph &gt;</button>} />
```

## 新模式和新变体

先登记名称、所属文件、语义和变体，再实现共享入口，然后迁移全部相关调用方。不能默认“先在本组件临时复制一份”。新增变体说明现有变体为何不足，并核对焦点、键盘、禁用/忙碌、错误态和窄 Inspector。

纯布局相似不强制合并无关业务组件。例如名称字段与自动填充按钮的 flex 排布、只读列容器可以保留。判断依据是是否重复决定同一元素的外观与基础行为，而非 JSX 是否类似。

## 检查和验收

`npm run check:ui` 已加入 `npm run check`。`scripts/ui-style-rules.mjs` 用语法树检查缺少共享 class 的控件、基础外观覆盖（含同文件常量/展开对象）、旧菜单入口、自建 menu/menuitem/dialog、重复语义色表、主题变量/公共选择器的多处定义、旧控件视觉规则回退，以及跨文件相同且包含多项装饰属性的内联规格。纯布局不拦截。

`check:guards` 有 **10 个错误 UI 探针、2 个合法布局/token 探针**，确认规则会实际拒绝复制实现。交互回归在 `tests/components/uiConsistency.test.tsx`；原有编辑、弹窗、条件、画布、会话、历史回归继续执行。

静态检查不能穷举全部间接生成和近似重复 CSS。审查仍须按上表确认归属，不以“没有报错”为由复制外观。新重复模式需同时修复源码、扩展规则和加入反向探针，不用文件名单/旧行号豁免。

提交前执行生产构建并直接在浏览器核对菜单、密度、颜色、预览、图节点/标签和业务动作；涉及桌面会话时执行 `npm run test:electron`。使用独立工程副本，手工记录“未测/通过/失败”；不将未执行的安装包/引擎联调记为通过。

参见 [实施设计及报告](./UI_Consistency_Implementation.md)、[功能复测指南](./Manual_Functional_Test_Guide.md)。
