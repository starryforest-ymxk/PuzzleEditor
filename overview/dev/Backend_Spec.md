# 后端运行时与管线协同规范 (Backend Runtime & Pipeline Specification)

> 本文档指导后端开发人员实现数据导入管线与核心运行时引擎，确保游戏能够正确解析并执行编辑器产生的数据。  
> **版本**: 1.1.0 | **对应前端版本**: 1.2.0 | **更新时间**: 2025-12-22

---

## 1. 概览 (Overview)

后端系统需承担两大核心职责：**静态代码生成**与**动态运行时构建**。

### 1.1 数据流向 pipeline

```mermaid
graph LR
    Editor[前端编辑器] -->|导出| JSON[.json Manifest]
    JSON -->|导入管线| Importer[Unity/C# Importer]
    
    subgraph "Backend / Engine"
        Importer -->|生成| Code["C# 常量/存根 (Stubs)"]
        Importer -->|转换| Asset["序列化资产 (ScriptableObject/DB)"]
        Asset -->|加载| Runtime["运行时引擎 (Runtime Engine)"]
        Code -.->|编译引用| Runtime
    end
```

### 1.2 核心目标

1.  **类型安全 (Type Safety)**：通过生成的 C# 常量/枚举，确保代码中引用资源时不会出现拼写错误。
2.  **动态构建 (Dynamic Construction)**：游戏启动时，根据 JSON/Asset 数据在内存中重建 Stage 树、FSM 和演出图。
3.  **前端主导 (Frontend Authority)**：任何逻辑结构的变更（如新增状态、修改条件）必须在前端完成，后端不得手动修改导出的数据文件。
4.  **资产名引用 (AssetName Reference)**：代码生成和脚本绑定使用 `assetName` 字段作为标识符，而非内部 `id`。`assetName` 遵循标准变量命名规则（字母/下划线开头，只含字母数字下划线），适合作为 C# 标识符。

---

## 2. 数据结构映射 (Data Schema Mapping)

后端需建立与前端 TypeScript 类型对应的 C#数据模型。

### 2.1 基础类型

| TypeScript (前端) | C# (后端建议) | 说明 |
| :--- | :--- | :--- |
| `string` (ID) | `string` / `Hash128` | 运行时可优化为 Hash 以提升性能 |
| `ResourceState` | `enum ResourceState` | Draft / Implemented / MarkedForDelete |
| `VariableType` | `enum VariableType` | Boolean / Integer / Float / String |
| `VariableScope` | `enum VariableScope` | Global / StageLocal / NodeLocal / Temporary |
| `Vector2` | `Vector2` (Unity) | 用于 FSM/Graph 节点坐标（仅编辑器复用或调试用） |

### 2.2 核心模型映射

建议使用 **组合模式 (Composition Pattern)** 而非继承，以匹配前端的 JSON 结构。

#### StageNode -> RuntimeStage
```csharp
public class RuntimeStage {
    public string ID;
    public RuntimeStage Parent;
    public List<RuntimeStage> Children;
    public Dictionary<string, RuntimeVariable> LocalVariables;
    public List<RuntimeTrigger> UnlockTriggers;
    public RuntimeCondition UnlockCondition;
    
    // 逻辑组件
    public RuntimeLifecycleHandler Lifecycle; // 处理 OnEnter/OnExit
    public List<RuntimeEventListener> EventListeners;
}
```

#### PuzzleNode -> RuntimePuzzleNode
```csharp
public class RuntimePuzzleNode {
    public string ID;
    public RuntimeFSM FSM; // 每个节点持有一个 FSM 实例
    public Dictionary<string, RuntimeVariable> LocalVariables;
}
```

#### StateMachine -> RuntimeFSM
```csharp
public class RuntimeFSM {
    public RuntimeState CurrentState;
    public Dictionary<string, RuntimeState> States;
    // Tick 方法每帧调用，检查 Transitions
}
```

---

## 3. 核心子系统设计 (Core Systems Design)

### 3.1 变量与作用域 (Scoping Resolution)

必须实现**责任链模式**来进行变量查找。

*   **查找逻辑**：`GetValue(varId, scope)`
    1.  若 scope 为 `NodeLocal` -> 查当前 Node.LocalVariables
    2.  若 scope 为 `StageLocal` -> 查当前 Node 所属 Stage.LocalVariables，若未找到则向上遍历父级 Stage 链（子 Stage 可继承访问所有祖先 Stage 的局部变量，同名变量遵循就近原则，子级覆盖父级）
    3.  若 scope 为 `Global` -> 查 GlobalBlackboard

### 3.2 脚本绑定与反射 (Script Binding)

前端通过 `ScriptId` 引用逻辑，但后端代码绑定应使用 `assetName` 作为标识符。

**建议方案：特性标记 (Attribute) + 注册表**

后端代码：
```csharp
// 定义脚本逻辑 - 使用 assetName 作为标识符
[PuzzleScript("PlaySound", Category.Performance)]  // "PlaySound" 对应前端 assetName
public class PlaySoundScript : IPuzzleScript {
    public async Task Execute(ScriptContext context) {
        string audioFile = context.GetParam<string>("AudioFile");
        AudioManager.Play(audioFile);
    }
}
```

**运行时绑定**：
1.  游戏启动时扫描所有带 `[PuzzleScript]` 特性的类。
2.  建立字典 `Dictionary<string, Type> ScriptRegistry`，键为 `assetName`。
3.  解析 JSON 时，通过资源的 `assetName` 字段查找并实例化对应的 C# 类。

> **注意**：导入管线需要将前端 JSON 中的 `id` 引用解析为 `assetName`，以便后端代码使用一致的标识符。

### 3.3 条件系统 (Condition System)

需实现一个能够递归求值的表达式树。

```csharp
public abstract class RuntimeCondition {
    public abstract bool Evaluate(Context ctx);
}

// 组合节点
public class AndCondition : RuntimeCondition {
    public List<RuntimeCondition> Children;
    public override bool Evaluate(Context ctx) {
        return Children.All(c => c.Evaluate(ctx));
    }
}

// 比较节点
public class ComparisonCondition : RuntimeCondition {
    public IValueSource Left; // 支持变量引用或常量
    public IValueSource Right;
    public Operator Op; // ==, >, < 等
    // ...
}
```

---

## 4. 导入管线与代码生成 (Importer & Code Gen)

当检测到 `_export.json` 更新时，Importer 应自动执行：

### 4.1 生成资产名常量表 (Generated/PuzzleAssets.cs)

**目的**：使用 `assetName` 生成 C# 常量，避免硬编码字符串，防止拼写错误。

> **重要**：常量名和值均使用 `assetName` 字段，而非内部 `id`。`assetName` 遵循标准变量命名规则，可直接作为有效的 C# 标识符。

```csharp
// 自动生成的代码 - 请勿修改
// 基于前端导出的 assetName 字段生成
public static class PuzzleAssets {
    public static class GlobalVars {
        public const string Sanity = "Sanity";       // assetName
        public const string HasKey = "HasKey";       // assetName
    }
    public static class Events {
        public const string ThunderStrike = "ThunderStrike";  // assetName
    }
    public static class Scripts {
        public const string PlaySound = "PlaySound";  // assetName
        public const string ShowDialog = "ShowDialog";  // assetName
    }
    public static class Stages {
        public const string EntranceHall = "EntranceHall";  // assetName
        public const string Basement = "Basement";          // assetName
    }
    public static class Nodes {
        public const string DoorPuzzle = "DoorPuzzle";      // assetName
        public const string KeyLocker = "KeyLocker";        // assetName
    }
}
```

### 4.2 ID 到 AssetName 映射表

导入管线需要生成一个运行时映射表，用于将 JSON 中的 `id` 转换为 `assetName`：

```csharp
// 运行时使用的 ID -> AssetName 映射
public static class PuzzleIdMap {
    public static readonly Dictionary<string, string> Scripts = new() {
        ["script-abc123"] = "PlaySound",
        ["script-def456"] = "ShowDialog",
    };
    
    public static readonly Dictionary<string, string> Variables = new() {
        ["var-ghi789"] = "Sanity",
        ["var-jkl012"] = "HasKey",
    };
    
    public static readonly Dictionary<string, string> Stages = new() {
        ["stage-abc123"] = "EntranceHall",
        ["stage-def456"] = "Basement",
    };
    
    public static readonly Dictionary<string, string> Nodes = new() {
        ["node-xyz789"] = "DoorPuzzle",
        ["node-uvw012"] = "KeyLocker",
    };
    // ... Events 等
}
```

### 4.3 数据完整性校验

在导入阶段执行最后一道防线检查：
1.  **引用检查**：确保所有脚本的 `assetName` 在后端都有对应的 `[PuzzleScript]` 实现类。
2.  **AssetName 有效性**：检查所有 `assetName` 是否符合 C# 标识符命名规则。
3.  **跳转检查**：确保所有 `jumpToStateId` 指向的状态真实存在。

---

## 5. 验证标准 (Verification Criteria)

后端开发完成后，必须通过 `test/test_project.puzzle.json` 的验证：

### 测试清单
1.  **加载测试**：
    *   [ ] 无错误加载 JSON 文件。
    *   [ ] 内存中正确构建了 Stage 树结构（Root -> Entrance -> Basement）。
2.  **黑板测试**：
    *   [ ] 能读取 Global 变量 `Sanity` 初始值为 100。
    *   [ ] 触发事件 `event-interact` 能被系统捕获。
3.  **逻辑测试**：
    *   [ ] 模拟：设置 `HasKey = false` -> 触发 `event-interact` -> 断言：状态保持 Locked，Runtime 执行了 Sanity-10 的操作。
    *   [ ] 模拟：设置 `HasKey = true` -> 触发 `event-interact` -> 断言：状态切换至 Unlocked。
4.  **演出测试**：
    *   [ ] 进入 `Fail` 转移时，系统能按顺序执行 `pg-scare` 中的 `Scream` -> `Wait(2s)` -> `Gasp`。

---

## 6. 后续工作 (Next Steps)

1.  搭建 Unity/C# 基础工程，建立上述类结构。
2.  编写 JSON Importer，实现从 JsonNet 到 Runtime 对象的转换。
3.  实现基础的 FSM Ticker。
4.  运行并通过上述测试用例。
