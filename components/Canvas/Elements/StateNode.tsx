
import React from 'react';
import { State } from '../../../types/stateMachine';
import * as Geom from '../../../utils/geometry';

interface Props {
    state: State;
    position: { x: number; y: number };
    isSelected: boolean;
    isMultiSelected?: boolean;  // 框选多选状态
    isInitial: boolean;
    isContextTarget: boolean;
    onMouseDown: (e: React.MouseEvent, stateId: string) => void;
    onMouseUp: (e: React.MouseEvent, stateId: string) => void;
    onContextMenu: (e: React.MouseEvent, stateId: string) => void;
    readOnly?: boolean;
    /** 是否存在校验错误（引用已删除资源） */
    hasError?: boolean;
    /** 错误提示信息 */
    errorTooltip?: string;
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
    readOnly,
    hasError = false,
    errorTooltip
}: Props) => {
    // 计算边框样式：错误状态优先显示红色边框
    const getBoxShadow = () => {
        if (hasError) {
            return '0 0 0 2px var(--accent-error, #ef4444), var(--shadow-md)';
        }
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
            title={hasError ? errorTooltip : undefined}
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
                background: hasError
                    ? 'linear-gradient(90deg, #3f1515, #2d2d2d)'  // 错误状态：红色渐变
                    : isInitial
                        ? 'linear-gradient(90deg, #1e3a5f, #2d2d2d)'
                        : '#383838',
                borderBottom: '1px solid rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                color: '#e0e0e0',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '6px 6px 0 0'
            }}>
                {/* 错误图标 */}
                {hasError && (
                    <span style={{
                        color: '#ef4444',
                        marginRight: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}>⚠</span>
                )}
                {isInitial && !hasError && <span style={{ color: '#4fc1ff', marginRight: '4px' }}>{'>'}</span>}
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{state.name}</span>
            </div>

            <div style={{ padding: '8px', minHeight: 40, fontSize: '11px', color: '#aaa' }}>
                {state.description || 'No description'}
            </div>
        </div>
    );
});

StateNode.displayName = 'StateNode';
