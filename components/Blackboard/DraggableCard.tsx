/**
 * components/Blackboard/DraggableCard.tsx
 * 可拖拽卡片包装组件 - 为黑板卡片添加拖拽排序能力
 * 使用原生 HTML5 Drag and Drop API 实现
 */

import React, { useRef, useState } from 'react';

interface DraggableCardProps {
  /** 卡片唯一标识 */
  id: string;
  /** 拖拽类型（限制只能在同类型间拖拽） */
  dragType: string;
  /** 当前索引 */
  index: number;
  /** 拖拽开始回调 */
  onDragStart: (id: string, index: number) => void;
  /** 拖拽经过回调 */
  onDragOver: (targetIndex: number) => void;
  /** 拖拽结束回调 */
  onDragEnd: () => void;
  /** 子元素 */
  children: React.ReactNode;
  /** 是否禁用拖拽 */
  disabled?: boolean;
}

/**
 * 可拖拽卡片包装组件
 * 为子卡片添加拖拽排序能力
 */
export const DraggableCard: React.FC<DraggableCardProps> = ({
  id,
  dragType,
  index,
  onDragStart,
  onDragOver,
  onDragEnd,
  children,
  disabled = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  // MIME 使用小写，避免浏览器归一化后含大写类型（Performance/Stage 等）匹配失败
  const dragTypeToken = dragType.toLowerCase();
  const dragTypeMime = `application/x-dnd-${dragTypeToken}`;

  // 解析 dataTransfer：优先自定义 MIME，其次 JSON 兼容旧逻辑
  const isSameDragType = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(dragTypeMime)) return true;
    if (!e.dataTransfer.types.includes('application/json')) return false;
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      return data?.dragType?.toLowerCase() === dragTypeToken;
    } catch {
      return false;
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    // 设置拖拽数据（包含类型和 ID，用于跨元素识别）
    e.dataTransfer.setData('application/json', JSON.stringify({ dragType, id, index }));
    // 写入自定义 MIME，方便在 dragover 阶段快速判断
    e.dataTransfer.setData(dragTypeMime, '1');
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
    onDragStart(id, index);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isSameDragType(e)) {
      setIsDragOver(false);
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
    onDragOver(index);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isSameDragType(e)) {
      setIsDragOver(false);
      return;
    }
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isSameDragType(e)) {
      setIsDragOver(false);
      return;
    }
    setIsDragOver(false);
    // 实际排序逻辑在 onDragEnd 中处理
  };

  return (
    <div
      ref={dragRef}
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        opacity: isDragging ? 0.5 : 1,
        borderTop: isDragOver ? '2px solid var(--accent-color)' : '2px solid transparent',
        cursor: disabled ? 'default' : 'grab',
        transition: 'border-top 0.1s ease'
      }}
    >
      {children}
    </div>
  );
};

export default DraggableCard;
