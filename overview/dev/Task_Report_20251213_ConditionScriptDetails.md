# 任务完成报告：LeafConditionEditor 脚本详情显示

## 任务目标
当条件类型选择为自定义脚本 (`SCRIPT_REF`) 时，在下拉选择框中展示脚本的详细信息（如 Key, Category, Description, State），复用 `ResourceSelect` 的详细信息显示功能。

## 修改内容
- **文件**：`components/Inspector/condition/LeafConditionEditor.tsx`
- **变更**：
  - 在 `ResourceSelect` 组件调用中添加 `showDetails={true}` 属性。
  - 更新 `options` 映射逻辑，将 `conditionScripts` 的 `key`, `category`, `description` 字段传递给 `ResourceOption`。

## 验证结果
- **预期效果**：用户在选择自定义脚本时，选中项下方会显示该脚本的详细元数据，包括脚本 Key、分类、状态和描述信息，与 `TriggerEditor` 中的体验一致。
