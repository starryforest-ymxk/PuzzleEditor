import React, { useMemo, useState } from 'react';
import type { ConditionExpression } from '../../../types/stateMachine';
import type { ConditionEditorProps, DeleteConfirmState, DragState } from './types';
import {
  normalizeConditionRoot,
  countGroupContent,
  isLeafType,
  createComparison,
  canAddChild,
  getChildren,
  setChildren,
} from '../../../utils/conditionBuilder';
/** 组状态和用户意图集中协调；递归布局和叶子字段不参与这里的状态变换。 */
export function useConditionGroup({ condition, onChange, depth = 0 }: ConditionEditorProps) {
  // ========== 状态管理 ==========
  const [collapsed, setCollapsed] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<DeleteConfirmState | null>(null);
  const [dragState, setDragState] = useState<DragState>({ dragIdx: null, dropIdx: null });

  // ========== 派生状态 ==========
  const isEmpty = condition === undefined;

  // 空状态时使用空 and 组便于渲染；否则使用实际 condition
  const effectiveCondition: ConditionExpression = useMemo(() => {
    return isEmpty ? { type: 'And', children: [] } : condition;
  }, [condition, isEmpty]);

  // ========== 核心处理函数 ==========

  /**
   * 处理条件变更，执行根级优化逻辑
   */
  const handleEffectiveChange = (
    newCond: ConditionExpression,
    options?: { preserveGroup?: boolean },
  ) => {
    if (!onChange) return;

    onChange(normalizeConditionRoot(newCond, depth, options?.preserveGroup));
  };

  // ========== 组类型渲染准备 ==========

  const groupType = effectiveCondition.type as 'And' | 'Or' | 'Not';
  const children = getChildren(effectiveCondition);
  const childCount = children.length;
  const canAdd = canAddChild(effectiveCondition);

  // ========== 逻辑模式切换 ==========

  const handleModeChange = (newMode: 'And' | 'Or' | 'Not') => {
    if (!onChange || newMode === groupType) return;

    if (newMode === 'Not') {
      // 切换为 not  时若已有多个子项，将现有子项自动包成一个子 Group
      if (children.length > 1) {
        const wrappedGroup: ConditionExpression = {
          type: groupType as 'And' | 'Or',
          children: children,
        };
        handleEffectiveChange({ type: 'Not', operand: wrappedGroup }, { preserveGroup: true });
      } else {
        handleEffectiveChange({ type: 'Not', operand: children[0] }, { preserveGroup: true });
      }
    } else {
      // And/Or 可以有多个子项
      handleEffectiveChange(
        {
          type: newMode,
          children:
            effectiveCondition.type === 'Not' && effectiveCondition.operand
              ? [effectiveCondition.operand]
              : children,
        },
        { preserveGroup: true },
      );
    }
  };

  // ========== 添加条件/组 ==========

  const handleAddCondition = () => {
    if (!onChange || !canAdd) return;
    const newChild = createComparison();

    // 根层且当前为单叶时，将现有叶子与新条件合并为 and 组
    if (depth === 0 && condition && isLeafType(condition.type)) {
      handleEffectiveChange(
        { type: 'And', children: [condition, newChild] },
        { preserveGroup: true },
      );
      return;
    }

    const needPreserveGroup = depth > 0 || !isEmpty;
    handleEffectiveChange(
      setChildren(effectiveCondition, [...children, newChild]),
      needPreserveGroup ? { preserveGroup: true } : undefined,
    );
  };

  const handleAddGroup = () => {
    if (!onChange || !canAdd) return;
    const newGroup: ConditionExpression = { type: 'And', children: [] };

    // 根层空态时，替换为新组
    if (depth === 0 && isEmpty) {
      handleEffectiveChange(newGroup, { preserveGroup: true });
      return;
    }

    // 根层单叶时，提升为 and 组并新增子组
    if (depth === 0 && condition && isLeafType(condition.type)) {
      handleEffectiveChange(
        { type: 'And', children: [condition, newGroup] },
        { preserveGroup: true },
      );
      return;
    }

    handleEffectiveChange(setChildren(effectiveCondition, [...children, newGroup]), {
      preserveGroup: true,
    });
  };

  // ========== 子项操作 ==========

  const handleChildChange = (idx: number, newChild: ConditionExpression) => {
    if (!onChange) return;
    const newChildren = [...children];
    newChildren[idx] = newChild;
    handleEffectiveChange(setChildren(effectiveCondition, newChildren), { preserveGroup: true });
  };

  const handleRemoveChild = (idx: number) => {
    if (!onChange) return;
    const newChildren = children.filter((_, i) => i !== idx);
    const nextCondition = setChildren(effectiveCondition, newChildren);
    // 删除子项后保持组包装，空组交由后端判定语义
    handleEffectiveChange(nextCondition, { preserveGroup: true });
  };

  const handleRemoveGroup = (idx: number) => {
    if (!onChange) return;
    const childItemCount = countGroupContent(children[idx]);

    if (childItemCount > 0) {
      setDeleteConfirmDialog({ idx, childCount: childItemCount });
    } else {
      handleRemoveChild(idx);
    }
  };

  const handleConfirmDeleteGroup = () => {
    if (!deleteConfirmDialog || !onChange) return;

    if (deleteConfirmDialog.idx === -1) {
      onChange(undefined); // 根级删除，重置为空态
    } else {
      handleRemoveChild(deleteConfirmDialog.idx);
    }
    setDeleteConfirmDialog(null);
  };

  // ========== 拖拽重排 ==========

  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
    setDragState({ dragIdx: idx, dropIdx: null });
  };

  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragState.dropIdx !== idx) {
      setDragState((prev) => ({ ...prev, dropIdx: idx }));
    }
  };

  const handleDragEnd = () => {
    setDragState({ dragIdx: null, dropIdx: null });
  };

  const handleDrop = (targetIdx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const fromIdx = dragState.dragIdx;
    if (fromIdx === null || fromIdx === targetIdx || !onChange) {
      setDragState({ dragIdx: null, dropIdx: null });
      return;
    }

    const newChildren = [...children];
    const [movedItem] = newChildren.splice(fromIdx, 1);
    newChildren.splice(targetIdx, 0, movedItem);
    handleEffectiveChange(setChildren(effectiveCondition, newChildren), { preserveGroup: true });
    setDragState({ dragIdx: null, dropIdx: null });
  };

  return {
    collapsed,
    setCollapsed,
    deleteConfirmDialog,
    setDeleteConfirmDialog,
    dragState,
    isEmpty,
    effectiveCondition,
    groupType,
    children,
    childCount,
    canAdd,
    handleEffectiveChange,
    handleModeChange,
    handleAddCondition,
    handleAddGroup,
    handleChildChange,
    handleRemoveChild,
    handleRemoveGroup,
    handleConfirmDeleteGroup,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,
  };
}
