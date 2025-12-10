# 叙事解谜游戏可视化编辑器 UX 设计案

---

## 1. 系统核心概念与模型 (Core Concepts)

### 1.1 资源管线重构 (Reverse Pipeline)

- **前端主导定义 (Frontend-First)**: 不再是后端提供 Manifest 给前端选，而是**策划在前端定义**"我需要一个什么脚本/事件/参数"，前端导出 JSON 给程序去生成代码桩 (Stub)。
- **软删除保护 (Soft-Delete Protection)**:
  - **状态**: `未实现 (Draft)` -> `已实现 (Implemented)` -> `已标记删除 (MarkedForDelete)`。
  - **规则**:
    - `未实现`: 可直接物理删除。
    - `已实现`: 点击删除仅变为 `已标记删除` 状态，UI 变灰，禁止新绑定，已有绑定报红。
    - `已标记删除`: 需执行二次确认的"应用删除 (Apply Delete)"操作，才会在 JSON 中真正移除，通知后端删代码。

### 1.2 脚本分类体系

脚本定义仅包含元数据（Name、Key、Category、State、Description），**不定义参数**。参数在调用时通过 ParameterBinding 动态传递。

1. **演出脚本 (Performance Script)**: 用于具体的表现（播动画、播声音）。调用时可传递参数。
2. **生命周期脚本 (Lifecycle Script)**:
   - *Stage Lifecycle*: 绑定到阶段。
   - *PuzzleNode Lifecycle*: 绑定到节点。
   - *State Lifecycle*: 绑定到状态机状态。
3. **自定义条件脚本 (Custom Condition Script)**: 返回 `bool`，用于条件构造器。
4. **自定义触发器脚本 (Custom Trigger Script)**: 用于驱动状态转移。

### 1.3 演出体系 (Performance System)

- **演出对象**: `演出子图 (Presentation Graph)` 或 `演出脚本 (Script)`。
- **绑定位置**:
  1. Stage (Enter/Exit)。
  2. State Transition (状态转移时)。
  3. Presentation Graph Node (子图内部节点)。
- **参数传递**: 绑定演出脚本时，可配置参数传递（常量或变量引用）和临时参数。

### 1.4 事件与监听体系 (Event System)

- **事件定义**: 纯字符串 ID (Key)，如 `"EVENT_BOSS_DIE"`。
- **Listener (监听器)**:
  - **脚本型 (Invoke Script)**: 触发当前对象绑定的生命周期脚本的 `OnEventInvoke(evt)` 回调，无需额外选择脚本。
  - **参数修改型 (Modify Parameter)**: 触发参数变更（如 `Coin += 1`，`TempVar = GlobalVar`）。
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
- **视图切换**: `编辑器 (Editor)` | `黑板管理 (Blackboard)`。位于 Header 中央区域。
- **面包屑导航 (Breadcrumbs)**: 核心导航，显示当前层级路径。
  - *显示*: `Root > Level 1 > [Stage: 商店] > [Puzzle: 老虎机]`。
  - *交互*: 点击任意节点跳转到对应层级；点击当前节点无反应。

### 2.2 左侧面板 (Explorer)

- **阶段树 (Stages)**: 始终显示项目完整的阶段层级结构，带展开/折叠控制。
- **节点列表 (Nodes)**: 显示当前选中 Stage 下的 PuzzleNode 列表。
- **分隔线可拖拽**: Stages 和 Nodes 区域之间的分隔线可上下拖拽调整比例。

### 2.3 中央画布 (Canvas)

根据当前导航层级显示不同视图：
- **Stage 选中**: 显示 Stage 概览（子阶段卡片 + 解谜节点卡片）。
- **PuzzleNode 选中**: 显示状态机编辑器。
- **Presentation Graph 选中**: 显示演出图编辑器。

### 2.4 右侧属性面板 (Inspector)

根据选中对象显示不同内容，采用统一的 Section 样式：
- **Section 标题**: 11px 大写灰色文字，带 0.5px letter-spacing
- **Section 分隔**: 使用 `border-bottom` 分隔各区域
- **Header**: 顶部显示对象类型标签（带颜色）和名称

### 2.5 面板边框可调整

所有面板边界均可拖拽调整大小：
- Explorer 与 Canvas 之间（水平）
- Canvas 与 Inspector 之间（水平）
- Stages 与 Nodes 之间（垂直）

拖拽时鼠标显示双向箭头，尺寸会记忆并跨视图保持。

------

## 3. 黑板管理视图 (Blackboard View)

包含四个页签：`Variables`, `Scripts`, `Events`, `Graphs`。

### 3.1 Variables 页签

- **分组显示**: 
  - `Global Variables`: 全局变量卡片列表
  - `Local Variables`: 所有 Stage/Node 的局部变量卡片列表
- **卡片信息**: Name, Key, Type, Default Value, State (Draft/Impl/Deleted)
- **局部变量额外显示**: Scope 信息（Stage/Node 类型 + 所属者名称）
- **创建**: 仅能创建 Global Variable
- **软删除**: 已实现的变量点击删除变灰
- **Inspector 显示**:
  - **BASIC INFO**: Key, Type, Default Value, State, Description
  - **SCOPE** (仅局部变量): Owner Type, Owner Name
  - **REFERENCES**: 引用追踪区域（占位）

### 3.2 Scripts 页签

- **分组显示**: 四个分组（Performance, Lifecycle, Condition, Trigger）
- **卡片信息**: Name, Key, Category, State
- **创建**: 点击 `+ 新建脚本` -> 选择类型 -> 填写信息
- **操作**: 软删除
- **Inspector 显示**:
  - **BASIC INFO**: Key, Category (带颜色), State, Description
  - **REFERENCES**: 引用追踪区域（占位）
- **注意**: 脚本不定义参数，参数在调用时配置

### 3.3 Events 页签

- **显示**: 事件定义卡片列表
- **卡片信息**: Name, Key, State
- **创建**: 填写 Name (必须唯一) 和 Description
- **操作**: 软删除

### 3.4 Graphs 页签

- **分组显示**:
  - `State Machines`: 状态机图卡片列表
  - `Presentation Graphs`: 演出图卡片列表
- **状态机卡片信息**: Name, ID, State Count, Transition Count, Initial State
- **演出图卡片信息**: Name, ID, Node Count, Start Node
- **双击**: 进入对应图的编辑器
- **Inspector 显示**:
  - **状态机**:
    - BASIC INFO: ID, State Count, Transition Count, Initial State
    - OWNER: 所属 Puzzle Node 名称和 ID
    - STATES: 状态列表
    - TRANSITIONS: 转移列表
  - **演出图**:
    - BASIC INFO: ID, Node Count, Start Node
    - NODES: 节点列表
    - REFERENCES: 引用追踪区域（占位）

------

## 4. 编辑器视图：阶段树层级 (Editor - Stage Hierarchy)

**场景**: 当面包屑位于某个 Stage 时。

### 4.1 左侧：阶段树 (Tree)

- 始终显示项目完整的阶段层级结构。
- 选中树节点，中间工作区刷新为该 Stage 的内容。
- 特殊标注：Root 下第一个子节点及每个 Stage 的首个子节点标记为 `[初始]`。

### 4.2 中间：内容概览 (Content Area)

显示当前 Stage 的内部结构：
- **子阶段卡片**: 展示子 Stage。
- **解谜节点卡片**: 展示该 Stage 下挂载的所有 PuzzleNode。
- **交互逻辑**:
  - **单击卡片**: 选中对象，右侧 Inspector 刷新为该对象属性。
  - **双击卡片**: 进入该对象的内部视图，面包屑下钻一层。
  - **点击空白处**: 选中当前 Stage 本身。

### 4.3 右侧：Inspector - Stage 选中

采用统一 Section 样式：

- **Header**: "STAGE" 标签 + Stage 名称
- **BASIC INFO**: ID, Description
- **UNLOCK CONDITION**: 条件构造器 (初始阶段不可用)
- **LIFECYCLE SCRIPT**: 绑定 Stage Lifecycle Script 的下拉选择器
- **PRESENTATION**: 
  - On Enter: PresentationBindingEditor
  - On Exit: PresentationBindingEditor
- **EVENT LISTENERS**: 事件监听器列表
- **LOCAL VARIABLES**: 局部变量编辑器

### 4.4 右侧：Inspector - PuzzleNode 选中

- **Header**: "PUZZLE NODE" 标签 + Node 名称
- **BASIC INFO**: ID, Type, Description
- **LIFECYCLE SCRIPT**: 绑定 PuzzleNode Lifecycle Script
- **EVENT LISTENERS**: 事件监听器列表
- **LOCAL VARIABLES**: 局部变量编辑器
- *注意：此时不显示内部状态机细节，仅显示作为"节点实体"的属性。*

------

## 5. 编辑器视图：解谜节点 (Editor - Puzzle Node)

**场景**: 双击进入具体的 Puzzle Node 内部。

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

### 5.4 右侧：Inspector - State 选中

- **Header**: "FSM STATE" 标签 + State 名称（可编辑）
- **Initial State 按钮**: 非初始状态显示 "Set as Initial State" 按钮
- **BASIC INFO**: ID, Description
- **LIFECYCLE SCRIPT**: 绑定 State Lifecycle Script
- **EVENT LISTENERS**: 事件监听器列表

### 5.5 右侧：Inspector - Transition 选中

- **Header**: "TRANSITION" 标签 + Transition 名称（可编辑）
- **BASIC INFO**: ID, From, To, Priority, Description
- **TRIGGER**: 触发器配置
  - 类型: `Always (每帧)`, `OnEvent (事件触发)`, `CustomScript (自定义脚本)`
  - 若选 `OnEvent`: 下拉选择 Event
  - 若选 `CustomScript`: 下拉选择 Trigger Script
  - 可配置多个触发器
- **CONDITION**: 条件构造器
- **PRESENTATION**: 演出绑定 (On Transition)
- **PARAMETER MODIFIER**: 参数修改器列表

### 5.6 局部参数管理

- 点击状态机面板画布的空白处，选中对象设置为当前 PuzzleNode。
- 此时可管理 **PuzzleNode Local Variables**。
- 这些参数对内部状态机和下属演出子图可见。

------

## 6. 编辑器视图：演出子图 (Presentation Graph)

**场景**: 编辑某个具体的 Presentation Graph。

### 6.1 节点类型

- **ScriptCall**: 调用演出脚本或嵌套演出图
- **Wait**: 等待指定时长
- **Branch**: 分支节点（控制流）
- **Parallel**: 并行执行节点

### 6.2 右侧：Inspector - Presentation Node 选中

- **Header**: "[节点类型] NODE" 标签 + Node 名称（可编辑）
- **BASIC INFO**: ID, Type 选择器
- **WAIT CONFIGURATION** (仅 Wait 类型): Duration 输入框
- **PRESENTATION BINDING** (仅 ScriptCall 类型): 
  - Type: None / Script / Graph
  - Script 选择器或 Graph 选择器
  - 选择 Graph 时显示 "Edit →" 按钮可跳转
- **CONFIGURATION** (Branch/Parallel 类型): 说明文字

### 6.3 参数传递配置 (Parameter Passing)

当绑定了**演出脚本**时，Inspector 会在 PRESENTATION BINDING 区域显示 **参数传递** 配置：

#### 脚本参数 (Script Parameters)
- 显示脚本定义的参数列表（如有）
- 每个参数可选择值来源：
  - **Constant**: 手填常量值
  - **Variable**: 下拉选择当前作用域可见的 Global/Local 变量

#### 临时参数 (Temporary Parameters)
- 点击 `+ Temporary Parameter` 添加
- 配置项：
  - **Target Param Name**: 目标脚本里的变量名
  - **Type**: String/Integer/Float/Boolean
  - **Name**: 显示名称
  - **Comment**: 可选注释
  - **Value Source**: Constant（常量值）或 Variable（变量引用）

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
  - `Operation`: `Set (=)`, `Add (+)`, `Subtract (-)`。
  - `Source`: `Constant Value` 或 `Another Variable`。

### 7.3 事件监听器 (Event Listeners)

- **添加监听器**: 点击 `+ Add Listener`
- **Event 选择**: 下拉选择要监听的事件
- **Action 类型**:
  - **Invoke Script**: 触发当前对象绑定的生命周期脚本的 OnEventInvoke 回调（无需选择脚本）
  - **Modify Parameter**: 配置参数修改器

### 7.4 演出绑定编辑器 (Presentation Binding Editor)

- **Type 选择**: None / Script / Graph
- **Script 模式**:
  - 下拉选择 Performance Script
  - 显示参数传递配置（脚本参数 + 临时参数）
- **Graph 模式**:
  - 下拉选择 Presentation Graph
  - 显示 "Edit →" 按钮，点击跳转到 Graph 编辑器

### 7.5 资源选择器 (Resource Select)

- **数据源**: 前端定义的资源列表（按类型过滤）
- **警告显示**: 已标记删除的资源显示红色警告图标
- **占位文本**: 未选中时显示 placeholder

### 7.6 软删除确认弹窗

- **触发**: 点击 `已标记删除` 条目旁的 `应用删除`。
- **内容**:
  - 标题: "确认永久删除？"
  - 正文: "此操作将从 Manifest 中移除该定义，并通知后端删除对应的 `XXX.cs` 文件。此操作不可撤销。"
  - 按钮: `取消`, `强制删除` (红色)。

------

## 8. 数据持久化策略

- **隐式处理**: 用户界面上不再显示 `Persistence` 勾选框。
- **逻辑**: 所有在编辑器中定义的 `Global Variables` 和 `Local Variables`，以及 `State Machine` 的当前状态 ID，默认都会被后端存档系统序列化。