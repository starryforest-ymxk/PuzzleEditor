# 第五批：模块边界与复杂组件职责整理

状态：主体重构及已实现交互验收完成（2026-10-07）；原计划的独立画布缩放验收未闭环（2026-10-08 校正状态）。技术设计先于本批业务代码修改建立，以下保留当批验收结果。

## 目标与约束

对应修复计划第五批，以及 P1-T08/T09 的分层、可复用交互要求。保持项目文件、Action 和现有编辑语义；不更换状态库，不引入未经测量的缓存/索引方案。第四批工作区作为基线，独立备份位于 `D:\Temp\puzzle-batch5-baseline-Dv0D6Q`（306 个文件）。开始前 `npm run check` 通过，154 项测试成功。没有提交或覆盖此前四批的未提交工作。

## 技术设计

1. **领域与应用边界**：项目诊断类型迁入 `types/validation.ts`；FSM/演出图即时校验仅接收 `ProjectData`。引用/诊断导航属于应用层，迁入 `store/navigation/`，保持先导航再选中的顺序。纯序列化不要求整个 `EditorState`。ESLint 增加纯工具与平台边界检查。
2. **平台与项目 IO**：删除经调用搜索确认无人使用的 `api` 抽象和旧 Electron Hooks；IPC 包装集中于 `platform/electron.ts`。实际项目读写、运行时导出经平台适配与服务协调，保留原扩展名保护、校验阻断、浏览器下载语义与错误提示。偏好设置仍通过平台包装访问。
3. **Blackboard**：主面板只组合工具栏和四个页签；筛选/分组为纯计算，引用统计由专用 Hook 管理；创建、选择、导航作为应用动作；共用重排 Hook 管理同组拖拽生命周期。筛选和折叠状态以 Store 中的 `blackboardView` 为唯一来源；菜单显隐为组件局部状态。局部变量按真实 scopeType/scopeId 分组，不从带分隔符的拼接键反解 ID。
4. **PresentationCanvas**：继续复用现有平移、图交互、键盘和剪线 Hooks。图修改命令独立并使用真实 reducer 回归；协调 Hook 管理临时手势；节点内容、节点层、边/临时线、手柄/吸附提示各负其责。尺寸和临时曲线计算收敛为纯几何模块，端点吸附与渲染使用同一尺寸。FSM 已使用通用 GraphNode/GraphEdge 与交互 Hooks，本批只适配领域校验签名，避免无证据的再次抽象。
5. **ConditionEditor**：分离递归组合、组操作 Hook、组头/子项布局；根级空态、单叶优化、Not 包裹、多项删除确认与组内重排语义保持不变。子列表通过渲染回调组合递归组，避免组件循环导入。条件纯变换放入已有条件工具模块。事件监听、参数绑定、临时变量等职责已独立的 Inspector 保持现有边界。
6. **样式**：本次拆分组件的固定颜色、布局、菜单与条件组样式迁入样式文件和主题变量；位置、尺寸、路径等动态几何保留在 JSX。迁移前后用同一测试工程和视口比较，不重新设计 UI。

## UX 与验收矩阵

- UX §3：四页签搜索（名称/ID/局部作用域）、状态/类型筛选、全局资源创建、分组折叠、同组重排、引用数量、局部变量声明导航、FSM/演出图双击。
- UX §5/6：画布平移/缩放、单选/框选/多选拖动、连接/吸附/端点修改/剪线、删除与撤销、Inspector 同步、起始节点和 Branch/Wait 显示。
- UX §7：And/Or/Not 与比较/脚本条件、嵌套增删重排、确认取消、参数与事件绑定保持；资源软删除/恢复/永久删除沿用 reducer 行为并运行既有回归。
- 自动检查：严格类型、零警告 ESLint、UTF-8、扩展格式范围、边界失败探针、全量单测、生产构建、Electron 集成冒烟。
- 直接浏览器回归：使用隔离的虚构工程执行上述高风险路径，检查控制台、保存回读、截图；记录实际通过与未覆盖项，不把单测称为浏览器验证。

## 实施结果

### 模块职责

| 入口 | 本批后的职责 | 主要协作者 |
| --- | --- | --- |
| `BlackboardPanel.tsx`，984 → 44 行 | 读取统一视图状态、组合工具栏和四页签 | `BlackboardToolbar`、四个 `*Tab`、`ScriptCreationMenu` |
| `useBlackboardData` / `utils/blackboard` | 引用统计与纯筛选分开，局部引用键包含完整作用域 | `useBlackboardActions`、`useResourceReorder` |
| `PresentationCanvas.tsx`，976 → 103 行 | 组合画布、信息层和图形层 | `usePresentationCanvas`、`store/commands/presentation`、`Canvas/presentation/*` |
| `utils/presentationGeometry` | 共用尺寸、锚点和两种临时路径计算 | 渲染、剪线与通用交互 Hook |
| `ConditionEditor.tsx`，633 → 172 行 | 递归组合叶子与组 | `useConditionGroup`、`GroupHeader`、`GroupChildren`、`utils/conditionBuilder` |
| `types/validation.ts` | 项目诊断契约，不依赖 Store | 业务校验器、Store、项目服务、诊断面板 |
| `store/navigation/*` | 引用/诊断映射成导航动作 | 先 `NAVIGATE_TO`，再 `SELECT_OBJECT` |
| `ProjectSession` / `projectExport` / `projectPlatform` | 项目与导出统一协调、平台 IO | `platform/electron.ts` 包装 IPC，浏览器统一下载 |

行数只用于说明主入口减负，拆分依据是职责，行数不是验收目标；本批格式化范围扩至 72 个文件。FSM 继续复用原有图节点/边/交互 Hooks，只调整校验参数。`LeafConditionEditor`、事件绑定、局部变量、演出参数等已分离职责的 Inspector 没有为了长度继续拆碎。

确认无调用后移除 `api/service.ts`、`api/types.ts` 和旧 `src/electron` Hook/barrel；实际 IPC 包装迁入 `platform/`，全部调用点更新。最后一次边界扫描发现翻译网络提供方仍在工具层，将三份网络服务移入 `services/translation/`；本地字典保留纯工具身份，没有调用付费翻译接口。

ESLint 新增纯工具、平台及服务/Hook 的反向依赖约束；纯工具还禁止直接访问 `fetch/window/document/localStorage/sessionStorage`。反向探针扩至 10 项，不依赖人工遵守目录约定。

### 同时修复的行为问题

- 局部变量拖拽不再从 `Stage-${id}` 字符串拆分 ID，导入带连字符的作用域仍能正确排序；引用计数也按 scopeType/scopeId/id 区分。
- 黑板筛选和折叠状态统一读取 Store，外部视图更新不再残留本地副本。
- 右键菜单创建连接时，把内容坐标明确转换成客户端坐标；连接中点击目标节点不再启动另一份拖动，避免结束连线后节点跟随鼠标漂移。
- 生命周期菜单点击保持展开，不与先发生的悬停事件互相抵消；已复测鼠标悬停后点击和菜单创建。
- 递归条件只读展示不再给内部叶子/组传入伪编辑回调。

### 自动验证

- `npm run check`：前端/Electron strict、零警告 ESLint、UTF-8、72 文件渐进格式、10 项 lint/边界探针及既有 7 项类型/3 项编码/1 项格式反例；14 个测试文件、180 个用例通过（新增 26 项）。
- 新增测试覆盖纯筛选/作用域键、创建/导航/分组拖拽、空态/Not/递归删除确认/重排、连线和多节点命令、几何固定端方向、仅传 ProjectData 的校验，以及运行时导出/后缀保护/失败恢复。
- 真实 React DOM 事件补充覆盖 Shift 连线中的目标点击、Ctrl 剪线与 Undo、中键平移和只读保护。没有用“调用 action 成功”代替这些手势测试。
- 生产构建通过；仍有主包超过 500 kB 的既有告警，未在本批宣称性能改善。
- `npm run test:electron`：真实 Electron/IPC/磁盘/监听共 11 项通过。隔离目录 `D:\Temp\puzzle-batch2-electron-RoHNcZ`；EEXIST 为排他新建失败的预期注入。

### 直接浏览器验收

使用自建的本地开发页与虚构工程 `D:\Temp\puzzle-batch5-browser-rqSj9j`，没有修改用户工程。

| UX / 路径 | 实际操作与结果 |
| --- | --- |
| §3 黑板 | 名称/作用域文本、整数类型、Implemented 状态筛选；Stage 局部变量拖拽排序后双击声明导航；生命周期 Node 脚本与事件创建、撤销；图与 FSM 双击均通过 |
| §5/6 画布 | 框选两个节点并一起拖动、两次撤销恢复原位置；右键创建 Branch、右键连线、连线后位置不变；端点吸附到左侧、拖到空白断线、Undo 恢复；节点与 FSM 转移 Delete/Undo、Inspector 同步通过 |
| §7 条件 | 显式空 And 组添加比较条件、切成 Literal，Or/Not 转换；Not 限制第二个 operand、删除确认取消、折叠/展开通过 |
| 引用与文件 | 图引用跳转 Stage；项目校验；工程下载和 runtime 导出；重开下载文件通过未保存确认后恢复条件树、左侧端点、排序和 Temporary Boolean false |
| 错误/警告 | 最终控制台 warn/error 为 0；测试 Branch 故意不连接两个输出，业务校验为 0 error / 1 条预期 warning，导出允许 warning 的行为验证通过 |

黑板与画布使用同一原始样本、同一视口分别截图，前后 **JPEG 字节完全一致**：

- 黑板 SHA-256：`0bf93dab548561aefb3dc87cf0647273f52175215ca05054ec7d3a82ae39d7b6`
- 画布 SHA-256：`3e4c4334c064ca0ef02373ec4de534a99b2650fd1ecb2d78b2310aeb0bce5034`

证据：[最终浏览器截图](./verification/batch5-browser-regression.jpg)、[控制台记录](./verification/batch5-browser-log.json)、[下载往返与图片一致性](./verification/batch5-roundtrip-result.json)、[Electron 结果](./verification/batch5-electron-result.json)。前后截图也保存在同一目录下的 `batch5-blackboard-*` 和 `batch5-canvas-*` 文件。

### 验证边界与后续

- 带修饰键的完整拖动、中键平移、条件内拖拽重排、资源永久删除由真实 React DOM/既有 reducer 回归覆盖，本轮未全部亲自在浏览器操作；不把自动事件测试称为手工验收。
- 检查当前导航 Hook 后确认独立画布缩放尚未实现，不能把浏览器页面缩放算作 UX §5 的画布缩放。本批保持该基线，并修正文档的旧能力描述；另立功能任务补齐。
- 多节点移动沿用逐节点历史提交，两个节点的移动需两次 Undo；没有在本批改变历史粒度。
- 第六批性能测量/优化在本批结束时尚未开始，现已完成，见 [第六批记录](./Architecture_Repair_Batch6.md)。原生关闭保护、原生选择器人工操作、安装包/引擎联调仍未纳入本批。网络翻译只完成依赖路径迁移与类型/构建检查，没有进行在线服务测试。
