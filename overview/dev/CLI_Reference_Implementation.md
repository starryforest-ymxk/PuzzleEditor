# CLI 使用参考、帮助与 Skill 完善

## 目标与约束

按已批准的六批计划补齐 36 条 CLI 命令、47 种领域操作及可执行示例，统一参数来源，完善多文档 Skill 安装与更新识别。文档中文、终端帮助英文；所有文件 UTF-8。保留现有命令、业务行为、工程格式及权限契约。最后提交推送 main，更新既有本机 CLI 和用户级 Skill，不创建 Release、标签或 npm 发布。

## 技术设计

- 参数 Schema 继续决定请求结构；共用参数适配模块决定位置参数、选项拼写、终端类型与 inspect 视图限制。解析器、帮助和文档生成使用相同适配。
- 命令语义、参数说明和示例分别维护一次，生成三个命令参考页；领域操作依据 operationSchema 生成字段参考，并链接共用嵌套结构。真实 CLI 执行示例，检查结果而非仅检查文字。
- 公开文档位于 overview/dev/cli-reference，现有发行指南变为导航。安装后的 references/cli-guide.md 保持稳定；显式文件清单连接源码、包和 Skill，允许列表外文件不进入交付。
- Skill 更新按文件路径、长度与 SHA-256 比较，兼容旧记录；继续使用已有事务、冲突检查和恢复逻辑。
- UX_Flow 的层级、FSM、演出、资源生命周期、保存/导出约束不变，无 GUI 组件、路由或状态管理修改。通过生成工程和真实桌面会话回归验证文档工作流。

## 分批状态

1. 统一参数与文档来源：完成。共用 argumentContract 连接解析器、帮助和生成器，Schema 决定字段约束；示例由 commandExamples 和 cli-reference-examples 唯一维护。
2. 命令参考及帮助：完成。实际登记的 36 条命令全部生成参考条目、准确语法与参数说明，skills read 的 name 为位置参数；describe 复用同一示例。
3. 领域操作与教程：完成。47 种操作均有完整计划和实际结果断言；提供离线、复杂层级/FSM/演出图、导入、生命周期、在线历史与授权操作教程。
4. 多文档打包与安装：完成。显式清单包含 24 份公共文件，服务另生成 compatibility.json；skills read/install 返回或安装共 25 份文件。旧四文件记录可直接受管升级，同批次内容改变也能被识别。
5. 回归及独立包验收：完成。807 项回归、48 项真实 Electron 在线检查、212 项独立 ZIP 检查及浏览器、隔离 Codex 发现通过。
6. Git 推送、本机安装及宿主发现：待实现提交推送后执行，实际结果将追加至本报告。

## 验证和交付

| 验证 | 结果与证据 |
|---|---|
| npm run check | 40 文件 / 807 用例通过；UTF-8 413、格式 314、UI 110，类型、lint、规则反例及文档只读检查全部通过。[日志](evidence/CLI_Reference/full-check.log) |
| 文档示例 | reference.test.ts 的 91 项包含 36 条命令的真实参数解析、47 种领域操作 preview/apply/validate 与变化断言、7 个 PowerShell 教程模式及生成内容/链接检查；已纳入完整 check |
| 安装回归 | tooling.test.ts 47 项通过，涵盖旧四文件 Skill 同批次升级、完整文件集合、幂等、外部修改拒绝、事务恢复与 PATH/安装管理 |
| Electron 在线 | 48 项通过；新增实际执行 online.ps1 的 apply/Undo/Redo/validate/save-as，原始磁盘工程字节不变；既有并发、过期 token、草稿、重复请求、断线重试及自动保存限制均通过。[结果](evidence/CLI_Reference/online.json) |
| 浏览器人工检查 | 加载 advanced.ps1 输出，检查 Root/Floor/Room/Door、Closed/Opened/Unlock FSM、Branch/Parallel/Wait/演出节点和连接；Validate 为 0 Errors / 0 Warnings，Console 无 warn/error；浏览器运行时导出的 data 与 CLI 导出逐结构相等。[截图](evidence/CLI_Reference/browser.png) |
| 独立 ZIP | 仓库外中文/空格路径、无全局 Node 环境的 212 项检查通过；包含 37 份包文件指纹、根说明链接、两个实际教程、25 份已安装 Skill 内容、幂等、CLI 安装/升级/卸载与授权拒绝。[结果](evidence/CLI_Reference/package.json) |
| Codex 隔离发现 | 真实 Codex app-server 只读 skills/list 发现并启用项目级 Skill，领域流程执行成功。[结果](evidence/CLI_Reference/codex-isolated.json) |

安装和高权限回归只操作隔离虚构工程、安装根及测试注册表。PowerShell 示例保留 UTF-8 BOM，以兼容 Windows PowerShell 5.1 中文源文件；示例工程统一 LF，避免文档中的 sourceHash 随 Git 换行转换失效。

本地包：`release/cli/reference-guide-2026-10-09/PuzzleEditor-CLI-1.0.0-beta-win-x64.zip`。

SHA-256：`cb73823fb66dfeadb165a75dc53aaf541bbc0cca25ee450963a6c0bd15162d70`。

CLI 产品版本仍为 1.0.0-beta；机器 phase C16、API 1.0.0、policy C10、converter C7.1、online 2 保持不变，不用开发批次变化代替内容指纹。包仅包含公开资料和运行依赖，不包含本报告、开发历史或测试证据。不创建 Release、标签或 npm 发布。

本次开始前已有 overview/dev/verification/batch6-browser-saved.puzzle.json 修改，SHA-256 为 DD162353C02EC8404E660E4A364208B857608280525387B2B5A7762A359724DF；保留并排除本次提交。

## UX 要求与验证边界

UX_Flow 的 Stage 层级、Puzzle FSM、演出图、校验、导出、保存及共享历史流程通过上述示例与 GUI/桌面回归核对。没有新增界面、偏好或导航命令；全部编辑仍走现有领域服务和权限检查。

CLI 管理工程和脚本定义，不执行游戏逻辑；游戏运行效果、实际业务工程和模型自主选择/触发 Skill 不在本次验证范围。Codex 发现成功证明入口存在并启用，不代替模型调用测试。每种领域教学工程为独立操作保留备用对象，允许出现已说明的不可达/未使用 warning；复杂组合教程为 0 错误 / 0 警告。
