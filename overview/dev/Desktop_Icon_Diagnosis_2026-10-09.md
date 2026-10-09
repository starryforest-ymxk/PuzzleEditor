# 桌面图标安装后诊断（2026-10-09）

后续状态：独立 ICO、保留快捷方式升级迁移及本机应用已完成，用户确认桌面图标已恢复正常，见[修复与验收报告](./Desktop_Icon_Fix_2026-10-09.md)。下文保留修复前的只读排查记录。

用户反馈：安装 C16 后，桌面快捷方式仍显示 Electron 默认图标。本次只读检查程序、快捷方式和图标资源，没有修改快捷方式、删除缓存或重启 Explorer。

## 已确认的结果

- 实际安装目录为 `D:\Program Files\Puzzle Editor`。安装的 EXE 和 `resources/app.asar` 与 C16 最终发布包逐字节一致，可排除仍安装旧版本。
- 桌面快捷方式 `C:\Users\Public\Desktop\Puzzle Editor.lnk` 和开始菜单快捷方式 `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Puzzle Editor.lnk` 均指向该 EXE，图标位置均为该 EXE 的索引 0。两者在 20:09 创建或更新。
- 直接提取安装 EXE 的关联图标，像素与原始 `public/icon.ico` 一致。
- 解析安装 EXE 的 PE 图标资源：只有一个图标组，16、24、32、48、64、72、96、128、256 共九个尺寸的图像内容均与原始 ICO 完全一致，没有遗漏的大尺寸 Electron 图标。
- 通过 `SHGetFileInfoW` 查询安装 EXE，返回的 16px、32px 图标与原始 ICO 的查询结果一致，并且与 Electron 默认 EXE 的结果不同。两个快捷方式返回的图标索引与安装 EXE 一致，且两者图像结果相同。快捷方式图像哈希与 EXE 不同，可能包含快捷方式标记，本次没有将该差异直接判定为图标错误。

核验哈希：

| 文件 | SHA-256 |
| --- | --- |
| 安装 EXE / C16 EXE | `1fe1506b5ad08eaa680eb0e582e37b73827d27cf29d6c4cb278a37646a13fa51` |
| 安装 ASAR / C16 ASAR | `1229c2ee2961cb15514848c44c6f280d0989dea97ec60907bc250326b7bcc360` |
| 原始 ICO / 安装的 uninstallerIcon.ico | `966ab98b5f83ee143e8fe98f367b2e7233c41e36c5ad23da5ff409c9a23527c5` |

## 判断及验证边界

安装内容和图标资源已经正确。结合用户仍看到旧图标的反馈，最可能的原因是当前 Explorer 或开始菜单进程保留了原路径的旧图标缓存。

本次新进程中的 Shell 查询没有复现默认图标，因此缓存原因属于有依据的推断，尚未直接确认。磁盘图标缓存文件时间早于本次安装也不能单独证明缓存错误，因为内存缓存可能延迟写入。

此前 C16 验收检查了构建产物和隔离安装后的快捷方式，但没有验证用户现有桌面进程在原路径覆盖升级后的实际显示。这一验证范围不足以保证当前桌面的缓存已更新。

## 建议的后续修复

1. 对这两个快捷方式采用明确的独立 ICO 路径，并通知 Shell 更新，先验证目标快捷方式的实际显示。当前安装的 `uninstallerIcon.ico` 内容已验证与原图一致，可用于针对性排查；长期方案应使用专用应用图标文件。
2. 安装器统一维护应用 ICO 文件及快捷方式图标来源，并补充“原路径覆盖升级后”的桌面显示验收。
3. 只有针对性刷新仍无效时，再考虑用户会话重启或图标缓存重建。本次未执行这些操作。

本次没有新增 UI，也未运行编辑器功能回归；检查范围仅为已安装的 Windows 图标链路。

接口参考：[Microsoft SHGetFileInfoW 文档](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shgetfileinfow)。Shell 的系统图标列表按进程维护，因此新进程的查询结果不能证明现有 Explorer 进程已经刷新。
