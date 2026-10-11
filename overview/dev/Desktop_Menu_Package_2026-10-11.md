# 菜单修复桌面重新打包（2026-10-11）

## 范围与构建方式

按用户要求，将本轮共享菜单项宽度、最近项目滚动区域、行尾按钮与分隔线修复打入 Windows x64 NSIS 安装包。产品版本沿用 `1.0.0-beta`，原图标和现有快捷方式迁移钩子保持。

执行 `npm run electron:build -- release/desktop/menu-fix-2026-10-11`，重新生成前端、Electron 与 Node 运行代码，再调用项目现有受校验的桌面打包脚本。输出使用新目录，旧产物保留。本次没有新增业务代码、修改工程格式或执行用户安装、Git 推送、GitHub 发布。

UX_Flow 2.1 项目控制沿用原流程；菜单交互的浏览器实测与 808 项源码回归复用本次打包前、同一源码的[菜单修复验证](./UI_Recent_Menu_Review_2026-10-11.md)。成品另外测试共同保存与关闭保护、在线编辑及共享历史。

## 本地产物

- 安装器：`E:\Projects\Web Projects\puzzle-editor\release\desktop\menu-fix-2026-10-11\Puzzle Editor Setup 1.0.0-beta.exe`。
- 大小：86,910,992 字节，约 87 MB。
- SHA-256：`dc142d86694a5413ef4eb7b0676e0121a8e25f29af92bb4e8e61f48289e78861`。
- 解包运行目录：同目录 `win-unpacked`；校验文件为 `SHA256SUMS.txt`。
- 构建日志：`release/ui-menu-2026-10-11/desktop-build.log`。

## 成品核验

| 检查 | 结果 |
| --- | --- |
| ASAR 与当前构建一致 | 23 份前端/Electron/Node 运行文件逐字节匹配；纯类型声明按 builder 既有规则排除 |
| 菜单修复确实进入包 | CSS 中 border-box、仅纵向滚动、危险/焦点样式及 JS 中共享组件均存在，独立回归页未混入 |
| 图标 | EXE、安装器、外置 ICO 与原图一致；临时快捷方式的 Shell 16px/32px 图像一致，默认 Electron 图标被检测拒绝 |
| 实际成品启动 | 直接运行本次 `win-unpacked/Puzzle Editor.exe` 的生产 ASAR，用户数据在启动前隔离 |
| 实际成品与已验收 CLI ZIP | 36 项通过：在线认证、doctor、未保存人工修改、领域修改、共同历史、重试、权限拒绝、授权保存、关闭取消/保存、重启恢复及文件所有权 |
| Renderer 控制台 | 实际操作中 0 warning/error |
| 用户工程与安装 | 仅使用隔离工程副本；现有软件安装、用户偏好和快捷方式未改，既有回归工程 SHA-256 保持 |

包内容比较使用平台原生路径调用 ASAR API，类型声明与运行文件分别记录，避免将打包器的既有排除规则误判为缺文件。独立核验脚本位于 `release/ui-menu-2026-10-11/audit-desktop.mjs`；成品回归使用项目既有 `run-packaged-smoke.mjs --ownership --cli-zip`，CLI ZIP 为 `release/cli/reference-guide-2026-10-09/PuzzleEditor-CLI-1.0.0-beta-win-x64.zip`，本轮未重新制作 CLI。

机器证据：[包内容和哈希](./evidence/Desktop_Menu_2026-10-11/package-verification.json)、[图标核验](./evidence/Desktop_Menu_2026-10-11/desktop-icons.json)、[36 项成品回归](./evidence/Desktop_Menu_2026-10-11/packaged-smoke.json)。成品回归临时目录为 `D:\Temp\puzzle-packaged-release-JB6KwN`，保留测试日志与关闭确认截图。

## 交付边界

安装器构建与上述核验完成，未在用户现有安装上执行升级，也未重复执行 NSIS 首装/升级/卸载验收；安装逻辑未发生变化。安装包仍未签名，当前交付仅为 Windows x64。本轮已安装桌面版仍需用户运行新安装器后才能使用菜单修复；图标核验覆盖成品与临时快捷方式，不将其表述为用户桌面的视觉验收。
