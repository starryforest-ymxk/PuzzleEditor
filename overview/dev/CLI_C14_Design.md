# C14 技术设计：离线 Skill 分发与安装

日期：2026-10-09。采用 skill-creator 的短入口/渐进参考结构。源 SKILL.md + agents/openai.yaml；发行 reference 从 CLI_Distribution_Guide.md 唯一来源复制，compatibility.json 从实际能力生成。源码执行时动态读取同一指南，不维护副本。

新增 skills list/read/install/status/uninstall/recover；read 接受唯一技能名位置参数。安装/状态/卸载/恢复显式 --agent codex --scope user|project；项目范围要求 --project-root，用户范围禁止该参数。默认用户目标 ~/.agents/skills/puzzle-editor；不触碰 Codex 配置。管理记录放 CLI 根/skills/<目标路径哈希>.json，指纹绑定目标、文件、版本兼容信息。外部同名或用户修改冲突，无 force。

安装先在同父级唯一 staging 目录写完整技能，核验后把旧目录改名为备份、发布新目录、提交所有权记录，再逐文件清理已核验旧版。事务日志记录 before/after/staging/backup；异常恢复旧目录，进程中断由显式 skills recover 处理，不自动吞掉未知变动。卸载同样先验证所有权再移到备份，提交记录后逐文件清理。所有递归目录边界在操作前解析；拒绝链接和未知文件。

status/只读列表不创建管理记录，不宣称宿主已发现。安装输出 reloadHint；实际 Codex 发现及一次虚构工程流程属于 C16 验收。技能引用当前 describe，要求 assetName 外部指定，三项最高权限分别遵循用户聊天授权；未授权时优先领域另存。UX_Flow 编辑交互不变。
