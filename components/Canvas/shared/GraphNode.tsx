/**
 * components/Canvas/shared/GraphNode.tsx
 * 通用图节点组件 - 可被 FSM 和演出图复用
 * 
 * 设计原则：
 * 1. 接收通用 IGraphNode 数据，通过 renderContent 自定义内容
 * 2. 复用 StateNode 的样式和交互模式
 * 3. 支持选中、多选、错误、初始节点等状态
 */

import React from 'react';
import { IGraphNode, NodeDimensions } from '../../../types/graphCore';
import { Vector2 } from '../../../types/common';

// ========== 默认节点尺寸 ==========
export const DEFAULT_NODE_DIMENSIONS: NodeDimensions = {
    width: 160,
    height: 80,
    minHeight: 68
};

// ========== Props 定义 ==========
export interface GraphNodeProps {
    /** 节点数据 */
    node: IGraphNode;
    /** 显示位置（可能是拖拽中的临时位置） */
    position: Vector2;
    /** 节点尺寸配置 */
    dimensions?: NodeDimensions;
    /** 是否选中 */
    isSelected: boolean;
    /** 是否多选（框选） */
    isMultiSelected?: boolean;
    /** 是否为初始/起始节点 */
    isInitial: boolean;
    /** 是否为右键菜单目标 */
    isContextTarget: boolean;
    /** 只读模式 */
    readOnly?: boolean;
    /** 是否有校验错误 */
    hasError?: boolean;
    /** 错误提示信息 */
    errorTooltip?: string;
    /** 自定义内容渲染器 */
    renderContent?: (node: IGraphNode) => React.ReactNode;
    /** 自定义标题渲染器 */
    renderTitle?: (node: IGraphNode) => React.ReactNode;
    /** 自定义样式类名 */
    className?: string;
    /** 节点鼠标按下事件 */
    onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
    /** 节点鼠标抬起事件 */
    onMouseUp: (e: React.MouseEvent, nodeId: string) => void;
    /** 右键菜单事件 */
    onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
}

/**
 * 通用图节点组件
 * 可用于 FSM State 和演出图 PresentationNode 的渲染
 */
export const GraphNode: React.FC<GraphNodeProps> = React.memo(({
    node,
    position,
    dimensions = DEFAULT_NODE_DIMENSIONS,
    isSelected,
    isMultiSelected = false,
    isInitial,
    isContextTarget,
    readOnly = false,
    hasError = false,
    errorTooltip,
    renderContent,
    renderTitle,
    className,
    onMouseDown,
    onMouseUp,
    onContextMenu
}) => {
    // 计算边框阴影样式
    const getBoxShadow = (): string => {
        if (hasError) {
            return '0 0 0 2px var(--accent-error, #ef4444), var(--shadow-md)';
        }
        if (isContextTarget) {
            return '0 0 0 2px var(--accent-warning), var(--shadow-md)';
        }
        if (isMultiSelected) {
            // 框选高亮使用粉色描边
            return '0 0 0 2px #f472b6, var(--shadow-md)';
        }
        if (isSelected) {
            return '0 0 0 2px var(--selection-border), var(--shadow-md)';
        }
        return 'var(--shadow-md)';
    };

    // 计算标题栏背景
    const getTitleBackground = (): string => {
        if (hasError) {
            return 'linear-gradient(90deg, #3f1515, #2d2d2d)';
        }
        if (isInitial) {
            return 'linear-gradient(90deg, #4a2a4a, #2d2d2d)';
        }
        return '#383838';
    };

    return (
        <div
            data-node-id={node.id}
            className={className}
            onMouseDown={(e) => onMouseDown(e, node.id)}
            onMouseUp={(e) => onMouseUp(e, node.id)}
            onContextMenu={(e) => onContextMenu(e, node.id)}
            onClick={(e) => e.stopPropagation()}
            title={hasError ? errorTooltip : undefined}
            style={{
                position: 'absolute',
                left: position.x,
                top: position.y,
                width: dimensions.width,
                minHeight: dimensions.minHeight,
                borderRadius: '6px',
                backgroundColor: isMultiSelected ? '#33212d' : '#27272a',
                boxShadow: getBoxShadow(),
                zIndex: 10,
                cursor: readOnly ? 'pointer' : 'grab',
                transform: 'translate3d(0,0,0)',
                transition: 'box-shadow 0.1s, background-color 0.1s'
            }}
        >
            {/* 标题栏 */}
            <div style={{
                height: 28,
                background: getTitleBackground(),
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
                {/* 初始节点指示器 */}
                {isInitial && !hasError && (
                    <span style={{ color: '#c586c0', marginRight: '4px' }}>{'>'}</span>
                )}
                {/* 标题内容 */}
                {renderTitle ? (
                    renderTitle(node)
                ) : (
                    <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1
                    }}>
                        {node.name}
                    </span>
                )}
            </div>

            {/* 内容区域 */}
            <div style={{
                padding: '8px',
                minHeight: 40,
                fontSize: '11px',
                color: '#aaa'
            }}>
                {renderContent ? (
                    renderContent(node)
                ) : (
                    node.description || 'No description'
                )}
            </div>
        </div>
    );
});

// 为 React DevTools 设置 displayName
GraphNode.displayName = 'GraphNode';

export default GraphNode;

