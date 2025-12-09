# P1-T03 资源生命周期与软删除状态机设计（落地）

> 需求出处：`Task_Breakdown.md` [P1-T03]。UX_Flow 当前无额外约束，仅需保证 Draft → Implemented → MarkedForDelete 的软删除闭环。

## 1. 状态机定义

- 状态集合：`Draft` → `Implemented` → `MarkedForDelete`
- 允许跳转：
  - Draft：Draft / Implemented / MarkedForDelete
  - Implemented：Implemented / MarkedForDelete
  - MarkedForDelete：仅自身（除“应用删除”外不允许回退）
- 删除动作语义：
  - Draft：直接物理删除
  - Implemented：标记为 MarkedForDelete（软删除）
  - MarkedForDelete：在“应用删除”时物理删除

## 2. UI / 行为约束

- `Draft`：可编辑、可直接删除。
- `Implemented`：禁止物理删除，仅允许“标记删除”；标记后应显示禁用/警示态，不允许新增引用。
- `MarkedForDelete`：禁止新引用；原有引用需显示警告；导出/校验阶段应阻断未清理的引用。

## 3. 代码落地

- 新增 `utils/resourceLifecycle.ts`
  - `canTransitionResourceState`：校验合法跳转
  - `resolveDeleteAction`：删除动作决策（软删/物理删）
  - `normalizeResourceStateUpdate`：过滤非法状态更新
- 接入点：`store/slices/nodeParamsSlice.ts`
  - 更新变量状态时校验跳转合法性。
  - 删除变量时遵循软删除规则：Draft/Marked 直接移除，Implemented 仅改为 MarkedForDelete。
- 适用范围：当前落地于 Node Local 变量，后续可同样应用于 Global/Stage Local 变量、Script/Trigger/Event 的管理与校验。

## 4. 后续建议

- 在引用解析/校验（导出前）接入对 MarkedForDelete 资源的阻断校验。
- UI 侧补充：列表/Inspector 显示状态标签与警示，删除按钮对 Implemented 采用二段式“标记→应用删除”。
