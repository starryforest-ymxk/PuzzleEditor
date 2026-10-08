import React from 'react';
import { IGraphNode, NodeDimensions } from '../../../types/graphCore';
import { Vector2 } from '../../../types/common';
import '../../shared/ui.css';
export const DEFAULT_NODE_DIMENSIONS: NodeDimensions = { width: 160, height: 80, minHeight: 68 };
export interface GraphNodeProps {
  variant?: 'fsm' | 'presentation';
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
  hasWarning?: boolean;
  /** 错误提示信息 */
  errorTooltip?: string;
  warningTooltip?: string;
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

// 两种画布共用节点外壳，主题差异通过声明式 variant 表达。
export const GraphNode: React.FC<GraphNodeProps> = React.memo(
  ({
    node,
    position,
    dimensions = DEFAULT_NODE_DIMENSIONS,
    variant = 'presentation',
    isSelected,
    isMultiSelected = false,
    isInitial,
    isContextTarget,
    readOnly = false,
    hasError = false,
    hasWarning = false,
    errorTooltip,
    warningTooltip,
    renderContent,
    renderTitle,
    className = '',
    onMouseDown,
    onMouseUp,
    onContextMenu,
  }) => {
    const shadows: string[] = [];
    if (hasError) shadows.push('0 0 0 2px var(--accent-error)');
    else if (hasWarning) shadows.push('0 0 0 2px var(--accent-warning)');
    const spread = hasError || hasWarning ? 4 : 2;
    if (isSelected || isMultiSelected)
      shadows.push('0 0 0 ' + spread + 'px var(--graph-selection)');
    else if (isContextTarget) shadows.push('0 0 0 ' + spread + 'px var(--accent-warning)');
    shadows.push('var(--shadow-md)');
    return (
      <div
        data-node-id={node.id}
        data-variant={variant}
        data-multi={isMultiSelected}
        data-tone={hasError ? 'error' : hasWarning ? 'warning' : isInitial ? 'initial' : 'default'}
        className={'ui-graph-node ' + className}
        onMouseDown={(e) => onMouseDown(e, node.id)}
        onMouseUp={(e) => onMouseUp(e, node.id)}
        onContextMenu={(e) => onContextMenu(e, node.id)}
        onClick={(e) => e.stopPropagation()}
        title={hasError ? errorTooltip : hasWarning ? warningTooltip : undefined}
        style={{
          left: position.x,
          top: position.y,
          width: dimensions.width,
          minHeight: dimensions.minHeight,
          boxShadow: shadows.join(', '),
          cursor: readOnly ? 'pointer' : 'grab',
        }}
      >
        <div className="ui-graph-node__title">
          {hasError && <span className="ui-graph-node__icon ui-graph-node__icon--error">⚠</span>}
          {!hasError && hasWarning && (
            <span className="ui-graph-node__icon ui-graph-node__icon--warning">⚠</span>
          )}
          {isInitial && !hasError && <span className="ui-graph-node__initial">{'>'}</span>}
          {renderTitle ? (
            renderTitle(node)
          ) : (
            <span className="ui-graph-node__name">{node.name}</span>
          )}
        </div>
        <div className="ui-graph-node__body">
          {renderContent ? renderContent(node) : node.description || 'No description'}
        </div>
      </div>
    );
  },
);
GraphNode.displayName = 'GraphNode';
export default GraphNode;
