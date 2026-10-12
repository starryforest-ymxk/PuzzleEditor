# 桌面消息栈功能的 Git 交付与本机升级

## 范围与实施方式

按用户“提交推送 git，并且更新本机的安装”的要求，交付只读 `session messages`、统一消息类型和排序、桌面能力声明、CLI 参考及 Skill 诊断流程。沿用 `1.0.0-beta`、工程格式、API、在线协议 2 与既有聊天授权边界。没有创建 GitHub Release、标签或 npm 发布。

本轮不新增 UX_Flow 交互。§2.1 的同一消息栈、原始等级、时间顺序与 GUI 清空语义已在 [实施报告](./CLI_Message_Stack_Implementation_2026-10-12.md) 验收；安装阶段再次核验实际桌面保存、关闭、消息、在线编辑与共同历史。交付设计为：审阅明确文件并排除用户夹具 → 提交推送并核对远端 → 使用已验收成品受管升级 CLI / Skill → 无桌面进程时备份并原位安装 → 分别验证文件、实际应用、宿主发现及真实只读查询 → 独立提交安装记录。安装失败继续使用既有事务恢复；桌面完整旧目录已保留。

## Git 与包

- 实现提交：`a7c54372f12d17879c248c6ecbf33d2a6d52650e`，含 44 份代码、公开资料、测试与开发证据，已推送 `origin/main` 并通过 `ls-remote` 核对。远端未领先，没有强制推送。
- 本报告、安装证据和实现状态更新以独立记录提交追加推送。
- 用户已有的 `overview/dev/verification/batch6-browser-saved.puzzle.json` 修改未暂存，SHA-256 仍为 `DD162353C02EC8404E660E4A364208B857608280525387B2B5A7762A359724DF`。

| 成品 | 本地路径 | SHA-256 |
| --- | --- | --- |
| 最终 CLI ZIP | `release/cli/message-stack-final-2026-10-12/PuzzleEditor-CLI-1.0.0-beta-win-x64.zip` | `a9b6ac27ee69b86125bbc8e0b78c9d3e7aaea4ec292481413cbb5708e11af915` |
| 桌面安装器 | `release/desktop/message-stack-2026-10-12/Puzzle Editor Setup 1.0.0-beta.exe`，86,914,388 字节 | `ca2d2e4144468c94d09d48c94fb654dafc61b950a5dc040aee7c6163cf2d9f13` |
| 已安装 EXE | `D:\Program Files\Puzzle Editor\Puzzle Editor.exe` | `550f2bde10b760ce2f7ee2bc35e4d5ab3be8431e03152b9ca1e350a21743a91c` |
| 已安装 ASAR | `D:\Program Files\Puzzle Editor\resources\app.asar` | `ffb71be99e3f75ebf726719a23fe815fd6ccc3de5da6a2961f5a79bd465b390c` |

安装复用上述最终包，不使用早期中间 ZIP，也不因提交文档重新构建相同业务代码。

## 实际安装

| 对象 | 安装结果 |
| --- | --- |
| CLI | `D:\Tools\PuzzleEditorCLI`，新活动版本 `C16-388e14c8265c8626`；此前版本 `C16-15d2d62f5dc3e659` 保留，共 5 个版本。dry-run 无冲突；原用户 PATH 未改。 |
| Skill | `C:\Users\吴迪\.agents\skills\puzzle-editor`，新版 CLI 受管预览与升级通过，26 份文件完整。没有强制覆盖、外部修改冲突或恢复事务遗留。 |
| 桌面 | `D:\Program Files\Puzzle Editor`，原全用户 NSIS 原位升级；退出码 0，安装注册位置与卸载入口保持原目录。 |
| 桌面备份 | `release/message-stack-2026-10-12/desktop-before`，正常关闭后的完整旧安装副本。 |

安装开始时未发现 Puzzle Editor 进程，不需要结束用户进程。桌面安装使用既有 `--updated /allusers` 与完整引用的 `"/D=D:\Program Files\Puzzle Editor"`，经 Windows 正常管理员机制完成，未修改 ACL。安装后已启动新版用户窗口并恢复原 BubbleHorror，留给用户继续使用，没有对真实工程做写入测试。

## 核验结果与证据

源码与包级验收复用同一实现的完整 834 项检查、真实 Electron 在线 58 项、浏览器操作、通用桌面会话/关闭/所有权回归、独立 CLI ZIP 214 项及成品 39 项，见 [实施报告](./CLI_Message_Stack_Implementation_2026-10-12.md)。本轮仅新增交付记录；以下检查单独针对实际安装执行。

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 受管 CLI / Skill 升级 | 预览与实际安装成功；旧版保留、原 PATH 不变、无恢复遗留 | [CLI](./evidence/CLI_Message_Stack_Delivery_2026-10-12/cli-upgrade.json)、[Skill](./evidence/CLI_Message_Stack_Delivery_2026-10-12/skill-upgrade.json) |
| 全局入口和公开资料 | 解析 `D:\Tools\PuzzleEditorCLI\bin\puzzle.cmd`，version/setup/config/skills 正常，doctor offline 健康；26 份 Skill 内容指纹一致、updateAvailable=false、重复安装 changed=false | [安装核验](./evidence/CLI_Message_Stack_Delivery_2026-10-12/cli-install.json) |
| CLI 运行文件 | 38 份清单文件与成品指纹一致，manifest 逐字节一致；新 `session messages --help` 可用 | [清单比对](./evidence/CLI_Message_Stack_Delivery_2026-10-12/cli-installed-package.json) |
| 安装版快速入门 | 从已安装 Skill 执行创建、查询、预览、应用到新路径、校验、导出；验证工程实际 description 变化 | [安装核验](./evidence/CLI_Message_Stack_Delivery_2026-10-12/cli-install.json) |
| 桌面文件与图标 | 75 份运行文件逐字节一致；桌面和开始菜单快捷方式指向正确 EXE / 独立原 ICO，Shell 16 / 32px 图像匹配 | [文件和图标](./evidence/CLI_Message_Stack_Delivery_2026-10-12/desktop-install.json) |
| 实际安装桌面回归 | 39 项通过；从真实安装 ASAR 启动，GUI 与 CLI 消息逐字段一致、关闭面板可读、token/dirty/history 保持；原在线编辑、Undo/Redo、授权保存、关闭保护和文件所有权通过；renderer warn/error 为空 | [实际桌面](./evidence/CLI_Message_Stack_Delivery_2026-10-12/installed-desktop-smoke.json) |
| Codex 用户级发现 | 本机 Codex app-server 的只读 `skills/list(forceReload=true)` 发现准确用户路径，scope=user、enabled=true；入口指纹与新版一致 | [宿主发现](./evidence/CLI_Message_Stack_Delivery_2026-10-12/codex-user.json) |
| 真实窗口消息 | 全局 CLI 与已安装 `messages.ps1` 成功读完整快照；真实 BubbleHorror 窗口为 1 info / 0 warning / 0 error，GUI 隐藏 info 仍可读；读取前后整个 status 和偏好指纹一致 | [真实读取](./evidence/CLI_Message_Stack_Delivery_2026-10-12/installed-live-messages.json) |
| 用户文件保护 | 安装与隔离回归完成、启动用户窗口之前，业务工程、偏好及原夹具全部指纹不变；实际窗口只读查询后业务工程/夹具仍相同 | [安装前基线](./evidence/CLI_Message_Stack_Delivery_2026-10-12/installation-before.json)、[启动前保护](./evidence/CLI_Message_Stack_Delivery_2026-10-12/installation-preservation.json)、[真实读取](./evidence/CLI_Message_Stack_Delivery_2026-10-12/installed-live-messages.json) |

真实用户窗口恢复工程时，既有 `PreferencesService.updateRecentProjects` 更新 `recentProjects.lastOpened` 为 `2026-10-12T11:12:24.591Z`，因此启动后的偏好指纹与安装基线不同。安装完成及隔离回归前后完整指纹已核验一致；真实消息查询另用查询前后的新偏好基线核验不变，不能将应用启动的最近项目更新时间计为 CLI 消息读取副作用。报告与受管证据只记录指纹、必要状态与非敏感字段，不存放偏好正文或密钥。

## 使用与限制

安装后直接使用 `puzzle session list --json` 选择 instance/session，再执行 `puzzle session messages --instance <instanceId> --session <sessionId> --json`，或使用 Skill 内的 `references/examples/messages.ps1` 读完快照。实例 ID 随软件重启变化，不复用本次验证 ID。

这次真实窗口的 0 warning / 0 error 只描述查询时窗口历史；工程有效性仍使用 `session validate`。安装后宿主发现确认入口可见且启用，没有把发现接口当作新一轮模型自动调用验收。历史消息没有项目归属，不提供 watch、清空或控制台/崩溃日志；旧消息被清空或软件关闭后无法恢复。保留既有版本与完整桌面备份，不自行清理旧安装。
