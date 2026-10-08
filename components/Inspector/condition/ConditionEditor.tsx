import React from 'react';
import type { ConditionEditorProps } from './types';
import { isLeafType, countGroupContent } from '../../../utils/conditionBuilder';
import { useConditionGroup } from './useConditionGroup';
import { LeafConditionEditor } from './LeafConditionEditor';
import { GroupHeader } from './GroupHeader';
import { GroupChildren } from './GroupChildren';
import { AddDropdown } from './AddDropdown';
import { ConfirmDialog } from '../ConfirmDialog';
import { getBlockStyle } from './conditionStyles';
import './condition.css';
/** 递归组合条件组与叶子；组操作和布局独立维护，子列表不反向导入本组件。 */
export const ConditionEditor: React.FC<ConditionEditorProps> = ({
  condition,
  onChange,
  onRemove,
  onDragStart,
  onDragEnd,
  depth = 0,
  variables = [],
  conditionScripts = [],
}) => {
  const model = useConditionGroup({ condition, onChange, depth });
  const {
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
  } = model;
  const style = getBlockStyle(groupType);
  // ========== 叶子条件渲染 ==========

  if (isLeafType(effectiveCondition.type)) {
    // 根层单叶允许删除以回退到空态
    const handleRootRemove = () => {
      if (onChange) onChange(undefined);
    };

    return (
      <LeafConditionEditor
        condition={effectiveCondition}
        onChange={handleEffectiveChange}
        onRemove={depth === 0 ? handleRootRemove : undefined}
        showDragHandle={false}
        variables={variables}
        conditionScripts={conditionScripts}
      />
    );
  }

  // ========== 根级空态渲染 ==========

  if (depth === 0 && isEmpty && childCount === 0) {
    return (
      <div className="condition-empty-root">
        <div className="condition-empty-row">
          <span className="condition-empty-text">Empty: No conditions (Always true)</span>
          {onChange && (
            <AddDropdown
              onAddCondition={handleAddCondition}
              onAddGroup={handleAddGroup}
              disabled={!canAdd}
              disabledReason={
                !canAdd && groupType === 'Not' ? 'Not group allows only one condition' : undefined
              }
            />
          )}
        </div>
      </div>
    );
  }

  // ========== 组渲染 ==========

  return (
    <div
      className="condition-group"
      style={{ backgroundColor: style.bg, borderLeft: style.borderLeft }}
    >
      {/* Group 行头部 */}
      <GroupHeader
        groupType={groupType}
        childCount={childCount}
        collapsed={collapsed}
        depth={depth}
        onChange={onChange}
        onRemove={onRemove}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onCollapsedChange={setCollapsed}
        onModeChange={handleModeChange}
        onDeleteClick={() => {
          if (depth === 0 && onChange) {
            if (childCount > 0) {
              setDeleteConfirmDialog({
                idx: -1,
                childCount: countGroupContent(effectiveCondition),
              });
            } else {
              onChange(undefined);
            }
          } else if (onRemove) {
            onRemove();
          }
        }}
      />

      {/* 子项列表 */}
      {!collapsed && (
        <GroupChildren
          renderGroup={(child, idx) => (
            <ConditionEditor
              condition={child}
              onChange={onChange ? (next) => next && handleChildChange(idx, next) : undefined}
              onRemove={onChange ? () => handleRemoveGroup(idx) : undefined}
              onDragStart={handleDragStart(idx)}
              onDragEnd={handleDragEnd}
              depth={depth + 1}
              variables={variables}
              conditionScripts={conditionScripts}
            />
          )}
          children={children}
          childCount={childCount}
          groupType={groupType}
          canAdd={canAdd}
          dragState={dragState}
          variables={variables}
          conditionScripts={conditionScripts}
          onChange={onChange}
          onChildChange={handleChildChange}
          onRemoveChild={handleRemoveChild}
          onAddCondition={handleAddCondition}
          onAddGroup={handleAddGroup}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
        />
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirmDialog && (
        <ConfirmDialog
          title="Confirm Delete"
          message={`Delete this group and its ${deleteConfirmDialog.childCount} item${deleteConfirmDialog.childCount !== 1 ? 's' : ''}?`}
          onConfirm={handleConfirmDeleteGroup}
          onCancel={() => setDeleteConfirmDialog(null)}
        />
      )}
    </div>
  );
};
