# C12 实施报告

日期：2026-10-09。代码已完成，批次真实子进程 10 项测试通过；C16 已补完整 ZIP、独立持久 HKCU PATH、新进程及升级/卸载验收，见 [C16 报告](./CLI_C16_Implementation.md)。当前用户 Environment 未改变。

新增 version 与 setup install/status/uninstall/recover，独立包包含两项 PowerShell 薄入口。源包逐文件核验，版本目录不可原地覆盖，升级保留旧版；安装/卸载有预览、OS 所有权锁、事务日志和条件 PATH 更新，修改过的启动器或未知文件阻断删除。Windows 卸载入口通过临时运行时解决 EXE 自删除问题。未调用 setx，不修改系统 PATH。

测试：版本、零写入预览/状态、损坏包、首次/重复安装、启动器修改、升级保留旧版、卸载预览、自运行时拒绝、未知文件保护、卸载保留配置及移除 PATH 全通过；测试使用独立 HKCU 命名空间，中文空格目录。修正了 JSON 属性顺序比较和 PowerShell UTF-8 输出。CLI 编译与类型检查通过。中断、并发、薄入口及完整发行回归在 C16 扩展验证。

工程语义及 UX_Flow 编辑交互未改变；environment_write 独立于三项最高工程权限。C12 首次打包仅证明包生成，后续修正由 C16 最终包覆盖，旧包不作为最终交付。最终 Windows 入口不自删除正在执行的 CMD；实际卸载需直接运行返回的外部 PowerShell 入口，受管 puzzle 的非预览卸载返回 EXTERNAL_UNINSTALLER_REQUIRED/4 且零写入，详见唯一发行指南。
