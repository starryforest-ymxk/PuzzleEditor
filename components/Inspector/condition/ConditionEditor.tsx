/**
 * ConditionEditor.tsx - 条件构造器主组件
 * 支持嵌套的条件逻辑编辑，符合 条件构造器.md 设计规范
 * 
 * UI 结构:
 * - Logic Bar: 逻辑模式选择 (And/Or/Not) + Add 下拉菜单
 * - Condition List: 支持 Group 行和 Condition 行嵌套
 * - Empty State: 无条件时显示 "No conditions (Always true)"
 * 
 * 重构说明：
 * - 样式常量抽取到 conditionStyles.ts
 * - 叶子条件编辑器抽取到 LeafConditionEditor.tsx
 * - 辅助组件抽取到独立文件（LogicModeButton, AddDropdown, ConfirmDialog）
 */

import React, { useMemo, useState } from 'react';
import { ConditionExpression } from '../../../types/stateMachine';
import { VariableDefinition } from '../../../types/blackboard';
import { ScriptDefinition } from '../../../types/manifest';
import {
    isGroupType,
    isLeafType,
    createComparison,
    canAddChild,
    getChildren,
    setChildren,
    getChildCount
} from '../../../utils/conditionBuilder';

// 子组件导入
import { LeafConditionEditor } from './LeafConditionEditor';
import { LogicModeButton } from './LogicModeButton';
import { AddDropdown } from './AddDropdown';
import { ConfirmDialog } from '../ConfirmDialog';
import { BLOCK_STYLES, getBlockStyle, COLORS, buttonStyles } from './conditionStyles';

// ==================== 类型定义 ====================

interface ConditionEditorProps {
    condition?: ConditionExpression;  // undefined 表示空状态（无条件）
    onChange?: (newCondition: ConditionExpression | undefined) => void;
    onRemove?: () => void;            // 子级 Group 删除回调
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
    depth?: number;                   // 嵌套深度（0 = 根级）
    variables?: VariableDefinition[];
    conditionScripts?: ScriptDefinition[];
}

interface DragState {
    dragIdx: number | null;   // 正在拖拽的子项索引
    dropIdx: number | null;   // 放置位置索引
}

interface DeleteConfirmState {
    idx: number;              // -1 = 根级 Group
    childCount: number;
}

// 递归统计组内元素数量（不含当前组本身）
const countGroupContent = (condition: ConditionExpression): number => {
    const countSelfAndDesc = (cond: ConditionExpression): number => {
        if (!isGroupType(cond.type)) return 1;
        if (cond.type === 'Not') {
            return 1 + (cond.operand ? countSelfAndDesc(cond.operand) : 0);
        }
        return 1 + (cond.children || []).reduce((sum, child) => sum + countSelfAndDesc(child), 0);
    };

    return Math.max(countSelfAndDesc(condition) - 1, 0);
};

// ==================== 主组件 ====================

/**
 * 条件编辑器主组件
 * 支持嵌套逻辑组（And/Or/Not）和叶子条件
 */
export const ConditionEditor: React.FC<ConditionEditorProps> = ({
    condition,
    onChange,
    onRemove,
    onDragStart,
    onDragEnd,
    depth = 0,
    variables = [],
    conditionScripts = []
}) => {
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
        options?: { preserveGroup?: boolean }
    ) => {
        if (!onChange) return;

        // 根级组优化逻辑
        if (depth === 0 && isGroupType(newCond.type)) {
            const children = getChildren(newCond);

            // 空组且无需保留 → 设为 undefined（空状态）
            if (children.length === 0 && !options?.preserveGroup) {
                onChange(undefined);
                return;
            }

            // and 且仅 1 条叶子 -> 拆封为单条，避免多余包裹
            if (!options?.preserveGroup &&
                newCond.type === 'And' &&
                children.length === 1 &&
                isLeafType(children[0].type)) {
                onChange(children[0]);
                return;
            }
        }

        onChange(newCond);
    };

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

    // ========== 组类型渲染准备 ==========

    const groupType = effectiveCondition.type as 'And' | 'Or' | 'Not';
    const style = getBlockStyle(groupType);
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
                    children: children
                };
                handleEffectiveChange({ type: 'Not', operand: wrappedGroup }, { preserveGroup: true });
            } else {
                handleEffectiveChange({ type: 'Not', operand: children[0] }, { preserveGroup: true });
            }
        } else {
            // And/Or 可以有多个子项
            handleEffectiveChange({
                type: newMode,
                children: effectiveCondition.type === 'Not' && effectiveCondition.operand
                    ? [effectiveCondition.operand]
                    : children
            }, { preserveGroup: true });
        }
    };

    // ========== 添加条件/组 ==========

    const handleAddCondition = () => {
        if (!onChange || !canAdd) return;
        const newChild = createComparison();

        // 根层且当前为单叶时，将现有叶子与新条件合并为 and 组
        if (depth === 0 && condition && isLeafType(condition.type)) {
            handleEffectiveChange({ type: 'And', children: [condition, newChild] }, { preserveGroup: true });
            return;
        }

        const needPreserveGroup = depth > 0 || !isEmpty;
        handleEffectiveChange(
            setChildren(effectiveCondition, [...children, newChild]),
            needPreserveGroup ? { preserveGroup: true } : undefined
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
            handleEffectiveChange({ type: 'And', children: [condition, newGroup] }, { preserveGroup: true });
            return;
        }

        handleEffectiveChange(setChildren(effectiveCondition, [...children, newGroup]), { preserveGroup: true });
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
            onChange(undefined);  // 根级删除，重置为空态
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
            setDragState(prev => ({ ...prev, dropIdx: idx }));
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

    // ========== 根级空态渲染 ==========

    if (depth === 0 && isEmpty && childCount === 0) {
        return (
            <div style={{
                padding: '12px',
                border: '1px dashed #3f3f46',
                borderRadius: '6px',
                background: COLORS.bgPrimary
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: COLORS.textDisabled, fontSize: '12px', fontStyle: 'italic' }}>
                        Empty: No conditions (Always true)
                    </span>
                    {onChange && (
                        <AddDropdown
                            onAddCondition={handleAddCondition}
                            onAddGroup={handleAddGroup}
                            disabled={!canAdd}
                            disabledReason={!canAdd && groupType === 'Not' ? 'Not group allows only one condition' : undefined}
                        />
                    )}
                </div>
            </div>
        );
    }

    // ========== 组渲染 ==========

    return (
        <div style={{
            marginTop: 0,
            backgroundColor: style.bg,
            borderLeft: style.borderLeft,
            borderRadius: '0 4px 4px 0',
            fontSize: '12px',
            position: 'relative',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
        }}>
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
                            setDeleteConfirmDialog({ idx: -1, childCount: countGroupContent(effectiveCondition) });
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
                    children={children}
                    childCount={childCount}
                    depth={depth}
                    groupType={groupType}
                    canAdd={canAdd}
                    dragState={dragState}
                    variables={variables}
                    conditionScripts={conditionScripts}
                    onChange={onChange}
                    onChildChange={handleChildChange}
                    onRemoveChild={handleRemoveChild}
                    onRemoveGroup={handleRemoveGroup}
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

// ==================== 子组件 ====================

/**
 * 组头部组件 - 显示折叠按钮、拖拽手柄、逻辑模式按钮、删除按钮
 */
interface GroupHeaderProps {
    groupType: 'And' | 'Or' | 'Not';
    childCount: number;
    collapsed: boolean;
    depth: number;
    onChange?: (newCondition: ConditionExpression | undefined) => void;
    onRemove?: () => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnd?: () => void;
    onCollapsedChange: (collapsed: boolean) => void;
    onModeChange: (mode: 'And' | 'Or' | 'Not') => void;
    onDeleteClick: () => void;
}

const GroupHeader: React.FC<GroupHeaderProps> = ({
    groupType,
    childCount,
    collapsed,
    depth,
    onChange,
    onRemove,
    onDragStart,
    onDragEnd,
    onCollapsedChange,
    onModeChange,
    onDeleteClick
}) => (
    <div style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: !collapsed ? '1px solid rgba(255,255,255,0.06)' : 'none',
        flexWrap: 'nowrap',
        minWidth: 0,
        overflow: 'hidden'
    }}>
        {/* 折叠箭头 */}
        <button
            onClick={() => onCollapsedChange(!collapsed)}
            style={{
                background: 'transparent',
                border: 'none',
                color: COLORS.textMuted,
                cursor: 'pointer',
                fontSize: '10px',
                padding: '2px',
                transition: 'transform 0.15s',
                flexShrink: 0
            }}
        >
            <span style={{
                display: 'inline-block',
                transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s'
            }}>▼</span>
        </button>

        {/* 拖拽手柄（仅非根级显示） */}
        {depth > 0 && (
            <span
                draggable={!!onDragStart}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                style={{
                    ...buttonStyles.dragHandle,
                    cursor: onDragStart ? 'grab' : 'default',
                    flexShrink: 0
                }}
            >⋮⋮</span>
        )}

        {/* 逻辑模式按钮组 */}
        <div style={{ display: 'flex', gap: '4px', minWidth: 0, flexShrink: 1 }}>
            <LogicModeButton mode="And" label="And" isActive={groupType === 'And'} onClick={() => onModeChange('And')} disabled={!onChange} />
            <LogicModeButton mode="Or" label="Or" isActive={groupType === 'Or'} onClick={() => onModeChange('Or')} disabled={!onChange} />
            <LogicModeButton mode="Not" label="Not" isActive={groupType === 'Not'} onClick={() => onModeChange('Not')} disabled={!onChange} />
        </div>

        {/* 子项数量摘要 */}
        <span style={{ fontSize: '11px', color: COLORS.textMuted, fontStyle: 'italic', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ({childCount})
        </span>

        {/* 删除按钮 */}
        {
            (onChange || onRemove) && (
                <button
                    onClick={onDeleteClick}
                    title="Delete Group"
                    style={buttonStyles.deleteButton}
                    onMouseEnter={(e) => e.currentTarget.style.color = COLORS.danger}
                    onMouseLeave={(e) => e.currentTarget.style.color = COLORS.textMuted}
                >
                    🗑
                </button>
            )
        }
    </div >
);

/**
 * 组子项列表组件
 */
interface GroupChildrenProps {
    children: ConditionExpression[];
    childCount: number;
    depth: number;
    groupType: 'And' | 'Or' | 'Not';
    canAdd: boolean;
    dragState: DragState;
    variables: VariableDefinition[];
    conditionScripts: ScriptDefinition[];
    onChange?: (newCondition: ConditionExpression | undefined) => void;
    onChildChange: (idx: number, newChild: ConditionExpression) => void;
    onRemoveChild: (idx: number) => void;
    onRemoveGroup: (idx: number) => void;
    onAddCondition: () => void;
    onAddGroup: () => void;
    onDragStart: (idx: number) => (e: React.DragEvent) => void;
    onDragOver: (idx: number) => (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDrop: (targetIdx: number) => (e: React.DragEvent) => void;
}

const GroupChildren: React.FC<GroupChildrenProps> = ({
    children,
    childCount,
    depth,
    groupType,
    canAdd,
    dragState,
    variables,
    conditionScripts,
    onChange,
    onChildChange,
    onRemoveChild,
    onRemoveGroup,
    onAddCondition,
    onAddGroup,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDrop
}) => (
    <div style={{ padding: childCount > 0 ? '8px 12px' : '0 12px' }}>
        {/* 空态提示 */}
        {childCount === 0 && (
            <div style={{
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <span style={{ color: COLORS.textDisabled, fontSize: '12px', fontStyle: 'italic' }}>
                    Empty: No conditions (Always true)
                </span>
                {onChange && (
                    <AddDropdown
                        onAddCondition={onAddCondition}
                        onAddGroup={onAddGroup}
                        disabled={!canAdd}
                        disabledReason={!canAdd && groupType === 'Not' ? 'Not group allows only one condition' : undefined}
                    />
                )}
            </div>
        )}

        {/* 子项列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {children.map((child, idx) => (
                <div
                    key={idx}
                    style={{
                        position: 'relative',
                        opacity: dragState.dragIdx === idx ? 0.5 : 1,
                        background: dragState.dropIdx === idx && dragState.dragIdx !== idx
                            ? 'rgba(59, 130, 246, 0.15)'
                            : 'transparent',
                        borderRadius: '4px',
                        transition: 'background 0.15s, opacity 0.15s'
                    }}
                    onDragOver={onDragOver(idx)}
                    onDrop={onDrop(idx)}
                >
                    {isGroupType(child.type) ? (
                        <ConditionEditor
                            condition={child}
                            onChange={(newChild) => onChildChange(idx, newChild!)}
                            onRemove={() => onRemoveGroup(idx)}
                            onDragStart={onDragStart(idx)}
                            onDragEnd={onDragEnd}
                            depth={depth + 1}
                            variables={variables}
                            conditionScripts={conditionScripts}
                        />
                    ) : (
                        <LeafConditionEditor
                            condition={child}
                            onChange={(newChild) => onChildChange(idx, newChild)}
                            onRemove={onChange ? () => onRemoveChild(idx) : undefined}
                            showDragHandle={true}
                            onDragStart={onDragStart(idx)}
                            onDragEnd={onDragEnd}
                            variables={variables}
                            conditionScripts={conditionScripts}
                        />
                    )}
                </div>
            ))}
        </div>

        {/* 底部添加按钮 */}
        {childCount > 0 && onChange && (
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <AddDropdown
                    onAddCondition={onAddCondition}
                    onAddGroup={onAddGroup}
                    disabled={!canAdd}
                    disabledReason={!canAdd && groupType === 'Not' ? 'Not group allows only one condition' : undefined}
                />
            </div>
        )}
    </div>
);
