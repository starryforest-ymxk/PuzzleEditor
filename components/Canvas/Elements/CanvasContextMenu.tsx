/**
 * components/Canvas/Elements/CanvasContextMenu.tsx
 * Canvas context menu for state machine editor
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
 * Right-click context menu on the canvas/state/transition.
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

    // Close when clicking outside the menu
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
                minWidth: '160px',
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
                    + Add State
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
                            Set as Initial State
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
                        Create Transition
                    </div>
                    <div
                        className="ctx-item danger"
                        onClick={() => {
                            onDeleteState(menu.targetId!);
                            onClose();
                        }}
                    >
                        Delete State
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
                    Delete Transition
                </div>
            )}
        </div>
    );
};
