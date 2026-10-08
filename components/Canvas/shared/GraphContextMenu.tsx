import { MenuSurface, MenuItem, MenuSeparator } from '../../shared/Menu';
/**
 * components/Canvas/shared/GraphContextMenu.tsx
 * 通用图画布右键菜单组件 - 可被 FSM 和演出图复用
 *
 * 设计原则：
 * 1. 使用菜单项配置代替固定回调
 * 2. 支持 CANVAS/NODE/EDGE 三种上下文类型
 * 3. 提供与 CanvasContextMenu 一致的样式和行为
 */

import React from 'react';

import type {
  GraphContextMenuState,
  GraphMenuElement,
  GraphMenuSeparator,
} from '../../../types/graphUI';
export type {
  GraphContextMenuState,
  GraphMenuElement,
  GraphMenuItem,
  GraphMenuSeparator,
} from '../../../types/graphUI';
// ========== Props ==========
export interface GraphContextMenuProps {
  /** 菜单状态 */
  menu: GraphContextMenuState;
  /** 关闭菜单回调 */
  onClose: () => void;
  /** 根据上下文类型和目标生成菜单项 */
  getMenuItems: (type: 'CANVAS' | 'NODE' | 'EDGE', targetId?: string) => GraphMenuElement[];
  /** 画布内容区域 Ref（用于位置计算） */
  contentRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * 判断元素是否为分隔符
 */
function isSeparator(item: GraphMenuElement): item is GraphMenuSeparator {
  return 'type' in item && item.type === 'separator';
}

/**
 * 通用图画布右键菜单组件
 */

export const GraphContextMenu: React.FC<GraphContextMenuProps> = ({
  menu,
  onClose,
  getMenuItems,
}) => {
  const items = getMenuItems(menu.type, menu.targetId);
  if (!items.length) return null;
  return (
    <MenuSurface
      onClose={onClose}
      consumeOutside
      style={{ position: 'absolute', left: menu.x, top: menu.y }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) =>
        isSeparator(item) ? (
          <MenuSeparator key={'separator-' + index} />
        ) : (
          <MenuItem
            key={item.id}
            danger={item.danger}
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.label}
          </MenuItem>
        ),
      )}
    </MenuSurface>
  );
};
export default GraphContextMenu;
