/**
 * ConditionEditor.tsx - 向后兼容的重导出
 * 
 * 重构说明：
 * 条件编辑器已重构为模块化结构，代码移动到 ./condition/ 目录下：
 * - condition/ConditionEditor.tsx   - 主组件
 * - condition/LeafConditionEditor.tsx - 叶子条件编辑器
 * - condition/LogicModeButton.tsx   - 逻辑模式按钮
 * - condition/AddDropdown.tsx       - 添加下拉菜单
 * - condition/ConfirmDialog.tsx     - 确认弹窗
 * - condition/conditionStyles.ts    - 样式常量
 * 
 * 此文件保留用于向后兼容现有的 import 路径
 */

export { ConditionEditor } from './condition';
