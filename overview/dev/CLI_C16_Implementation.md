# C16 完成报告：CLI 配套能力与图标成品验收

日期：2026-10-09。**C11–C16 已按顺序完成开发、分批测试及隔离成品验收。** 当前 CLI 为 C16，36 个命令入口、47 种领域操作；API 1.0.0、policy C10、converter C7.1、online protocol 2 保持。当前用户的 PATH、Skill、已安装桌面程序和已发布 C10 附件未改变。本文记录开发验收完成时的状态；随后按用户要求的 Git/Release 交付见 [C16 发行记录](./Release_C16_2026-10-09.md)。

## 1. 分批结果

| 批次 | 结果 | 设计与报告 |
| --- | --- | --- |
| C11 | 恢复 Windows EXE 资源编辑、正确生产图标路径及发布门禁；使用原 ICO/PNG | [设计](./CLI_C11_Design.md)、[报告](./CLI_C11_Implementation.md) |
| C12 | 内置 Node 的用户级全局命令；预览、状态、安装/升级、卸载及事务恢复 | [设计](./CLI_C12_Design.md)、[报告](./CLI_C12_Implementation.md) |
| C13 | config path/show 只读查询、严格配置及来源优先级；不存权限 | [设计](./CLI_C13_Design.md)、[报告](./CLI_C13_Implementation.md) |
| C14 | Codex 用户/项目 Skill 安装、查询、更新、卸载及恢复；指南同源 | [设计](./CLI_C14_Design.md)、[报告](./CLI_C14_Implementation.md) |
| C15 | 默认离线、显式在线的只读 doctor；独立结果汇总及准确退出码 | [设计](./CLI_C15_Design.md)、[报告](./CLI_C15_Implementation.md) |
| C16 | 全量回归、真实 ZIP/桌面/NSIS/Codex/浏览器验收、最终包和证据 | [设计](./CLI_C16_Design.md)、本文 |

## 2. 技术决策与收尾修正

- 管理命令在 contracts/automation 中定义严格输入和能力，CLI 复用共同路由。services/cliTooling 维护安装、配置、Skill、doctor；platform/node 的环境适配处理 OS 操作。未复制 Stage/FSM/演出图领域实现。
- 安装激活前核验完整包的文件名、大小、指纹、Node 和 describe。版本目录不可原地覆盖；OS 所有权锁、持久日志、条件 PATH 更新及 recovery 保护中断与并发，升级保留旧版。未知文件、链接、用户修改及第三方 PATH 变化明确拒绝。
- Windows PATH 保留未展开的原值与注册表类型，区分缺失值和空字符串；修改通过当前用户/注册表键的命名 Mutex 串行化，不使用 setx 或系统 PATH。实际 Environment 变化会广播设置变更；现有进程仍可能需要重启。
- **Windows 卸载采用外部 PowerShell 入口。** 真实 CMD 验证表明，删除正在执行的启动脚本会产生原生错误，因此移除了自动自删除分派。受管 puzzle 的实际 setup uninstall 在任何变更前返回 EXTERNAL_UNINSTALLER_REQUIRED/4，附入口及参数；--dry-run 正常工作。外部入口先复制已核验的完整包到专属临时目录，再调用同一服务删除受管版本，最后清理临时运行时。完整 ZIP 已验证无 CMD 错误、无残留后台清理进程。
- Skill reference 与 AGENTS.md 均原样来自 CLI_Distribution_Guide.md；兼容性由真实能力生成。配置只允许 schemaVersion/desktopExecutable；安装记录、配置、Skill 不保存聊天授权。
- doctor 不修复、不启动软件、不联网、不提交字段草稿；显式在线仅查询指定状态。本轮补验正常握手及 contentHash/contentEpoch 不变。
- 关键源码注释为 UTF-8 中文，CLI/界面元数据保持 English；未新增 GUI，UI 仍使用原共享所有者。

## 3. 本轮重新执行的验证

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| npm run check | 39 文件 / **715 用例**通过；含 46 项配套管理子进程测试 | [完整日志](./evidence/CLI_C16/check-final.log) |
| 编码/格式/类型/lint/UI/守卫 | UTF-8 404、格式 306、UI 110；类型/lint及故意错误拦截通过 | 同上 |
| 生产构建、Electron 编译、最终 NSIS 构建 | 通过；最终 ASAR 中 23 份运行文件与本轮构建逐字节一致 | [构建日志](./evidence/CLI_C16/desktop-package-build.log)、[快照](./evidence/CLI_C16/manifest.json) |
| 真实 Electron 文件会话 | **11 项**通过 | [桌面回归](./evidence/CLI_C16/electron-regression.log) |
| 关闭保护 | **7 场景 / 32 断言**通过，含取消、保存失败、另存、退出 | 同上 |
| 双实例文件所有权 | **21 项**通过，含切换失败保持、另存冲突、进程退出释放 | 同上 |
| 真实在线编辑/历史/保存 | **45 项**通过；实际等待 61 秒自动保存周期确认未授权内容零覆盖 | [在线日志](./evidence/CLI_C16/electron-online.log) |
| 最终独立 ZIP | **136 项**通过；仓库外中文空格路径、无全局 Node/npm | [结果](./evidence/CLI_C16/cli-package-verification.json) |
| 最终桌面 EXE/ASAR + 最终 CLI ZIP | **36 项**通过；未保存编辑、online doctor、GUI Undo/CLI Redo、授权保存、关闭及重启；renderer 零 warn/error | [配套日志](./evidence/CLI_C16/packaged-smoke.log) |
| 原图标 | EXE/安装器图标、临时快捷方式及 ASAR PNG 通过；默认 Electron 图标被拒绝 | [图标结果](./evidence/CLI_C16/icons.json) |
| 实际 NSIS 安装/升级/卸载 | 独立产品命名空间 **12 项**通过，真实桌面/开始菜单快捷方式及图标正确，全部测试安装项已清理 | [安装结果](./evidence/CLI_C16/nsis-install.json) |
| 实际 Codex Skill 发现 | Codex app-server skills/list 返回 puzzle-editor、scope=repo、enabled=true | [Skill 结果](./evidence/CLI_C16/codex-skill.json) |
| Skill 指导的工程流程 | 虚构项目创建、查询、领域预览/另存、校验及导出通过 | 同上 |
| 浏览器直接交互 | 加载→改名→Undo/Redo→校验→保存下载→导出→重开→再校验通过；0 Errors / 0 Warnings，Console 无 warn/error | [截图](./evidence/CLI_C16/browser-regression.jpg)、[日志](./evidence/CLI_C16/browser-console.json) |
| GUI/CLI 导出对照 | 同一保存工程的运行时 data 完全相等 | [对照结果](./evidence/CLI_C16/browser-export-equivalence.json) |

配套管理反例覆盖重复/损坏清单、junction、无效 UTF-8、未知配置/权限字段、同名外部命令/技能、用户修改、未知文件、安装锁、恢复前 PATH 被第三方改动、Skill 中断恢复、长 PATH 及空值/缺失值。工程回归继续覆盖外部 assetName、sourceHash/回执冲突、raw/overwrite/permanent 独立声明、文件所有权及未授权零覆盖。

NSIS 使用独立 appId/productName/卸载 GUID，在专属临时目录实际安装；升级测试把实际 C10 默认图标 EXE 放到该测试安装位置，再由新安装器替换。**这证明新安装器能替换旧图标二进制并重建快捷方式，不能当作当前用户原安装的升级记录。** 原用户安装的 EXE 哈希未变。

Codex 测试仅运行隔离 HOME/CODEX_HOME/项目中的 app-server 只读发现，没有创建模型任务；领域流程由测试脚本依照 Skill 指南调用 CLI。自动触发、模型自动询问 assetName/聊天许可的行为不在已测范围。原官方 quick_validate.py 缺 PyYAML，本轮使用已有 js-yaml 解析 frontmatter/openai.yaml并通过工具层的严格元数据与相对引用检查。

浏览器通过 Codex In-app Browser 的 UI 控件操作，使用虚构 fixture；浏览器“Save”下载副本后仍保留 dirty，重开时共享 Unsaved Changes 弹窗提示与现有规范一致，已保存副本后选择 Discard 并重开验证。导出首次使用不符合 .export.json 规则的文件名被 CLI 正常拒绝，改用规范路径后成功并通过数据对照。

## 4. UX_Flow 对应

- §2.1 的打开、保存、导出、校验、通知和项目切换保护：真实浏览器与 Electron 回归通过，保存失败保留当前会话。
- §4 的 Stage/Puzzle、§5/§6 的 FSM/演出图及 §7.6 的资源生命周期：复用原领域内核，全量领域/组件回归通过；本轮浏览器直接操作主要覆盖现有工程的 Puzzle 显示名与保存链路，没有逐一手动重测所有画布操作。
- 窗口关闭继续使用统一 Dialog/ProjectSession 流程，取消、保存、失败、另存和程序退出均重新验证。工具安装与诊断没有新 GUI/UX 交互。

## 5. 最终交付

| 产物 | 路径 | SHA-256 |
| --- | --- | --- |
| Windows x64 CLI ZIP | [PuzzleEditor CLI](../../release/cli/C16-final3/PuzzleEditor-CLI-1.0.0-beta-win-x64.zip) | 1e102835c8b11f1828955d194fa12568b1266b5091588ba5e7c2b55b8b9bf30c |
| 桌面 NSIS 安装器 | [Puzzle Editor Setup](../../release/desktop/C16-final/Puzzle%20Editor%20Setup%201.0.0-beta.exe) | d9c19156cb4beb5a1fc2fc633a9ed9ad223a833d1f300ad478dac808f1603bc4 |

完整源码快照、目录版 EXE/ASAR 哈希、原资产哈希和测试边界见 [验收清单](./evidence/CLI_C16/manifest.json)。CLI 运行文件、包内 AGENTS.md 和 Skill reference 与维护源一致；C10 ZIP、EXE、ASAR、安装器四项历史哈希全部相同。C16/C16-final/C16-final2 CLI 中间候选不作为交付。

安装、升级、外部卸载、配置、Skill 及 doctor 用法统一在 [发行指南](./CLI_Distribution_Guide.md)；快速开始见 [CLI 入门](./CLI_Quick_Start.md)。本轮同步了计划、架构、状态和能力覆盖；文档 UTF-8、本地链接及 git diff 检查通过。

## 6. 验证边界与后续

- 已完成开发及隔离 Windows 成品验收，**未替换当前用户安装，未永久安装当前用户全局命令或 Skill**。原桌面/开始菜单图标需安装本轮桌面包后才会生效；本轮没有清理系统图标缓存。
- 当前用户真实 Environment 的持久安装/广播、新打开的用户 Codex 进程 PATH 刷新、实际原 appId 安装升级及原快捷方式外观仍需在实际安装后确认。本轮使用持久独立 HKCU 测试键、新进程命令解析及独立 NSIS 产品进行验收，不将临时 PATH 或解包成功冒充用户实际安装。
- 未用原生 UI 手工观察任务栏/窗口图标像素；生产路径及进入 ASAR 的 PNG 已核验，真实快捷方式图标按系统提取核验。未签名，无证书签名验收。
- 仅验证 Windows x64/Codex；未验证 macOS/Linux、其他 Agent、Unity 游戏运行、跨机器部署或 Skill 自动模型调用。
- 没有新增 npm/MCP/软件内 AI；开发验收阶段未提交推送或更新远端 Release，后续交付另记在 C16 发行记录。测试支持受影响功能未发现回归，不能证明所有历史功能绝对无缺陷。
