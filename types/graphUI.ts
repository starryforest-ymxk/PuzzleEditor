// ========== 菜单状态类型 ==========
export interface GraphContextMenuState {
  /** 菜单位置 X */
  x: number;
  /** 菜单位置 Y */
  y: number;
  /** 右键点击的上下文类型 */
  type: 'CANVAS' | 'NODE' | 'EDGE';
  /** 目标对象 ID（节点或边） */
  targetId?: string;
}

// ========== 菜单项配置 ==========
export interface GraphMenuItem {
  /** 菜单项唯一标识 */
  id: string;
  /** 显示标签 */
  label: string;
  /** 是否为危险操作（红色显示） */
  danger?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 点击回调 */
  onClick: () => void;
}

// ========== 分隔符 ==========
export interface GraphMenuSeparator {
  type: 'separator';
}

export type GraphMenuElement = GraphMenuItem | GraphMenuSeparator;
