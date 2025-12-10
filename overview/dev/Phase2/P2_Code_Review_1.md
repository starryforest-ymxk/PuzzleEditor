# P2 阶段代码审查（截至 2025-12-10）

## 阶段二核心目标达成度
- **工程加载与基础架构**：`store/context.tsx` 已通过 `normalizeProjectForStore` 统一处理 mock 数据并注入 Store，Undo/Redo、导航栈、三栏布局等核心骨架具备。
- **导航与浏览**：`MainLayout` / `Canvas` 实现了 Stage 概览、Node 双击进入 FSM、Graph 视图优先级切换，`Breadcrumb` + `navStack` 提供返回路径，左/右侧面板支持拖拽尺寸，整体符合“打开工程即可逐层浏览”的目标。
- **Blackboard 只读展示**：`components/Blackboard/BlackboardPanel.tsx` 按变量/脚本/事件/图分类卡片展示，支持搜索、分组折叠并持久化 UI 状态，基础只读浏览可用。
- **FSM/Presentation 画布**：`StateMachineCanvas`、`PresentationCanvas` 能渲染所有状态/连线与演出节点，Inspector 侧栏可查看关联属性，满足“可视化浏览内部结构”的需求。

## 主要问题与风险
1. **Load 按钮绕过归一化与导航，可能无法正常浏览新工程**  
   `components/Layout/Header.tsx` 的文件导入直接派发 `INIT_SUCCESS`，未经过 `normalizeProjectForStore`、未加载 manifest、也未重置导航/选中状态。切换工程后 `ui.currentStageId` 仍指向旧 ID，Canvas 可能空白或报错，违背“打开工程即可浏览”的阶段目标。
2. **面包屑导航与 UX_Flow 不符**  
   `components/Layout/Breadcrumb.tsx` 中点击 Root 会清空 `stageId`，导致回到空画布而非根 Stage；Node 面包屑不可点击（逻辑仅处理 ROOT/STAGE/GRAPH），与“点击任意节点跳转对应层级”的要求不一致，降低只读浏览效率。
3. **Blackboard 筛选维度缺失**  
   `components/Blackboard/BlackboardPanel.tsx` 仅按名称/Key 文本过滤，缺少按类型/状态的筛选（阶段二要求支持名称/类型/State 过滤）。当资源量增大或存在软删项时，策划无法快速聚焦需要的条目。
4. **只读阶段缺少保护且 UI 状态污染数据**  
   画布与 Inspector 默认可编辑（添加/删除状态、修改触发器等），Stage Tree 的展开状态通过 `TOGGLE_STAGE_EXPAND` 直接写入 `project.stageTree`（且未进入历史栈），导出时会包含纯 UI 状态。阶段二目标是“无编辑能力的完整浏览”，当前实现存在误操作破坏数据的风险，且 UI 状态混入业务数据影响导出一致性。
5. **加载/初始化错误未暴露给用户**  
   `store/types.ts` 中 `ui.errorMessage` 从未在 UI 展示。若加载失败用户只在控制台看到错误，无法在界面上获知状态，与阶段二对“可以打开工程”可感知性的期望不符。
6. **初始 Stage 标记依赖 children 顺序（低优先级）**  
   `components/Explorer/StageExplorer.tsx` 通过“父节点 childrenIds[0]”判断初始 Stage，忽略数据中的 `isInitial` 字段。当数据顺序与“初始”定义不一致时，UI 可能错误展示初始标记。

## 建议的修复优先级
1. 在 `Header` 的 LOAD 流程复用 `normalizeProjectForStore`，并在导入后派发 `NAVIGATE_TO` 根 Stage / 清理旧 selection，保证新工程可立即浏览且字段补全。
2. 修正 `Breadcrumb`：Root 点击应导航到根 Stage；允许 Node 面包屑跳转；确保 navStack 更新正确，避免空画布。
3. Blackboard 增加 State/类型筛选（下拉或标签过滤），并在卡片上突出软删/类型标签，契合阶段二浏览需求。
4. 为阶段二提供 ReadOnly 模式或基础防护：画布/Inspector 根据配置禁用修改操作；Stage 展开状态移至 UI slice 或历史记录，避免污染导出。
5. 在 Header/Canvas 显著位置显示 `ui.errorMessage`，提供重试入口或提示信息。
6. 若后续数据含显式 `isInitial`，Stage Explorer 优先读取该字段以避免顺序依赖。

## 测试
- 本次为静态代码审查，未执行自动化或手动跑通流程。
