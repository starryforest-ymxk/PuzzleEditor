import { MenuSurface, MenuItem } from '../../shared/Menu';
/**
 * components/Canvas/Elements/CanvasContextMenu.tsx
 * Canvas context menu for state machine editor
 */

import React from 'react';

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
  contentRef: React.RefObject<HTMLDivElement | null>;
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
  contentRef,
}) => {
  return (
    <MenuSurface
      onClose={onClose}
      consumeOutside

      style={{ position: 'absolute', top: menu.y, left: menu.x, minWidth: '160px' }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {menu.type === 'CANVAS' && (
        <MenuItem
          onClick={() => {
            onAddState(menu.x, menu.y);
            onClose();
          }}
        >
          + Add State
        </MenuItem>
      )}
      {menu.type === 'NODE' && menu.targetId && (
        <>
          {!isInitialState && (
            <MenuItem
              onClick={() => {
                onSetInitial(menu.targetId!);
                onClose();
              }}
            >
              Set as Initial State
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              const rect = contentRef.current?.getBoundingClientRect();
              if (rect) {
                onStartLink(menu.targetId!, menu.x + rect.left, menu.y + rect.top);
              }
              onClose();
            }}
          >
            Create Transition
          </MenuItem>
          <MenuItem
            danger
            onClick={() => {
              onDeleteState(menu.targetId!);
              onClose();
            }}
          >
            Delete State
          </MenuItem>
        </>
      )}
      {menu.type === 'TRANSITION' && menu.targetId && (
        <MenuItem
          danger
          onClick={() => {
            onDeleteTransition(menu.targetId!);
            onClose();
          }}
        >
          Delete Transition
        </MenuItem>
      )}
    </MenuSurface>
  );
};
