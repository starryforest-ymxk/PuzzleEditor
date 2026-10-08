import { useRef } from 'react';
import { reorderedIds } from '../utils/blackboard';

/** 每次拖动只在发起的分组内提交，ref 保证同一帧内的 dragover/end 读取最新位置。 */
export function useResourceReorder() {
  const drag = useRef<{ group: string; from: number; to: number } | null>(null);
  return (group: string, items: { id: string }[], onReorder: (orderedIds: string[]) => void) => ({
    onDragStart: (_id: string, index: number) => {
      drag.current = { group, from: index, to: index };
    },
    onDragOver: (index: number) => {
      if (drag.current?.group === group) drag.current.to = index;
    },
    onDragEnd: () => {
      const current = drag.current;
      drag.current = null;
      if (current?.group !== group) return;
      const ids = reorderedIds(items, current.from, current.to);
      if (ids) onReorder(ids);
    },
  });
}
