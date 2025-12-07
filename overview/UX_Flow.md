# 叙事解谜游戏可视化编辑器 UX 设计案

---

## 1. 系统核心概念与模型 (Core Concepts)

### 1.1 资源管线重构 (Reverse Pipeline)

- **前端主导定义 (Frontend-First)**: 不再是后端提供 Manifest 给前端选，而是**策划在前端定义**“我需要一个什么脚本/事件/参数”，前端导出 JSON 给程序去生成代码桩 (Stub)。
- **软删除保护 (Soft-Delete Protection)**:
  - **状态**: `未实现 (Draft)` -> `已实现 (Implemented)` -> `已标记删除 (MarkedForDelete)`。
  - **规则**:
    - `未实现`: 可直接物理删除。
    - `已实现`: 点击删除仅变为 `已标记删除` 状态，UI 变灰，禁止新绑定，已有绑定报红。
    - `已标记删除`: 需执行二次确认的“应用删除 (Apply Delete)”操作，才会在 JSON 中真正移除，通知后端删代码。

### 1.2 脚本分类体系

1. **演出脚本 (Performance Script)**: 用于具体的表现（播动画、播声音）。支持绑定时传参。
2. **生命周期脚本 (Lifecycle Script)**:
   - *Stage Lifecycle*: 绑定到阶段的 `OnEnter` / `OnExit`。
   - *PuzzleNode Lifecycle*: 绑定到节点的 `OnCreate` / `OnDestroy`。
   - *State Lifecycle*: 绑定到状态机状态的 `OnEnter` / `OnExit`。
3. **自定义条件脚本 (Custom Condition Script)**: 返回 `bool`，用于条件构造器。
4. **自定义触发器脚本 (Custom Trigger Script)**: 用于驱动状态转移。

### 1.3 演出体系 (Performance System)

- **演出对象**: `演出子图 (Presentation Graph)` 或 `演出脚本 (Script)`。
- **绑定位置**:
  1. Stage (Enter/Exit)。
  2. State Transition (状态转移时)。
  3. Presentation Graph Node (子图内部节点)。

### 1.4 事件与监听体系 (Event System)

- **事件定义**: 纯字符串 ID (Key)，如 `"EVENT_BOSS_DIE"`。
- **Listener (监听器)**:
  - **脚本型**: 触发绑定的生命周期脚本的 `OnEventInvoke(evt)`。
  - **参数修改型**: 触发参数变更（如 `Coin += 1`，`TempVar = GlobalVar`）。
- **Trigger (触发器)**: 用于状态机转移。

### 1.5 参数作用域 (Variable Scope)

- **Global**: 全局可见。
- **Stage Local**: 该 Stage 及其子 Stage、下属 PuzzleNode 可见。
- **PuzzleNode Local**: 仅该 PuzzleNode 及其内部状态机/演出可见。
- **Temporary**: 仅在传参时存在的临时常量。

------

## 2. 界面布局与导航 (Layout & Navigation)

### 2.1 顶部导航栏 (Top Bar)

- **项目控制**: `项目名`, `保存`, `导出 JSON`, `校验`。
- **视图切换**: `编辑器 (Editor)` | `黑板管理 (Blackboard)`。
- **面包屑导航 (Breadcrumbs)**: 核心导航。
  - *显示*: `Root > Level 1 > [Stage: 商店] > [Puzzle: 老虎机]`。
  - *交互*: 点击任意节点跳转到对应层级；点击当前节点无反应；每一层级前都有 **`< 返回`** 按钮，点击直接返回上一级（父节点）。

------

## 3. 黑板管理视图 (Blackboard View)

包含三个页签：`参数 (Variables)`, `脚本 (Scripts)`, `事件 (Events)`。

### 3.1 参数页签 (Variables Tab)

- **显示**: 分为两组列表 `Global Variables` 和 `Local Variables` (只读列表，仅用于搜索跳转)。
- **列信息**: `Name`, `Key` (系统生成), `Type`, `Initial Value`, `Comment`, `State` (Draft/Impl/Deleted)。
- **创建**: 仅能创建 Global Variable。
  - 填写 Name, Type, Initial Value, Comment。
- **软删除**: `已实现` 的参数点击删除变灰，右侧出现红色 `应用删除` 按钮。
- **引用查询**: 点击某参数，弹出侧边栏显示“被引用列表”，点击条目跳转到对应编辑器位置。

### 3.2 脚本页签 (Scripts Tab)

- **显示**: 四个分组列表（演出、生命周期、条件、触发器）。
- **列信息**: `Name`, `Key`, `Type`, `Comment`, `State`。
- **创建**: 点击 `+ 新建脚本` -> 选择类型 -> 填写信息。
- **操作**: 同样支持软删除和引用查询。

### 3.3 事件页签 (Events Tab)

- **显示**: 事件定义列表。
- **列信息**: `Name`, `Key`, `Comment`, `State`。
- **创建**: 填写 Name (必须唯一) 和 Comment。
- **操作**: 软删除、引用查询。

------

## 4. 编辑器视图：阶段树层级 (Editor - Stage Hierarchy)

**场景**: 当面包屑位于某个 `Stage` 时。

### 4.1 左侧：阶段树 (Tree)

- 始终显示项目完整的阶段层级结构。
- 选中树节点，中间工作区刷新为该 Stage 的内容。
- 特殊标注：Root 下第一个子节点及每个 Stage 的首个子节点标记为 `[初始]`。

### 4.2 中间：内容概览 (Content Area)

这里显示当前 Stage 的内部结构。

- **子阶段列表**: 卡片展示子 Stage。
- **解谜节点列表**: 卡片展示该 Stage 下挂载的所有 PuzzleNode。
- **交互逻辑**:
  - **单击卡片**: 选中解谜节点（高亮边框），**右侧 Inspector 刷新**为该节点的属性。
  - **双击卡片**: **进入**该节点的内部视图（跳转至第 5 节界面），面包屑下钻一层。
  - **点击空白处**: 选中当前 Stage 本身，Inspector 显示 Stage 属性。

### 4.3 右侧：属性面板 (Inspector)

**情况 A: 选中了 Stage (点击树节点或中间空白处)**

- **基本信息**: Name, Description.
- **局部参数 (Stage Local)**: 管理当前 Stage 的作用域参数。
- **解锁条件**: 条件构造器 (初始阶段不可用)。
- **生命周期**: 绑定 `Stage Lifecycle Script`。
- **演出绑定**: 
  - `OnEnter Presentation`: 选择 `Presentation Graph` 或 `Performance Script`。
  - `OnExit Presentation`: 同上。
- **事件监听**: 配置事件响应 (调用脚本或修改参数)。



**情况 B: 单击选中了某个 PuzzleNode 卡片**

- **基本信息**: Name, ID, Description, Type.
- **局部参数 (Node Local)**: 管理该节点的私有参数。
- **生命周期**: 绑定 `PuzzleNode Lifecycle Script` 
- **事件监听**: 配置事件响应 (调用脚本或修改参数)。
- *注意：此时不显示内部状态机细节，仅显示作为“节点实体”的属性。*

------

## 5. 编辑器视图：解谜节点 (Editor - Puzzle Node)

**场景**: 双击进入具体的 Puzzle Node内部。

### 5.1 视图导航 (Navigation) 

- **平移 (Pan)**:
  - 按住 **Space + 左键** 拖拽。
  - 按住 **中键 (Middle Mouse)** 拖拽。
  - 按住 **Alt + 左键** 拖拽。
- **缩放 (Zoom)**: 按住 **Ctrl + 鼠标滚轮** 缩放。

### 5.2 状态节点操作 (Node Ops) 

- **创建节点**: 在画布空白处 **右键 -> Add State**
- **选择 (Selection)**:
  - **单选**: 左键点击。
  - **加选/减选**: **Shift** 或 **Ctrl** + 点击。
  - **框选**: 在空白处左键拖拽，画出虚线框，释放选中。
  - **取消**: 点击空白处 或 按 **Escape**。
  - **视觉反馈**: 选中节点显示蓝色发光边框；多选时背景变深。
- **移动**: 选中后按住左键拖拽（支持多选移动）。
- **删除**: 选中后按 **Delete** / **Backspace**，或右键菜单 `🗑 Delete`。
- **在节点上右键菜单**:
  - `🏁 Set Initial`: 设为初始状态（标题栏显示蓝色 `▶`）。
  - `🔗 Link`: 触发连线模式。
  - `🗑 Delete`: 删除。

### 5.3 连线与转移 (Transitions) 

- **创建连线**:
  - **Shift + 拖拽**: 从源节点按住 Shift 拖出线条至目标节点。
  - **右键菜单**: 源节点右键 `🔗 Link` -> 点击目标节点。
  - **吸附**: 靠近目标节点边缘（上下左右锚点）时显示黄色圆点并吸附。
- **调整连线**:
  - 选中/悬停连线时显示圆形手柄 (Handle)。
  - 拖动手柄可改变连线起始/结束位置或方向。
- **删除连线**:
  - 选中后按 **Delete** / **Backspace**。
  - 右键连线 -> `🗑 Delete`。
  - **切断模式 (Line Cutting)**: 按住 **Ctrl** + **左键拖拽** 划出红色虚线，松开后批量删除路径上的连线。

### 5.4 状态/转移属性配置 (Inspector Integration)

- **选中状态节点 (State)**:
  - 右侧面板显示：
    - 名称，描述
    - 生命周期绑定：绑定 `State Lifecycle Script`。
    - 添加事件监听器: 类似 Stage，可配置脚本调用或参数修改。
- **选中连线 (Transition)**:
  - 右侧面板显示：
    - 名称，描述
    - 触发器 (Trigger):
      - 类型: `Always (每帧)`, `OnEvent (事件触发)`, `Custom (自定义脚本)`.
      - 若选 `OnEvent`: 下拉选择 Event ID。
      - 若选 `Custom`: 下拉选择 `Custom Trigger Script`。
      - 可以配置多个触发器，任意触发器触发都生效
    - 条件构造器:
      - 添加条件行：`(变量) op (值)`。
      - 添加自定义脚本：选择 `Custom Condition Script`。
      - 支持多个条件的**与/或**逻辑判断
    - 演出绑定: 选择 `Presentation Graph` 或 `Performance Script`。
    - 参数修改器：与参数修改型事件监听器一致，可以触发参数变更（如 `Coin += 1`，`TempVar = GlobalVar`）。

### 5.5 局部参数管理

- 点击状态机面板画布的空白处，可以将选中对象设置为当前的PuzzleNode，此时可以管理 **PuzzleNode Local Variables**。
- 这些参数对内部状态机和下属演出子图可见。

------

## 6. 编辑器视图：演出子图 (Presentation Graph)

**场景**: 编辑某个具体的 Presentation Graph。

### 6.1 节点编辑

- **节点**: 每一个节点代表一个演出原子操作。
- **绑定**: 每个节点必须绑定一个 **演出脚本 (Performance Script)**。

### 6.2 参数传递配置 (Parameter Passing)

- 当在任意位置（Stage/Transition/GraphNode）绑定了 **演出脚本** 时，Inspector 会显示 **`参数传递`** 区域。用户可以添加需要传递的参数，也可以不添加。
- **添加参数传递**分为两种：
  - 传递已有的参数（局部/全局参数）
  - 新建临时参数:
    - 若脚本需要额外参数，点击 `+ 临时参数`。
    - `Param Name`: 目标脚本里的变量名。
    - 配置 `Type`, `Name`, `Comment`, `Value` (常量或变量引用)
    - `Value Source`:
      - 常量: 手填常量值。
      - 变量引用: 下拉选择当前作用域可见的 Global/Local 变量。
  

------

## 7. 通用交互组件细节

### 7.1 条件构造器 (Condition Builder)

- **混合模式**:
  - 列表项 A: `Global.Coin > 10` (数据比较)。
  - 列表项 B: `[Script] CheckPlayerInShadow` (自定义脚本)。
  - 逻辑: 条件的与、或

### 7.2 参数修改器 (Parameter Modifier)

- 用于事件监听器的响应配置/用于状态转移的附加操作。
- **UI**:
  - `Target Variable`: 选择要修改的参数 (Global/Local)。
  - `Operation`: `Set (=)`, `Add (+)`, `Subtract (-)`.
  - `Source`: `Constant Value` 或 `Another Variable`.

### 7.3 脚本选择器 (Script Picker)

- **数据源**: 前端定义的脚本列表（按类型过滤）。
- 不可以选中“已删除状态”的脚本

### 7.4 软删除确认弹窗

- **触发**: 点击 `已标记删除` 条目旁的 `应用删除`。
- **内容**:
  - 标题: "确认永久删除？"
  - 正文: "此操作将从 Manifest 中移除该定义，并通知后端删除对应的 `XXX.cs` 文件。此操作不可撤销。"
  - 按钮: `取消`, `强制删除` (红色)。

------

## 8. 数据持久化策略

- **隐式处理**: 用户界面上不再显示 `Persistence` 勾选框。
- **逻辑**: 所有在编辑器中定义的 `Global Variables` 和 `Local Variables`，以及 `State Machine` 的当前状态 ID，默认都会被后端存档系统序列化。