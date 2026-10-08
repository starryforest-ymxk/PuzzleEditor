# 未保存项目的窗口关闭保护

日期：2026-10-08。状态：已实施；自动回归与真实 Electron 关闭场景通过，原生 X / Alt+F4 手动验收未完成。

## 目标与范围

用户要求：未保存项目时，关闭软件必须询问是否保存。覆盖 Electron 窗口关闭（标题栏 X、Alt+F4 所走的 `close` 事件）和正常应用退出（`app.quit()`）。空会话或已保存项目直接关闭；有未保存修改时提供英文 `Save & Close`、`Discard & Close`、`Cancel`。

沿用 `Task_Breakdown.md` 的 P2-T08 完整快照保存、P4-T06 项目切换保护，以及 `UX_Flow.md` §2.1 项目控制与消息反馈。原 UX 未详细定义原生退出，本次以用户要求补充交互，不修改只读设计文档。界面全部英文，说明与关键代码注释中文。

## 技术设计（实施前）

1. **主进程**：新增单主窗口关闭协调器，在 `BrowserWindow.close` 和 `app.before-quit` 中同步阻止第一次关闭，再向该窗口发送带唯一 ID 的请求。重复关闭合并；只接受当前窗口主框架、当前请求的答复。取消时清除退出意图；批准后才执行原生关闭或继续退出。窗口销毁时解绑监听。主进程不保存 dirty 副本，也不自己写项目文件。
2. **IPC / 平台边界**：共享类型定义就绪通知、关闭请求、答复三条窄接口；preload 不暴露通用 IPC。渲染器安装监听后发送 ready，卸载时撤销。启动尚未建立编辑会话时允许关闭；已有编辑器但无法处理请求时不默认放行。渲染器失效后的关闭只能使用默认 Cancel 的原生放弃确认，不能声称保存成功。
3. **渲染器接线**：一个应用级 Hook 注册关闭事件。收到请求先同步让当前输入框失焦，提交已有 `onBlur` 草稿，再交给 `ProjectSession` 判断。卸载使用 AbortSignal 取消未完成确认，不遗留阻塞或旧答复。
4. **会话与数据**：新增 `requestClose`，复用已有 `protect`、`saveProject` 和同一 I/O 队列。先等待已有保存完成，再检查最新 revision；确认之后再次排空队列并校验会话和 revision。最终进入已有 `committing` 阶段冻结内容，直至主进程接受关闭。拒绝或 IPC 异常则恢复 idle；不把 Discard 伪装成已保存。关闭时禁止新的恢复、切换、自动保存与最终阶段导出。
5. **并发规则**：正在打开/新建项目时拒绝本次关闭并提示先完成或取消当前操作，不替换其确认框。保存中发生新编辑则重新确认；保存失败或取消路径选择则留在确认框，允许重试、放弃或取消。缺少路径时复用现有文件保存选择器；不会因为业务校验警告阻止项目文件保存。
6. **界面**：复用 `ConfirmSaveDialog`，只为关闭操作调整按钮文案和等待说明；增加 dialog 语义、键盘焦点限制与 Escape 取消。打开/新建项目的原有按钮保持原语义，不增加路由或第二套项目状态。

正常关闭在 DOM 卸载前可取消，采用 Electron 的 [`BrowserWindow` close 事件](https://www.electronjs.org/docs/latest/api/browser-window#event-close)。强制杀进程、断电和操作系统强制结束会话不属于可以承诺弹窗的范围；浏览器标签页不是本次原生退出功能的入口。

## 验证计划

- 会话测试：空/干净、保存关闭、放弃、取消、无路径保存、取消文件选择、保存失败与重试、旧保存/新编辑、队列耗尽后的 revision 复查、会话变化、关闭与切换互斥、IPC 拒绝/异常、卸载中止。
- React DOM：真实草稿输入失焦提交、三按钮及 Escape、焦点限制、StrictMode 卸载订阅清理。
- 隔离 Electron：真实 preload、IPC、磁盘写入、`BrowserWindow.close()` 和 `app.quit()`；取消后窗口存活，保存内容落盘后才销毁，重复请求与过期/其他窗口答复不放行。隔离项目和偏好，不操作用户项目。
- 全量 `npm run check`、生产构建、现有 Electron 会话回归。手动浏览器检查弹窗表现；区分浏览器 UI 检查与自动化原生事件验证。

## 实施与验证记录

### 实际实现

- 新增主进程 `electron/windowCloseGuard.ts` 和应用级 `hooks/useWindowClose.ts`，由 `electron/main.ts` / `MainLayout` 接线。三条 IPC 只处理就绪、关闭请求与答复，不暴露通用 IPC 或直接销毁窗口的接口。
- `ProjectSession.requestClose` 复用现有保存能力与版本保护。`Discard & Close` 不修改磁盘或 dirty；`Cancel` 和失败握手恢复 idle；批准后保持 committing，阻止最终关闭期间产生未保存的新版本。
- 弹窗使用现有视觉样式，默认聚焦 Cancel，Tab 留在对话框内，Escape 取消，忙碌时三个按钮均不可操作。
- **弹窗复用范围（统一后）**：正常关闭与打开/新建项目时的保存确认继续共用 `components/Layout/ConfirmSaveDialog.tsx`，由 Header 展示；该组件与删除确认、新建、项目设置和偏好五类内部弹窗均接入 `components/shared/Dialog.tsx` / `dialog.css`。布局、语义色、按钮、键盘、busy 和弹窗栈统一维护。渲染器失效、关闭监听不可用时仍走主进程的原生 `dialog.showMessageBox` 兜底。见 [弹窗统一与排查报告](./Dialog_Unification_and_UI_Style_Audit.md)。
- **真实回归发现并修复**：隐藏/后台窗口虽然仍有 `activeElement`，调用 `blur()` 可能不派发 `focusout`，从而不触发 React `onBlur`。现先尝试自然失焦，仅在事件缺失时补一次 focusout；前台/后台两条 React 测试及真实 Electron 保存内容核对均通过。
- 原项目的文件格式、Undo/Redo、自动保存队列和导入校验没有另建实现。项目设置等独立表单仍以其确认按钮提交草稿；本功能保护项目会话中的编辑和按失焦提交的字段，不把尚未确认的新建表单当成已创建项目。

### 验证结果

| 验证 | 结果与覆盖 |
| --- | --- |
| `npm run check` | 通过：266 文件 UTF-8、前端/Electron 严格类型、ESLint 0 warnings、85 文件格式、21 个故意错误拦截探针；17 个文件 / **206 个回归用例** |
| 新增会话测试 | 14 个：干净/空会话、保存、取消/放弃、失败及取消选择器重试、新编辑、已有保存排队、确认后版本变化、IPC 拒绝/异常、与切换互斥、卸载/旧会话保护 |
| 新增 React DOM 测试 | 5 个：实际 Stage Inspector 草稿在前台/后台提交、Escape/焦点限制、两个继续按钮、StrictMode 订阅及卸载清理 |
| `npm run build` | 通过：1882 模块，主 JS 630.51 kB / gzip 166.44 kB；仍有既有的 500 kB 包体告警 |
| 原 Electron 文件会话回归 | **11 项通过**，包含真实 IPC、创建/保存/重开、完整项目设置保存、文件监听与导入副本 |
| 新增 Electron 关闭回归 | **7 个场景 / 32 项断言通过**：空会话、干净工程、保存、放弃、写盘失败、另存为取消/重试、app.quit。保存场景同时验证取消退出、重复关闭合并、旧请求及其他窗口答复拒绝；在 closed 事件中直接读取文件验证最新输入已落盘 |
| 弹窗视觉核对 | 已查看完整生产页面截图，未保存星号、最新名称、三个完整英文按钮与遮罩正常显示 |
| 桌面手动操作 | 启动了隔离窗口并定位到 Name 输入框；工具随后报告同步用户输入，窗口在恢复定位前关闭。**未完成手动 X / Alt+F4 流程，不计为通过** |

Electron 测试使用真实生产页面、真实 preload、关闭协调器、项目会话及文件服务。只有另存为的选择器返回值被控制为“先取消，再指定测试路径”；写盘失败通过隔离目录中的真实文件路径冲突制造，恢复后重试。测试没有读写用户项目或用户偏好。自动测试通过代表已测场景通过，不代表强制退出或所有产品功能均已验证。

### 证据与复跑

- [关闭场景原始结果](./verification/window-close-electron.json)、[原文件链路回归](./verification/window-close-session-regression.json)、[弹窗文本](./verification/window-close-confirmation.txt)。
- [实际生产页面弹窗截图](./verification/window-close-confirmation.png)。
- 完整临时证据：`D:\Temp\puzzle-close-electron-gvyTsM`；文件会话证据：`D:\Temp\puzzle-batch2-electron-8Oj9dw`。
- 工作区备份：`D:\Temp\puzzle-close-baseline-a17ea1ef`（363 个已有文件，含前六批未提交改动）。
- 复跑全部相关验证：`npm run check` → `npm run build` → `npm run test:electron`。新增 runner 会为每个退出场景创建独立 Electron 进程，并保留结果及截图。
- 如需直接操作隔离桌面窗口：先 `npm run electron:compile`，再 `node tests/electron/run-close-smoke.mjs --manual`。该模式仅准备测试窗口和记录关闭，不自动证明手工步骤通过；按 [手工清单 M20](./Manual_Functional_Test_Guide.md) 操作并记录。

### 未覆盖范围

Windows 原生标题栏 X / Alt+F4 手动验收、真实文件选择器操作、渲染器崩溃后的原生兜底对话框、macOS 退出以及新安装包均未在本次记为通过。正常 Electron 关闭入口已接通；强制结束进程、断电、浏览器标签页和系统强制结束会话不在此保证范围。其余独立缩放、多节点整体撤销等历史缺口不属于本次实现。
