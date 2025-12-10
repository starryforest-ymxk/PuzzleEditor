# Project_Overview：侦探解谜游戏 Web 可视化编辑器

---

## 0. 角色定义（Role Definition）

你是一位 **资深前端系统架构师与产品设计师**。任务是为一款侦探类 Roguelite 游戏设计并实现 **Web 端可视化编辑器**。

- **目标用户**：游戏策划与关卡设计师（非技术背景）。
- **核心职责**：提供 IDE 风格界面以管理游戏逻辑数据，保障数据完整性与操作直觉。
- **工作范围**：**仅限前端（Frontend Only）**。定义数据结构、交互逻辑与 UI 组件，假设后端存在标准接口处理文件 I/O 与代码生成。

---

## 1. 项目背景与核心架构

本系统是一款“节点式叙事解谜编辑器”。通过 **阶段树（Stage Tree）** 管理宏观流程，通过 **有限状态机（FSM）** 管理微观叙事逻辑。

**核心架构约束：前端主导的资源管线（Frontend-First Pipeline）**

- 编辑器是游戏逻辑定义的 **Source of Truth**。
- 策划在前端定义脚本、事件、参数等元数据。
- 前端导出 JSON 清单（Manifest），后端据此生成 C# 代码 Stub。
- 前端 **不读取** 现有代码文件，仅管理这些定义的生命周期。

---

## 2. 设计目标（Design Goals）

1. **数据安全与软删除（Data Safety & Soft Deletes）**
   - `Implemented` 资源（脚本/变量/事件）不可物理删除，只能标记为 `MarkedForDelete`。
   - “应用删除”需二次确认后才会将数据从 JSON 中移除。
2. **多层级可视化（Multi-Level Visualization）**
   - **宏观**：树形结构管理关卡阶段。
   - **中观**：卡片列表管理解谜节点实体。
   - **微观**：无限画布编辑状态机逻辑。
   - **线性**：时间轴/序列式编辑演出流程。
3. **隐式持久化（Implicit Persistence）**
   - 编辑器中定义的所有变量（全局/局部）与状态机状态，默认视为需要存档，无需手动配置“是否持久化”。
4. **严格的作用域管理（Scoping）**
   - 变量分为 Global、Stage Local、Node Local、Temporary。
5. **可追溯的消息堆栈（Message Stack）**
   - 所有系统提示统一进入顶栏“消息”堆栈（info/warning/error），可随时展开查看并一键清空；加载/导入/校验/保存等错误必须写入堆栈。

---

## 3. 技术选型建议（High-Level Tech Choices）

- **框架**：现代 SPA 框架（React / Vue / Svelte）。
- **语言**：TypeScript（严格类型描述 Schema）。
- **状态管理**：需要健壮的全局 Store（如 Zustand/Redux Toolkit）处理黑板定义与复杂依赖。
- **可视化库**：
  - **画布**：React Flow / Vue Flow / X6（用于状态机）。
  - **树**：高性能层级树组件（用于阶段树）。
- **数据交换**：纯 JSON。具备“离线优先”逻辑，在内存中维护完整的 JSON 状态树。

---

## 4. 核心领域模型（Core Domain Models）

### 4.1 黑板（The Blackboard）

所有抽象定义的注册表。

- **参数（Variables）**
  - 字段：`Key`（系统生成）、`Name`、`Type`、`InitialValue`、`Description`、`State`
  - 作用域：Global、Stage Local（只读视图）、Node Local（只读视图）
- **脚本（Scripts）**
  - 分类：`Performance`、`Lifecycle`、`Condition`、`Trigger`
  - 字段：`Key`、`Name`、`Description`、`State`
- **事件（Events）**
  - 字段：`Key`、`Name`、`Description`、`State`
- **状态流转**：Draft -> Implemented -> MarkedForDelete

### 4.2 阶段树（The Stage Tree）

- **结构**：递归树节点；Root 下首个子节点及每个 Stage 的首个子节点为“初始阶段”。
- **绑定**：
  - 生命周期：`StageLifecycleScript`
  - 演出：`PresentationGraph` 或 `PerformanceScript`
  - 数据：Stage Local Variables

### 4.3 解谜节点（The Puzzle Node）

- **实体属性**：ID、Name、Type、Node Local Variables、Lifecycle（OnCreate/OnDestroy）
- **内部逻辑（FSM）**：
  - **State**：生命周期（OnEnter/OnExit）、事件监听（Invoke Script / Modify Param）
  - **Transition**：触发器（Always/OnEvent/Custom）、条件构造器（And/Or 逻辑）、演出绑定、参数修改器

---

## 5. 用户使用流程（User Flows）

### 5.1 黑板管理（定义源头）

1. 进入黑板视图创建脚本、事件或全局参数。
2. **软删除逻辑**：若删除 `Implemented` 条目，UI 变灰并禁选；需点击“应用删除”确认后才物理移除。
3. **引用查询**：点击任意条目，侧边栏显示其在编辑器中的引用位置。

### 5.2 阶段层级编辑（Stage View）

1. 导航：通过左侧树或顶部面包屑（带返回上一层）定位 Stage。
2. 概览交互：
   - **单击** 解谜节点卡片 -> 右侧面板显示节点实体属性（生命周期/局部变量）。
   - **双击** 解谜节点卡片 -> 下钻，视图切换到 **状态机画布**。
   - **点击空白** -> 右侧面板显示 **Stage 属性**（解锁条件/生命周期/演出）。

### 5.3 解谜节点内部编辑（FSM Canvas）

1. **视图**：无限画布，支持平移（Space+拖拽）和缩放（Ctrl+滚轮）。
2. **状态编辑**：右键创建 State；选中 State 配置属性（生命周期、事件监听）。
3. **连线编辑**：Shift+拖拽创建；选中连线配置 **触发器**（多选：每帧/事件/自定义）、**条件**（混合模式：变量比较+自定义脚本）、**演出**。
4. **参数管理**：点击画布空白，右侧面板管理 **Node Local Variables**。

### 5.4 演出与参数传递

1. **演出子图**：线性/分支节点编辑器，每个节点绑定一个 `PerformanceScript`。
2. **参数传递**：在任意绑定演出脚本的位置，面板显示参数传递区域：
   - **来源**：可选常量、全局/局部变量。
   - **临时参数**：可现场新建 Temporary 变量（定义类型、值，并传入脚本）。

### 5.5 事件与监听

1. **触发器**：状态机转移可由 `OnEvent(ID)` 驱动。
2. **监听器**：Stage/State 可监听事件，触发 `Invoke Script` 或 `Modify Parameter`（Set/Add/Sub）。

### 5.6 导出

1. 用户点击导出。
2. 系统校验完整性（检查是否存在对“已标记删除”项的引用）。
3. 生成包含完整定义的 JSON。
4. **消息堆栈**：导出/校验的成功或错误信息必须写入消息堆栈，便于追溯。

---

## 6. 开发注意事项

- **UI 布局**：经典三栏（树/导航 -> 主工作区 -> 属性侧边栏）。
- **组件复用**：`ScriptPicker`（自动过滤已删除项）、`ConditionBuilder`（混合逻辑）、`ParamModifier`（通用修改逻辑）。
- **容错性**：引用了“已标记删除”资源的地方需显示醒目警告（红框/警告图标），但不能导致编辑器崩溃。
- **消息堆栈**：全局状态 `ui.messages` 存储消息列表；顶部 Header 展示堆栈，支持清空；所有加载/导入/校验/保存错误必须写入堆栈。
