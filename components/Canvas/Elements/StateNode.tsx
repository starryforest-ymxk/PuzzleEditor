import { GraphNode } from '../shared/GraphNode';

import React from 'react';
import { State } from '../../../types/stateMachine';
import * as Geom from '../../../utils/geometry';

interface Props {
  state: State;
  position: { x: number; y: number };
  isSelected: boolean;
  isMultiSelected?: boolean; // 框选多选状态
  isInitial: boolean;
  isContextTarget: boolean;
  onMouseDown: (e: React.MouseEvent, stateId: string) => void;
  onMouseUp: (e: React.MouseEvent, stateId: string) => void;
  onContextMenu: (e: React.MouseEvent, stateId: string) => void;
  readOnly?: boolean;
  /** 是否存在校验错误（引用已删除资源） */
  hasError?: boolean;
  hasWarning?: boolean;
  /** 错误提示信息 */
  errorTooltip?: string;
  warningTooltip?: string;
}

// FSM 适配层仅提供业务数据和尺寸，外壳统一交给 GraphNode。
export const StateNode = React.memo(({ state, ...props }: Props) => (
  <GraphNode
    {...props}
    node={state}
    variant="fsm"
    dimensions={{ width: Geom.STATE_WIDTH, height: Geom.STATE_ESTIMATED_HEIGHT }}
  />
));
StateNode.displayName = 'StateNode';
