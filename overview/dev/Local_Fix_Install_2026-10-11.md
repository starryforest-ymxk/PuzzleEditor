# 菜单与 CLI 修复的 Git 交付和本机升级

## 范围与实施方式

按用户“提交 Git，推送，修复本地安装”的要求，交付已完成的共享菜单修复和 CLI 参数/落盘/提示等级修复，并升级原安装位置。沿用产品版本 `1.0.0-beta`、工程格式、权限策略及在线协议；使用已有安装服务、恢复机制与 NSIS 图标钩子。没有创建 GitHub Release、标签或 npm 发布，没有改写业务工程。

交付采用以下顺序：核对改动与远端 → 分别提交菜单和 CLI → 推送并核对远端 HEAD → 包及成品验收 → 受管 CLI/Skill 预览与升级 → 用户正常退出桌面软件后备份并升级 → 实际安装核验 → 追加本报告与证据推送。环境安装不新增领域权限，普通参数仍由工具生成辅助信息。

本次没有新增 UX_Flow 交互。§2.1 的加载、保存、导出、消息和关闭保护继续复用共享服务；§6.3 的参数编辑按前一修复报告验收。源码验证复用同一源码的 [816 项完整检查与浏览器/桌面回归](./CLI_Parameter_Consistency_Fix_2026-10-11.md)，成品和安装后验证单独执行。

## Git 交付

- `b5f7772`：共享最近项目菜单宽度、滚动区域、行尾按钮/分隔线、规范、拦截规则与回归证据。
- `53d05ad`：参数补齐、最终候选落盘、导入提示等级、公开指南、回归及此前真实 Codex 自动 Skill 测试报告。
- 上述提交已推送到 `origin/main`，远端 HEAD 与本地 `53d05ad83905262ddbcdc8a3de4b443b4c492d97` 一致。此前远端没有领先；未使用强制推送。
- 只暂存明确的代码、测试、文档和证据；用户已有的 `overview/dev/verification/batch6-browser-saved.puzzle.json` 修改保持未提交。本文及安装证据以独立记录提交追加。

## 新包与安装位置

| 对象         | 实际路径 / 标识                                                                | 结果                                                                                         |
| ------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| CLI ZIP      | `release/cli/parameter-fix-2026-10-11/PuzzleEditor-CLI-1.0.0-beta-win-x64.zip` | 内置 Node、运行文件与完整 Skill；37 份包文件                                                 |
| 桌面安装器   | `release/desktop/parameter-fix-2026-10-11/Puzzle Editor Setup 1.0.0-beta.exe`  | 新生产 ASAR、NSIS 与原图标                                                                   |
| 全局 CLI     | `D:\Tools\PuzzleEditorCLI`                                                     | 当前版本 `C16-15d2d62f5dc3e659`；旧版 `C16-8728a5764e047680` 保留，共 4 个版本；原 PATH 不变 |
| 用户级 Skill | `C:\Users\吴迪\.agents\skills\puzzle-editor`                                   | 通过新版 CLI 的受管 install 升级，25 份文件内容一致、重复安装 changed=false                  |
| 桌面软件     | `D:\Program Files\Puzzle Editor`                                               | 原全用户安装原位升级；NSIS 退出码 0，75 份运行文件与新包逐字节相同                           |
| 桌面回滚备份 | `release/parameter-fix-2026-10-11/desktop-before`                              | 升级前完整安装目录副本，旧产物未删除                                                         |

CLI ZIP SHA-256：`9758a22d1a97decdc4960191e1b7d82ea16124711ec435c0bfd80932acb87bb6`。

NSIS 安装器 SHA-256：`c0e0d3634c337815325c8e8c954249b8e7fc664f8f07d08df08800e25cfca037`，86,911,699 字节。

实际安装的 EXE SHA-256：`63ac1ed86f1004d48411538810b003dda501a0cf3aba54392c2219ea6cadf973`；ASAR SHA-256：`6bf5533c219697f77441380fa80248ee90c983ff55ecb68442e827ba5e88fb03`。二者均与成品完全一致；ASAR 的 23 份前端/Electron/Node 运行文件又与构建目录逐字节一致。

CLI 和 Skill 均先执行 dry-run，无冲突后升级。用户明确回复“已关闭 Puzzle Editor”后，确认无运行进程，备份原目录；桌面升级使用既有全用户 NSIS、`--updated` 和完整引用的 `/D` 参数，避免空格路径截断。Windows 管理员机制由正常安装流程处理，没有改变 ACL 或安全设置。卸载注册表仍指向原目录。

## 新包和实际安装验收

| 检查                    | 实际结果                                                                                                                                                              | 证据                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 独立 CLI ZIP            | 212 项通过；仓库外中文空格路径、无全局 Node；含受管安装/升级/卸载、文档及权限                                                                                         | [ZIP 验收](./evidence/Local_Fix_Install_2026-10-11/cli-package-verification.json)      |
| ASAR / 运行文件 / 菜单  | 23 份构建运行文件相同，共享菜单样式存在，临时测试页未进入包                                                                                                           | [包比对](./evidence/Local_Fix_Install_2026-10-11/package-verification.json)            |
| 新桌面成品 + 新 CLI ZIP | 36 项通过：保存、重开、在线、历史、关闭、文件占用；renderer warn/error 为空                                                                                           | [成品回归](./evidence/Local_Fix_Install_2026-10-11/packaged-smoke.json)                |
| 实际安装的桌面 EXE      | 重新执行 36 项，通过；启动的实际 ASAR 是 `D:\Program Files\Puzzle Editor\resources\app.asar`                                                                          | [安装后桌面回归](./evidence/Local_Fix_Install_2026-10-11/installed-desktop-smoke.json) |
| 实际安装文件与快捷方式  | 75 份文件匹配；桌面/开始菜单原 ICO、正确目标和 Shell 16px/32px 图像一致                                                                                               | [安装与图标](./evidence/Local_Fix_Install_2026-10-11/desktop-install.json)             |
| 全局命令与环境          | 新进程解析 `D:\Tools\PuzzleEditorCLI\bin\puzzle.cmd`，version/setup/skills/config 正确，doctor 健康且无 warn/fail                                                     | [CLI 安装核验](./evidence/Local_Fix_Install_2026-10-11/cli-install.json)               |
| Skill 文件与完整教程    | 25 份文件逐指纹匹配；安装后的 PowerShell 快速入门完成 create/inspect/preview/apply/validate/export；重复 Skill install 无变化                                         | 同上                                                                                   |
| 安装版参数流程          | 4 处绑定 / 20 参数：创建→查询→编辑→预览→另存→严格校验→导出。普通/Temporary、变量、0/空串/false、回执 hash、源文件保留均正确；0 errors / 0 warnings / 空 importNotices | [参数流程](./evidence/Local_Fix_Install_2026-10-11/installed-parameters.json)          |
| 真实 Codex 用户级发现   | app-server 只读 `skills/list(forceReload=true)` 返回精确用户路径、scope=user、enabled=true；未修改 Codex 配置                                                         | [宿主发现](./evidence/Local_Fix_Install_2026-10-11/codex-user.json)                    |

安装版参数流程只在 `D:\Temp\puzzle-installed-parameters 中文 tptabH` 使用虚构领域计划。桌面回归在独立偏好/发现目录/工程副本中执行；没有拿 BubbleHorror 做写入测试。原图标保持橙色齿轮，未清空 Shell 图标缓存、重启资源管理器或变更原图。

## 保留结果与边界

安装前后原偏好 SHA-256 一致：`150AB98E7BA357B31DC33E001FE0833972FA2B216DB92A5AD78D49B518113E94`。原 BubbleHorror 工程与已有浏览器验证工程指纹仍为 `CF11B7AC6075DE9BCB5D5A367C2CB7BFBC9AB756C8E00272CBFC0F20CD36AF11`、`DD162353C02EC8404E660E4A364208B857608280525387B2B5A7762A359724DF`，见 [保留文件核验](./evidence/Local_Fix_Install_2026-10-11/preserved-files.json)。

已有工程缺少参数辅助字段时，新桌面仍会保值补齐并显示 info；不会再把这类恢复当成 warning，也不会因此自动重写工程。新 CLI 按规范生成的参数工程直接包含辅助字段，不再出现恢复提示。真实领域错误、版本差异及约束调整仍保持可见。

产品版本沿用 beta，更新依据内容指纹而非修改开发批次。当前已安装版本与 Skill 均已升级；软件可正常重新打开。真实安装的快捷方式由系统提取图像核验，本轮未冒充用户人工视觉确认。未重复启动模型自动任务，宿主发现与安装后领域流程是独立验证；之前模型自动触发证据保留。安装器仍未签名，仅验收 Windows x64。
