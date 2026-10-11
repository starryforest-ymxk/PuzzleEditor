# CLI 参数补齐、落盘与提示等级修复

## 目标与边界

按现有 CLI 契约提供的普通参数与 Temporary 参数应由工具补齐编辑器辅助字段，预览、校验、落盘和重新打开保持一致，不再需要导入恢复这些字段。保留命令、领域操作、工程版本、权限、在线协议和 assetName 规则；不修改当前 BubbleHorror 工程或已有浏览器验证工程。软件 UI 文本保持英文。

相关 UX_Flow：2.1 要求加载/导入提示进入统一消息堆栈；6.3 要求演出脚本参数支持常量、可见变量和 Temporary 参数。原本的保存、导出、Undo/Redo 与在线编辑行为保持兼容。

## 实施前技术设计

1. 在 utils 建立唯一的参数辅助字段补齐函数，保留已有 ID/kind、来源、值、描述、顺序和临时变量数据。缺少的 ID 采用确定性生成并避开同一绑定内已有 ID，避免 preview/apply 重建不同候选。领域操作与导入规范化都复用该函数；Inspector 的兼容显示也复用此函数，避免第三份规则。
2. 领域绑定构造在引用解析后立即补齐元数据，使离线与在线操作共享完整参数形态。候选构建仍经过真实导入边界；文件模式以最终规范化候选重新序列化，确保校验对象与落盘对象一致。在线模式保留 Store 的可选字段形态，不因导入默认值制造空计划历史。
3. 导入提示增加明确的 info/warning 等级：不改变业务值的辅助字段恢复、格式识别和迁移为 info；非当前编辑器版本及已有面板尺寸被约束等需要关注的情况为 warning。桌面按提示自身等级发布；CLI 的 importNotices 保留相同等级，将真正的导入 warning 加入诊断以参与 warnings-as-errors。领域校验错误/警告保持原规则。
4. 错误处理仍拒绝非法参数、引用、权限和并发冲突。不扩大公开参数字段，不允许 Agent 手填普通参数的 id/kind。实际导入错误仍拒绝打开，不通过降低所有消息等级掩盖问题。
5. 回归覆盖 Stage 进入/退出、FSM 转移、演出图节点、普通常量/变量/Temporary、ID 冲突与幂等、create/preview/apply/validate/export/重新打开、在线历史与保存，以及 info/warning 在 CLI 和 GUI 的一致性。使用独立虚构工程与临时目录。
6. 运行完整 npm run check、相关 Electron 在线回归，并在浏览器实际打开新 CLI 生成的工程，查看消息栈、参数值、校验和导出。另使用原始 248 项 BubbleHorror 领域计划生成临时副本核验，不覆盖业务工程。

## 完成状态与验证

已完成源码修复、公开说明同步与回归。普通参数辅助字段由工具生成；Stage 进入/退出、FSM 迁移和演出图 Script 节点共用 `utils/presentationParameters.ts`。CLI、导入规范化与 Inspector 均复用它，ID 在同一参数列表中确定且避开已有身份。文件候选重新序列化最终规范项目，回执 hash、校验对象和落盘字节一致；在线候选保留 Store 形态及既有历史语义。

导入提示的等级由导入边界统一决定：保留业务值的补齐/迁移为 info；编辑器版本差异、已有面板尺寸被约束为 warning。ProjectSession 使用同一等级。CLI 的真实导入警告产生 `IMPORT_WARNING` 诊断，计入 warnings 并参与 `--warnings-as-errors`；普通信息仍在 `importNotices` 中可查。非法结构、引用及权限拒绝不降级。满足 UX_Flow 2.1 的统一消息堆栈和 6.3 的参数来源/Temporary 编辑要求。

### 自动回归

| 范围                     | 结果                         | 主要核验                                                                                                                                                   |
| ------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`          | 42 文件 / 816 测试通过       | 编码、全部类型、lint、格式、共享 UI 归属与反向探针、36 命令 / 47 操作 / 24 Skill 文件文档覆盖、业务回归                                                    |
| 参数定向回归             | 120 测试通过，包含于完整检查 | 公共计划 create/preview/apply/validate/export/重开；磁盘原文与规范候选一致；回执 hash、重放幂等；普通/Temporary、变量引用、0/空串/false、ID 冲突、输入不变 |
| 在线参数服务             | 通过，包含于完整检查         | 提交前补齐、Undo/Redo 身份稳定、另存与内存一致、重开无参数恢复提示、空计划不制造编辑                                                                       |
| 提示等级                 | 通过，包含于完整检查         | GUI/CLI 对补齐均为 info，真正 warning 一致；严格模式拒绝 warning、允许 info；面板缺省与约束调整区分                                                        |
| 真实生产 Electron 在线   | 50 项通过                    | 新 CLI 工程打开消息栈 0 warning / 0 error；多会话、原子历史、未知结果重试、草稿、模态、过期 token、授权/磁盘冲突、自动保存边界、教程另存                   |
| `npm run test:electron`  | 通过                         | 文件会话 11 项；关闭保护 7 场景 / 32 检查；所有权 21 项。覆盖编辑/保存/重开、导入失败保留状态、外部同步、另存、取消关闭、进程退出释放占用                  |
| 生产构建与 Electron 编译 | 通过                         | 新前端和独立 CLI/Node/Electron 编译产物可运行                                                                                                              |

完整检查的安装相关测试仅在测试子进程 PATH 排除已安装全局 CLI，避免命中用户实际安装；系统/用户 PATH 未修改。真实 Electron 使用独立偏好、发现目录和工程副本，没有改变用户桌面会话或业务工程。在线验证原始结果见 [electron-online-result.json](./evidence/CLI_Parameter_Fix_2026-10-11/electron-online-result.json)，通用桌面日志见 [electron-general.log](./evidence/CLI_Parameter_Fix_2026-10-11/electron-general.log)。

[真实桌面消息栈截图](./evidence/CLI_Parameter_Fix_2026-10-11/electron-parameter-messages.png)显示打开新 CLI 参数工程后 1 条加载 info、0 warning、0 error。截图前等待后台窗口完成渲染，结果文件同时保存实际消息面板文本。

### 原始计划与浏览器实测

使用原始 BubbleHorror seed 和 248 项领域计划，只读取原文件，通过本轮编译 CLI 执行 preview → apply 到新文件 → validate（严格模式）→ export。三处 SourceKey 自动具有 `id/kind`，值和描述保留。新文件校验为 valid=true、0 errors、0 warnings、空 importNotices，见 [原始计划重放结果](./evidence/CLI_Parameter_Fix_2026-10-11/real-plan-result.json)。

在浏览器通过真实 ProjectSession 和生产 MainLayout 打开新文件，实际执行 Validate Project 和 Export；消息栈只有加载、校验和导出的 3 条 info，warning/error 均为 0。进入来源阶段的三个 Puzzle FSM 并选择“完成关闭”迁移，Inspector 分别显示 `"sink"`、`"washer"`、`"toilet"`。运行时导出的 data 与 CLI 导出逐项相同，浏览器控制台 warn/error 为空。浏览器下载仅由隔离适配器捕获输出，没有下载到业务目录。

- [浏览器观察与导出核对结果](./evidence/CLI_Parameter_Fix_2026-10-11/browser-observation.json)
- [消息堆栈截图](./evidence/CLI_Parameter_Fix_2026-10-11/browser-messages.png)
- [校验截图](./evidence/CLI_Parameter_Fix_2026-10-11/browser-validation.png)
- [FSM 参数截图](./evidence/CLI_Parameter_Fix_2026-10-11/browser-parameter-sink.png)

临时工程及导出位于仓库忽略目录 `release/parameter-fix-2026-10-11`，完整业务工程不加入开发证据或对外包。已关闭本轮浏览器标签页、Vite 服务及隔离 Electron 窗口。

### 保留边界与已知限制

- 实际 BubbleHorror 文件 SHA-256 前后一致：`CF11B7AC6075DE9BCB5D5A367C2CB7BFBC9AB756C8E00272CBFC0F20CD36AF11`。既有用户修改的浏览器验证文件一致：`DD162353C02EC8404E660E4A364208B857608280525387B2B5A7762A359724DF`。其他菜单修复及未提交内容保留。
- 本轮验证的是新源码及编译产物，没有替换已安装 CLI、Skill 或桌面安装器，没有提交推送/发布。旧安装仍沿用旧行为，需后续打包升级；旧工程打开时仍可产生信息级兼容恢复，业务文件不会自动被重写。
- 本次消除的是合法参数缺少工具辅助元数据造成的警告，不保证任意工程无领域警告；真实错误、版本风险及约束调整仍应可见。
- Vite 成功构建仍有已有 Zod 注释和大于 500 kB 的包体提示；部分隔离 Electron 用例输出 Chromium GPU 驱动日志，但断言和退出码通过。这些不是工程导入诊断，本轮未扩大为依赖或图形驱动治理。

## 后续 Git 与安装交付

用户随后要求提交推送并修复本地安装，现已完成 `origin/main` 同步、新 CLI/Skill 与原桌面安装升级；旧安装需升级的描述仅对应上述开发验收阶段。新包和实际安装分别完成验收，实际安装版的参数流程无恢复提示，原工程未改写。详见 [本机交付报告](./Local_Fix_Install_2026-10-11.md)。
