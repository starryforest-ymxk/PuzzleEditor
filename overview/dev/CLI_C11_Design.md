# C11 技术设计：恢复原图标与桌面发行检查

日期：2026-10-09；依据 C11–C16 计划，先实施 C11，不更改原 ICO/PNG 或用户安装。

## 目标及 UX

恢复 Windows EXE、安装/卸载器和快捷方式的原图标。窗口图标使用开发 public/icon.png 或生产 dist/icon.png。保留 UX_Flow §2.1 的项目保存/导出/消息和既有关闭保护；不新增 UI、Store、路由或项目格式。

## 实施设计

- main.ts 从 app.getAppPath() 构建对应环境的图标路径，启动前确认存在。打包 files 已包含 dist，故不复制第二份 public 目录。
- Windows 构建明确启用 signAndEditExecutable。证书缺失仍可未签名，不允许关闭资源编辑作为降级。
- 构建准备器校验固定 winCodeSign 2.6.0 官方归档的 SHA-512，选择性提取 Windows 内容至 electron-builder 标准缓存，不提取 darwin/linux 的符号链接。只操作工具缓存，不提升权限、不修改依赖。
- 新 package-desktop.mjs 通过结构化 electron-builder API 打包到 release 内新目录；资源编辑后提取 EXE 图标并与原 ICO 的 32px 像素指纹比较，核对产品信息及 ASAR 中 PNG 字节。校验失败阻断构建。
- Windows 图标核验共用独立脚本；安装器、已安装测试 EXE、临时快捷方式也使用同一检查，不把现有软件安装过程作为默认测试。

## 错误与验证

输出/缓存路径必须经过边界核对，工具归档指纹不符则拒绝，不能覆盖旧发行目录。原 ICO/PNG hash 固定。真实构建目录版/NSIS，检查 EXE 图标、临时快捷方式目标及图标；真实成品启动/关闭保护沿用现有 Electron 验收。Windows 图标显示缓存和真实升级另在 C16 隔离安装验收中核对，不宣称本次已更新用户桌面。
