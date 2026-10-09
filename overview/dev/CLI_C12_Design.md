# C12 技术设计：用户级全局命令

日期：2026-10-09。依赖独立 ZIP，工程/API/权限/在线协议保持不变；工具 phase 推进为 C12。

## 命令与层次

新增 version、setup install/status/uninstall。安装/卸载支持 dry-run，source 显式指向完整包，install-root 可显式指定；默认使用当前用户 LOCALAPPDATA/StarryTree/PuzzleEditorCLI。命令/Schema/帮助/describe 同源，环境写入标注 environment_write，与工程最高权限分开。Windows PS 薄入口调用同一服务，不重复业务校验。

服务层严格解析安装记录及源包清单，验证每个文件路径、指纹、普通文件和最低必需资源；Node 层提供保留注册表类型/未展开原值的 PATH 读取与条件写入。测试适配仅允许独立 HKCU/Software/PuzzleEditorCLI/Tests/... 注册表键，不冒充真实用户 PATH 验收。

## 事务与所有权

每次读配置/预览不创建目录。执行使用受管根中的独占操作锁。新版本完整写入 versions/<phase>-<manifest hash>，核验后才激活；旧版本保持。安装记录记录每个版本的源清单及启动器指纹，路径固定为根内相对路径，拒绝 junction/symlink、未知文件、外部内容和受管文件修改。

事务先写恢复日志，发布完整版本，再写稳定 bin/puzzle.cmd 和安装记录，最后条件更新用户 PATH；故障时恢复旧启动器/记录及仅本事务新增的 PATH 项。未完成的恢复日志阻断后续激活，返回可定位的恢复状态；不能自动覆盖第三方新改动。无变更重复安装幂等。

PATH 只追加稳定 bin，保留其他值和类型；对同名外部 puzzle 返回冲突。卸载先验证所有受管文件及目录清单，无外部修改才逐文件删除，不递归清除未知目录；保留用户 config/Skill 等不属于安装版本的文件。

Windows 正在运行的 Node EXE 和 CMD 脚本均不能安全删除自身。C16 成品测试修正设计：稳定入口不自行删除；安装状态公开卸载 PS 入口，实际从外部直接运行，先复制完整包到独占临时目录，再由临时运行时执行共同卸载服务；清理前核对绝对临时路径。受管 Node 调用 setup uninstall 则零写入返回 EXTERNAL_UNINSTALLER_REQUIRED 和结构化入口/参数，预览仍可正常执行，不伪报成功或留后台清理任务。

## 参数、版本和验证

启动器不 cd，保留 stdin/stdout/stderr、退出码和参数；--version 映射到结构化 version，版本来源于 package 元数据、当前 phase、Node 与协议常量。安装脚本不要求全局 Node/npm，包内 Node 提供执行环境。

覆盖源损坏/穿越/重复路径/符号链接/未知文件/并发锁、重复安装、升级回滚、被修改的启动器、长 PATH、变量表达式、命令冲突、卸载和真实子进程。最终在新终端/实际用户环境的永久 PATH 与 Skill 验收另按 C16 执行；当前用户设置保持。UX_Flow §2.1 及既有工程事务不变。
