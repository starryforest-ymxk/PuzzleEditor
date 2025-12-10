
import React from 'react';
import { State } from '../../../types/stateMachine';
import * as Geom from '../../../utils/geometry';

interface Props {
    state: State;
    position: { x: number; y: number };
    isSelected: boolean;
    isMultiSelected?: boolean;  // 新增：框选多选状态
    isInitial: boolean;
    isContextTarget: boolean;
    onMouseDown: (e: React.MouseEvent, stateId: string) => void;
    onMouseUp: (e: React.MouseEvent, stateId: string) => void;
    onContextMenu: (e: React.MouseEvent, stateId: string) => void;
    readOnly?: boolean;
}

export const StateNode = React.memo(({
    state,
    position,
    isSelected,
    isMultiSelected = false,
    isInitial,
    isContextTarget,
    onMouseDown,
    onMouseUp,
    onContextMenu,
    readOnly
}: Props) => {
    // 计算边框样式
    const getBoxShadow = () => {
        if (isContextTarget) {
            return '0 0 0 2px var(--accent-warning), var(--shadow-md)';
        }
        if (isMultiSelected) {
            return '0 0 0 2px #4fc1ff, var(--shadow-md)';  // 框选时的蓝色边框
        }
        if (isSelected) {
            return '0 0 0 2px var(--selection-border), var(--shadow-md)';
        }
        return 'var(--shadow-md)';
    };

    return (
        <div
            data-node-id={state.id}
            onMouseDown={(e) => onMouseDown(e, state.id)}
            onMouseUp={(e) => onMouseUp(e, state.id)}
            onContextMenu={(e) => onContextMenu(e, state.id)}
            onClick={(e) => e.stopPropagation()}
            style={{
                position: 'absolute',
                left: position.x,
                top: position.y,
                width: Geom.STATE_WIDTH,
                borderRadius: '6px',
                backgroundColor: isMultiSelected ? '#3a3a4a' : '#27272a',
                boxShadow: getBoxShadow(),
                zIndex: 10,
                cursor: readOnly ? 'pointer' : 'grab',
                transform: 'translate3d(0,0,0)',
                transition: 'box-shadow 0.1s, background-color 0.1s'
            }}>

            <div style={{
                height: 28,
                background: isInitial ? 'linear-gradient(90deg, #1e3a5f, #2d2d2d)' : '#383838',
                borderBottom: '1px solid rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                color: '#e0e0e0',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '6px 6px 0 0'
            }}>
                {isInitial && <span style={{ color: '#4fc1ff', marginRight: '4px' }}>▶</span>}
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{state.name}</span>
            </div>

            <div style={{ padding: '8px', minHeight: 40, fontSize: '11px', color: '#aaa' }}>
                {state.description || 'No description'}
            </div>
        </div>
    );
});

