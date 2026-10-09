# C11 完成报告：原图标恢复与成品检查

日期：2026-10-09。C11 代码、构建和成品资源检查完成；C16 已补独立产品的真实 NSIS 安装/旧图标二进制升级/卸载验证，当前用户安装未更改，见 [C16 报告](./CLI_C16_Implementation.md)。

## 变更与 UX

- 原 public/icon.ico、icon.png 字节保持。主窗口开发/生产分别使用 public/icon.png、dist/icon.png，启动前检查资源存在。
- Windows 明确保留 EXE 资源编辑。固定官方 winCodeSign 2.6.0 归档 SHA-512，只提取 Windows 工具内容，解决 macOS 符号链接权限导致的构建失败；未修改系统权限或依赖源码。
- package-desktop.mjs 在资源编辑后检查 EXE 图标像素、产品元数据及 ASAR 内原 PNG。未签名与图标验收独立，不再以关闭资源编辑降级。
- 新资源检查器同时检查成品 EXE、NSIS 安装器和隔离快捷方式；默认 Electron 图标会被拒绝。
- 未增加 UI。UX_Flow §2.1 保存/校验/导出/消息及已有关闭保护保持原共同流程。

## 已执行验证

生产构建、Electron 编译、实际 NSIS 构建成功。新目录为 release/desktop/C11；EXE 与安装器实际提取的 32px 图标均等于原 ICO 像素指纹，临时快捷方式 TargetPath/IconLocation 正确，原资产 hash 未变。[图标证据](./evidence/CLI_C11/icons.json)

真实 C11 ASAR/EXE 与 C10 CLI ZIP 配套运行：在线查询/修改、GUI Undo/CLI Redo、授权保存、关闭与重启、所有权检查通过；执行日志见 [成品回归](./evidence/CLI_C11/packaged-smoke.log)。未使用用户业务工程；应用偏好、发现目录及用户数据在启动前隔离。

## 边界

本批未更新当前已安装程序/快捷方式，不清理系统图标缓存，不替换已发布附件。未签名状态仍保留；C16 独立产品真实安装及 C10 二进制升级图标检查已通过，不能把该测试等同于当前用户原安装已升级或任务栏外观已手工观察。
