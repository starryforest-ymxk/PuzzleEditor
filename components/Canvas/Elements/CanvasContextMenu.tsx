/**
 * components/Canvas/Elements/CanvasContextMenu.tsx
 * 画布右键菜单组件
 * 从 StateMachineCanvas.tsx 拆分而来
 */

import React, { useRef, useEffect } from 'react';

export interface ContextMenuState {
    x: number;
    y: number;
    type: 'CANVAS' | 'NODE' | 'TRANSITION';
    targetId?: string;
}

interface CanvasContextMenuProps {
    menu: ContextMenuState;
    onClose: () => void;
    onAddState: (x: number, y: number) => void;
    onSetInitial: (stateId: string) => void;
    onStartLink: (stateId: string, x: number, y: number) => void;
    onDeleteState: (stateId: string) => void;
    onDeleteTransition: (transitionId: string) => void;
    isInitialState?: boolean;
    contentRef: React.RefObject<HTMLDivElement>;
}

/**
 * 画布右键菜单
 * 支持三种类型：CANVAS（添加状态）、NODE（设为初始/连线/删除）、TRANSITION（删除）
 */
export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
    menu,
    onClose,
    onAddState,
    onSetInitial,
    onStartLink,
    onDeleteState,
    onDeleteTransition,
    isInitialState = false,
    contentRef
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // 点击菜单外部时关闭
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

    return (
        <div
            ref={menuRef}
            style={{
                position: 'absolute',
                top: menu.y,
                left: menu.x,
                zIndex: 9999,
                backgroundColor: '#252526',
                border: '1px solid #444',
                minWidth: '140px',
                borderRadius: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {menu.type === 'CANVAS' && (
                <div
                    className="ctx-item"
                    onClick={() => {
                        onAddState(menu.x, menu.y);
                        onClose();
                    }}
                >
                    + 添加状态
                </div>
            )}
            {menu.type === 'NODE' && menu.targetId && (
                <>
                    {!isInitialState && (
                        <div
                            className="ctx-item"
                            onClick={() => {
                                onSetInitial(menu.targetId!);
                                onClose();
                            }}
                        >
                            🏁 设为初始状态
                        </div>
                    )}
                    <div
                        className="ctx-item"
                        onClick={() => {
                            const rect = contentRef.current?.getBoundingClientRect();
                            if (rect) {
                                onStartLink(menu.targetId!, menu.x + rect.left, menu.y + rect.top);
                            }
                            onClose();
                        }}
                    >
                        🔗 创建连线
                    </div>
                    <div
                        className="ctx-item danger"
                        onClick={() => {
                            onDeleteState(menu.targetId!);
                            onClose();
                        }}
                    >
                        🗑 删除
                    </div>
                </>
            )}
            {menu.type === 'TRANSITION' && menu.targetId && (
                <div
                    className="ctx-item danger"
                    onClick={() => {
                        onDeleteTransition(menu.targetId!);
                        onClose();
                    }}
                >
                    🗑 删除连线
                </div>
            )}
        </div>
    );
};
