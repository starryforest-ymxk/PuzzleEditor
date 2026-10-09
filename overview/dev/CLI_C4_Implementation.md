# CLI C4：演出图编辑与跨资源影响

开始：2026-10-08；完成：2026-10-09。状态：已完成。C04 对应 [CLI 实施计划](./CLI_Implementation_Plan.md)中的 C4；实现前设计见 [C4 技术设计](./CLI_C4_Design.md)。在 C3 工作区基础上继续实现，C3/C4 尚未另行提交、推送或打包安装程序；已有远端提交仍为 C1/C2 的 `511701b`。

## 本批交付

新增 **11 种领域操作，累计 42 种**，共用原有 create/preview/apply/export 事务和文件格式。

| 对象 | 操作 | 行为 |
| --- | --- | --- |
| 演出图 | presentation.create/update/delete/setStart | 名称、描述、顺序、入口；删除前须明确解除所有绑定 |
| 演出节点 | presentationNode.create/update/delete | 四类节点、位置、等待时长、递归条件、脚本/子图绑定与参数；明确替代入口和关联边删除 |
| 连线 | presentationEdge.connect/disconnect/redirect/update | Branch true/false 固定槽、普通 next、Parallel 有序索引；边方向样式保留及明确清空 |

graph 必须明确指定，节点 alias 带 graphId 并核对归属。scope.project 或 scope.presentations 才允许编辑图；Stage/Puzzle 权限不会隐式扩张到共享图。新图可以通过创建 alias 单独授权。图和演出节点当前没有 assetName 字段，不新增或生成该字段；其他新增资产的 assetName 仍必须外部输入。

preview/apply 增加 impacts：资源修改前后引用、图的直接绑定、经过子图传播的全部根调用上下文及共享状态。inspect presentation 同样返回 directReferences/callingContexts。菱形调用每个“根绑定 + 图”保留一条代表路径，所有直接绑定仍完整返回；递归子图分析会收敛并给出警告。

## 共享实现与修复

- `utils/presentation.ts` 提供 GUI/CLI 共用图和节点工厂；`presentationEditing.ts` 维护唯一连线规则。修复删除/断开 True 导致 False 移位、改接追加到末尾、丢失另一端样式、残留失效边样式的问题。删除入口不会自动挑选替代节点；无变化端点手势不生成 dirty 或历史。GUI 保留禁止直接自连接的手势限制；CLI 可以显式创建环并接受共同循环警告。
- `presentationUsage.ts` 统一 Stage enter/exit、Puzzle FSM Transition、子图调用的上下文传播与最近祖先变量所有者解析。
- `resourceReferences.ts` 统一领域引用遍历，原 find*References 保留为兼容入口，黑板计数和 CLI 共用。补齐演出节点递归条件脚本、Transition invokeEventIds；不再把孤立图局部变量算到所有同 ID 资源上。普通常量 JSON 不参与引用搜索。批量查询使用显式快照索引，不建立全局工程缓存。
- 共用校验逐个调用上下文检查递归条件、参数名重复、Temporary 常量/变量类型、脚本类别和变量可见范围。诊断携带 graphId，可准确定位不同图中的相同节点 ID；旧错误基线不能掩盖新增的无效调用者。
- 浏览器验收发现普通 Constant 参数被错误显示为“未选变量”，已在共用 ScriptBindingSection 中使用现有 ui-control 展示实际常量值；不把 JSON 对象强转为字符串或 Temporary。此类普通常量在 GUI 中只读展示，可通过 CLI 领域参数修改；Variable/Temporary 的原编辑流程保留。

## UX_Flow 对照

| 要求 | 验证结果 |
| --- | --- |
| §1.3 演出绑定与上下文 | Stage 与 Transition 共用同一主图，三级子图调用完整传播；GUI Edit Graph 导航正常 |
| §6.1 四类节点与连线 | PresentationNode / Wait / Branch / Parallel 均能创建、显示、保存、导出；分支和并行顺序受保护 |
| §6.2 Inspector | 类型字段、Wait 时长、脚本与子图、Branch 递归条件显示正常；改边保留无关坐标与绑定 |
| §6.3、§7 参数和条件 | 常量 false/0/JSON、StageLocal 与 Temporary 变量引用、And/Not/Comparison/ScriptRef 往返；非法类别、参数和作用域拒绝 |
| 删除与历史边界 | CLI 删除入口/关联边要求显式策略；GUI Branch 断开和撤销实际操作通过，Store 自动化覆盖撤销/重做与无变化手势 |

## 验证结果

| 验证 | 结果与证据 |
| --- | --- |
| npm run check | **26 文件 / 417 用例全部通过**，含 C4 **42 项真实 CLI 子进程 + 11 项领域/画布回归**；C1–C3 及原有编辑器用例通过，[完整日志](./evidence/CLI_C4/check.log) |
| 静态规范 | UTF-8 327 文件、格式范围 235 文件、UI owner 110 文件；TypeScript、ESLint 和反向守卫全部通过 |
| 大型工程回归 | 引用查询/计数 6 项通过（约 1.00 秒）；Hook 更新/卸载边界通过（约 0.35 秒）。保留 5 秒超时门槛，未通过加大超时掩盖重复构建 |
| 前端生产构建 | 通过；仍有既有的 >500 kB chunk 提示，[构建日志](./evidence/CLI_C4/build.log) |
| Electron | 文件会话 **11 项**、关闭保护 **7 场景 / 32 断言**通过；日志中的 EEXIST/EPERM 是冲突创建及失败保存场景的预期结果，[日志](./evidence/CLI_C4/electron.log) |
| 实际浏览器 | 打开 CLI 文件，检查分支、并行与三级子图；断开 True 保留 False，撤销恢复；查看普通 JSON/Temporary 参数；将 Leaf Wait 从 0.5 改为 0.75；下载保存/导出；**0 Errors / 0 Warnings**，Console 无 warn/error；浏览器下载模式保留 dirty 标记，桌面保存行为由 Electron 回归覆盖 |
| 双向数据对照 | 浏览器导出 = CLI 对浏览器保存文件的导出；浏览器修改 = CLI 对原文件执行同一领域修改后的导出；源文件 SHA-256 不变，[对照记录](./evidence/CLI_C4/roundtrip-check.json) |

首轮新增测试修正了对既有错误码、导入规范化和尾换行的不准确预期；整仓回归还发现旧批量查询测试反复重建索引，已增加显式批量索引并更新测试调用方式。独立手工预期位于 c4Domain.test.ts，覆盖引用归属和计数，不以索引自身生成语义预期。

## 可直接使用的样例

- [完整创建计划](./evidence/CLI_C4/creation-plan.json)：前向 alias、显式资产名、分支/并行、三级共享图和参数。
- [CLI 生成工程](./evidence/CLI_C4/C4%20Presentation.puzzle.json)、[图编辑计划](./evidence/CLI_C4/edit-plan.json)、[预览结果](./evidence/CLI_C4/preview-result.json)、[共享叶图调用上下文](./evidence/CLI_C4/shared-leaf-contexts.json)。编辑计划绑定本次源指纹，换源后必须重新 inspect/preview。
- [浏览器保存文件](./evidence/CLI_C4/browser-saved.puzzle.json)、[GUI 导出](./evidence/CLI_C4/browser.export.json)、[CLI 同等修改结果](./evidence/CLI_C4/cli-edited.puzzle.json)。
- [分支断开证据](./evidence/CLI_C4/browser-branch-disconnected.jpg)、[参数展示](./evidence/CLI_C4/browser-script-parameters.jpg)、[最终零错误画布](./evidence/CLI_C4/browser-final.jpg)。
- [证据与源码指纹清单](./evidence/CLI_C4/manifest.json)。

## 后续边界

C1–C4 已完成，**C5 尚未实施**：用户逐次直接确认的最高权限 JSON 备用编辑，以及 CLI 发行交付。json preview/json apply 仍不可执行；回执、scope 或普通领域写权限不构成人工审批。

本批验证编辑器与文件管线，没有运行 Unity 游戏或执行用户脚本。现有脚本清单没有运行时参数签名，不能证明脚本实现接受任意参数或保证玩法正确。未新建 release，也未验证安装/升级或 MCP/在线会话。这些边界不等同于已完成所有 CLI 后续工作。
