# CLI 对外文档与 Skill 整理

日期：2026-10-09。状态：已完成，新的本地 ZIP 与本机 CLI/Skill 已同步更新。

## 目标与范围

用户要求可发布包只保留外部使用者需要的信息，移除开发批次、实施历史、验收记录和维护过程说明，并询问为什么 PuzzleEditor 只有一个 Skill。

发行指南按当前功能与任务组织：安装与配置、工程读取与领域编辑、在线会话和撤销/重做、导入导出、授权及恢复。命令、参数、当前限制和兼容要求保留；开发阶段比较、历史包目录及内部报告链接移除。包内 README 使用同一份入门文档，避免再维护一套入门说明。

## 技术设计

- `overview/dev/CLI_Distribution_Guide.md` 是完整使用说明来源，打包产生 `AGENTS.md` 和 Skill 的 `references/cli-guide.md`；使用者看到的内容不描述这条维护流程。
- `overview/dev/CLI_Quick_Start.md` 维护入门步骤，打包为 README 时只转换完整指南的相对链接。
- `agent-skills/puzzle-editor/SKILL.md` 保留一个产品入口，按任务定位指南中的相应章节；去除维护来源说明。安装记录与文件指纹继续通过现有受管安装服务维护。
- `describe` 与 help 的功能说明移除开发批次括号。机器回执、协议及受管安装格式沿用现有契约：这些字段用于兼容判断和恢复，不是开发记录。此次不变更请求格式或桌面协议。
- 打包只复制明确需要的 Skill 入口、界面元数据及指南，不递归带入整个源码 Skill 目录里的未知文件。新包放入新的发行目录，验收后升级已有 CLI 与用户级 Skill。
- 无编辑器 UI、路由或状态管理变更；UX_Flow 的保存、资源生命周期与共享历史约束继续由原实现处理。此次任务不创建用户工程或授予工程高权限。

## Skill 划分依据

本机飞书 Skills 的入口分别处理文档、表格、多维表格、知识库、认证等业务，各自有不同模型和工作流。PuzzleEditor 的 Stage、Puzzle、FSM、演出图及资源属于同一工程模型，共用 inspect/preview/apply/validate 和授权规则；保留一个入口能减少选择歧义。只有出现独立任务、不同工作流或需要独立触发时才增加 Skill，不能以数量判断覆盖程度。

## 验证计划

1. 检查对外文档及命令说明，确认当前用法完整且不依赖开发历史；本地链接、UTF-8、Skill 元数据有效。
2. 执行类型/lint/格式等项目门禁，以及已有 CLI 契约、工具安装和升级测试。
3. 构建完整 ZIP，在隔离目录运行现有发行包验收，覆盖无全局 Node、指纹、Skill 安装/卸载和领域操作。
4. 通过受管安装服务升级 `D:\Tools\PuzzleEditorCLI` 及用户 Skill，检查 doctor、实际文件一致性和 Codex 发现；保留已有用户工程修改。

## 实施与验证结果

- 完整指南、入门文档和 Skill 入口均已清理开发批次、历史包目录、内部报告链接及维护过程说明。功能说明只描述当前操作、权限、兼容要求及出错后的处理方式。
- describe/help 的功能描述去除开发批次括号，命令和协议行为保持。Skill 仍是一个入口，通过任务定位功能章节；未创建多个重复维护授权规则的 Skill。
- 打包只复制明确的 Skill 文件，README 由入门文档生成并转换包内相对链接；包内完整指南和 Skill 参考与源文档逐字节一致。
- 编码、类型、lint、格式、UI 规范及守卫检查通过；全量 **39 文件 / 715 项测试通过**。仅格式检查发现两处换行格式，修正后通过。
- 独立 ZIP 在仓库外中文/空格路径与无全局 Node 环境完成 **136 项检查**，覆盖运行、指纹、领域操作、安装和 Skill 管理。详见[包验收](./evidence/CLI_Public_Distribution/package-smoke.json)。
- 文档 UTF-8、本地链接、YAML 元数据和 36 个命令说明通过审阅；包内 4 份对外文档无开发标记。Python 官方 Skill 检查器因环境缺少 PyYAML 未能运行，改用现有 js-yaml 校验元数据及必需字段，并由实际 CLI/宿主校验安装结果。见[源审阅](./evidence/CLI_Public_Distribution/source-audit.json)、[包审阅](./evidence/CLI_Public_Distribution/package-audit.json)。
- 通过 setup install 升级 `D:\Tools\PuzzleEditorCLI`，再通过 skills install 更新用户级 Skill；PATH 无新增变化，旧 CLI 版本按既有升级机制保留。全局命令解析、doctor 和安装后的指南指纹通过，见[CLI 实装](./evidence/CLI_Public_Distribution/installed-cli.json)。
- 当前用户 Codex app-server 只读发现 `puzzle-editor`、scope=user、enabled=true，见[Skill 实装](./evidence/CLI_Public_Distribution/installed-skill.json)。未创建模型任务验证自动触发。

新的本地发行包：`release/cli/public-guide-2026-10-09/PuzzleEditor-CLI-1.0.0-beta-win-x64.zip`。

SHA-256：`244a2aab74aad54dc694445b9405f0c9f440e381bb0399a9bdf51e1628bd2212`。

首次交付为本地可发布 ZIP 和已安装工具的更新；后续用户要求提交推送并复核安装，见下节。开发记录和本报告不进入 ZIP。机器契约中的既有版本标识仍用于兼容校验和安装恢复，不在使用文档中以开发进度解释。未改桌面代码或 UI，因此没有重新打包桌面安装器或重复浏览器手工回归；原 UX_Flow 的保存、删除与历史行为由既有全量测试覆盖其自动化范围。

## Git 交付与安装复核（2026-10-09）

用户明确要求“重新推送并且安装，不需要发布”。源代码、对外指南、打包调整及相关验证记录纳入本次提交，推送目标为 origin/main；不创建新标签或操作 GitHub Release。用户原有的 `verification/batch6-browser-saved.puzzle.json` 工作区修改不纳入此次提交。

使用 SHA-256 与已验收记录相同的 ZIP 对应目录重新执行 CLI 安装和用户级 Skill 安装，两者均成功并返回 changed=false，确认已处于相同版本。全局命令、doctor、包内指纹和已安装指南与源码一致性通过。见[安装复核](./evidence/CLI_Public_Distribution/reinstall-check.json)。本次没有修改功能代码，沿用上节 715 项回归与 136 项包验收结果。

最终 Git 提交及远端核对结果记录在忽略目录 `release/publication/public-guide-git-result.json`，不进入发行包。
