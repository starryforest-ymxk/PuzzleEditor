# C10 技术设计：CLI 历史与配套发行

状态：已完成，验收见 [C10 实施报告](./CLI_C10_Implementation.md)。依据 [C6–C10 计划 §7](./CLI_Next_Development_Plan.md#7-c10cli-undoredo整体验收与发行)。本批复用 C9 在线桥、编辑屏障和保存队列，补全 history list/undo/redo，并交付实际验证的 Windows CLI 与兼容桌面构建。既有 C3–C9 工作区保留；不自动提交推送 Git。

## 1. 目标和 UX 约束

- GUI 和 Agent 共用 50 条 past/future，不建立另一套历史，不修改工程 JSON/运行时格式。
- 对应 UX_Flow §2.1 的保存/消息、§4–§6 层级和图编辑、§1.1/§7.6 永久删除不可撤销，以及现有关闭保护。历史恢复继续由共同协调器修复失效选择和导航，不新增 UI 导航命令或弹窗外观。
- 只处理当前方向顶部一条；需明确 instance/session、预期 token、entryId、requestId。人工新编辑后不能挑旧 Agent 条目撤销。没有可用顶部、版本/条目过期、草稿/忙碌、只读、权限不足均无历史提交。
- assetName 仍来自外部。raw/overwrite/permanent 三项最高权限仍由用户在 Agent 聊天中明确授权，参数仅声明已有许可。Undo 只改内存，不是磁盘回滚。

## 2. 历史数据和共同维护入口

在 `store/documentHistory.ts` 唯一维护历史操作元数据和移动规则。历史快照保留 content/revision/restrictedRevisions；HistoryEntry 另外带 operation，含稳定 entryId、source（human/agent/system）、英文 summary、原操作所需能力。entryId 由会话 ID 与单调分配的修订号组成，Undo/Redo 移动时沿用同一 operation，而非为一次移动伪造新编辑条目。

Reducer 新建记录时，将“本次操作”与“操作之前的快照”放入 past；Undo 把当前快照与同一 operation 放入 future，Redo 对称处理。普通 GUI Action 使用动作摘要，Agent 整批使用领域命令摘要；meta 不进入 serializer。内容相等不记历史、不改 redo。外部资源同步与永久删除继续建立清空 past/future 的边界。

`RESTORE_AUTOMATION_HISTORY` 仅为可信应用服务内部 Action，携带方向、顶部 ID 与保存限制；复用同一个 restoreHistory 函数，并在 reducer 再核对顶部。contentEpoch 对成功历史操作递增。恢复保存时间沿用当前成功保存时间，dirty 仍比较恢复 revision 与 savedRevision。

## 3. 契约、应用服务与权限

在 `sessionSchemas.ts` 扩展严格的 history CLI/桥契约。三个 CLI 入口仍通过现有 `cli/session.ts` 适配和认证传输；不增加第二个客户端。history list 是只读，返回 token、pending/busy/savePolicy、上限、按下一步执行顺序排列的 past/future 摘要、顶部 ID 和各方向所需能力，不暴露整份历史快照。

undo/redo 复用 OnlineSession 的 10 分钟/256 项 requestId 缓存。先进入 C9 草稿屏障，再核对 token 与顶部；基于当前内容和目标快照分析实际永久删除，Redo 另外保留原操作的语义能力要求。overwrite 是本次持久化声明，旧条目的许可不能自动批准本次自动保存；普通内存撤销不要求 overwrite。若历史恢复实际永久移除受保护资源，必须有 permanent 声明，成功后同样形成不可恢复边界。在线 raw 创建/替换仍未开放，历史元数据不提供绕过该限制的入口。

最终同步 compare-and-dispatch 前复核版本和屏障，返回 before/after、方向、entry、changed、dirty、history 和 savePolicy。失败沿用结构化错误；未知结果只能同 ID/同请求重试，不可自动撤销第二次。切换/重启使原会话失效。

## 4. 保存限制与历史恢复

没有 allowOverwrite 的 Agent undo/redo 为目标快照增加一个全新受限标记，使用单调分配计数确保不会重用已被 GUI 保存认可的标记。恢复目标原有的未获许可限制也保留。获得本次 allowOverwrite 只不新增本次限制，不抹掉更早的受限内容；显式保存/另存继续按 C9 规则认可实际捕获内容。

历史操作不写盘、不修改用户偏好、不打开选择器。已排队自动保存仍核对执行时限制，GUI 主动保存/关闭流程保持。空栈失败不增加标记、修订号或历史。

## 5. 版本与发行

phase/policy 升至 C10，API 和工程格式不变。在线协议升为 2，使 C9/新客户端在握手前明确报告不兼容；受限登记目录保留，以便 list 看见旧实例而不是误判未打开。管道名的 v1 是端点命名格式，协议号由登记/握手独立核验。

产物放新目录 `release/cli/C10/` 和 `release/desktop/C10/`，保留 C5–C8 旧包。CLI 包继续使用锁定 Node、唯一来源 AGENTS 指南、许可证、能力及哈希清单。桌面必须包含本批 Store、所有权和在线桥，验证实际 ASAR/EXE；尽可能生成 NSIS，若本机签名/资源编辑工具限制仍在，使用已验证的未签名构建配置并如实记录，不修改系统权限。

## 6. 验收

1. 历史元数据在混合 GUI/Agent、Undo/Redo、50 条截断、分支/no-op、保存/外部同步/永久删除边界中保持正确，序列化不含历史元数据。
2. 服务测试覆盖 token/entry 双前提、并发/断线幂等、草稿/busy/只读/会话切换、实际权限与 Redo 语义、自动保存限制及保存后 Undo dirty。
3. 真实 CLI 子进程验证严格参数/Schema、空栈、协议不兼容和受认证的 history 请求；不并行重建共用 dist 产物。
4. 真实 Electron 验证 GUI Undo/CLI Redo、人工新编辑顶部保护、无许可零自动覆盖、显式覆盖/重开，保留原文件会话/关闭/双实例测试。
5. 实际 CLI ZIP 在仓库外中文空格目录、PATH 无全局 Node 验证；配套桌面包验证在线协议、读取/编辑/历史/保存和 UI，另用浏览器检查共同编辑/历史/校验。
6. 顺序执行全量 check、生产构建和专项测试，保存本批证据/哈希，更新规范、覆盖表、计划与完成报告。未测平台/部署范围明确记录，不保证穷举全部历史功能。
