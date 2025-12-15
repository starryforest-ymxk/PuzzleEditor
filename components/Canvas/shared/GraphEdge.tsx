/**
 * components/Canvas/shared/GraphEdge.tsx
 * 通用图边组件 - 可被 FSM 和演出图复用
 * 
 * 设计原则：
 * 1. 接收通用 IGraphEdge 数据
 * 2. 复用 ConnectionLine 的贝塞尔曲线绘制逻辑
 * 3. 支持选中、右键菜单、错误状态等
 */

import React from 'react';
import { IGraphEdge, NodeDimensions } from '../../../types/graphCore';
import { Vector2 } from '../../../types/common';
import * as Geom from '../../../utils/geometry';

// ========== Props 定义 ==========
export interface GraphEdgeProps {
    /** 边数据 */
    edge: IGraphEdge;
    /** 起始节点位置 */
    fromPos: Vector2;
    /** 目标节点位置 */
    toPos: Vector2;
    /** 节点尺寸（用于计算锚点） */
    nodeDimensions?: NodeDimensions;
    /** 是否选中 */
    isSelected: boolean;
    /** 是否为右键菜单目标 */
    isContextTarget: boolean;
    /** 是否正在修改中 */
    isModifying?: boolean;
    /** 是否有校验错误 */
    hasError?: boolean;
    /** 自定义标签渲染器 */
    renderLabel?: (edge: IGraphEdge) => React.ReactNode;
    /** 是否禁用交互（点击/右键），仅作展示 */
    disableInteractions?: boolean;
    /** 点击选中事件 */
    onSelect: (e: React.MouseEvent, edgeId: string) => void;
    /** 右键菜单事件 */
    onContextMenu: (e: React.MouseEvent, edgeId: string) => void;
}

/**
 * 通用图边组件（SVG路径部分）
 * 渲染贝塞尔曲线连线
 */
export const GraphEdge: React.FC<GraphEdgeProps> = React.memo(({
    edge,
    fromPos,
    toPos,
    nodeDimensions,
    isSelected,
    isContextTarget,
    isModifying = false,
    hasError = false,
    disableInteractions = false,
    onSelect,
    onContextMenu
}) => {
    // 如果正在修改中，不渲染
    if (isModifying) return null;

    const nodeWidth = nodeDimensions?.width || Geom.STATE_WIDTH;
    const nodeHeight = nodeDimensions?.height || Geom.STATE_ESTIMATED_HEIGHT;

    // 计算边的端点方向
    const fromSide = edge.fromSide || Geom.getClosestSide(fromPos, nodeWidth, nodeHeight, toPos);
    const toSide = edge.toSide || Geom.getClosestSide(toPos, nodeWidth, nodeHeight, fromPos);

    // 计算锚点坐标
    const start = Geom.getNodeAnchor(fromPos, nodeWidth, nodeHeight, fromSide);
    const end = Geom.getNodeAnchor(toPos, nodeWidth, nodeHeight, toSide);

    // 生成贝塞尔路径
    const path = Geom.getBezierPathData(start, end, fromSide, toSide);

    // 计算颜色
    const strokeColor = hasError
        ? 'var(--accent-error, #ef4444)'
        : isContextTarget
            ? 'var(--accent-warning)'
            : isSelected
                ? 'var(--accent-color)'
                : '#666';

    const markerId = hasError
        ? 'url(#arrow-error)'
        : isContextTarget
            ? 'url(#arrow-context)'
            : isSelected
                ? 'url(#arrow-selected)'
                : 'url(#arrow-normal)';

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Ctrl+点击时不做操作（留给剪线功能）
        if (e.ctrlKey || e.metaKey) return;
        onSelect(e, edge.id);
    };

    return (
        <g>
            {/* 透明宽路径用于点击 */}
            <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth="15"
                style={{ pointerEvents: disableInteractions ? 'none' : 'stroke', cursor: disableInteractions ? 'default' : 'pointer' }}
                onClick={disableInteractions ? undefined : handleClick}
                onContextMenu={disableInteractions ? undefined : (e) => onContextMenu(e, edge.id)}
            />
            {/* 可见路径 */}
            <path
                d={path}
                fill="none"
                stroke={strokeColor}
                strokeWidth={(isSelected || isContextTarget || hasError) ? 3 : 2}
                markerEnd={markerId}
                style={{ pointerEvents: 'none' }}
            />
        </g>
    );
});

GraphEdge.displayName = 'GraphEdge';

// ========== 边控制组件（标签和手柄） ==========
export interface GraphEdgeControlsProps {
    /** 边数据 */
    edge: IGraphEdge;
    /** 起始节点位置 */
    fromPos: Vector2;
    /** 目标节点位置 */
    toPos: Vector2;
    /** 节点尺寸 */
    nodeDimensions?: NodeDimensions;
    /** 是否选中 */
    isSelected: boolean;
    /** 是否为右键菜单目标 */
    isContextTarget: boolean;
    /** 只读模式 */
    readOnly?: boolean;
    /** 是否有错误 */
    hasError?: boolean;
    /** 错误提示 */
    errorTooltip?: string;
    /** 自定义标签渲染器 */
    renderLabel?: (edge: IGraphEdge) => React.ReactNode;
    /** 默认标签文本（如果没有 renderLabel） */
    defaultLabel?: string;
    /** 是否显示端点手柄 */
    showHandles?: boolean;
    /** 点击选中事件 */
    onSelect: (e: React.MouseEvent, edgeId: string) => void;
    /** 右键菜单事件 */
    onContextMenu: (e: React.MouseEvent, edgeId: string) => void;
    /** 手柄拖拽开始事件 */
    onHandleDown?: (e: React.MouseEvent, edgeId: string, handle: 'source' | 'target') => void;
}

/**
 * 边的 HTML 控制层（标签和手柄）
 */
export const GraphEdgeControls: React.FC<GraphEdgeControlsProps> = React.memo(({
    edge,
    fromPos,
    toPos,
    nodeDimensions,
    isSelected,
    isContextTarget,
    readOnly = false,
    hasError = false,
    errorTooltip,
    renderLabel,
    defaultLabel,
    showHandles = true,
    onSelect,
    onContextMenu,
    onHandleDown
}) => {
    const nodeWidth = nodeDimensions?.width || Geom.STATE_WIDTH;
    const nodeHeight = nodeDimensions?.height || Geom.STATE_ESTIMATED_HEIGHT;

    const fromSide = edge.fromSide || Geom.getClosestSide(fromPos, nodeWidth, nodeHeight, toPos);
    const toSide = edge.toSide || Geom.getClosestSide(toPos, nodeWidth, nodeHeight, fromPos);

    const start = Geom.getNodeAnchor(fromPos, nodeWidth, nodeHeight, fromSide);
    const end = Geom.getNodeAnchor(toPos, nodeWidth, nodeHeight, toSide);
    const mid = Geom.getBezierMidPoint(start, end, fromSide, toSide);

    // 标签样式
    const labelBg = hasError
        ? 'var(--accent-error, #ef4444)'
        : isContextTarget
            ? 'var(--accent-warning)'
            : isSelected
                ? 'var(--accent-color)'
                : '#252526';

    const labelBorder = hasError ? '1px solid #b91c1c' : '1px solid #444';

    return (
        <>
            {/* 标签 */}
            <div
                onClick={(e) => { e.stopPropagation(); onSelect(e, edge.id); }}
                onContextMenu={(e) => onContextMenu(e, edge.id)}
                title={hasError ? errorTooltip : undefined}
                style={{
                    position: 'absolute',
                    left: mid.x,
                    top: mid.y,
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: labelBg,
                    border: labelBorder,
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '10px',
                    color: (isSelected || isContextTarget || hasError) ? '#fff' : '#ccc',
                    cursor: 'pointer',
                    zIndex: 30,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}
            >
                {hasError && <span style={{ fontSize: '10px' }}>⚠</span>}
                {renderLabel ? renderLabel(edge) : defaultLabel || edge.id}
            </div>

            {/* 端点手柄 */}
            {!readOnly && showHandles && onHandleDown && (
                <>
                    <div
                        className="handle"
                        style={{ left: start.x, top: start.y, zIndex: 31 }}
                        onMouseDown={(e) => { e.stopPropagation(); onHandleDown(e, edge.id, 'source'); }}
                    />
                    <div
                        className="handle"
                        style={{ left: end.x, top: end.y, zIndex: 31 }}
                        onMouseDown={(e) => { e.stopPropagation(); onHandleDown(e, edge.id, 'target'); }}
                    />
                </>
            )}
        </>
    );
});

GraphEdgeControls.displayName = 'GraphEdgeControls';

export default GraphEdge;

