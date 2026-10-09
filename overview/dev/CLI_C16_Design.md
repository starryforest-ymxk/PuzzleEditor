# C16 验收设计

日期：2026-10-09。统一 phase=C16；API 1.0.0、policy C10、converter C7.1、online protocol 2 保持。当前新增 14 个工具入口，总 36 个入口，领域操作仍 47。

依次执行格式/编码/类型/lint/UI/守卫/全部测试，然后构建桌面与 CLI；共享 dist 不并发重建。扩展管理测试覆盖长 PATH/变量类型、并发锁、事务恢复、薄入口、损坏 UTF-8/路径和引用。首次候选生成于 release/cli/C16 与 release/desktop/C16；卸载入口在真实 Windows CMD 验证后调整，最终交付目录为 release/cli/C16-final3 与 release/desktop/C16-final，原有附件不覆盖。

完整 ZIP 解压仓库外中文空格目录，无全局 Node/npm，执行全部原有领域/权限冒烟及管理查询/安装/升级/卸载。安装 PATH 测试使用持久独立 HKCU 命名空间，并由新进程读取该值验证直接 puzzle 调用；这种验证不能冒充当前用户 Environment 的永久安装。Skill 用户/项目写入隔离 HOME/项目，使用真实 Codex app-server skills/list（只读，不创建任务）检查发现，执行 Skill 指导的虚构项目另存流程。若宿主不可用，记录明确限制。

桌面成品运行真实打包 EXE+新 CLI ZIP，复验在线原子编辑、Undo/Redo、保存权限/关闭保护、所有权和重启。实际用户已有软件/桌面快捷方式不改；新安装器可在独立产品命名空间测试，禁止与原 appId/快捷方式/卸载记录冲突。浏览器可操作时额外人工交互回归，自动化证据单独标明。

交付哈希、证据、使用/架构/覆盖/状态文档。Git 推送与对外 Release 发布不在本次授权内。当前用户实际安装/全局 PATH/宿主加载及外观若未执行则明确待验收，不标为完成。
