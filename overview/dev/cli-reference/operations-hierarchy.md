# 工程与层级操作

[返回使用指南](cli-guide.md) · [共用数据结构](data-structures.md) · [执行示例](workflows.md#domain-examples)

以下是领域计划中的操作，交给 preview/apply 执行，不是独立 shell 子命令。每个完整计划都以随包 [sample.puzzle.json](examples/sample.puzzle.json) 为源，使用固定的虚构资产名称。真实工程先 inspect，再替换目标和 sourceHash，收紧 scope。不要把示例 ID 当作任意工程的 ID。

- [project.update](#project-update)
- [stage.create](#stage-create)
- [stage.update](#stage-update)
- [stage.move](#stage-move)
- [stage.reorder](#stage-reorder)
- [stage.delete](#stage-delete)
- [puzzle.create](#puzzle-create)
- [puzzle.update](#puzzle-update)
- [puzzle.move](#puzzle-move)
- [puzzle.reorder](#puzzle-reorder)
- [puzzle.delete](#puzzle-delete)

<a id="project-update"></a>
## project.update

修改工程元数据。

仅允许元数据白名单，不替换工程结构或编辑器状态。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "project.update" | 必填 | 操作类型，使用这里的固定值。  |
| `changes` | object | 必填 | 白名单修改；省略保留，数组完整替换，只有允许 null 的字段可用 null 清除。  |
| `changes.name` | string | 可选 | 显示名称。 minLength=1; pattern="\\S" |
| `changes.description` | string | 可选 | 说明文字。  |
| `changes.version` | string | 可选 | 工程展示版本，不是文件协议版本。 minLength=1; pattern="\\S" |
| `changes.exportFileName` | string | 可选 | 导出文件名称偏好。  |
| `changes.exportPath` | string | 可选 | 导出目录偏好。  |

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
      "op": "project.update",
      "changes": {
        "description": "Updated demo"
      }
    }
  ]
}
```

预期结果：工程内 `/meta/description` 变为 `"Updated demo"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="stage-create"></a>
## stage.create

在父 Stage 下创建子阶段。

parent 可为现有 ID 或同计划 alias；新名称必须外部指定。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "stage.create" | 必填 | 操作类型，使用这里的固定值。  |
| `alias` | string | 必填 | 同计划新实体的唯一引用名；不是 assetName。 pattern="^[A-Za-z][A-Za-z0-9_-]*$" |
| `parent` | object \| object | 必填 | 目标父 Stage。  |
| `data` | object | 必填 | 创建内容，必须提供其中的必填字段。  |
| `data.name` | string | 必填 | 显示名称。 minLength=1; pattern="\\S" |
| `data.assetName` | string | 必填 | 调用方明确给定的资产名，禁止自动生成或翻译。 minLength=1; pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"; pattern="^(?![\\s\\S]*\\s)" |
| `data.description` | string | 可选 | 说明文字。  |
| `data.lifecycleScriptId` | object \| object \| null | 可选 | 分类和目标匹配的生命周期脚本引用。  |
| `data.eventListeners` | array<object> | 可选 | 事件监听器完整数组。  |
| `data.unlockTriggers` | array<object \| object \| object \| object> | 可选 | 解锁触发器完整数组。  |
| `data.unlockCondition` | reference \| null | 可选 | 解锁条件表达式；null 清除。  |
| `data.onEnterPresentation` | object \| object \| null | 可选 | 进入 Stage 的演出绑定；null 清除。  |
| `data.onExitPresentation` | object \| object \| null | 可选 | 退出 Stage 的演出绑定；null 清除。  |

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
      "op": "stage.create",
      "alias": "newStage",
      "parent": {
        "id": "room"
      },
      "data": {
        "name": "Office",
        "assetName": "Office"
      }
    }
  ]
}
```

预期结果：工程内 `/stageTree/stages/$newStage/assetName` 变为 `"Office"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="stage-update"></a>
## stage.update

修改 Stage 属性和绑定。

可修改解锁、生命周期、事件监听及出入演出；引用必须在可见作用域内。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "stage.update" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `changes` | object | 必填 | 白名单修改；省略保留，数组完整替换，只有允许 null 的字段可用 null 清除。  |
| `changes.name` | string | 可选 | 显示名称。 minLength=1; pattern="\\S" |
| `changes.assetName` | string | 可选 | 调用方明确给定的资产名，禁止自动生成或翻译。 minLength=1; pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"; pattern="^(?![\\s\\S]*\\s)" |
| `changes.description` | string | 可选 | 说明文字。  |
| `changes.lifecycleScriptId` | object \| object \| null | 可选 | 分类和目标匹配的生命周期脚本引用。  |
| `changes.eventListeners` | array<object> | 可选 | 事件监听器完整数组。  |
| `changes.unlockTriggers` | array<object \| object \| object \| object> | 可选 | 解锁触发器完整数组。  |
| `changes.unlockCondition` | reference \| null | 可选 | 解锁条件表达式；null 清除。  |
| `changes.onEnterPresentation` | object \| object \| null | 可选 | 进入 Stage 的演出绑定；null 清除。  |
| `changes.onExitPresentation` | object \| object \| null | 可选 | 退出 Stage 的演出绑定；null 清除。  |

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
      "op": "stage.update",
      "target": {
        "id": "room"
      },
      "changes": {
        "description": "Updated room"
      }
    }
  ]
}
```

预期结果：工程内 `/stageTree/stages/room/description` 变为 `"Updated room"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="stage-move"></a>
## stage.move

改变 Stage 的父级及位置。

根不可移动，不能形成环；scope 要覆盖来源和目标父级。移动后局部变量引用仍须有效。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "stage.move" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `parent` | object \| object | 必填 | 目标父 Stage。  |
| `index` | integer | 可选 | 从 0 开始的位置。 minimum=0; maximum=9007199254740991 |

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
      "op": "stage.move",
      "target": {
        "id": "child"
      },
      "parent": {
        "id": "hall"
      },
      "index": 0
    }
  ]
}
```

预期结果：工程内 `/stageTree/stages/child/parentId` 变为 `"hall"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="stage-reorder"></a>
## stage.reorder

改变 Stage 在父级中的顺序。

首个子阶段为初始阶段；同时检查原、新初始兄弟的影响。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "stage.reorder" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `index` | integer | 必填 | 从 0 开始的位置。 minimum=0; maximum=9007199254740991 |

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
      "op": "stage.reorder",
      "target": {
        "id": "hall"
      },
      "index": 0
    }
  ]
}
```

预期结果：工程内 `/stageTree/stages/STAGE_1/childrenIds/0` 变为 `"hall"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="stage-delete"></a>
## stage.delete

删除 Stage 及明确指定的子内容。

根不可删除；非空 Stage 须 cascade=true；包括所属 FSM，保留共享图和全局资源。间接删除受保护资源仍需授权。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "stage.delete" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `cascade` | boolean | 可选 | 明确允许删除非空 Stage 的子内容。  |

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
      "op": "stage.delete",
      "target": {
        "id": "room"
      },
      "cascade": true
    }
  ]
}
```

预期结果：工程内 `/stageTree/stages/room` 不存在。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="puzzle-create"></a>
## puzzle.create

创建 Puzzle 及其初始状态机。

Puzzle 和 initialState 均须明确 assetName；initialState.alias 可供同计划迁移引用。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "puzzle.create" | 必填 | 操作类型，使用这里的固定值。  |
| `alias` | string | 必填 | 同计划新实体的唯一引用名；不是 assetName。 pattern="^[A-Za-z][A-Za-z0-9_-]*$" |
| `stage` | object \| object | 必填 | 所属或目标 Stage。  |
| `data` | object | 必填 | 创建内容，必须提供其中的必填字段。  |
| `data.name` | string | 必填 | 显示名称。 minLength=1; pattern="\\S" |
| `data.assetName` | string | 必填 | 调用方明确给定的资产名，禁止自动生成或翻译。 minLength=1; pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"; pattern="^(?![\\s\\S]*\\s)" |
| `data.description` | string | 可选 | 说明文字。  |
| `data.lifecycleScriptId` | object \| object \| null | 可选 | 分类和目标匹配的生命周期脚本引用。  |
| `data.eventListeners` | array<object> | 可选 | 事件监听器完整数组。  |
| `initialState` | object | 必填 | 随 Puzzle 创建的初始状态；名称和资产名必须明确。  |
| `initialState.name` | string | 必填 | 显示名称。 minLength=1; pattern="\\S" |
| `initialState.assetName` | string | 必填 | 调用方明确给定的资产名，禁止自动生成或翻译。 minLength=1; pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"; pattern="^(?![\\s\\S]*\\s)" |
| `initialState.description` | string | 可选 | 说明文字。  |
| `initialState.alias` | string | 可选 | 同计划新实体的唯一引用名；不是 assetName。 pattern="^[A-Za-z][A-Za-z0-9_-]*$" |

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
      "op": "puzzle.create",
      "alias": "newPuzzle",
      "stage": {
        "id": "room"
      },
      "data": {
        "name": "Chest",
        "assetName": "Chest"
      },
      "initialState": {
        "name": "Closed",
        "assetName": "Closed",
        "alias": "closed"
      }
    }
  ]
}
```

预期结果：工程内 `/nodes/$newPuzzle/assetName` 变为 `"Chest"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="puzzle-update"></a>
## puzzle.update

修改 Puzzle 元数据、生命周期及事件监听。

定位 Puzzle ID，不能用 FSM ID 代替。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "puzzle.update" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `changes` | object | 必填 | 白名单修改；省略保留，数组完整替换，只有允许 null 的字段可用 null 清除。  |
| `changes.name` | string | 可选 | 显示名称。 minLength=1; pattern="\\S" |
| `changes.assetName` | string | 可选 | 调用方明确给定的资产名，禁止自动生成或翻译。 minLength=1; pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"; pattern="^(?![\\s\\S]*\\s)" |
| `changes.description` | string | 可选 | 说明文字。  |
| `changes.lifecycleScriptId` | object \| object \| null | 可选 | 分类和目标匹配的生命周期脚本引用。  |
| `changes.eventListeners` | array<object> | 可选 | 事件监听器完整数组。  |

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
      "op": "puzzle.update",
      "target": {
        "id": "door"
      },
      "changes": {
        "description": "Updated door"
      }
    }
  ]
}
```

预期结果：工程内 `/nodes/door/description` 变为 `"Updated door"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="puzzle-move"></a>
## puzzle.move

将 Puzzle 移到另一 Stage。

同时检查原 Stage、新 Stage 和局部变量可见性；不会重建 FSM。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "puzzle.move" | 必填 | 操作类型，使用这里的固定值。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `stage` | object \| object | 必填 | 所属或目标 Stage。  |
| `index` | integer | 可选 | 从 0 开始的位置。 minimum=0; maximum=9007199254740991 |

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
      "op": "puzzle.move",
      "target": {
        "id": "door"
      },
      "stage": {
        "id": "hall"
      },
      "index": 0
    }
  ]
}
```

预期结果：工程内 `/nodes/door/stageId` 变为 `"hall"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="puzzle-reorder"></a>
## puzzle.reorder

明确指定同一 Stage 的 Puzzle 完整顺序。

order 必须恰好包含该 Stage 全部 Puzzle，不能遗漏或重复。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "puzzle.reorder" | 必填 | 操作类型，使用这里的固定值。  |
| `stage` | object \| object | 必填 | 所属或目标 Stage。  |
| `order` | array<object \| object> | 必填 | 完整顺序，必须包括该归属下所有成员。  |

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
      "op": "puzzle.reorder",
      "stage": {
        "id": "room"
      },
      "order": [
        {
          "id": "lock"
        },
        {
          "id": "door"
        }
      ]
    }
  ]
}
```

预期结果：工程内 `/nodes/lock/displayOrder` 变为 `0`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="puzzle-delete"></a>
## puzzle.delete

删除 Puzzle 及所属 FSM。

其他 Puzzle 仍共享该 FSM 时拒绝；共享图不随之删除，剩余引用须明确修复。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "puzzle.delete" | 必填 | 操作类型，使用这里的固定值。  |
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
      "op": "puzzle.delete",
      "target": {
        "id": "door"
      }
    }
  ]
}
```

预期结果：工程内 `/nodes/door` 不存在。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。
