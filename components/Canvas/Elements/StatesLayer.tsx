/**
 * StatesLayer.tsx - 状态节点渲染层组件
 * 负责渲染 FSM 中所有的 State 节点
 */

import React from 'react';
import { State } from '../../../types/stateMachine';
import { StateNode } from './StateNode';
import { StateValidation } from '../../../utils/fsmValidation';

/** Props */
interface StatesLayerProps {
    /** FSM states 数据 */
    states: Record<string, State>;
    /** 初始状态 ID */
    initialStateId: string | null;
    /** 多选状态 ID 列表 */
    multiSelectIds: string[];
    /** 当前选中对象 */
    selection: { type: string; id: string | null };
    /** 右键菜单目标 */
    contextMenuTarget?: { type: string; targetId?: string } | null;
    /** 校验结果 */
    validationResults: Record<string, StateValidation>;
    /** 只读模式 */
    readOnly?: boolean;
    /** 获取节点显示位置 */
    getNodeDisplayPosition: (nodeId: string, originalPos: { x: number; y: number }) => { x: number; y: number };
    /** 鼠标按下 */
    onMouseDown: (e: React.MouseEvent, stateId: string) => void;
    /** 鼠标抬起 */
    onMouseUp: (e: React.MouseEvent, stateId: string) => void;
    /** 右键菜单 */
    onContextMenu: (e: React.MouseEvent, stateId: string) => void;
}

/**
 * 状态节点渲染层
 * 职责：遍历渲染所有 State 节点，传递校验结果和交互回调
 */
export const StatesLayer: React.FC<StatesLayerProps> = ({
    states,
    initialStateId,
    multiSelectIds,
    selection,
    contextMenuTarget,
    validationResults,
    readOnly = false,
    getNodeDisplayPosition,
    onMouseDown,
    onMouseUp,
    onContextMenu
}) => {
    return (
        <>
            {Object.values(states).map((state: State) => {
                const stateValidation = validationResults[state.id];
                const errorTooltip = stateValidation?.hasError
                    ? stateValidation.issues.filter(i => i.type === 'error').map(i => i.message).join('\n')
                    : undefined;
                const warningTooltip = stateValidation?.hasWarning
                    ? stateValidation.issues.filter(i => i.type === 'warning').map(i => i.message).join('\n')
                    : undefined;

                return (
                    <StateNode
                        key={state.id}
                        state={state}
                        position={getNodeDisplayPosition(state.id, state.position)}
                        isSelected={selection.type === 'STATE' && selection.id === state.id}
                        isMultiSelected={multiSelectIds.includes(state.id)}
                        isInitial={initialStateId === state.id}
                        isContextTarget={contextMenuTarget?.type === 'NODE' && contextMenuTarget?.targetId === state.id}
                        onMouseDown={onMouseDown}
                        onMouseUp={onMouseUp}
                        onContextMenu={(e) => onContextMenu(e, state.id)}
                        readOnly={readOnly}
                        hasError={stateValidation?.hasError}
                        hasWarning={stateValidation?.hasWarning}
                        errorTooltip={errorTooltip}
                        warningTooltip={warningTooltip}
                    />
                );
            })}
        </>
    );
};
