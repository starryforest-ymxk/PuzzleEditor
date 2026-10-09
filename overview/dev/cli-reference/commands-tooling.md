# 环境与工具命令

[返回使用指南](cli-guide.md) · [权限与错误](permissions-errors.md)

每个示例列出一次调用。需要的工程、计划、token、回执和 PowerShell 变量须按[快速入门](quick-start.md)或[完整教程](workflows.md)准备。示例路径按实际包位置替换；高权限示例仅在已有相应聊天授权时执行。

- [doctor](#doctor)
- [skills list](#skills-list)
- [skills read](#skills-read)
- [skills status](#skills-status)
- [skills install](#skills-install)
- [skills uninstall](#skills-uninstall)
- [skills recover](#skills-recover)
- [config path](#config-path)
- [config show](#config-show)
- [version](#version)
- [setup install](#setup-install)
- [setup status](#setup-status)
- [setup uninstall](#setup-uninstall)
- [setup recover](#setup-recover)

<a id="doctor"></a>
## doctor

聚合只读环境诊断，可额外检查工程或明确桌面会话。

```text
puzzle doctor [--install-root <installRoot>] [--config <config>] [--offline] [--online] [--instance <instance>] [--session <session>] [--project <project>] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--install-root` | string | 可选 | 受管安装根；省略时使用运行环境解析的安装根。 minLength=1; pattern="\\S" |
| `--config` | string | 可选 | 显式可选配置文件；优先于环境变量和默认位置。 minLength=1; pattern="\\S" |
| `--offline` | boolean | 可选；默认 `false` | 明确要求只做离线诊断，不能与 online 同用。  |
| `--online` | boolean | 可选；默认 `false` | 对明确 instance/session 做在线诊断，不会启动桌面程序。  |
| `--instance` | string | 可选 | session list 中用户明确选择的 instanceId，不能猜第一个窗口。 pattern="^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$"; format="uuid" |
| `--session` | integer | 可选 | 对应实例中的 sessionId；必须与 instance 配对。 minimum=0; maximum=9007199254740991 |
| `--project` | string | 可选 | doctor 要额外校验的工程文件，不修改工程。 minLength=1; pattern="\\S" |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 默认离线；online 与 offline 互斥；online 必须同时提供 instance/session，离线禁止提供。

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle doctor --offline --json
```

结果检查：data.healthy、checks 的 pass/warn/fail/skip；有 fail 退出 3，否则 0。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。

<a id="skills-list"></a>
## skills list

列出当前 CLI 随包提供的 Skill。

```text
puzzle skills list [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle skills list --json
```

结果检查：data.skills 的名称、支持的 Agent 和安装范围；不代表已经安装。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 安装冲突或恢复要求：核对返回路径和受管记录，使用同目标 recover；不强制覆盖未知文件。

<a id="skills-read"></a>
## skills read

离线读取随包 Skill 及全部参考文件。

```text
puzzle skills read <name> [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `<name>` | "puzzle-editor" | 必填 | 显示名称；skills read 的位置参数固定为 puzzle-editor。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle skills read puzzle-editor --json
```

结果检查：data.files 是相对路径到 UTF-8 内容的映射；按任务选择具体参考页。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 安装冲突或恢复要求：核对返回路径和受管记录，使用同目标 recover；不强制覆盖未知文件。

<a id="skills-status"></a>
## skills status

核验指定位置的 Skill 安装及内容更新状态。

```text
puzzle skills status [--install-root <installRoot>] --agent <agent> --scope <scope> [--project-root <projectRoot>] [--dry-run] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--install-root` | string | 可选 | 受管安装根；省略时使用运行环境解析的安装根。 minLength=1; pattern="\\S" |
| `--agent` | "codex" | 必填 | 目标 Agent，目前只支持 codex。  |
| `--scope` | "user" \| "project" | 必填 | user 为用户级；project 为明确项目级，后者必须带 projectRoot。  |
| `--project-root` | string | 可选 | 已存在的项目目录；project 范围必填，user 范围禁止。 minLength=1; pattern="\\S" |
| `--dry-run` | boolean | 可选；默认 `false` | 只检查并返回计划，不执行安装、卸载或恢复写入。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 必须显式 agent/scope；project 范围必须提供已有 project-root，user 范围禁止该参数；外部修改拒绝覆盖。

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle skills status --agent codex --scope user --json
```

结果检查：installed、managed、updateAvailable、recoveryRequired、target；hostDiscovery 单独验证。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 安装冲突或恢复要求：核对返回路径和受管记录，使用同目标 recover；不强制覆盖未知文件。

<a id="skills-install"></a>
## skills install

安装或更新未被外部修改的受管 Skill。

```text
puzzle skills install [--install-root <installRoot>] --agent <agent> --scope <scope> [--project-root <projectRoot>] [--dry-run] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--install-root` | string | 可选 | 受管安装根；省略时使用运行环境解析的安装根。 minLength=1; pattern="\\S" |
| `--agent` | "codex" | 必填 | 目标 Agent，目前只支持 codex。  |
| `--scope` | "user" \| "project" | 必填 | user 为用户级；project 为明确项目级，后者必须带 projectRoot。  |
| `--project-root` | string | 可选 | 已存在的项目目录；project 范围必填，user 范围禁止。 minLength=1; pattern="\\S" |
| `--dry-run` | boolean | 可选；默认 `false` | 只检查并返回计划，不执行安装、卸载或恢复写入。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 必须显式 agent/scope；project 范围必须提供已有 project-root，user 范围禁止该参数；外部修改拒绝覆盖。

权限与副作用：`environment_write`。明确修改工具安装、Skill 或用户 PATH；dry-run 不写入。

```powershell
puzzle skills install --agent codex --scope user --json
```

结果检查：target、changed、installed 和 reloadHint；重复相同内容安装 changed=false。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 安装冲突或恢复要求：核对返回路径和受管记录，使用同目标 recover；不强制覆盖未知文件。

<a id="skills-uninstall"></a>
## skills uninstall

卸载明确范围中未被修改的受管 Skill。

```text
puzzle skills uninstall [--install-root <installRoot>] --agent <agent> --scope <scope> [--project-root <projectRoot>] [--dry-run] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--install-root` | string | 可选 | 受管安装根；省略时使用运行环境解析的安装根。 minLength=1; pattern="\\S" |
| `--agent` | "codex" | 必填 | 目标 Agent，目前只支持 codex。  |
| `--scope` | "user" \| "project" | 必填 | user 为用户级；project 为明确项目级，后者必须带 projectRoot。  |
| `--project-root` | string | 可选 | 已存在的项目目录；project 范围必填，user 范围禁止。 minLength=1; pattern="\\S" |
| `--dry-run` | boolean | 可选；默认 `false` | 只检查并返回计划，不执行安装、卸载或恢复写入。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 必须显式 agent/scope；project 范围必须提供已有 project-root，user 范围禁止该参数；外部修改拒绝覆盖。

权限与副作用：`environment_write`。明确修改工具安装、Skill 或用户 PATH；dry-run 不写入。

```powershell
puzzle skills uninstall --agent codex --scope user --dry-run --json
```

结果检查：移除结果；同名外部 Skill、未知文件和用户改动会阻止卸载。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 安装冲突或恢复要求：核对返回路径和受管记录，使用同目标 recover；不强制覆盖未知文件。

<a id="skills-recover"></a>
## skills recover

恢复中断的 Skill 安装、升级或卸载。

```text
puzzle skills recover [--install-root <installRoot>] --agent <agent> --scope <scope> [--project-root <projectRoot>] [--dry-run] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--install-root` | string | 可选 | 受管安装根；省略时使用运行环境解析的安装根。 minLength=1; pattern="\\S" |
| `--agent` | "codex" | 必填 | 目标 Agent，目前只支持 codex。  |
| `--scope` | "user" \| "project" | 必填 | user 为用户级；project 为明确项目级，后者必须带 projectRoot。  |
| `--project-root` | string | 可选 | 已存在的项目目录；project 范围必填，user 范围禁止。 minLength=1; pattern="\\S" |
| `--dry-run` | boolean | 可选；默认 `false` | 只检查并返回计划，不执行安装、卸载或恢复写入。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 必须显式 agent/scope；project 范围必须提供已有 project-root，user 范围禁止该参数；外部修改拒绝覆盖。

权限与副作用：`environment_write`。明确修改工具安装、Skill 或用户 PATH；dry-run 不写入。

```powershell
puzzle skills recover --agent codex --scope user --json
```

结果检查：恢复结果和目标路径；使用原来的 agent/scope/project-root。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 安装冲突或恢复要求：核对返回路径和受管记录，使用同目标 recover；不强制覆盖未知文件。

<a id="config-path"></a>
## config path

只查询可选配置的解析位置和存在状态。

```text
puzzle config path [--install-root <installRoot>] [--config <config>] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--install-root` | string | 可选 | 受管安装根；省略时使用运行环境解析的安装根。 minLength=1; pattern="\\S" |
| `--config` | string | 可选 | 显式可选配置文件；优先于环境变量和默认位置。 minLength=1; pattern="\\S" |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle config path --json
```

结果检查：预期路径及是否存在；不解析配置正文，不创建配置。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。

<a id="config-show"></a>
## config show

读取严格配置及各字段的生效来源。

```text
puzzle config show [--install-root <installRoot>] [--config <config>] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--install-root` | string | 可选 | 受管安装根；省略时使用运行环境解析的安装根。 minLength=1; pattern="\\S" |
| `--config` | string | 可选 | 显式可选配置文件；优先于环境变量和默认位置。 minLength=1; pattern="\\S" |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle config show --json
```

结果检查：原值、生效值、来源、运行环境；不会保存权限或执行 desktopExecutable。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。

<a id="version"></a>
## version

查询当前实际运行的产品、CLI、Node 及协议版本。

```text
puzzle version [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle version --json
```

结果检查：data 中的 productVersion、apiVersion、onlineProtocol、executable 和 cliEntry。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。

<a id="setup-install"></a>
## setup install

把完整独立包安装或升级到当前用户的受管目录。

```text
puzzle setup install [--install-root <installRoot>] --source <source> [--dry-run] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--install-root` | string | 可选 | 受管安装根；省略时使用运行环境解析的安装根。 minLength=1; pattern="\\S" |
| `--source` | string | 必填 | 已完整解压的 CLI 包根，包含 manifest.json 和随包运行时。 minLength=1; pattern="\\S" |
| `--dry-run` | boolean | 可选；默认 `false` | 只检查并返回计划，不执行安装、卸载或恢复写入。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

权限与副作用：`environment_write`。明确修改工具安装、Skill 或用户 PATH；dry-run 不写入。

```powershell
puzzle setup install --source "C:\Downloads\PuzzleEditor-CLI" --install-root "D:\Tools\PuzzleEditorCLI" --dry-run --json
```

结果检查：安装根、激活版本、PATH 变化；预览只返回计划，实际升级保留旧版本。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 安装冲突或恢复要求：核对返回路径和受管记录，使用同目标 recover；不强制覆盖未知文件。

<a id="setup-status"></a>
## setup status

读取受管安装、版本及外部卸载入口。

```text
puzzle setup status [--install-root <installRoot>] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--install-root` | string | 可选 | 受管安装根；省略时使用运行环境解析的安装根。 minLength=1; pattern="\\S" |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

权限与副作用：`read`。不提交工程写入；preview 可另写回执，在线预览可提交有效字段草稿。

```powershell
puzzle setup status --json
```

结果检查：data.root、activeVersion、versions、path、uninstallEntry、recoveryRequired。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 安装冲突或恢复要求：核对返回路径和受管记录，使用同目标 recover；不强制覆盖未知文件。

<a id="setup-uninstall"></a>
## setup uninstall

移除未被修改的受管 CLI 文件及对应用户 PATH 入口。

```text
puzzle setup uninstall [--install-root <installRoot>] [--dry-run] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--install-root` | string | 可选 | 受管安装根；省略时使用运行环境解析的安装根。 minLength=1; pattern="\\S" |
| `--dry-run` | boolean | 可选；默认 `false` | 只检查并返回计划，不执行安装、卸载或恢复写入。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

前置条件与组合规则：

- 运行中的受管 Node/CMD 不能删除自身；实际卸载使用 setup status 返回的外部 PowerShell 入口。

权限与副作用：`environment_write`。明确修改工具安装、Skill 或用户 PATH；dry-run 不写入。

```powershell
puzzle setup uninstall --dry-run --json
```

结果检查：预览结果或 EXTERNAL_UNINSTALLER_REQUIRED 提供的外部入口；配置和 Skill 单独管理。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 安装冲突或恢复要求：核对返回路径和受管记录，使用同目标 recover；不强制覆盖未知文件。

<a id="setup-recover"></a>
## setup recover

恢复中断的受管安装或卸载事务。

```text
puzzle setup recover [--install-root <installRoot>] [--dry-run] [--json] [--help]
```

| 参数 | 类型 / 枚举 | 必填 / 默认 | 含义与限制 |
|---|---|---|---|
| `--install-root` | string | 可选 | 受管安装根；省略时使用运行环境解析的安装根。 minLength=1; pattern="\\S" |
| `--dry-run` | boolean | 可选；默认 `false` | 只检查并返回计划，不执行安装、卸载或恢复写入。  |
| `--json` | boolean | 可选 | 明确请求默认的 JSON 结果信封；与 raw 互斥。 |
| `--help`, `-h` | boolean | 可选 | 显示本命令帮助，不执行命令。 |

权限与副作用：`environment_write`。明确修改工具安装、Skill 或用户 PATH；dry-run 不写入。

```powershell
puzzle setup recover --install-root "D:\Tools\PuzzleEditorCLI" --json
```

结果检查：恢复状态；未知外部修改造成冲突时应保留文件并人工核对。

常见失败与处理：

- INVALID_ARGUMENT / DUPLICATE_ARGUMENT：按语法、参数组合和类型修正；不要重复传同一选项。
- 安装冲突或恢复要求：核对返回路径和受管记录，使用同目标 recover；不强制覆盖未知文件。

## 配置、升级与卸载说明

默认受管根为 %LOCALAPPDATA%/StarryTree/PuzzleEditorCLI，自定义安装使用 --install-root。安装只追加稳定 bin 入口到当前用户 PATH；不要单独移动启动器。升级使用完整新包，核验后激活，保留旧版本。启动器损坏时从完整解压包执行修复。

可选配置是安装根下 config.json，唯一格式为 {"schemaVersion":1,"desktopExecutable":"..."}，desktopExecutable 可省略。优先级：--config > PUZZLE_EDITOR_CLI_CONFIG > 默认路径；PUZZLE_EDITOR_DESKTOP_EXECUTABLE > 配置字段。配置内相对路径按配置目录解析。只用于诊断，不启动桌面，不存授权或 secret，无 config set/unset；普通工程命令不加载可选配置。会话目录沿用 PUZZLE_EDITOR_SESSION_DIR。

实际卸载使用外部 PowerShell：

```powershell
$entry = (puzzle setup status --json | ConvertFrom-Json).data.uninstallEntry
powershell -NoProfile -ExecutionPolicy Bypass -File $entry
```

未安装的便携包也可使用 uninstall-cli.ps1 --install-root 指定根。卸载保留用户配置及独立 Skill 记录；Skill 使用 skills uninstall 单独管理。doctor 可选项目未配置显示 skip，不等同失败；有 fail 才退出 3。
