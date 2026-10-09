# CLI 与软件编辑功能覆盖核对

更新：2026-10-09。当前基线：C10 工作区、实际命令契约和本批回归。各批历史完成记录保留在其报告与 manifest，不以旧快照代替本批验证。

## 结论

**C1–C10 已完成。** 当前 describe 和权限策略为 C10，22 个命令入口、47 种领域操作。在线会话、未保存快照、原子领域事务、共享 GUI 历史及保存权限保护已交付；配套发行和验证边界见 [C10 完成报告](./CLI_C10_Implementation.md)。

## 当前覆盖

| 内容 | 当前 CLI 能力 |
| --- | --- |
| 工程 | 创建、元数据、完整只读、查询、校验、预览、另存新工程、获聊天许可后 in-place 覆盖、运行时导出；四类既有格式转完整工程 |
| Stage | 创建、属性、移动、重排、显式子树删除；解锁、生命周期、监听及演出绑定 |
| Puzzle Node | 创建含 FSM/初始状态、属性、移动、重排、删除含关联 FSM、生命周期与监听 |
| 黑板资源 | 全局/Stage/Node 变量及事件/脚本增改、普通删除/恢复；变量搬移；获永久删除聊天许可后 purge 已实现/标删资源 |
| FSM | 状态/迁移增改删、初始项、端点、优先级、触发器、递归条件、参数修改与演出 |
| 演出图 | 图/节点增改删、入口、连线、Wait/Branch/Parallel、脚本参数、Temporary 与子图 |
| 布局和顺序数据 | 状态/演出坐标、连线端口、资源/FSM/图 displayOrder 的 update |
| 在线会话 | list/status/inspect/validate/preview/apply/save；读未保存内容、字段屏障、单调 token、原子历史及自动保存授权限制 |
| 会话历史 | history list/undo/redo；与 GUI 共用 50 条历史，稳定条目 ID/来源/摘要/权限、顶部单步恢复、版本保护和同请求重试 |
| 备用完整 JSON | 获聊天许可后提交完整候选；实际永久移除受保护资源另需 permanent 许可；结构/命名/引用/生命周期仍校验 |

C6 删除不按显示名称扩大范围。非空 Stage 显式 cascade；根受保护；范围外存在 FSM 所有者整批拒绝；共享图和全局资源保留。预览列出全部移除实体及所需能力；最终候选拒绝新增悬空引用和同 ID 祖先隐式改绑。相同合法删除的三组 GUI/CLI 工程内容对照通过，见 [C6 完成报告](./CLI_C6_Implementation.md)。

C7 转换共用 GUI importer/serializer。严格名称映射只操作 assetName，已有缺名可按旧错误报告保留，不能导出；不自动命名、不开放通用 patch。预览固定元数据生成上下文并绑定源/映射/候选，apply 重建验证后只写新文件；源字节保持。详见 [C7 完成报告](./CLI_C7_Implementation.md)。

## 尚未覆盖或明确排除

| 功能 | 当前差异 | 安排 |
| --- | --- | --- |
| 面板、导航、选择等界面操作 | 不增加对应常规 CLI 指令；保存的 editorState 可在获 raw 许可后随完整候选调整 | 用户明确暂不开发 |
| 偏好、最近项目、自动保存设置 | CLI 不管理软件偏好 | 用户明确暂不开发 |
| 自动生成/翻译 assetName | GUI 保留辅助按钮；CLI 新资产名必须外部指定 | 用户明确要求的差异 |

GUI 可暂存未完成编辑，CLI 保留已有业务错误基线但拒绝新增错误；因此可能需要同一计划同时修复引用。权限参数不认证聊天，Agent 负责核对用户授权。共同规则见 [CLI 方案 §1.3](./CLI_Implementation_Plan.md#13-下一阶段最高权限扩展用户已确认)。

覆盖能力首轮限定 Windows；在线 session/history 须使用 C10 配套 CLI/桌面程序（协议 2）。已打开工程明确拒绝离线覆盖，不丢弃未保存内存。raw/overwrite/permanent 三项按实际效果组合授权，历史恢复也重新检查；旧回执须重新预览。OS 锁协调不能约束旧版桌面或任意第三方文件工具。

没有把 GUI 未实现的模板、克隆、自动布局或 Unity 仿真列作已确认覆盖缺口，不给未经逐项验收的百分比。[C6–C10 计划](./CLI_Next_Development_Plan.md)已完成；MCP 与软件内 AI 不在本轮。历史只在当前会话内保留，永久删除形成边界，Undo 不回滚磁盘。

## 核对依据

- [当前使用说明](./CLI_Agent_Usage.md)、[C10 技术设计](./CLI_C10_Design.md)、[完成报告](./CLI_C10_Implementation.md)与 [验收快照](./evidence/CLI_C10/manifest.json)。
- [转换契约](../../contracts/automation/importSchemas.ts)、[转换服务](../../services/automation/importService.ts)、[精确命名](../../services/automation/importNames.ts)。
- [领域契约](../../contracts/automation/planSchemas.ts)、[能力表](../../contracts/automation/capabilities.ts)、[共同权限](../../contracts/automation/permissions.ts)。
- [共用删除](../../utils/hierarchyDeletion.ts)、[资源身份](../../utils/projectResources.ts)、[历史](../../store/documentHistory.ts)、[GUI Hook](../../hooks/useDeleteHandler.ts)。
- [领域写入](../../services/automation/writeService.ts)、[备用写入](../../services/automation/rawWriteService.ts)、[引用保护](../../utils/deletionReferences.ts)。

历史：C5 为 42 种 operation / 467 项测试 / 41 项独立包检查，缺层级删除与永久删除入口；这些缺口已由 C6 补齐。旧 [C5 manifest](./evidence/CLI_C5/manifest.json) 和 C5 发行包保持当时内容。
