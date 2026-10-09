# 完整场景教程

[返回使用指南](cli-guide.md) · [共用数据结构](data-structures.md) · [权限与错误](permissions-errors.md)

以下命令从本页所在 references 目录执行。puzzle 在 PATH 可见时脚本无需 -Puzzle；否则传实际启动器的绝对路径。所有示例写入全新的临时目录；也可以用 -WorkDirectory 指定尚不存在的目录。脚本正文随包提供，可先阅读。

## 从零创建到导出

按[快速入门](quick-start.md)运行 [quick-start.ps1](examples/quick-start.ps1)。其中 edit-plan.json 内容、sourceHash、根 Stage ID 和回执都由实际步骤产生，没有缺失的中间文件。

<a id="domain-examples"></a>
## 逐项领域操作

[sample.puzzle.json](examples/sample.puzzle.json) 是完整虚构工程：Root 下有 Room/Hall，Room 下有 Child 与 Door/Lock；各 Puzzle 有 FSM；Opening 是共享演出图。变量、事件、脚本分别预置 Draft、Implemented、MarkedForDelete，便于学习生命周期。示例资产名已在该文件中明确提供。

[operations.json](examples/operations.json) 包含每种操作的完整计划；[domain-operation.ps1](examples/domain-operation.ps1)复制教学工程、重新读取当前 hash、选取计划、预览、另存并校验：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\domain-operation.ps1 -Operation stage.move
powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\domain-operation.ps1 -Operation puzzle.delete
powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\domain-operation.ps1 -Operation transition.redirect
powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\domain-operation.ps1 -Operation presentationEdge.connect
```

每次运行独立创建一个目录。脚本输出 output 和 aliases；在领域参考页中找到对应“预期结果”核对。状态删除、Stage 级联删除、图节点起点/关联边删除的限制均在对应操作条目说明。

教学工程为各项独立操作保留了备用状态和孤立图，因此部分示例会有不可达或未使用警告。validated=true 表示默认校验未发现 error，不表示没有 warning；请同时阅读 diagnostics。

示例不假设固定 ID 能用于真实工程。已有项目先通过 inspect 的 entities、fsm、presentation、references、variables 等视图确认实体和归属，再构造精确计划。

## 嵌套层级、FSM 和演出图

运行[advanced.ps1](examples/advanced.ps1)：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\advanced.ps1
```

这个自足脚本展示：

- Root → Floor → Room 的嵌套 Stage，以及 Room 内的 Door。
- Door 的 Closed/Opened 状态、OnEvent 触发、And/Comparison/ScriptRef 条件、NodeLocal 次数累加。
- 演出图的 Branch、Parallel、Wait、PresentationNode，以及 true/false、索引和 next 槽位。
- 演出脚本参数的 Global 变量来源和 Temporary 参数。
- 通过 alias 在同一计划连接新实体；通过 Puzzle 引用取得新 FSM。
- 校验、导出，再导入为另一份完整工程。

在桌面或浏览器加载输出的 Advanced.puzzle.json，依次检查 Stage 层级、Door FSM 和 Door Sequence 演出图。CLI 只管理脚本定义与绑定，不执行游戏逻辑；是否符合实际玩法仍需在游戏中验证。

## 导入与资产名映射

advanced 脚本的最后一段读取真实导出文件，取得 SHA-256 和根 Stage ID，写出有效的 names.json，再以同一映射执行 import preview/apply。映射只把根资产名设为规格中明确给定的 ImportedRoot。

映射格式：apiVersion="1.0.0"、sourceHash、entries。每条 entry 包含 entity 和 assetName；Stage/Puzzle/Event/Script 用 type+id，State 加 ownerType=fsm 和 ownerId，Variable 指定 project/stage/puzzle owner。全局变量 ownerType=project 时不传 ownerId。完整字段见 describe.importNamesSchema。

检查 detectedFormat、missingAssetNames、importNotices 和 remainingErrors；旧缺名被保留为诊断时不能宣称可导出。转换不合并 GUI 会话、不覆盖源文件，也不允许先未经授权修改 JSON 再导入。

## 资源删除、恢复与永久删除

普通 delete 的 Draft 示例及 restore 的 MarkedForDelete 示例可直接通过领域脚本演练。标删 Implemented 时，把从 inspect 确认的目标交给相应 delete，预览应显示状态变为 MarkedForDelete；随后 restore 恢复为 Implemented。CLI 不提供“标为 Implemented”命令。

[生命周期完整脚本](examples/authorized.ps1)的默认模式在独立教学副本中依次标删和恢复，并分别另存结果：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\authorized.ps1 -Mode mark-restore
```

以下调用要求用户已在聊天中明确授权对本次虚构演练工程的对应资源做永久删除；脚本开关仅声明该许可：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\domain-operation.ps1 -Operation variable.purge -AllowPermanentDelete
```

不加声明会在提交前拒绝执行。保护规则同样覆盖父 Stage/Puzzle 删除时的间接资源移除。

## 桌面会话、Undo/Redo 与保存

1. 启动兼容桌面程序，建议打开随包 sample.puzzle.json 的副本。
2. 执行 `puzzle session list --json`，按用户指定的工程确认 instanceId 和 sessionId，不取第一项代替选择。
3. 将实际值赋给下面变量，运行[online.ps1](examples/online.ps1)。脚本会修改所选内存工程的 description，并将结果另存至新路径。

```powershell
# 以下两项必须来自刚才明确选择的会话；没有给出伪造的可执行 ID。
$instance = Read-Host 'Selected instanceId'
$session = [int](Read-Host 'Selected sessionId')
powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\online.ps1 -Instance $instance -Session $session
```

脚本包含 session list/status/inspect/preview/apply/validate/save 和 history list/undo/redo 全流程。每个写请求先把 requestId 保存到文件；token 取最新 data.token，历史条目取 data.history.undoEntryId/redoEntryId。Undo/Redo 处理当前顶部一条，不能跳过人工操作。最多保留 50 条历史，不跨重启。

没有覆盖声明的在线写入会建立自动保存限制；脚本最后使用 --out 创建新文件，两个保存模式都必须带 request-id。获授权覆盖当前路径时，省略 out，添加 allow-overwrite 和从磁盘读取的 expected-disk-hash；不能把 token.contentHash 当作磁盘 hash。

有效字段草稿可能先被提交并改变 token；重新读取状态、构造计划和预览。无效草稿、拖拽、连线、输入法组合、弹窗或翻译未完成可能返回 pending/busy。连接失败不回退到磁盘写入。

结果未知时，保留原 token、计划、回执和 requestId。10 分钟内只能重试相同 ID/内容；容量 256，过期、实例或会话变化后先核对实际内容。不要重新运行整个教程来重放未知写入。

## 获授权的覆盖与备用 JSON 编辑

[权限页](permissions-errors.md)给出预览、应用、备份与事务恢复命令。领域计划的覆盖模式使用 preview/apply 两步都加 in-place，提交加 allow-overwrite。备用 JSON 则先在已授权范围内准备完整候选，使用 json preview/apply；raw 与覆盖许可相互独立。

可从 `json read` 返回的 data.file 准备候选，保留完整包装字段，只修改明确授权的内容并写到单独候选文件；不要拿 inspect 摘要或运行时导出当作完整工程。候选归一化要求、业务校验或剩余引用出现错误时按诊断修正并重新预览，不能扩大授权范围。

[完整脚本](examples/authorized.ps1)还包含下面三种独立模式，只对新建的教学副本操作。执行相应行之前，需要用户在聊天中授权对应模式；两个开关互不授权：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\authorized.ps1 -Mode overwrite -AllowOverwrite
powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\authorized.ps1 -Mode raw -AllowRawJsonWrite
powershell -NoProfile -ExecutionPolicy Bypass -File .\examples\authorized.ps1 -Mode raw-overwrite -AllowRawJsonWrite -AllowOverwrite
```

覆盖结果中核对 backup 和 transaction，再验证输出 hash；raw 模式保存单独候选并按回执提交，不替调用者填充 ID、资产名或时间。脚本缺少声明时在准备候选前停止。
