# 项目任务拆解：解谜系统 Web 编辑器

我们将项目分为五个主要阶段（Milestone），每个阶段都有明确的目标和一系列可执行的任务。

#### **阶段 0：项目奠基与架构设计 (Milestone 0: Foundation & Architecture)**

此阶段的目标是搭建项目的骨架，定义核心数据结构和规范，确保后续开发有稳定的基础。

- **任务 0.1：技术栈选型与项目初始化**描述：确定具体的前端框架（例如 React 或 Vue），并使用 TypeScript 初始化项目。配置构建工具（如 Vite）、代码规范工具（ESLint, Prettier）和版本控制（Git）。**产出：** 一个可以运行的、空的单页应用（SPA）项目骨架。
- **任务 0.2：核心领域模型类型定义 (TypeScript Interfaces)**描述：根据“核心领域模型”文档，创建所有核心概念的 TypeScript 类型或接口。这是保证代码稳定性和可维护性的关键。**产出：**types/stage.ts: 定义 StageNode 结构。types/puzzleNode.ts: 定义 PuzzleNode、NodeParameters 等。types/stateMachine.ts: 定义 State、Transition。types/presentation.ts: 定义 PresentationGraph、PresentationScriptNode。types/blackboard.ts: 定义 BlackboardVariable。types/manifest.ts: 定义 ScriptsManifest、TriggersManifest 等清单结构。
- **任务 0.3：数据访问层抽象 (API Abstraction Layer)**描述：设计并实现一个与后端无关的数据访问层。初期可以使用 Mock 数据进行模拟，后续可以无缝替换为真实的 HTTP API 调用。**产出：**一个 services/api.ts 模块，包含接口：loadProject(id): 加载项目数据（StageTree, Nodes, Blackboard）。saveProject(data): 保存项目数据。loadManifests(): 加载所有 Manifest 文件（Scripts, Triggers, Variables）。一套完整的 Mock 数据，用于前端独立开发。
- **任务 0.4：全局状态管理方案设计 (State Management)**描述：选择并配置一个全局状态管理库（如 Redux Toolkit, Zustand, Pinia）。设计全局 State 的结构，用于存放项目数据、Manifests、以及 UI 状态（如当前选中的阶段/节点）。**产出：**配置好的 Store。定义的 State 结构，包含 projectData、manifests、uiState（如 selectedStageId, selectedNodeId）。
- **任务 0.5：应用主布局设计 (Application Layout)**描述：创建应用的主体 UI 布局框架。通常是一个三栏式布局：左侧（阶段树）、中间（主编辑区）、右侧（属性面板）。**产出：** 一个包含明确区域划分的顶层 App 组件或 Layout 组件。

------



#### **阶段 1：核心浏览与只读展示 (Milestone 1: Core Viewing & Read-only Display)**

此阶段的目标是让用户能够加载并查看项目核心数据，实现最基本的导航流程。

- **任务 1.1：阶段树 (Stage Tree) 视图开发**描述：在左侧栏中，根据加载的项目数据，渲染出一个可交互的阶段树。**产出：**StageTree 组件，能够展示层级结构。点击某个阶段节点时，能够更新全局状态中的 selectedStageId。
- **任务 1.2：解谜节点列表 (Puzzle Node List) 视图开发**描述：在中间区域，当用户选中一个阶段时，展示该阶段下所有的解谜节点列表。**产出：**PuzzleNodeList 组件，根据 selectedStageId 显示节点。列表中应包含节点的关键信息（名称、类型等）。点击某个节点时，能够更新全局状态中的 selectedNodeId。
- **任务 1.3：属性检查器 (Property Inspector) 基础**描述：在右侧栏中，根据当前选中的阶段或节点，动态展示其详细信息。此阶段只做只读展示。**产出：**PropertyInspector 组件，能根据 selectedStageId 或 selectedNodeId 从全局状态中获取数据并渲染。为 StageNode 和 PuzzleNode 创建对应的只读属性面板。

------



#### **阶段 2：核心编辑功能：解谜节点编辑器 (Milestone 2: The Puzzle Node Editor)**

这是项目的核心，目标是实现单个解谜节点内部所有复杂逻辑的图形化编辑。

- **任务 2.1：状态机图形化编辑器 (State Machine Editor)**描述：为 PuzzleNode 创建一个图形化的状态机编辑视图。这是技术难点最高的部分，可以考虑引入 React Flow、X6 等成熟的图编辑库。**产出：**一个画布组件，能够将 State 渲染为节点，Transition 渲染为带箭头的边。支持拖拽状态节点调整布局。实现状态和转移的 **增、删、查、改** 操作：在画布上创建/删除状态。通过交互（如拖拽）创建/删除转移。选中状态/转移时，在右侧属性检查器中显示其可编辑字段（名称、触发器、条件等）。
- **任务 2.2：演出子图编辑器 (Presentation Graph Editor)**描述：在 PuzzleNode 编辑器内，创建一个独立的标签页或区域，用于编辑演出子图。其形态与状态机编辑器类似，但更侧重于流程。**产出：**一个演出图画布，可添加/删除代表“脚本调用”的节点。支持连接节点，表示执行顺序（线形、分支）。选中脚本节点时，属性检查器能根据 ScriptsManifest 动态生成参数配置表单。支持创建多个演出子图，并为其命名，以便在状态机中通过 ID 引用。
- **任务 2.3：条件表达式编辑器 (Condition Editor)**描述：创建一个用户友好的界面，用于构建条件表达式。用户无需手写代码，通过选择变量、操作符和值来组合逻辑。**产出：**一个独立的 ConditionEditor 组件。支持从 Blackboard 和 Node Parameters 中选择变量。支持选择其他 PuzzleNode 的状态作为条件。支持 AND/OR 等逻辑组合。
- **任务 2.4：节点本地参数管理 (Node Parameters)**描述：在 PuzzleNode 编辑器内，提供一个界面来管理该节点的本地参数。**产出：**一个可以增、删、改本地参数（名称、类型、默认值、持久化策略）的表单或表格。

------



#### **阶段 3：全局系统与工作流完善 (Milestone 3: Global Systems & Workflow)**

此阶段的目标是完成项目级的管理功能，并将各个分散的编辑器整合为顺畅的工作流。

- **任务 3.1：全局黑板管理器 (Global Blackboard Manager) **描述：创建一个独立的全局视图，用于管理项目的所有全局黑板变量。**产出：**一个表格或列表视图，展示所有全局变量及其属性。支持增、删、改全局变量（根据权限）。
- **任务 3.2：阶段树编辑功能**描述：为阶段树视图（任务 1.1）增加编辑功能。**产出：**支持创建新阶段（根阶段或子阶段）。支持删除阶段（并提供安全提示）。支持修改阶段属性（如名称、解锁条件、进出脚本），复用已有的属性检查器和条件编辑器。
- **任务 3.3：项目管理与持久化**描述：实现完整的项目加载和保存流程。**产出：**顶层菜单栏或按钮，提供“新建”、“打开”、“保存”功能。调用 services/api.ts 中的接口与后端（或 Mock）交互，并处理加载中、成功、失败等状态。

------



#### **阶段 4：校验、体验优化与交付 (Milestone 4: Validation, UX & Delivery)**

此阶段专注于提升编辑器的健壮性和易用性，确保产出配置的质量。

- **任务 4.1：配置校验系统 (Validation Engine)**描述：开发一个校验模块，用于静态分析整个项目配置，发现潜在问题。**产出：**一个 ValidationService，能够检查：阶段树是否存在循环引用。状态机中是否存在孤立状态或死胡同状态。是否存在对已删除的变量、节点、脚本的引用。一个校验结果展示面板，能列出所有问题并提供快速跳转到问题位置的链接。
- **任务 4.2：用户体验 (UX) 优化**描述：根据用户流程，对交互细节进行打磨。**产出：**为所有耗时操作（加载、保存）添加加载指示器。为所有危险操作（删除）添加二次确认对话框。优化表单输入体验，如提供清晰的标签、描述和错误提示。确保 UI 在不同分辨率下表现良好（响应式布局）。
- **任务 4.3：导出功能与最终集成**描述：实现将配置数据导出为后端/Unity所需格式的功能。**产出：**“导出”按钮，触发数据格式化与下载/提交。与后端团队对齐最终的数据接口和格式，完成真实 API 的对接。
- **任务 4.4：预留调试扩展接口**描述：在架构和 UI 上为未来的模拟/调试功能预留空间。**产出：**在状态机、演出图等视图中预留可用于高亮“当前激活状态/节点”的视觉钩子。在架构设计文档中说明如何扩展以支持运行时状态的注入和展示。