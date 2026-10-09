# C7 技术设计：兼容格式导入与转换

日期：2026-10-09。状态：已实施并验收，结果见 [C7 完成报告](./CLI_C7_Implementation.md)。以下为实施前确定的设计，末尾记录验收补充。依据 [C7 计划](./CLI_Next_Development_Plan.md#4-c7兼容格式导入与转换)。

## 目标与约束

提供 `import preview` / `import apply`，把已有 importer 支持的 puzzle-project、puzzle-export、raw ProjectData、legacy ExportManifest 转换为新的完整 `.puzzle.json`。不覆盖源、不合并当前工程、不接 GUI 会话，不增加 C8–C10 功能。转换属于普通领域能力，不能先未经聊天授权直接改源 JSON 再借 import 绕行。

对应 Project_Overview §3.2 的工程/导出区别及 UX_Flow §2.1 的加载、保存、校验和消息；保留 §1.1 既有资源状态、§1.3–1.5 的演出/监听/作用域，以及 Stage/FSM 编辑所需内容。未知字段、未知 manifestVersion、结构歧义和已知有损旧数据拒绝；editorVersion 仍表示生产软件而非 Schema，沿用当前结构兼容规则。没有新的 UI 组件、路由或审批弹窗。

## 输入、结果及命名

- `import preview <source> --out <new.puzzle.json> [--names <mapping.json>] [--expected-hash <hash>] [--receipt-out <receipt.json>]`。
- `import apply <source> --out <same-target> --receipt <receipt.json> [--names <same-mapping.json>] [--expected-hash <hash>]`。不接受 raw/overwrite/purge 启用参数，也不接受计划、通用字段补丁或导入至现有工程。
- 映射严格为 `{apiVersion, sourceHash, entries:[{entity, assetName}]}`。Stage/Puzzle/Event/Script 由 type+id 定位，State 要求 FSM owner，Variable 要求 project 或明确 Stage/Puzzle owner。全局变量不以导入时生成的项目 UUID 为映射键，避免定位不稳定。映射只改 assetName；未知字段、目标、重复身份、缺 ID/owner/assetName、非法名称拒绝。
- 映射可修正已有缺名或主动修改资产名，所有改动明示差异；未映射的旧缺名可保留为原有业务错误，返回 missingAssetNames 和 remainingErrors，不能导出为运行时。当前 importer 不创建业务资产，只补项目元数据、画布坐标与参数编辑辅助 ID；禁止暗中创建 Stage/State 或补资产名。以后若转换新增资产，必须显式登记并要求外部命名，不得用旧缺名基线豁免。
- 结果返回 detectedFormat（沿用 importer 四种格式枚举）、importNotices、migrated、source、命名修改、missingAssetNames、remainingErrors、完整候选文件、candidateHash、完整源→候选差异和回执。生成的辅助字段及旧格式移除由差异/notice 可见；保留原 ID、引用、顺序、0/false 和资源状态。

## 可重建转换与唯一维护入口

| 位置 | 职责 |
| --- | --- |
| `utils/projectImport/` | 增加可注入 now/runtimeProjectId；未注入的 GUI 调用仍生成当前时间/UUID；所有元数据补时都使用同一 context；迁移/字段读取规则保持唯一 |
| `utils/projectEditorState.ts` | 抽出无历史编辑状态时的共用默认值；GUI 仍可传已有面板尺寸，离线转换用共用默认尺寸；明确不能恢复运行时文件未保存的 UI |
| `contracts/automation/importSchemas.ts` | 命令、严格映射、转换版本和 import 回执 Schema；TS/JSON Schema 同源 |
| `services/automation/importNames.ts` | 精确定位白名单命名实体，校验并应用映射；无字符串路径写入、状态修改或 ID 分配 |
| `services/automation/importService.ts` | 原文审计、共用导入/命名/错误基线、serialize/reimport、固定回执及排他交付 |
| `cli/`、`capabilities.ts` | 注册两个命令和可发现契约；沿用 JSON 输出及退出码 |

预览生成并固定导入 context（时间、运行时项目 UUID）；已有项目 meta.id/createdAt 保留，只有缺省时间按 context 补齐，输出 updatedAt/savedAt 采用固定保存时间。无 editorState 时使用共同默认并发出说明，有 editorState 时保留共用 importer 的规范化结果。

回执 kind 为 import-preview，绑定 API、converterVersion、permission policyVersion、源规范路径与字节 SHA-256、映射路径/hash 或 null、目标路径/create-new/absent、context、detectedFormat、candidateHash。它不是聊天授权。提交必须重新读取并转换，比较完整回执；不信任回执自带候选，不允许换目标/源/映射/旧转换版本直接执行。无映射与空映射是不同输入。确定性参数及命名只从固定输入得出，不能借回执注入业务内容。

导入后的未改工程作为业务错误基线；命名后的候选经共同 serializer 和 importer 重读，再用 validateCandidate 拒绝新增错误。未知/有损结构在建立基线前已拒绝。导入已有 Implemented 声明是读取已有数据，不经新建 Draft 策略伪造或降级；映射不会修改资源状态。

预览默认仅返回结果，指定 receipt-out 才排他创建回执；目标预期不存在。提交复用 targetPath/publishNew，保护源/映射/回执及别名/硬链接，发布前重新验证输入快照。相同回执同字节重试返回 already-applied；已有不同内容拒绝。回执输出与候选输出也不得相同。失败不写项目，不修改偏好或 GUI Store。

## 验收

1. 四种格式的真实 CLI 预览→提交→重开→校验/导出；源字节保持，ID/状态/0/false/引用保留。
2. 已知旧条件、缺省集合、画布坐标与参数 ID 补齐；无损迁移不成立、未知字段/版本/非法结构/重复键/数值精度/编码错误拒绝。
3. 命名映射覆盖全部有 assetName 类型、局部同 ID、全局身份稳定；未知/重复/缺字段/非法/重名/错误 sourceHash、通用 patch 拒绝；旧缺名基线保留且导出阻断。
4. 固定 UUID/时间（含缺失 meta 时间）、映射/源/目标/回执变动、旧转换版本、输入碰撞/硬链接、已有输出、幂等重试、并发排他发布、无副作用。
5. 共用 importer 的 GUI 默认行为与固定 context 行为分别验证；真实浏览器导入兼容文件后保存，与 CLI 转换结果对照，并打开 CLI 输出检查导航/参数/状态。
6. 全量 check、生产构建、Electron 会话/关闭回归；新版独立包命令发现及转换冒烟。更新使用说明、当前覆盖/架构/状态、完成报告与独立 C7 证据，保留旧批次证据与包。Git 不提交推送，GUI 安装包不重打。

## 实施与验收补充

按设计完成，无新增 UI 或额外审批。浏览器实测发现共用运行时导出器把合法 Wait=0 改为 1，已改为与有限非负时长校验一致，并增加端到端数值断言；59 项新增回归、576 项全量测试与实际 GUI/CLI 文件对照通过。工具 phase 为 C7，转换器 C7.1；本批没有权限语义变更，policyVersion 继续使用 C6。独立包 55 项检查通过。
