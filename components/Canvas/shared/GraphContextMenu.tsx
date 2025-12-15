/**
 * components/Canvas/shared/GraphContextMenu.tsx
 * 通用图画布右键菜单组件 - 可被 FSM 和演出图复用
 * 
 * 设计原则：
 * 1. 使用菜单项配置代替固定回调
 * 2. 支持 CANVAS/NODE/EDGE 三种上下文类型
 * 3. 提供与 CanvasContextMenu 一致的样式和行为
 */

import React, { useRef, useEffect } from 'react';

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

// ========== Props ==========
export interface GraphContextMenuProps {
    /** 菜单状态 */
    menu: GraphContextMenuState;
    /** 关闭菜单回调 */
    onClose: () => void;
    /** 根据上下文类型和目标生成菜单项 */
    getMenuItems: (type: 'CANVAS' | 'NODE' | 'EDGE', targetId?: string) => GraphMenuElement[];
    /** 画布内容区域 Ref（用于位置计算） */
    contentRef?: React.RefObject<HTMLDivElement>;
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
    contentRef
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭菜单
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (menuRef.current && menuRef.current.contains(e.target as Node)) {
                return;
            }
            onClose();
            e.stopPropagation();
        };
        window.addEventListener('mousedown', handleMouseDown, { capture: true });
        return () => window.removeEventListener('mousedown', handleMouseDown, { capture: true });
    }, [onClose]);

    // 获取当前上下文的菜单项
    const items = getMenuItems(menu.type, menu.targetId);

    // 无菜单项时不渲染
    if (items.length === 0) return null;

    return (
        <div
            ref={menuRef}
            className="canvas-context-menu"
            style={{
                position: 'absolute',
                top: menu.y,
                left: menu.x,
                zIndex: 9999,
                backgroundColor: '#252526',
                border: '1px solid #444',
                minWidth: '160px',
                borderRadius: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                padding: '4px 0'
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {items.map((item, index) => {
                if (isSeparator(item)) {
                    return (
                        <div
                            key={`sep-${index}`}
                            className="context-menu-separator"
                            style={{
                                height: '1px',
                                background: '#444',
                                margin: '4px 0'
                            }}
                        />
                    );
                }

                return (
                    <div
                        key={item.id}
                        className={`ctx-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`}
                        onClick={() => {
                            if (!item.disabled) {
                                item.onClick();
                                onClose();
                            }
                        }}
                        style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            cursor: item.disabled ? 'not-allowed' : 'pointer',
                            color: item.danger ? '#ef4444' : item.disabled ? '#666' : '#ccc',
                            opacity: item.disabled ? 0.5 : 1
                        }}
                    >
                        {item.label}
                    </div>
                );
            })}
        </div>
    );
};

export default GraphContextMenu;
