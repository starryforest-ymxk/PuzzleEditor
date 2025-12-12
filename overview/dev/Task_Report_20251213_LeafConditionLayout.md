# 任务完成报告：LeafConditionEditor 脚本详情布局调整

## 任务目标
当条件类型选择为自定义脚本 (`SCRIPT_REF`) 时，要求：
1. **单行布局**：条件类型选择、脚本选择器、删除按钮始终保持在那一行。
2. **详情显示**：脚本的详细信息（ID, 状态, 描述）显示在这三个元素的**下方**。
3. **样式复用**：复用 `ResourceSelect` 中的详情卡片样式。

## 修改内容

### 1. `components/Inspector/ResourceSelect.tsx`
- **重构**：将内部的详情卡片渲染逻辑抽取为导出的组件 `ResourceDetailsCard`。
- **目的**：允许外部组件（如 `LeafConditionEditor`）复用此 UI，同时保持 `ResourceSelect` 的主要功能不变。

### 2. `components/Inspector/condition/LeafConditionEditor.tsx`
- **引入组件**：导入 `ResourceDetailsCard`。
- **调整 ResourceSelect**：设置 `showDetails={false}`，禁止其在内部渲染详情，从而保证下拉框不会撑开行高或破坏 flex 布局。
- **新增渲染块**：在主 flex 行（包含类型、输入框、删除按钮）的下方，添加独立的渲染逻辑：
  - 检查当前条件是否为 `SCRIPT_REF` 且有 `scriptId`。
  - 查找对应的脚本数据。
  - 渲染 `ResourceDetailsCard`，使其独占一行显示在控件下方。

## 验证结果
- **布局一致性**：Type Select, Script Select, Delete Button 现在严格保持在同一水平行内。
- **详情展示**：选中脚本后，详情卡片正确显示在这一行的下方，内容包含 Key, Category, State, Description。
- **代码复用**：通过抽取 `ResourceDetailsCard`，避免了样式代码的重复。

## 后续建议
- 如果其他地方也有类似 "Inline Select + Bottom Details" 的需求，可以直接使用此模式。
