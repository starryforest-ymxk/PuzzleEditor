/**
 * components/Explorer/StageExplorer.tsx
 * 阶段树浏览与编辑组件
 * 支持展开/折叠、选择、右键菜单、拖拽排序等交互
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ChevronRight, ChevronDown, Folder, Flag, Box, FolderPlus, FilePlus, Trash2, Edit3 } from 'lucide-react';
import { createDefaultStage, hasStageContent, canMoveStage } from '../../utils/stageTreeUtils';
import { ConfirmDialog } from '../Inspector/ConfirmDialog';
import { StageId } from '../../types/common';

// 拖拽放置位置类型
type DropPosition = 'before' | 'after' | 'inside' | null;

// 上下文菜单状态
interface ContextMenuState {
  x: number;
  y: number;
  stageId: string | null;  // null 表示空白区域菜单（在 Root 下创建）
}

// 拖拽状态
interface DragState {
  draggingId: string | null;
  dropTargetId: string | null;
  dropPosition: DropPosition;
  // sticky bottom logic
  dropIndicatorType?: 'indented' | 'full-width' | null;
}

export const StageExplorer = () => {
  const { project, ui } = useEditorState();
  const dispatch = useEditorDispatch();

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  // 内联编辑状态
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  // 拖拽状态
  const [dragState, setDragState] = useState<DragState>({
    draggingId: null,
    dropTargetId: null,
    dropPosition: null,
    dropIndicatorType: null
  });
  // 删除确认弹窗状态
  const [deleteConfirm, setDeleteConfirm] = useState<{
    stageId: string;
    stageName: string;
    childStageCount: number;
    nodeCount: number;
  } | null>(null);

  // 编辑输入框引用
  const editInputRef = useRef<HTMLInputElement>(null);

  // 关闭右键菜单 - 使用 mousedown 确保在任何点击时立即关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // 不关闭如果点击在菜单内部
      const target = e.target as HTMLElement;
      if (target.closest('.canvas-context-menu')) {
        return;
      }
      setContextMenu(null);
    };
    if (contextMenu) {
      // 使用 setTimeout 避免立即触发关闭（同一次点击事件）
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [contextMenu]);

  // 聚焦编辑输入框
  useEffect(() => {
    if (editingStageId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingStageId]);

  // 选择 Stage
  const handleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch({ type: 'NAVIGATE_TO', payload: { stageId: id, nodeId: null, graphId: null } });
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id } });
  };

  // 展开/折叠 Stage
  const handleToggle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch({ type: 'TOGGLE_STAGE_EXPAND', payload: { id } });
  };

  // 右键菜单
  const handleContextMenu = (e: React.MouseEvent, stageId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, stageId });
  };

  // 创建子 Stage（或在空白区域时创建 Root 下的 Stage）
  const handleCreateChildStage = useCallback(() => {
    if (!contextMenu) return;
    // 如果 stageId 为 null，表示在空白区域点击，使用 rootId 作为父节点
    const parentId = (contextMenu.stageId || project.stageTree.rootId) as StageId;
    const newStage = createDefaultStage(parentId);
    dispatch({ type: 'ADD_STAGE', payload: { parentId, stage: newStage } });
    // 自动展开父节点
    dispatch({ type: 'SET_STAGE_EXPANDED', payload: { id: parentId, expanded: true } });
    // 选中新创建的 Stage
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: newStage.id } });
    dispatch({ type: 'NAVIGATE_TO', payload: { stageId: newStage.id, nodeId: null, graphId: null } });
    setContextMenu(null);
  }, [contextMenu, project.stageTree.rootId, dispatch]);

  // 创建同级 Stage
  const handleCreateSiblingStage = useCallback(() => {
    if (!contextMenu) return;
    const stage = project.stageTree.stages[contextMenu.stageId];
    if (!stage || !stage.parentId) return;

    const parentId = stage.parentId as StageId;
    const newStage = createDefaultStage(parentId);
    dispatch({
      type: 'ADD_STAGE',
      payload: { parentId, afterStageId: contextMenu.stageId, stage: newStage }
    });
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: newStage.id } });
    dispatch({ type: 'NAVIGATE_TO', payload: { stageId: newStage.id, nodeId: null, graphId: null } });
    setContextMenu(null);
  }, [contextMenu, project.stageTree.stages, dispatch]);

  // 开始重命名
  const handleStartRename = useCallback(() => {
    if (!contextMenu) return;
    const stage = project.stageTree.stages[contextMenu.stageId];
    if (stage) {
      setEditingStageId(contextMenu.stageId);
      setEditingName(stage.name);
    }
    setContextMenu(null);
  }, [contextMenu, project.stageTree.stages]);

  // 确认重命名
  const handleConfirmRename = useCallback(() => {
    if (!editingStageId || !editingName.trim()) {
      setEditingStageId(null);
      return;
    }
    dispatch({
      type: 'UPDATE_STAGE',
      payload: { stageId: editingStageId as StageId, data: { name: editingName.trim() } }
    });
    setEditingStageId(null);
  }, [editingStageId, editingName, dispatch]);

  // 取消重命名
  const handleCancelRename = useCallback(() => {
    setEditingStageId(null);
    setEditingName('');
  }, []);

  // 请求删除 Stage（显示确认弹窗）
  const handleRequestDelete = useCallback(() => {
    if (!contextMenu) return;
    const stage = project.stageTree.stages[contextMenu.stageId];
    if (!stage || !stage.parentId) {
      // 不允许删除根节点
      setContextMenu(null);
      return;
    }

    const contentInfo = hasStageContent(project.stageTree, project.nodes, contextMenu.stageId as StageId);

    if (contentInfo.hasChildren || contentInfo.totalDescendantStages > 0 || contentInfo.totalDescendantNodes > 0) {
      // 有子内容，显示确认弹窗
      setDeleteConfirm({
        stageId: contextMenu.stageId,
        stageName: stage.name,
        childStageCount: contentInfo.totalDescendantStages,
        nodeCount: contentInfo.totalDescendantNodes
      });
    } else {
      // 无子内容，直接删除
      dispatch({ type: 'DELETE_STAGE', payload: { stageId: contextMenu.stageId as StageId } });
    }
    setContextMenu(null);
  }, [contextMenu, project.stageTree, project.nodes, dispatch]);

  // 确认删除
  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfirm) return;
    dispatch({ type: 'DELETE_STAGE', payload: { stageId: deleteConfirm.stageId as StageId } });
    setDeleteConfirm(null);
  }, [deleteConfirm, dispatch]);

  // 取消删除
  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  // ========== 拖拽处理 ==========
  const handleDragStart = (e: React.DragEvent, stageId: string) => {
    const stage = project.stageTree.stages[stageId];
    if (!stage || !stage.parentId) {
      // 不允许拖拽根节点
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', stageId);
    e.dataTransfer.effectAllowed = 'move';
    setDragState({ ...dragState, draggingId: stageId });
  };

  const handleDragEnd = () => {
    setDragState({ draggingId: null, dropTargetId: null, dropPosition: null, dropIndicatorType: null });
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.stopPropagation(); // 阻止事件冒泡到空白区域处理器
    if (!dragState.draggingId || dragState.draggingId === stageId) return;

    // 检查是否可以移动到该位置
    if (!canMoveStage(project.stageTree, dragState.draggingId as StageId, stageId as StageId)) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // 根据鼠标位置判断放置位置：上部 = before，下部 = after，中间 = inside
    let position: DropPosition;
    if (y < height * 0.25) {
      position = 'before';
    } else if (y > height * 0.75) {
      position = 'after';
    } else {
      position = 'inside';
    }

    if (dragState.dropTargetId !== stageId || dragState.dropPosition !== position) {
      setDragState({
        ...dragState,
        dropTargetId: stageId,
        dropPosition: position,
        dropIndicatorType: null // 清除 sticky 状态
      });
    }
  };

  // 空白区域拖拽处理 (Sticky Bottom Logic)
  const handleEmptyAreaDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragState.draggingId) return;

    // 找到最后一个可见的 tree-node
    // 注意：这里使用 DOM 查询，因为我们需要可视位置
    // 使用 querySelectorAll 找到所有 tree-node，取最后一个
    const treeNodes = document.querySelectorAll('.tree-node');
    if (treeNodes.length === 0) return;

    const lastNode = treeNodes[treeNodes.length - 1];
    const lastNodeRect = lastNode.getBoundingClientRect();

    // 计算鼠标距离最后一个节点底部的距离
    const distance = e.clientY - lastNodeRect.bottom;
    const STICKY_THRESHOLD = 30;

    let indicatorType: 'indented' | 'full-width';

    // Case A: Close Proximity -> Indented (Sibling to last node)
    if (distance <= STICKY_THRESHOLD && distance >= 0) {
      indicatorType = 'indented';
    }
    // Case B: Far Away -> Full Width (Append to Root)
    else {
      indicatorType = 'full-width';
    }

    if (dragState.dropIndicatorType !== indicatorType || dragState.dropTargetId !== 'EMPTY_AREA') {
      setDragState({
        ...dragState,
        dropTargetId: 'EMPTY_AREA',
        dropPosition: null, // 不使用常规 position
        dropIndicatorType: indicatorType
      });
    }
  };

  // 空白区域 Drop 处理
  const handleEmptyAreaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId || !dragState.dropIndicatorType) {
      handleDragEnd();
      return;
    }

    const draggedStage = project.stageTree.stages[draggedId];
    if (!draggedStage) {
      handleDragEnd();
      return;
    }

    // 获取最后一个节点
    const treeNodes = document.querySelectorAll('.tree-node');
    if (treeNodes.length === 0) {
      handleDragEnd();
      return;
    }
    const lastNode = treeNodes[treeNodes.length - 1];
    const lastStageId = lastNode.getAttribute('data-stage-id');
    if (!lastStageId) {
      handleDragEnd();
      return;
    }

    const lastStage = project.stageTree.stages[lastStageId];

    if (dragState.dropIndicatorType === 'full-width') {
      // Append to Root
      if (canMoveStage(project.stageTree, draggedId as StageId, project.stageTree.rootId as StageId)) {
        dispatch({
          type: 'MOVE_STAGE',
          payload: {
            stageId: draggedId as StageId,
            newParentId: project.stageTree.rootId!,
            insertIndex: project.stageTree.stages[project.stageTree.rootId!].childrenIds.length
          }
        });
      }
    } else if (dragState.dropIndicatorType === 'indented') {
      // Indented -> Sibling to last node (Append to last node's parent)
      if (lastStage && lastStage.parentId) {
        const parentId = lastStage.parentId;
        if (canMoveStage(project.stageTree, draggedId as StageId, parentId as StageId)) {
          // 插入到父节点的最后
          const parent = project.stageTree.stages[parentId];
          const insertIndex = parent.childrenIds.length;
          dispatch({
            type: 'MOVE_STAGE',
            payload: {
              stageId: draggedId as StageId,
              newParentId: parentId as StageId,
              insertIndex
            }
          });
        }
      }
    }

    handleDragEnd();
  };

  const handleDragLeave = () => {
    setDragState({ ...dragState, dropTargetId: null, dropPosition: null, dropIndicatorType: null });
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === stageId) {
      handleDragEnd();
      return;
    }

    const { dropPosition } = dragState;
    const targetStage = project.stageTree.stages[stageId];
    const draggedStage = project.stageTree.stages[draggedId];

    if (!targetStage || !draggedStage) {
      handleDragEnd();
      return;
    }

    if (dropPosition === 'inside') {
      // 移动到目标 Stage 内部（作为子节点）
      if (canMoveStage(project.stageTree, draggedId as StageId, stageId as StageId)) {
        dispatch({
          type: 'MOVE_STAGE',
          payload: { stageId: draggedId as StageId, newParentId: stageId as StageId }
        });
        // 展开目标节点
        dispatch({ type: 'SET_STAGE_EXPANDED', payload: { id: stageId, expanded: true } });
      }
    } else if (dropPosition === 'before' || dropPosition === 'after') {
      // 移动到同级位置
      if (targetStage.parentId) {
        const parentId = targetStage.parentId as StageId;
        const parent = project.stageTree.stages[parentId];
        if (parent) {
          const targetIndex = parent.childrenIds.indexOf(stageId);
          const insertIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1;

          if (draggedStage.parentId === parentId) {
            // 同一父节点下重新排序
            dispatch({
              type: 'REORDER_STAGE',
              payload: { stageId: draggedId as StageId, newIndex: insertIndex }
            });
          } else {
            // 跨父节点移动
            dispatch({
              type: 'MOVE_STAGE',
              payload: { stageId: draggedId as StageId, newParentId: parentId, insertIndex }
            });
          }
        }
      }
    }

    handleDragEnd();
  };

  // ========== 渲染树节点 ==========
  const renderTree = (stageId: string, depth = 0) => {
    const stage = project.stageTree.stages[stageId];
    if (!stage) return null;

    const isSelected = ui.currentStageId === stage.id;
    const hasChildren = stage.childrenIds.length > 0;
    const isExpanded = ui.stageExpanded[stage.id] ?? stage.isExpanded ?? false;
    const isEditing = editingStageId === stage.id;
    const isDragging = dragState.draggingId === stage.id;
    const isDropTarget = dragState.dropTargetId === stage.id;

    // 初始阶段判断：父节点的第一个子节点即为初始阶段
    // 不使用 stage.isInitial 属性，因为拖动后该属性不会自动更新
    const parent = stage.parentId ? project.stageTree.stages[stage.parentId] : null;
    const isInitial = parent ? parent.childrenIds?.[0] === stage.id : false;

    // 确定拖拽放置指示器的 CSS 类
    let dropClass = '';
    if (isDropTarget && dragState.dropPosition) {
      dropClass = `drop-target-${dragState.dropPosition}`;
    }

    return (
      <div key={stage.id}>
        <div
          className={`tree-node ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${dropClass}`}
          style={{ paddingLeft: `${depth * 16 + 8}px`, position: 'relative' }}
          data-stage-id={stage.id} // 用于 sticky bottom logic 获取 ID
          onClick={(e) => handleSelect(e, stage.id)}
          onContextMenu={(e) => handleContextMenu(e, stage.id)}
          onDoubleClick={() => {
            if (!isEditing) {
              setEditingStageId(stage.id);
              setEditingName(stage.name);
            }
          }}
          draggable={!!stage.parentId}
          onDragStart={(e) => handleDragStart(e, stage.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, stage.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, stage.id)}
        >
          {/* Expander Icon */}
          <span
            style={{
              marginRight: '4px',
              display: 'flex',
              alignItems: 'center',
              cursor: hasChildren ? 'pointer' : 'default',
              opacity: hasChildren ? 1 : 0.3,
              color: 'var(--text-secondary)'
            }}
            onClick={(e) => hasChildren && handleToggle(e, stage.id)}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : (
              <div style={{ width: 14, height: 14 }} />
            )}
          </span>

          {/* Type Icon */}
          <span style={{ marginRight: '6px', color: isSelected ? 'inherit' : 'var(--text-secondary)' }}>
            {hasChildren ? <Folder size={14} /> : <Box size={14} />}
          </span>

          {/* Name (editable or static) */}
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              className="tree-node-name-edit"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleConfirmRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename();
                if (e.key === 'Escape') handleCancelRename();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: '13px',
              flex: 1
            }}>
              {stage.name}
            </span>
          )}

          {/* Initial Marker */}
          {isInitial && !isEditing && (
            <span
              title="Initial Stage"
              style={{
                marginLeft: '6px',
                color: 'var(--accent-color)',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Flag size={12} fill="currentColor" />
            </span>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {stage.childrenIds.map(childId => renderTree(childId, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!project.isLoaded) {
    return <div className="empty-state">Loading...</div>;
  }

  // 空白区域右键菜单 - 在 Root 层级下创建 Stage
  const handleEmptyAreaContextMenu = (e: React.MouseEvent) => {
    // 始终阻止浏览器默认右键菜单
    e.preventDefault();

    // 检查点击目标是否为空白区域（不是 Stage 节点）
    const target = e.target as HTMLElement;
    if (target.closest('.tree-node')) {
      return; // 点击在 Stage 节点上，由节点自己的 handleContextMenu 处理
    }

    if (project.stageTree.rootId) {
      setContextMenu({ x: e.clientX, y: e.clientY, stageId: null });
    }
  };

  return (
    <div
      style={{
        padding: '8px 0',
        flex: 1,
        minHeight: '50px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}
      onContextMenu={handleEmptyAreaContextMenu}
    >
      {project.stageTree.rootId ? (
        renderTree(project.stageTree.rootId)
      ) : (
        <div className="empty-state">No Root Stage</div>
      )}

      {/* 底部空白区域，用于右键新建 Stage */}
      {/* 底部空白区域 */}
      <div
        style={{ flex: 1, minHeight: '40px', cursor: 'default', position: 'relative' }}
        title="Right-click to create a new stage"
        onDragOver={handleEmptyAreaDragOver}
        onDrop={handleEmptyAreaDrop}
      >
        {/* Sticky Bottom Drop Indicator */}
        {dragState.dropTargetId === 'EMPTY_AREA' && dragState.dropIndicatorType && (
          <div
            className={`sticky-drop-indicator ${dragState.dropIndicatorType}`}
            style={{
              position: 'absolute',
              top: 0,
              left: dragState.dropIndicatorType === 'indented' ? '24px' : '0', // 简单缩进
              right: 0,
              height: '2px',
              backgroundColor: 'var(--accent-color)',
              boxShadow: '0 0 4px var(--accent-color)',
              pointerEvents: 'none'
            }}
          />
        )}
      </div>

      {/* 右键上下文菜单 */}
      {contextMenu && (
        <div
          className="canvas-context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 空白区域菜单 - 只显示新建选项 */}
          {contextMenu.stageId === null ? (
            <div className="menu-item" onClick={handleCreateChildStage}>
              <FolderPlus size={14} style={{ marginRight: '8px' }} />
              Create Stage
            </div>
          ) : (
            <>
              <div className="menu-item" onClick={handleCreateChildStage}>
                <FolderPlus size={14} style={{ marginRight: '8px' }} />
                Create Child Stage
              </div>
              {project.stageTree.stages[contextMenu.stageId]?.parentId && (
                <>
                  <div className="menu-item" onClick={handleCreateSiblingStage}>
                    <FilePlus size={14} style={{ marginRight: '8px' }} />
                    Create Sibling Stage
                  </div>
                  <div className="menu-item" onClick={handleStartRename}>
                    <Edit3 size={14} style={{ marginRight: '8px' }} />
                    Rename
                  </div>
                  <div className="menu-divider" />
                  <div className="menu-item menu-item-danger" onClick={handleRequestDelete}>
                    <Trash2 size={14} style={{ marginRight: '8px' }} />
                    Delete
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Stage"
          message={`Are you sure you want to delete "${deleteConfirm.stageName}"? This will also delete all child content. This action cannot be undone.`}
          references={[
            deleteConfirm.childStageCount > 0 ? `${deleteConfirm.childStageCount} child stage(s)` : '',
            deleteConfirm.nodeCount > 0 ? `${deleteConfirm.nodeCount} puzzle node(s)` : ''
          ].filter(Boolean)}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
};
