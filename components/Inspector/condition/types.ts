import type React from 'react';
import type { ConditionExpression } from '../../../types/stateMachine';
import type { VariableDefinition } from '../../../types/blackboard';
import type { ScriptDefinition } from '../../../types/manifest';
export interface ConditionEditorProps {
  condition?: ConditionExpression; // undefined 表示空状态（无条件）
  onChange?: (newCondition: ConditionExpression | undefined) => void;
  onRemove?: () => void; // 子级 Group 删除回调
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  depth?: number; // 嵌套深度（0 = 根级）
  variables?: VariableDefinition[];
  conditionScripts?: ScriptDefinition[];
}

export interface DragState {
  dragIdx: number | null; // 正在拖拽的子项索引
  dropIdx: number | null; // 放置位置索引
}

export interface DeleteConfirmState {
  idx: number; // -1 = 根级 Group
  childCount: number;
}
