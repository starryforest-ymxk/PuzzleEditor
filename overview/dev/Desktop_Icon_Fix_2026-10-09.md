# 桌面图标修复设计与验收（2026-10-09）

后续 Git 交付、C16.1 重新发布及真实 CLI 安装见[最新发行记录](./Release_C16_1_2026-10-09.md)。本文“尚未提交发布”描述的是图标修复验收阶段。

## 目标与约束

修复桌面及开始菜单快捷方式仍显示 Electron 默认图标的问题，覆盖原路径升级、保留旧快捷方式的场景。保持原始 `public/icon.ico` / `icon.png`，不改编辑器数据、CLI 权限或 UI。源码为 UTF-8，关键意图使用中文注释。

本任务属于 Windows 安装分发，不新增 UX_Flow 中的编辑交互；项目打开、保存、导出、关闭保护继续使用既有入口。

## 技术设计

1. `scripts/windows-icons.mjs` 统一根据原始 ICO 的 SHA-256 生成 `puzzle-editor-<16位指纹>.ico` 文件名，并生成 NSIS 安装后钩子。图标内容变化时使用新文件路径，避免复用同一图标缓存键。
2. `package-desktop.mjs` 将原始 ICO 作为独立文件放入安装目录的 `resources`，注入生成的 NSIS include，并在打包后逐字节核验资源。EXE 原图标和 ASAR 中窗口 PNG 的检查保留。
3. NSIS `customInstall` 在标准快捷方式创建/保留流程之后，更新已经存在的桌面和开始菜单快捷方式，使其使用独立 ICO；重新设置 AppUserModelID。遵守不创建快捷方式的选项，不强制恢复用户已删除的安装器快捷方式。
4. 更新后发送针对各快捷方式的 `SHChangeNotify(SHCNE_UPDATEITEM, SHCNF_PATHW | SHCNF_FLUSH)`，通知 Shell 刷新；不删除系统图标缓存或重启 Explorer。
5. `verifyWindowsIcon` 支持显式快捷方式图标来源，核对该文件图像和快捷方式配置。ICO 文件与快捷方式的系统图标索引不一定相同，因此以原始 ICO 创建隔离参考快捷方式，比较 Shell 实际返回的 16px、32px 图像，包括相同的快捷方式标记。
6. 隔离 NSIS 验收先安装，再构造旧 EXE 图标、旧快捷方式且启用 KeepShortcuts 的升级场景，确认新钩子真正迁移保留的快捷方式。验证不创建桌面快捷方式的配置并卸载测试产品。
7. 本机先备份已有快捷方式和安装/偏好哈希，然后通过 Windows UAC 应用同一已验收的安装器到原目录 `D:\Program Files\Puzzle Editor`。本次应用时桌面快捷方式已缺失，真实安装器恢复了公共桌面快捷方式。按文件回读、注册表、Shell 图像及用户实际显示反馈核验结果。

## 验证计划

- 原始 ICO/PNG 字节保持；新目录成品包含完整独立 ICO。
- EXE/安装器直接提取图标及临时快捷方式核验，拒绝默认 Electron 图标。
- 真实 NSIS 首装、保留旧快捷方式升级、无桌面快捷方式升级、卸载。
- 静态检查和项目既有回归；安装分发变更不新增镜像实现的单元测试。
- 本机修改后记录实际快捷方式、图标来源和 Shell 查询结果；当前工具不能操作原生桌面 UI，文件/API 检查不当作用户桌面像素验收。

## 执行结果

### 实现与验证

- 原 ICO/PNG 哈希保持。新安装资源为 `resources/puzzle-editor-966ab98b5f83ee14.ico`，内容与原始 ICO 全部字节一致。
- NSIS 标准创建/保留流程之后执行统一钩子，更新存在的快捷方式、保留应用 AppUserModelID，并发出同步 Shell 更新通知。不删除 Windows 图标缓存或重启 Explorer。
- 验收曾错误地要求 ICO 文件与快捷方式的 Shell 图标索引相同；改为对比原 ICO 参考快捷方式的实际图像。恢复旧来源的夹具确实观察到 Shell 图像滞后，允许仅在修复前记录此状态；修复后的每轮仍严格比较图像。
- 升级验收显式使用 `--updated`，实际触发 KeepShortcuts，而非仅重复执行普通安装。移除用户主动删除的桌面快捷方式后，再次升级不会强制重建。

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| 编码/类型/lint/格式/UI/守卫 | 通过；最终脚本改动后再次检查编码、lint、格式 | 原检查输出及下面回归记录 |
| 全量编辑器与 CLI 回归 | 39 文件 / 715 项通过；首次一项超出 5 秒，降低并发到 4、时限 15 秒后全量通过，未改变业务代码或测试断言 | [回归日志](./evidence/CLI_C16/iconfix-regression.log) |
| 成品 EXE、安装器与独立 ICO | 原图标相符，默认 Electron 图标被拒绝；临时快捷方式 Shell 16px/32px 图像通过 | [成品结果](./evidence/CLI_C16/iconfix-icons.json) |
| 真实 NSIS 首装、保留旧来源升级、删除桌面快捷方式后升级、卸载 | 中文和空格路径下 20 项检查通过；隔离产品全部卸载，用户主程序哈希保持 | [安装结果](./evidence/CLI_C16/iconfix-nsis.json)、[日志](./evidence/CLI_C16/iconfix-nsis.log) |
| 新桌面成品与原 C16 CLI ZIP | 36 项通过，含在线编辑、历史、保存、关闭及重启，renderer 无 warning/error | [配套日志](./evidence/CLI_C16/iconfix-packaged-smoke.log) |
| 当前用户真实安装 | 原目录、两处快捷方式、独立 ICO 全部回读正确；Shell 16px/32px 图像与原图相符，用户偏好哈希不变 | [本机结果](./evidence/CLI_C16/iconfix-local-install.json)、[修复前记录](./evidence/CLI_C16/iconfix-local-before.json) |
| 桌面实际显示 | 用户在 Agent 聊天中明确确认“已恢复正常” | 同上本机结果 |

当前安装的 EXE 哈希仍为 `1fe1506b5ad08eaa680eb0e582e37b73827d27cf29d6c4cb278a37646a13fa51`，ASAR 仍为 `1229c2ee2961cb15514848c44c6f280d0989dea97ec60907bc250326b7bcc360`，与原 C16 相同。本轮没有改变编辑器运行逻辑；新增外置图标和安装时快捷方式维护逻辑。UX_Flow 的保存、在线历史、关闭保护在成品回归中通过。

### 本机安装路径问题及恢复

第一次本机应用时，未引用的 `/D=D:\Program Files\Puzzle Editor` 被当前 electron-builder 的 `StdUtils.GetParameter` 按空格截断，实际安装到了 `D:\Program`。这是本次调用参数处理失误；没有修改项目文件，但暂时改变了程序安装位置。对误安装目录的 77 个文件进行了核验，确认应用文件与本轮包一致且只有预期 NSIS 附加文件，再恢复到原目录。

本项目 electron-builder 25.1.8 的多用户模板会重新解析 `/D`；因此需要将完整 `/D=...` 作为一个参数传入，不能直接套用 NSIS 原生的未引用路径规则。本机在提升的脚本中以一个完整引用的参数执行安装器；隔离测试移除了 `windowsVerbatimArguments: true`，由 Node 保持包含空格的完整参数，并新增中文/空格路径回归。相关处理按本地已安装模板和实际安装结果验证，没有修改依赖源码。

现已确认 `D:\Program Files\Puzzle Editor`、卸载注册表和两个快捷方式均恢复正确；误安装文件由真实升级卸载流程清理，仅对验证为空的遗留目录作非递归删除。`D:\Program` 已不存在。独立测试曾与本机恢复并行，导致“主程序哈希不变”探针观察到主程序从暂缺恢复；待本机稳定后重新执行整个安装验收，20 项全部通过。

### 交付与边界

新本地安装包：[Puzzle Editor Setup 1.0.0-beta.exe](../../release/desktop/C16-iconfix/Puzzle%20Editor%20Setup%201.0.0-beta.exe)，SHA-256：`bd857a3b8392ec33a22d50a4c653fc3ae367b22e82ad045a99f3d7d2b2e0619e`。

本机已经应用修复，无需再次安装。旧 C16 包和 CLI ZIP 保留；本轮未提交推送 Git 或更新 GitHub Release。保留用户此前未提交的项目夹具改动。当前工具不能截图或操控原生桌面，本次视觉验收来自用户明确反馈；自动化覆盖成品/安装/Shell 图像，未将其冒充原生桌面截图验证。安装器仍未签名。

参考：[Microsoft Shell 更新通知](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-shchangenotify)、[NSIS 原生命令参数说明](https://nsis.sourceforge.io/Docs/Chapter3.html#installerusage)。本项目 `/D` 的处理以已安装 electron-builder 模板和实际回归为准。
