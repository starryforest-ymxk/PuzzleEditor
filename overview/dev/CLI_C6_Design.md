# C6 技术设计：共同权限与层级/资源删除

日期：2026-10-09。状态：已按设计实施，结果见 [C6 完成报告](./CLI_C6_Implementation.md)。范围以 [C6–C10 计划 §3](./CLI_Next_Development_Plan.md#3-c6共同权限策略与层级资源删除) 和 [授权规范 §1.3](./CLI_Implementation_Plan.md#13-下一阶段最高权限扩展用户已确认) 为准。

## 目标与 UX 约束

本批补齐 Stage 子树、Puzzle 及关联 FSM 删除，提供显式资源 purge，统一普通领域与 raw 候选的能力要求和永久删除历史边界。C7 导入、C8 覆盖、C9 在线、C10 CLI 历史均不提前开放。继续只交付新的输出文件，不操作用户业务工程；回归使用隔离虚构夹具。

- UX_Flow §1.1：Draft 普通删除；Implemented 普通删除仍标删；Marked 普通 CLI delete 拒绝并指向显式 purge，不能重复 delete 隐式永久删除。新建资源仍为 Draft。
- UX_Flow §4：根保护，保留父子顺序；删除初始子 Stage 时按共用规则更新后继初始项并移除其解锁配置，完整列入预览及 scope。
- UX_Flow §5/§6：删除 Puzzle 的独占 FSM 及内部状态/迁移；共享演出图不隐式删除。删除范围外仍引用 FSM 时整批拒绝。
- UX_Flow §7.6：GUI 沿用统一确认 Dialog。级联删除含已实现/标删局部变量时说明永久删除及历史边界；普通删除说明可撤销。Agent 授权在聊天中，不新增软件审批。
- UX_Flow §2.1：GUI 预检失败进入共享消息堆栈；删除后清理失效选择、画布上下文和导航。没有新的对外 UI 指令或路由。

## 契约与权限

新增五种 operation：`stage.delete {target, cascade?}`、`puzzle.delete {target}`、`variable.purge {target, owner}`、`event.purge {target}`、`script.purge {target}`。非空 Stage 必须 `cascade: true`；purge 只接受 Implemented / MarkedForDelete，Draft 使用 delete。现有命令入口不增加通用 Action 或 JSON Patch。

共同能力契约声明 `raw_json_write`、`overwrite_project`、`permanent_resource_delete` 为相同最高等级，各自按聊天授权范围执行。C6 仅开放 raw 与永久删除的执行声明；overwrite 登记为待实现，不接受覆盖参数。`apply`、`json apply` 增加 `--allow-permanent-delete`；raw 仍需原有 `--allow-raw-json-write`。只读 preview 无需执行声明，返回实际 `requiredCapabilities` 及受影响资源。准备 raw 候选仍先遵守聊天授权。

权限要求根据源/候选资源身份差异及显式 purge 意图计算，不能由计划自报。资源身份包含 owner；唯一且无歧义的变量搬移保留身份，多处同 ID 不猜对应关系。新建/状态修改检查与删除授权分开：授予 purge 不允许伪造 Implemented、重置 Draft 或清空资产名。raw、领域、父级级联共用差异规则。

apply 对已知的受限入口先拒绝缺声明；级联效果完成隔离候选后、任何输出前再次统一核对。错误退出 6，返回缺失能力和受影响对象；回执不是授权。回执增加 C6 策略版本及 requiredCapabilities，重建时核对；旧策略回执要求重新预览，不能补个参数就沿用旧回执。保留原 `permission` 元数据，新增条件能力说明及发现字段。

## 唯一实现入口

| 位置 | 职责 |
| --- | --- |
| `utils/hierarchyDeletion.ts` | 纯删除计划与候选：子树/节点/FSM 集合、共享归属保护、根/结构检查、父级与初始项更新；GUI Slice 和 CLI 共用 |
| `utils/stageTreeUtils.ts` | 抽出现有初始项规范化；创建/移动/重排/删除复用 |
| `utils/projectResources.ts` | 资源枚举、所属身份匹配、永久移除识别；raw 生命周期、权限和 Store 历史共用 |
| `contracts/automation/permissions.ts` | 能力名称、等级、启用声明和策略版本唯一来源 |
| `services/automation/permissions.ts` | 从实际差异推导所需能力、核对声明；不读取聊天、不操作文件 |
| `store/commands/automation/execute.ts` | 新命令路由与 scope/purge 状态检查；调用共用领域逻辑 |
| `services/automation/candidateValidation.ts`、`impacts.ts` | 保留错误基线；删除影响复用 resourceReferences，输出全部被移除实体及图调用变化；拒绝残余引用与隐式局部变量改绑 |
| `store/slices/projectSlice.ts`、`documentHistory.ts`、`reducer.ts` | GUI 使用同一删除结果；实际移除受保护资源时清空 past/future，不按单个 Action 名称漏检；普通删除可撤销 |
| `hooks/useDeleteHandler.ts` | 使用同一预检/影响提示，共享 Dialog 与消息；不复制数据删除规则 |

领域计划在独立候选中完成，允许同一计划显式修复外部引用后删除；最终校验失败全部不发布，不自动解绑共享图/全局资源。删除范围内的引用随内容消失；保留内容的引用不能因移除局部变量而悄悄改指同 ID 的祖先变量。共享演出图按实际调用上下文判断，不把已删除调用位置视为仍存在的外部引用。

GUI 继续允许已有资源删除流程所支持的未完成状态；合法输入的 GUI/CLI 层级删除结果一致。共享 FSM 的危险级联删除在共用入口拒绝；最终执行时重算计划，避免确认弹窗打开后沿用陈旧删除集合。核心 Slice 失败保持内容不变，Hook 预检提供错误消息。离线 CLI 不提交 GUI 历史，也不伪称具备在线 Undo。

## 验证与交付

1. 领域/Store 测试：根、非空显式级联、深层与同名 ID 归属、父级/新初始项 scope、共享 FSM、保留共享图/全局资源、末步失败、Draft/Implemented/Marked 三态、级联历史边界、普通删除 Undo/Redo、失效 UI 上下文清理。
2. 真实 CLI 子进程：预览清单/权限、purge/级联/raw 权限组合、缺声明零输出、原文件保持、旧/改动回执拒绝、原子批次、输出重试及保留已有错误基线；assetName 规则继续回归。
3. 运行 `npm run check`（含 UI 规范与全量测试）、前端生产构建和既有 Electron 文件会话/关闭保护回归。
4. 在浏览器直接核对 Stage/Puzzle 删除、取消、普通删除 Undo/Redo、受保护局部资源确认与历史边界；GUI 保存后与合法 CLI 删除结果比较。单独记录实际浏览器证据，不以组件测试代替。
5. 更新当前使用说明、能力覆盖、架构/状态与 C6 完成报告。C5 历史证据和发行包保持，不进行 Git 提交推送。收尾检查发现发行脚本硬编码 C5，补充改为从实际能力表读取批次，并另目录打包验证其兼容性；不重打 GUI 安装包。
