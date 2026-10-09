# FSM 操作

[返回使用指南](cli-guide.md) · [共用数据结构](data-structures.md) · [执行示例](workflows.md#domain-examples)

以下是领域计划中的操作，交给 preview/apply 执行，不是独立 shell 子命令。每个完整计划都以随包 [sample.puzzle.json](examples/sample.puzzle.json) 为源，使用固定的虚构资产名称。真实工程先 inspect，再替换目标和 sourceHash，收紧 scope。不要把示例 ID 当作任意工程的 ID。

- [state.create](#state-create)
- [state.update](#state-update)
- [state.delete](#state-delete)
- [fsm.setInitial](#fsm-setInitial)
- [fsm.update](#fsm-update)
- [transition.create](#transition-create)
- [transition.update](#transition-update)
- [transition.delete](#transition-delete)
- [transition.redirect](#transition-redirect)

<a id="state-create"></a>
## state.create

在明确 FSM 中创建状态。

必须给 position 和 assetName；不会自动成为初始状态。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "state.create" | 必填 | 操作类型，使用这里的固定值。  |
| `alias` | string | 必填 | 同计划新实体的唯一引用名；不是 assetName。 pattern="^[A-Za-z][A-Za-z0-9_-]*$" |
| `fsm` | object \| object | 必填 | FSM ID，或通过所属 Puzzle 定位。  |
| `data` | object | 必填 | 创建内容，必须提供其中的必填字段。  |
| `data.name` | string | 必填 | 显示名称。 minLength=1; pattern="\\S" |
| `data.assetName` | string | 必填 | 调用方明确给定的资产名，禁止自动生成或翻译。 minLength=1; pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"; pattern="^(?![\\s\\S]*\\s)" |
| `data.description` | string | 可选 | 说明文字。  |
| `data.lifecycleScriptId` | object \| object \| null | 可选 | 分类和目标匹配的生命周期脚本引用。  |
| `data.eventListeners` | array<object> | 可选 | 事件监听器完整数组。  |
| `data.position` | object | 必填 | 画布坐标；不控制导航或用户偏好。  |
| `data.position.x` | number | 必填 | 水平坐标。  |
| `data.position.y` | number | 必填 | 垂直坐标。  |

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
      "op": "state.create",
      "alias": "newState",
      "fsm": {
        "id": "door-fsm"
      },
      "data": {
        "name": "Locked",
        "assetName": "Locked",
        "position": {
          "x": 400,
          "y": 0
        }
      }
    }
  ]
}
```

预期结果：工程内 `/stateMachines/door-fsm/states/$newState/assetName` 变为 `"Locked"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="state-update"></a>
## state.update

修改 FSM 状态属性和位置。

必须同时指定 FSM 和状态，避免不同 FSM 中相同局部 ID 混淆。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "state.update" | 必填 | 操作类型，使用这里的固定值。  |
| `fsm` | object \| object | 必填 | FSM ID，或通过所属 Puzzle 定位。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `changes` | object | 必填 | 白名单修改；省略保留，数组完整替换，只有允许 null 的字段可用 null 清除。  |
| `changes.name` | string | 可选 | 显示名称。 minLength=1; pattern="\\S" |
| `changes.assetName` | string | 可选 | 调用方明确给定的资产名，禁止自动生成或翻译。 minLength=1; pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"; pattern="^(?![\\s\\S]*\\s)" |
| `changes.description` | string | 可选 | 说明文字。  |
| `changes.lifecycleScriptId` | object \| object \| null | 可选 | 分类和目标匹配的生命周期脚本引用。  |
| `changes.eventListeners` | array<object> | 可选 | 事件监听器完整数组。  |
| `changes.position` | object | 可选 | 画布坐标；不控制导航或用户偏好。  |
| `changes.position.x` | number | 必填 | 水平坐标。  |
| `changes.position.y` | number | 必填 | 垂直坐标。  |

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
      "op": "state.update",
      "fsm": {
        "id": "door-fsm"
      },
      "target": {
        "id": "idle"
      },
      "changes": {
        "position": {
          "x": 20,
          "y": 30
        }
      }
    }
  ]
}
```

预期结果：工程内 `/stateMachines/door-fsm/states/idle/position` 变为 `{"x":20,"y":30}`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="state-delete"></a>
## state.delete

删除状态并明确处理初始状态及关联迁移。

删除初始状态须指定 replacementInitialState；有关联迁移须明确 deleteTransitions=true。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "state.delete" | 必填 | 操作类型，使用这里的固定值。  |
| `fsm` | object \| object | 必填 | FSM ID，或通过所属 Puzzle 定位。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `replacementInitialState` | object \| object | 可选 | 删除初始状态时指定仍存在的替代状态。  |
| `deleteTransitions` | boolean | 可选 | 明确删除该状态关联的迁移。  |

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
      "op": "state.delete",
      "fsm": {
        "id": "door-fsm"
      },
      "target": {
        "id": "spare"
      }
    }
  ]
}
```

预期结果：工程内 `/stateMachines/door-fsm/states/spare` 不存在。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="fsm-setInitial"></a>
## fsm.setInitial

设置 FSM 初始状态。

state 必须属于该 FSM；不接受其他 FSM 的同名状态。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "fsm.setInitial" | 必填 | 操作类型，使用这里的固定值。  |
| `fsm` | object \| object | 必填 | FSM ID，或通过所属 Puzzle 定位。  |
| `state` | object \| object | 必填 | 本 FSM 中的初始状态。  |

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
      "op": "fsm.setInitial",
      "fsm": {
        "id": "door-fsm"
      },
      "state": {
        "id": "open"
      }
    }
  ]
}
```

预期结果：工程内 `/stateMachines/door-fsm/initialStateId` 变为 `"open"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="fsm-update"></a>
## fsm.update

调整 FSM 显示排序元数据。

只开放 displayOrder，不直接替换 states/transitions。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "fsm.update" | 必填 | 操作类型，使用这里的固定值。  |
| `fsm` | object \| object | 必填 | FSM ID，或通过所属 Puzzle 定位。  |
| `changes` | object | 必填 | 白名单修改；省略保留，数组完整替换，只有允许 null 的字段可用 null 清除。  |
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
      "op": "fsm.update",
      "fsm": {
        "id": "door-fsm"
      },
      "changes": {
        "displayOrder": 2
      }
    }
  ]
}
```

预期结果：工程内 `/stateMachines/door-fsm/displayOrder` 变为 `2`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="transition-create"></a>
## transition.create

创建 FSM 迁移。

from/to 必须同 FSM，priority 为非负整数；通过 triggers/condition/参数修改/演出表达流程。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "transition.create" | 必填 | 操作类型，使用这里的固定值。  |
| `alias` | string | 必填 | 同计划新实体的唯一引用名；不是 assetName。 pattern="^[A-Za-z][A-Za-z0-9_-]*$" |
| `fsm` | object \| object | 必填 | FSM ID，或通过所属 Puzzle 定位。  |
| `from` | object \| object | 必填 | 来源状态或图节点。  |
| `to` | object \| object | 必填 | 目标状态或图节点。  |
| `data` | object | 必填 | 创建内容，必须提供其中的必填字段。  |
| `data.name` | string | 必填 | 显示名称。 minLength=1; pattern="\\S" |
| `data.description` | string | 可选 | 说明文字。  |
| `data.priority` | integer | 必填 | 迁移优先级，非负整数。 minimum=0; maximum=9007199254740991 |
| `data.triggers` | array<object \| object \| object \| object> | 必填 | 触发器完整数组。  |
| `data.condition` | reference \| null | 可选 | 条件表达式，详见共用结构。  |
| `data.presentation` | object \| object \| null | 可选 | Script/Graph 演出绑定。  |
| `data.invokeEventIds` | array<object \| object> | 可选 | 迁移调用的事件引用完整数组。  |
| `data.parameterModifiers` | array<object> | 可选 | 变量修改器完整数组。  |
| `data.fromSide` | "top" \| "right" \| "bottom" \| "left" \| null | 可选 | 来源连接方向；null 清除。  |
| `data.toSide` | "top" \| "right" \| "bottom" \| "left" \| null | 可选 | 目标连接方向；null 清除。  |

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
      "op": "transition.create",
      "alias": "newTransition",
      "fsm": {
        "id": "door-fsm"
      },
      "from": {
        "id": "open"
      },
      "to": {
        "id": "idle"
      },
      "data": {
        "name": "Close",
        "priority": 1,
        "triggers": [
          {
            "type": "Always"
          }
        ]
      }
    }
  ]
}
```

预期结果：工程内 `/stateMachines/door-fsm/transitions/$newTransition/toStateId` 变为 `"idle"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="transition-update"></a>
## transition.update

修改迁移逻辑和演出。

triggers/parameterModifiers/invokeEventIds 等数组是完整替换；改端点使用 redirect。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "transition.update" | 必填 | 操作类型，使用这里的固定值。  |
| `fsm` | object \| object | 必填 | FSM ID，或通过所属 Puzzle 定位。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `changes` | object | 必填 | 白名单修改；省略保留，数组完整替换，只有允许 null 的字段可用 null 清除。  |
| `changes.name` | string | 可选 | 显示名称。 minLength=1; pattern="\\S" |
| `changes.description` | string | 可选 | 说明文字。  |
| `changes.priority` | integer | 可选 | 迁移优先级，非负整数。 minimum=0; maximum=9007199254740991 |
| `changes.triggers` | array<object \| object \| object \| object> | 可选 | 触发器完整数组。  |
| `changes.condition` | reference \| null | 可选 | 条件表达式，详见共用结构。  |
| `changes.presentation` | object \| object \| null | 可选 | Script/Graph 演出绑定。  |
| `changes.invokeEventIds` | array<object \| object> | 可选 | 迁移调用的事件引用完整数组。  |
| `changes.parameterModifiers` | array<object> | 可选 | 变量修改器完整数组。  |
| `changes.fromSide` | "top" \| "right" \| "bottom" \| "left" \| null | 可选 | 来源连接方向；null 清除。  |
| `changes.toSide` | "top" \| "right" \| "bottom" \| "left" \| null | 可选 | 目标连接方向；null 清除。  |

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
      "op": "transition.update",
      "fsm": {
        "id": "door-fsm"
      },
      "target": {
        "id": "go"
      },
      "changes": {
        "condition": {
          "type": "Literal",
          "value": true
        },
        "priority": 2
      }
    }
  ]
}
```

预期结果：工程内 `/stateMachines/door-fsm/transitions/go/priority` 变为 `2`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="transition-delete"></a>
## transition.delete

删除指定迁移。

不删除两端状态；FSM 与 target 必须准确。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "transition.delete" | 必填 | 操作类型，使用这里的固定值。  |
| `fsm` | object \| object | 必填 | FSM ID，或通过所属 Puzzle 定位。  |
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
      "op": "transition.delete",
      "fsm": {
        "id": "door-fsm"
      },
      "target": {
        "id": "go"
      }
    }
  ]
}
```

预期结果：工程内 `/stateMachines/door-fsm/transitions/go` 不存在。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="transition-redirect"></a>
## transition.redirect

改变迁移两端状态和可选连接方向。

必须同时提供 from/to；保留其触发器、条件和其他元数据。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "transition.redirect" | 必填 | 操作类型，使用这里的固定值。  |
| `fsm` | object \| object | 必填 | FSM ID，或通过所属 Puzzle 定位。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `from` | object \| object | 必填 | 来源状态或图节点。  |
| `to` | object \| object | 必填 | 目标状态或图节点。  |
| `fromSide` | "top" \| "right" \| "bottom" \| "left" \| null | 可选 | 来源连接方向；null 清除。  |
| `toSide` | "top" \| "right" \| "bottom" \| "left" \| null | 可选 | 目标连接方向；null 清除。  |

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
      "op": "transition.redirect",
      "fsm": {
        "id": "door-fsm"
      },
      "target": {
        "id": "go"
      },
      "from": {
        "id": "idle"
      },
      "to": {
        "id": "spare"
      }
    }
  ]
}
```

预期结果：工程内 `/stateMachines/door-fsm/transitions/go/toStateId` 变为 `"spare"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。
