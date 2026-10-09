# 演出图操作

[返回使用指南](cli-guide.md) · [共用数据结构](data-structures.md) · [执行示例](workflows.md#domain-examples)

以下是领域计划中的操作，交给 preview/apply 执行，不是独立 shell 子命令。每个完整计划都以随包 [sample.puzzle.json](examples/sample.puzzle.json) 为源，使用固定的虚构资产名称。真实工程先 inspect，再替换目标和 sourceHash，收紧 scope。不要把示例 ID 当作任意工程的 ID。

- [presentation.create](#presentation-create)
- [presentation.update](#presentation-update)
- [presentation.delete](#presentation-delete)
- [presentation.setStart](#presentation-setStart)
- [presentationNode.create](#presentationNode-create)
- [presentationNode.update](#presentationNode-update)
- [presentationNode.delete](#presentationNode-delete)
- [presentationEdge.connect](#presentationEdge-connect)
- [presentationEdge.disconnect](#presentationEdge-disconnect)
- [presentationEdge.redirect](#presentationEdge-redirect)
- [presentationEdge.update](#presentationEdge-update)

<a id="presentation-create"></a>
## presentation.create

创建共享演出图。

图不是命名业务资产，没有 assetName 字段；节点与起点通过独立操作设置。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "presentation.create" | 必填 | 操作类型，使用这里的固定值。  |
| `alias` | string | 必填 | 同计划新实体的唯一引用名；不是 assetName。 pattern="^[A-Za-z][A-Za-z0-9_-]*$" |
| `data` | object | 必填 | 创建内容，必须提供其中的必填字段。  |
| `data.name` | string | 必填 | 显示名称。 minLength=1; pattern="\\S" |
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
      "op": "presentation.create",
      "alias": "newGraph",
      "data": {
        "name": "Victory"
      }
    }
  ]
}
```

预期结果：工程内 `/presentationGraphs/$newGraph/name` 变为 `"Victory"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="presentation-update"></a>
## presentation.update

修改演出图名称、说明和排序。

不替换节点字典；共享调用者不会被隐式改写。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "presentation.update" | 必填 | 操作类型，使用这里的固定值。  |
| `graph` | object \| object | 必填 | 所属演出图。  |
| `changes` | object | 必填 | 白名单修改；省略保留，数组完整替换，只有允许 null 的字段可用 null 清除。  |
| `changes.name` | string | 可选 | 显示名称。 minLength=1; pattern="\\S" |
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
      "op": "presentation.update",
      "graph": {
        "id": "show"
      },
      "changes": {
        "description": "Updated graph"
      }
    }
  ]
}
```

预期结果：工程内 `/presentationGraphs/show/description` 变为 `"Updated graph"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="presentation-delete"></a>
## presentation.delete

删除演出图。

剩余 Stage/迁移/图调用引用必须在同计划修复。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "presentation.delete" | 必填 | 操作类型，使用这里的固定值。  |
| `graph` | object \| object | 必填 | 所属演出图。  |

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
      "op": "presentation.delete",
      "graph": {
        "id": "show"
      }
    }
  ]
}
```

预期结果：工程内 `/presentationGraphs/show` 不存在。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="presentation-setStart"></a>
## presentation.setStart

设置或清空图的起点。

node 为本图节点或 null；清空可能产生业务诊断，导出仍受校验约束。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "presentation.setStart" | 必填 | 操作类型，使用这里的固定值。  |
| `graph` | object \| object | 必填 | 所属演出图。  |
| `node` | object \| object \| null | 必填 | 本图起点节点，null 表示清空。  |

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
      "op": "presentation.setStart",
      "graph": {
        "id": "show"
      },
      "node": {
        "id": "last"
      }
    }
  ]
}
```

预期结果：工程内 `/presentationGraphs/show/startNodeId` 变为 `"last"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="presentationNode-create"></a>
## presentationNode.create

创建演出、等待、分支或并行节点。

Wait 使用 duration；Branch 使用 condition；PresentationNode 使用 presentation 绑定。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "presentationNode.create" | 必填 | 操作类型，使用这里的固定值。  |
| `alias` | string | 必填 | 同计划新实体的唯一引用名；不是 assetName。 pattern="^[A-Za-z][A-Za-z0-9_-]*$" |
| `graph` | object \| object | 必填 | 所属演出图。  |
| `data` | object | 必填 | 创建内容，必须提供其中的必填字段。  |
| `data.name` | string | 必填 | 显示名称。 minLength=1; pattern="\\S" |
| `data.description` | string | 可选 | 说明文字。  |
| `data.type` | "PresentationNode" \| "Wait" \| "Branch" \| "Parallel" | 必填 | 此对象的判别类型，按列出的枚举选择。  |
| `data.position` | object | 必填 | 画布坐标；不控制导航或用户偏好。  |
| `data.position.x` | number | 必填 | 水平坐标。  |
| `data.position.y` | number | 必填 | 垂直坐标。  |
| `data.duration` | number \| null | 可选 | Wait 节点等待时间，非负。  |
| `data.condition` | reference \| null | 可选 | 条件表达式，详见共用结构。  |
| `data.presentation` | object \| object \| null | 可选 | Script/Graph 演出绑定。  |

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
      "op": "presentationNode.create",
      "graph": {
        "id": "show"
      },
      "alias": "newGraphNode",
      "data": {
        "name": "Pause",
        "type": "Wait",
        "duration": 2,
        "position": {
          "x": 500,
          "y": 0
        }
      }
    }
  ]
}
```

预期结果：工程内 `/presentationGraphs/show/nodes/$newGraphNode/duration` 变为 `2`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="presentationNode-update"></a>
## presentationNode.update

修改演出节点属性。

类型改变须让原有边和字段仍合法；连线使用 edge 操作。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "presentationNode.update" | 必填 | 操作类型，使用这里的固定值。  |
| `graph` | object \| object | 必填 | 所属演出图。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `changes` | object | 必填 | 白名单修改；省略保留，数组完整替换，只有允许 null 的字段可用 null 清除。  |
| `changes.name` | string | 可选 | 显示名称。 minLength=1; pattern="\\S" |
| `changes.description` | string | 可选 | 说明文字。  |
| `changes.type` | "PresentationNode" \| "Wait" \| "Branch" \| "Parallel" | 可选 | 此对象的判别类型，按列出的枚举选择。  |
| `changes.position` | object | 可选 | 画布坐标；不控制导航或用户偏好。  |
| `changes.position.x` | number | 必填 | 水平坐标。  |
| `changes.position.y` | number | 必填 | 垂直坐标。  |
| `changes.duration` | number \| null | 可选 | Wait 节点等待时间，非负。  |
| `changes.condition` | reference \| null | 可选 | 条件表达式，详见共用结构。  |
| `changes.presentation` | object \| object \| null | 可选 | Script/Graph 演出绑定。  |

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
      "op": "presentationNode.update",
      "graph": {
        "id": "show"
      },
      "target": {
        "id": "last"
      },
      "changes": {
        "duration": 3
      }
    }
  ]
}
```

预期结果：工程内 `/presentationGraphs/show/nodes/last/duration` 变为 `3`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="presentationNode-delete"></a>
## presentationNode.delete

删除图节点并明确处理连线和起点。

有关联边须 deleteEdges=true；删除起点须 replacementStart。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "presentationNode.delete" | 必填 | 操作类型，使用这里的固定值。  |
| `graph` | object \| object | 必填 | 所属演出图。  |
| `target` | object \| object | 必填 | 要修改的现有实体或同计划 alias。  |
| `replacementStart` | object \| object | 可选 | 删除起点时指定替代节点。  |
| `deleteEdges` | boolean | 可选 | 明确删除节点关联的边。  |

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
      "op": "presentationNode.delete",
      "graph": {
        "id": "show"
      },
      "target": {
        "id": "spare"
      }
    }
  ]
}
```

预期结果：工程内 `/presentationGraphs/show/nodes/spare` 不存在。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="presentationEdge-connect"></a>
## presentationEdge.connect

在指定语义槽位建立连线。

普通/Wait 为 next；Branch 为 true/false；Parallel 为从 0 开始的有序索引；目标属于同图。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "presentationEdge.connect" | 必填 | 操作类型，使用这里的固定值。  |
| `graph` | object \| object | 必填 | 所属演出图。  |
| `from` | object \| object | 必填 | 来源状态或图节点。  |
| `slot` | "true" \| "false" \| "next" \| integer | 必填 | 普通节点 next；分支 true/false；并行节点使用从 0 开始的索引。  |
| `to` | object \| object | 必填 | 目标状态或图节点。  |
| `style` | object | 可选 | 连线方向属性。  |
| `style.fromSide` | "top" \| "right" \| "bottom" \| "left" \| null | 可选 | 来源连接方向；null 清除。  |
| `style.toSide` | "top" \| "right" \| "bottom" \| "left" \| null | 可选 | 目标连接方向；null 清除。  |

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
      "op": "presentationEdge.connect",
      "graph": {
        "id": "show"
      },
      "from": {
        "id": "last"
      },
      "slot": "next",
      "to": {
        "id": "spare"
      }
    }
  ]
}
```

预期结果：工程内 `/presentationGraphs/show/nodes/last/nextIds/0` 变为 `"spare"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="presentationEdge-disconnect"></a>
## presentationEdge.disconnect

移除指定槽位连线。

定位使用 graph+from+slot，不直接编辑 nextIds；节点保留。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "presentationEdge.disconnect" | 必填 | 操作类型，使用这里的固定值。  |
| `graph` | object \| object | 必填 | 所属演出图。  |
| `from` | object \| object | 必填 | 来源状态或图节点。  |
| `slot` | "true" \| "false" \| "next" \| integer | 必填 | 普通节点 next；分支 true/false；并行节点使用从 0 开始的索引。  |

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
      "op": "presentationEdge.disconnect",
      "graph": {
        "id": "show"
      },
      "from": {
        "id": "first"
      },
      "slot": "next"
    }
  ]
}
```

预期结果：工程内 `/presentationGraphs/show/nodes/first/nextIds` 变为 `[]`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="presentationEdge-redirect"></a>
## presentationEdge.redirect

重定向指定槽位的目标。

保留其他槽位，必要时显式指定样式；不允许跨图连线。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "presentationEdge.redirect" | 必填 | 操作类型，使用这里的固定值。  |
| `graph` | object \| object | 必填 | 所属演出图。  |
| `from` | object \| object | 必填 | 来源状态或图节点。  |
| `slot` | "true" \| "false" \| "next" \| integer | 必填 | 普通节点 next；分支 true/false；并行节点使用从 0 开始的索引。  |
| `to` | object \| object | 必填 | 目标状态或图节点。  |
| `style` | object | 可选 | 连线方向属性。  |
| `style.fromSide` | "top" \| "right" \| "bottom" \| "left" \| null | 可选 | 来源连接方向；null 清除。  |
| `style.toSide` | "top" \| "right" \| "bottom" \| "left" \| null | 可选 | 目标连接方向；null 清除。  |

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
      "op": "presentationEdge.redirect",
      "graph": {
        "id": "show"
      },
      "from": {
        "id": "first"
      },
      "slot": "next",
      "to": {
        "id": "spare"
      }
    }
  ]
}
```

预期结果：工程内 `/presentationGraphs/show/nodes/first/nextIds/0` 变为 `"spare"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。

<a id="presentationEdge-update"></a>
## presentationEdge.update

修改连线两端连接方向。

只改 style；方向为 top/right/bottom/left 或 null，改目标使用 redirect。

作用域：本示例只对随包虚构工程使用 project=true。正式任务按受影响的 Stage、Puzzle、Graph 或全局资源收紧 scope；影响父级/初始兄弟、共享调用者时一并声明。

权限：普通领域编辑；若实际间接移除受保护资源，仍额外要求永久删除授权。覆盖源文件另需覆盖授权。

| 字段 | 类型 / 枚举 | 必填 | 含义与约束 |
|---|---|---|---|
| `op` | "presentationEdge.update" | 必填 | 操作类型，使用这里的固定值。  |
| `graph` | object \| object | 必填 | 所属演出图。  |
| `from` | object \| object | 必填 | 来源状态或图节点。  |
| `slot` | "true" \| "false" \| "next" \| integer | 必填 | 普通节点 next；分支 true/false；并行节点使用从 0 开始的索引。  |
| `style` | object | 必填 | 连线方向属性。  |
| `style.fromSide` | "top" \| "right" \| "bottom" \| "left" \| null | 可选 | 来源连接方向；null 清除。  |
| `style.toSide` | "top" \| "right" \| "bottom" \| "left" \| null | 可选 | 目标连接方向；null 清除。  |

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
      "op": "presentationEdge.update",
      "graph": {
        "id": "show"
      },
      "from": {
        "id": "first"
      },
      "slot": "next",
      "style": {
        "fromSide": "right",
        "toSide": "left"
      }
    }
  ]
}
```

预期结果：工程内 `/presentationGraphs/show/edgeProperties/first->last/fromSide` 变为 `"right"`。 `$alias` 表示预览回执 allocations 中该别名的实际 ID。
