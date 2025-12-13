
import React from 'react';
import { Transition, State } from '../../../types/stateMachine';
import * as Geom from '../../../utils/geometry';

interface Props {
    transition: Transition;
    fromState: State;
    toState: State;
    isSelected: boolean;
    isContextTarget: boolean;
    isModifying: boolean;
    fromPos: Geom.Point;
    toPos: Geom.Point;
    onSelect: (e: React.MouseEvent, id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    onHandleDown: (e: React.MouseEvent, id: string, type: 'source' | 'target') => void;
    /** 是否存在校验错误（引用已删除资源） */
    hasError?: boolean;
}

export const ConnectionLine = React.memo(({
    transition,
    fromState,
    toState,
    isSelected,
    isContextTarget,
    isModifying,
    fromPos,
    toPos,
    onSelect,
    onContextMenu,
    onHandleDown,
    hasError = false
}: Props) => {
    if (!fromState || !toState || isModifying) return null;

    const fromSide = transition.fromSide || Geom.getClosestSide(fromPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, toPos);
    const toSide = transition.toSide || Geom.getClosestSide(toPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, fromPos);

    const start = Geom.getNodeAnchor(fromPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, fromSide);
    const end = Geom.getNodeAnchor(toPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, toSide);
    const path = Geom.getBezierPathData(start, end, fromSide, toSide);

    // 错误状态优先显示红色
    const strokeColor = hasError
        ? "var(--accent-error, #ef4444)"
        : isContextTarget
            ? "var(--accent-warning)"
            : (isSelected ? "var(--accent-color)" : "#666");
    const markerId = hasError
        ? "url(#arrow-error)"
        : isContextTarget
            ? "url(#arrow-context)"
            : (isSelected ? "url(#arrow-selected)" : "url(#arrow-normal)");

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Ctrl+点击时不做任何操作（让Ctrl+拖拽来处理切线）
        if (e.ctrlKey || e.metaKey) return;
        onSelect(e, transition.id);
    };

    return (
        <React.Fragment>
            {/* SVG Path Layer */}
            <path d={path} fill="none" stroke="transparent" strokeWidth="15"
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onClick={handleClick}
                onContextMenu={(e) => onContextMenu(e, transition.id)}
            />
            <path d={path} fill="none"
                stroke={strokeColor}
                strokeWidth={(isSelected || isContextTarget || hasError) ? 3 : 2}
                markerEnd={markerId}
                style={{ pointerEvents: 'none' }}
            />
        </React.Fragment>
    );
});



// Helper component for the HTML overlay part (Handles & Label)
interface ControlsProps extends Omit<Props, 'fromState' | 'toState' | 'isModifying'> {
    readOnly?: boolean;
    /** 是否存在校验错误 */
    hasError?: boolean;
    /** 错误提示信息 */
    errorTooltip?: string;
}

export const ConnectionControls = React.memo(({
    transition, fromPos, toPos, isSelected, isContextTarget, onSelect, onContextMenu, onHandleDown, readOnly,
    hasError = false, errorTooltip
}: ControlsProps) => {

    const fromSide = transition.fromSide || Geom.getClosestSide(fromPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, toPos);
    const toSide = transition.toSide || Geom.getClosestSide(toPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, fromPos);

    const start = Geom.getNodeAnchor(fromPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, fromSide);
    const end = Geom.getNodeAnchor(toPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, toSide);
    const mid = Geom.getBezierMidPoint(start, end, fromSide, toSide);

    // 标签背景色：错误状态显示红色
    const labelBg = hasError
        ? 'var(--accent-error, #ef4444)'
        : isContextTarget
            ? 'var(--accent-warning)'
            : (isSelected ? 'var(--accent-color)' : '#252526');
    const labelBorder = hasError ? '1px solid #b91c1c' : '1px solid #444';

    return (
        <React.Fragment>
            <div
                onClick={(e) => { e.stopPropagation(); onSelect(e, transition.id); }}
                onContextMenu={(e) => onContextMenu(e, transition.id)}
                title={hasError ? errorTooltip : undefined}
                style={{
                    position: 'absolute', left: mid.x, top: mid.y, transform: 'translate(-50%, -50%)',
                    backgroundColor: labelBg,
                    border: labelBorder, borderRadius: '12px', padding: '2px 8px', fontSize: '10px',
                    color: (isSelected || isContextTarget || hasError) ? '#fff' : '#ccc',
                    cursor: 'pointer', zIndex: 30,
                    display: 'flex', alignItems: 'center', gap: '4px'
                }}
            >
                {/* 错误图标 */}
                {hasError && <span style={{ fontSize: '10px' }}>⚠</span>}
                {transition.name}
            </div>
            {!readOnly && (
                <>
                    <div className="handle" style={{ left: start.x, top: start.y, zIndex: 31 }}
                        onMouseDown={(e) => { e.stopPropagation(); onHandleDown(e, transition.id, 'source'); }} />
                    <div className="handle" style={{ left: end.x, top: end.y, zIndex: 31 }}
                        onMouseDown={(e) => { e.stopPropagation(); onHandleDown(e, transition.id, 'target'); }} />
                </>
            )}
        </React.Fragment>
    )
});

