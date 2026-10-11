# Codex 自动发现并使用 PuzzleEditor Skill 实测

## 目标与技术设计

本次验证真实模型能否在自然语言工程任务中自动选择已安装的用户级 puzzle-editor Skill，并通过实际 CLI 完成创建、读取、领域编辑、预览、另存、校验和导出。此前 skills/list 和脚本回归只证明发现与工具可用，本次补充模型自主执行证据。

- 使用当前实际安装的 Codex CLI 和账户默认模型，不复制 Skill、不在提示中使用 `$puzzle-editor` 或给出 SKILL.md 路径，也不提供预写计划/教程脚本。
- 创建仓库外、含中文和空格的新空目录；模型只能为虚构任务在该目录生成新文件，使用 workspace-write 沙箱，不修改安装、配置、业务工程或本仓库源码。
- 任务规格明确给出全部 assetName，覆盖 Root → Room → Door、Closed/Opened FSM 和 Unlock 事件迁移。动态 ID/hash 由模型自行读取 CLI 结果。
- 记录 codex exec --json 的真实命令事件，检查是否读取正确用户级 SKILL.md/参考资料、调用已安装 CLI、采用领域编辑并保留源工程。
- 流程结束后另用 CLI 只读校验和结构断言核对工程/导出，不以模型最终回答代替文件证据。
- UX_Flow 中对应的层级、FSM 事件迁移、校验与导出通过实际领域数据核对；本次不变更 GUI，不重复既有浏览器视觉回归。

方法参考 [OpenAI 的 Skill 实测说明](https://developers.openai.com/blog/eval-skills)：自然语言隐式触发，并基于 JSONL 命令事件和实际产物判断结果。

## 执行结果

**通过。** 本次是一次真实 Codex 模型任务，提示中没有点名 Skill 或提供入口路径；模型自行读取用户级 Skill，随后完成整个 CLI 流程，中途没有人工补充提示或操作工程。

| 项目 | 实测结果 |
|---|---|
| Codex | 当前本机 `codex-cli 0.162.0-alpha.17.2`；没有传 model 参数，沿用账户默认配置 |
| 工具 | 全局 `puzzle` 解析到 `D:\Tools\PuzzleEditorCLI\bin\puzzle.cmd`，产品 1.0.0-beta / phase C16 |
| 执行方式 | codex exec --json --ephemeral，workspace-write，approval_policy=never；用户级 Skill 从原安装位置自动发现 |
| 模型耗时 | 约 154 秒，进程退出码 0，收到 turn.completed |
| Skill 触发 | 第一条命令读取 `C:\Users\吴迪\.agents\skills\puzzle-editor\SKILL.md`；之后读取指南、文件命令、层级、FSM、资源与共用结构参考 |
| CLI 工作流 | version → describe → create → inspect → preview → apply（另存）→ validate → export；最后 json read 只读回查 |
| 创建 | Root → Room → Door，Door 初始状态 Closed；完整源工程由 CLI 写入 |
| 编辑 | 更新 description；新增 Opened、Unlock 事件与 Closed → Opened 的事件迁移，Closed 保持初始状态 |
| 资产名 | 六个 assetName 与测试提示明确给定的名称逐项一致 |
| 校验 | 源工程和编辑后工程均为 0 错误 / 0 警告；独立复核得到相同结果 |
| 导出 | 实际 runtime.export.json 的 data 与独立再次导出的 data 逐结构完全一致 |
| 源文件保护 | 最终源文件 SHA-256 与第一次 create 返回的 hash 完全一致；编辑应用到全新路径 |
| 授权边界 | 未使用 raw JSON 写入、覆盖或永久删除声明；没有运行随包教程来代替该任务 |
| 独立审计 | 47 项断言通过，包含调用轨迹、实际对象/归属/引用、文件指纹、源文件保护和安装状态 |

实际模型工作目录：`D:\Temp\PuzzleEditor Codex 自动发现 2026-10-11 146a10bd-3b39-4d27-920d-3f80d1b38133`。

完整原始 JSONL 和 stderr 保留在仓库忽略目录 `release/codex-automatic-skill-2026-10-11`；公开开发证据仅复制本次虚构任务的命令、规格、产物和审计结果：

- [审计结果与 SHA-256](evidence/CLI_Codex_Automatic_2026-10-11/result.json)
- [14 条真实命令执行记录](evidence/CLI_Codex_Automatic_2026-10-11/commands.json)
- [原始自然语言提示](evidence/CLI_Codex_Automatic_2026-10-11/prompt.txt)
- [模型最终报告](evidence/CLI_Codex_Automatic_2026-10-11/model-final.md)
- [创建计划](evidence/CLI_Codex_Automatic_2026-10-11/create-project-plan.json)、[编辑计划](evidence/CLI_Codex_Automatic_2026-10-11/edit-plan.json)、[预览回执](evidence/CLI_Codex_Automatic_2026-10-11/edit-preview-receipt.json)
- [源工程](evidence/CLI_Codex_Automatic_2026-10-11/source.puzzle.json)、[编辑后工程](evidence/CLI_Codex_Automatic_2026-10-11/edited.puzzle.json)、[运行时导出](evidence/CLI_Codex_Automatic_2026-10-11/runtime.export.json)

## 实际遇到的问题

模型第一次 create 把同计划中新建的 Room/Door alias 放入 scope，scope 在执行前检查目标时得到 `ENTITY_NOT_FOUND`（CLI 退出码 3），没有创建源工程。模型自行检查失败结果，改用本次虚构新工程的 project=true scope，再次创建成功；后续编辑、预览、另存、校验和导出均成功。

另一个非零 shell 退出来自批量执行“读取 SKILL.md + 查询原生记忆”：读取 Skill 成功，但 rg 无匹配返回 1。它不是 Skill 发现或 CLI 故障。审计按实际命令记录了两次非零 shell 状态，未把自主纠错过程隐藏为全部首次成功。

后续指南可进一步明确新工程 scope 的求值时机，以及“新对象可在操作中通过 alias 引用”和“新对象不可提前作为 scope 中的现有目标”之间的区别。模型还读取了完整能力契约并反复筛选 Schema；可通过更集中的任务参考减少读取开销。本次没有修改公共指南或业务实现。

## 验证边界

本次确认当前环境中的一次自然语言任务能自动触发 Skill，并完成实际创建/编辑/校验/导出；不能据此保证所有措辞、模型或机器都会自动命中。测试运行在 Codex CLI 的真实模型会话中，没有通过桌面聊天 UI 重放；本次也未覆盖演出图、在线会话、高权限写入或游戏运行效果。

没有修改产品源码、CLI/Skill 安装、Codex 配置或既有业务工程。原有浏览器夹具 `overview/dev/verification/batch6-browser-saved.puzzle.json` 的 SHA-256 仍为 `DD162353C02EC8404E660E4A364208B857608280525387B2B5A7762A359724DF`。本次新增开发报告和虚构测试证据，不重复此前 807 项源码回归。
