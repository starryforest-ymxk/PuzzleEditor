# 变量、事件和脚本操作

[返回使用指南](cli-guide.md) · [共用数据结构](data-structures.md) · [执行示例](workflows.md#domain-examples)

以下是领域计划中的操作，交给 preview/apply 执行，不是独立 shell 子命令。每个完整计划都以随包 [sample.puzzle.json](examples/sample.puzzle.json) 为源，使用固定的虚构资产名称。真实工程先 inspect，再替换目标和 sourceHash，收紧 scope。不要把示例 ID 当作任意工程的 ID。

- [variable.create](#variable-create)
- [variable.update](#variable-update)
- [variable.move](#variable-move)
- [variable.delete](#variable-delete)
- [variable.purge](#variable-purge)
- [variable.restore](#variable-restore)
- [event.create](#event-create)
- [event.update](#event-update)
- [event.delete](#event-delete)
- [event.purge](#event-purge)
- [event.restore](#event-restore)
- [script.create](#script-create)
- [script.update](#script-update)
- [script.delete](#script-delete)
- [script.purge](#script-purge)
- [script.restore](#script-restore)

<a id="variable-create"></a>
## variable.create

在明确归属中创建变量。

owner 为 global、stage 或 puzzle；type 必须与 value 匹配。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "variable.create" | 必填 | 操作类型，使用这里的固定值。  |
| `alias` | string | 必填 | 同计划新实体的唯一引用名；不是 assetName。 pattern="^[A-Za-z][A-Za-z0-9_-]*$" |
| `owner` | object \| object \| object | 必填 | 变量当前所属作用域。  |
| `data` | object | 必填 | 创建内容，必须提供其中的必填字段。  |
| `data.name` | string | 必填 | 显示名称。 minLength=1; pattern="\\S" |
| `data.assetName` | string | 必填 | 调用方明确给定的资产名，禁止自动生成或翻译。 minLength=1; pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"; pattern="^(?![\\s\\S]*\\s)" |
| `data.description` | string | 可选 | 说明文字。  |
| `data.displayOrder` | integer | 可选 | 非负显示排序序号。 minimum=0; maximum=9007199254740991 |
| `data.type` | "boolean" \| "integer" \| "float" \| "string" | 必填 | 此对象的判别类型，按列出的枚举选择。  |
| `data.value` | boolean \| number \| string | 必填 | 变量值或常量；变量值须与声明类型相容。  |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "variable.create",
      "alias": "newVariable",
      "owner": {
        "type": "global"
      },
      "data": {
        "name": "Score",
        "assetName": "Score",
        "type": "integer",
        "value": 0
      }
    }
  ]
}
```

预期结果：工程内 `/blackboard/globalVariables/$newVariable/value` 变为 `0`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="variable-update"></a>
## variable.update

修改变量的名称、类型或值。

target 与 owner 一起定位；类型变化后须修复不兼容引用。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "variable.update" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `owner` | object \| object \| object | 必填 | 变量当前所属作用域。  |
| `changes` | object | 必填 | 白名单修改；省略保留，数组完整替换，只有允许 null 的字段可用 null 清除。  |
| `changes.name` | string | 可选 | 显示名称。 minLength=1; pattern="\\S" |
| `changes.assetName` | string | 可选 | 调用方明确给定的资产名，禁止自动生成或翻译。 minLength=1; pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"; pattern="^(?![\\s\\S]*\\s)" |
| `changes.description` | string | 可选 | 说明文字。  |
| `changes.displayOrder` | integer | 可选 | 非负显示排序序号。 minimum=0; maximum=9007199254740991 |
| `changes.type` | "boolean" \| "integer" \| "float" \| "string" | 可选 | 此对象的判别类型，按列出的枚举选择。  |
| `changes.value` | boolean \| number \| string | 可选 | 变量值或常量；变量值须与声明类型相容。  |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "variable.update",
      "target": {
        "id": "draft"
      },
      "owner": {
        "type": "global"
      },
      "changes": {
        "value": 2
      }
    }
  ]
}
```

预期结果：工程内 `/blackboard/globalVariables/draft/value` 变为 `2`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="variable-move"></a>
## variable.move

把变量移到另一个归属。

明确原 owner 和 destination；不会替调用者隐式改绑同名变量，须检查可见性及引用。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "variable.move" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `owner` | object \| object \| object | 必填 | 变量当前所属作用域。  |
| `destination` | object \| object \| object | 必填 | 变量移动后的作用域。  |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "variable.move",
      "target": {
        "id": "draft"
      },
      "owner": {
        "type": "global"
      },
      "destination": {
        "type": "stage",
        "ref": {
          "id": "room"
        }
      }
    }
  ]
}
```

预期结果：工程内 `/stageTree/stages/room/localVariables/draft/scope` 变为 `"StageLocal"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="variable-delete"></a>
## variable.delete

按资源生命周期删除或标删变量。

Draft 物理删除，Implemented 标记删除，MarkedForDelete 再次 delete 拒绝。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "variable.delete" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `owner` | object \| object \| object | 必填 | 变量当前所属作用域。  |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "variable.delete",
      "target": {
        "id": "draft"
      },
      "owner": {
        "type": "global"
      }
    }
  ]
}
```

预期结果：工程内 `/blackboard/globalVariables/draft` 不存在。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="variable-purge"></a>
## variable.purge

永久移除受保护变量。

只用于 Implemented/MarkedForDelete，须已有聊天永久删除授权及提交声明，检查剩余引用。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：需要已有 permanent_resource_delete 聊天授权，apply 声明 --allow-permanent-delete。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "variable.purge" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `owner` | object \| object \| object | 必填 | 变量当前所属作用域。  |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "variable.purge",
      "target": {
        "id": "implemented"
      },
      "owner": {
        "type": "global"
      }
    }
  ]
}
```

预期结果：工程内 `/blackboard/globalVariables/implemented` 不存在。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="variable-restore"></a>
## variable.restore

恢复已标删变量。

MarkedForDelete 恢复为 Implemented；不是恢复已永久删除对象。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "variable.restore" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `owner` | object \| object \| object | 必填 | 变量当前所属作用域。  |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "variable.restore",
      "target": {
        "id": "marked"
      },
      "owner": {
        "type": "global"
      }
    }
  ]
}
```

预期结果：工程内 `/blackboard/globalVariables/marked/state` 变为 `"Implemented"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="event-create"></a>
## event.create

创建全局事件定义。

定义事件不等于触发事件；触发器和监听器通过引用使用它。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "event.create" | 必填 | 操作类型，使用这里的固定值。  |
| `alias` | string | 必填 | 同计划新实体的唯一引用名；不是 assetName。 pattern="^[A-Za-z][A-Za-z0-9_-]*$" |
| `data` | object | 必填 | 创建内容，必须提供其中的必填字段。  |
| `data.name` | string | 必填 | 显示名称。 minLength=1; pattern="\\S" |
| `data.assetName` | string | 必填 | 调用方明确给定的资产名，禁止自动生成或翻译。 minLength=1; pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"; pattern="^(?![\\s\\S]*\\s)" |
| `data.description` | string | 可选 | 说明文字。  |
| `data.displayOrder` | integer | 可选 | 非负显示排序序号。 minimum=0; maximum=9007199254740991 |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "event.create",
      "alias": "newEvent",
      "data": {
        "name": "Door Opened",
        "assetName": "DoorOpened"
      }
    }
  ]
}
```

预期结果：工程内 `/blackboard/events/$newEvent/assetName` 变为 `"DoorOpened"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="event-update"></a>
## event.update

修改事件元数据。

保留 ID；删除或改换引用须通过对应调用者操作。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "event.update" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `changes` | object | 必填 | 白名单修改；省略保留，数组完整替换，只有允许 null 的字段可用 null 清除。  |
| `changes.name` | string | 可选 | 显示名称。 minLength=1; pattern="\\S" |
| `changes.assetName` | string | 可选 | 调用方明确给定的资产名，禁止自动生成或翻译。 minLength=1; pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"; pattern="^(?![\\s\\S]*\\s)" |
| `changes.description` | string | 可选 | 说明文字。  |
| `changes.displayOrder` | integer | 可选 | 非负显示排序序号。 minimum=0; maximum=9007199254740991 |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "event.update",
      "target": {
        "id": "draft"
      },
      "changes": {
        "description": "Updated event"
      }
    }
  ]
}
```

预期结果：工程内 `/blackboard/events/draft/description` 变为 `"Updated event"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="event-delete"></a>
## event.delete

按生命周期删除或标删事件。

Draft 删除，Implemented 标删；引用检查仍适用。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "event.delete" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "event.delete",
      "target": {
        "id": "draft"
      }
    }
  ]
}
```

预期结果：工程内 `/blackboard/events/draft` 不存在。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="event-purge"></a>
## event.purge

永久移除受保护事件。

须已有对应聊天永久删除授权；检查触发器、监听器和事件调用引用。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：需要已有 permanent_resource_delete 聊天授权，apply 声明 --allow-permanent-delete。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "event.purge" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "event.purge",
      "target": {
        "id": "implemented"
      }
    }
  ]
}
```

预期结果：工程内 `/blackboard/events/implemented` 不存在。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="event-restore"></a>
## event.restore

恢复已标删事件。

恢复为 Implemented，不恢复永久删除后的内容。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "event.restore" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "event.restore",
      "target": {
        "id": "marked"
      }
    }
  ]
}
```

预期结果：工程内 `/blackboard/events/marked/state` 变为 `"Implemented"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="script-create"></a>
## script.create

创建脚本定义。

只维护元数据，不生成或执行脚本代码；Lifecycle 分类须有匹配 lifecycleType。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "script.create" | 必填 | 操作类型，使用这里的固定值。  |
| `alias` | string | 必填 | 同计划新实体的唯一引用名；不是 assetName。 pattern="^[A-Za-z][A-Za-z0-9_-]*$" |
| `data` | object | 必填 | 创建内容，必须提供其中的必填字段。  |
| `data.name` | string | 必填 | 显示名称。 minLength=1; pattern="\\S" |
| `data.assetName` | string | 必填 | 调用方明确给定的资产名，禁止自动生成或翻译。 minLength=1; pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"; pattern="^(?![\\s\\S]*\\s)" |
| `data.description` | string | 可选 | 说明文字。  |
| `data.displayOrder` | integer | 可选 | 非负显示排序序号。 minimum=0; maximum=9007199254740991 |
| `data.category` | "Performance" \| "Lifecycle" \| "Condition" \| "Trigger" | 必填 | 脚本分类，必须与调用位置匹配。  |
| `data.lifecycleType` | "Stage" \| "Node" \| "State" | 可选 | Lifecycle 脚本的 Stage/Node/State 目标。  |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "script.create",
      "alias": "newScript",
      "data": {
        "name": "Check Door",
        "assetName": "CheckDoor",
        "category": "Condition"
      }
    }
  ]
}
```

预期结果：工程内 `/scripts/scripts/$newScript/category` 变为 `"Condition"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="script-update"></a>
## script.update

修改脚本元数据或分类。

修改分类后调用者绑定仍须匹配；不更改脚本实现。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "script.update" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `changes` | object | 必填 | 白名单修改；省略保留，数组完整替换，只有允许 null 的字段可用 null 清除。  |
| `changes.name` | string | 可选 | 显示名称。 minLength=1; pattern="\\S" |
| `changes.assetName` | string | 可选 | 调用方明确给定的资产名，禁止自动生成或翻译。 minLength=1; pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"; pattern="^(?![\\s\\S]*\\s)" |
| `changes.description` | string | 可选 | 说明文字。  |
| `changes.displayOrder` | integer | 可选 | 非负显示排序序号。 minimum=0; maximum=9007199254740991 |
| `changes.category` | "Performance" \| "Lifecycle" \| "Condition" \| "Trigger" | 可选 | 脚本分类，必须与调用位置匹配。  |
| `changes.lifecycleType` | "Stage" \| "Node" \| "State" \| null | 可选 | Lifecycle 脚本的 Stage/Node/State 目标。  |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "script.update",
      "target": {
        "id": "draft"
      },
      "changes": {
        "description": "Updated script"
      }
    }
  ]
}
```

预期结果：工程内 `/scripts/scripts/draft/description` 变为 `"Updated script"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="script-delete"></a>
## script.delete

按生命周期删除或标删脚本。

Draft 删除，Implemented 标删；演出、条件、触发器和生命周期引用需检查。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "script.delete" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "script.delete",
      "target": {
        "id": "draft"
      }
    }
  ]
}
```

预期结果：工程内 `/scripts/scripts/draft` 不存在。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="script-purge"></a>
## script.purge

永久移除受保护脚本。

须已有对应聊天永久删除授权；有剩余调用者时须在同计划修复。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：需要已有 permanent_resource_delete 聊天授权，apply 声明 --allow-permanent-delete。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "script.purge" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "script.purge",
      "target": {
        "id": "implemented"
      }
    }
  ]
}
```

预期结果：工程内 `/scripts/scripts/implemented` 不存在。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="script-restore"></a>
## script.restore

恢复已标删脚本。

恢复为 Implemented，不恢复永久删除后的内容。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "script.restore" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |

联合和递归字段见[共用数据结构](data-structures.md)；完整机器契约在 [operation-schema.json](examples/operation-schema.json) 的 oneOf 中按 op 查找，所有递归定义集中在 $defs。

完整示例计划：

```json
{
  "apiVersion": "1.0.0",
  "sourceHash": "9ea51e2d010a1452fecae22e92ca9803c8c249725f6ace8e1b330a5fe71529b2",
  "scope": {
    "project": true
  },
  "commands": [
    {
      "op": "script.restore",
      "target": {
        "id": "marked"
      }
    }
  ]
}
```

预期结果：工程内 `/scripts/scripts/marked/state` 变为 `"Implemented"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。
