/**
 * TransitionsLayer.tsx - 连线渲染层组件
 * 负责渲染 FSM 中所有的 Transition 连线（SVG + HTML 控件）
 */

import React from 'react';
import { Transition, State } from '../../../types/stateMachine';
import { Side } from '../../../types/common';
import * as Geom from '../../../utils/geometry';
import { ConnectionLine, ConnectionControls } from './ConnectionLine';
import { TransitionValidation } from '../../../utils/fsmValidation';

/** SVG 连线层 Props */
interface TransitionsSvgLayerProps {
    /** FSM transitions 数据 */
    transitions: Record<string, Transition>;
    /** FSM states 数据 */
    states: Record<string, State>;
    /** 当前修改连线状态 */
    modifyingTransition: { id: string; handle: 'source' | 'target' } | null;
    /** 获取节点显示位置 */
    getNodeDisplayPosition: (nodeId: string, originalPos: { x: number; y: number }) => { x: number; y: number };
    /** 当前选中对象 */
    selection: { type: string; id: string | null };
    /** 右键菜单目标 */
    contextMenuTarget?: { type: string; targetId?: string } | null;
    /** 校验结果 */
    validationResults: Record<string, TransitionValidation>;
    /** PuzzleNode ID (用于 contextId) */
    nodeId: string;
    /** 选中连线 */
    onSelect: (e: React.MouseEvent, id: string) => void;
    /** 右键菜单 */
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    /** 开始修改连线端点 */
    onHandleDown: (e: React.MouseEvent, id: string, type: 'source' | 'target') => void;
    /** 剪断连线 */
    onCut: (e: React.MouseEvent, id: string) => void;
}

/**
 * SVG 连线层 - 渲染所有 Transition 的贝塞尔曲线
 */
export const TransitionsSvgLayer: React.FC<TransitionsSvgLayerProps> = ({
    transitions,
    states,
    modifyingTransition,
    getNodeDisplayPosition,
    selection,
    contextMenuTarget,
    validationResults,
    nodeId,
    onSelect,
    onContextMenu,
    onHandleDown,
    onCut
}) => {
    return (
        <>
            {Object.values(transitions).map((trans: Transition) => {
                const isModifying = modifyingTransition?.id === trans.id;
                const fromState = states[trans.fromStateId];
                const toState = states[trans.toStateId];

                if (!fromState || !toState) return null;

                const fromPos = getNodeDisplayPosition(trans.fromStateId, fromState.position || { x: 0, y: 0 });
                const toPos = getNodeDisplayPosition(trans.toStateId, toState.position || { x: 0, y: 0 });

                const transValidation = validationResults[trans.id];

                return (
                    <ConnectionLine
                        key={trans.id}
                        transition={trans}
                        fromState={fromState}
                        toState={toState}
                        isSelected={selection.type === 'TRANSITION' && selection.id === trans.id}
                        isContextTarget={contextMenuTarget?.type === 'TRANSITION' && contextMenuTarget?.targetId === trans.id}
                        isModifying={isModifying}
                        fromPos={fromPos}
                        toPos={toPos}
                        onSelect={(e, id) => onSelect(e, id)}
                        onContextMenu={(e, id) => onContextMenu(e, id)}
                        onHandleDown={(e, id, type) => onHandleDown(e, id, type)}
                        onCut={(e, id) => onCut(e, id)}
                        hasError={transValidation?.hasError}
                    />
                );
            })}
        </>
    );
};

/** 临时连线 Props */
interface TempConnectionLineProps {
    /** 连线状态 */
    linkingState: { nodeId: string } | null;
    /** 修改连线状态 */
    modifyingTransition: { id: string; handle: 'source' | 'target' } | null;
    /** FSM transitions */
    transitions: Record<string, Transition>;
    /** FSM states */
    states: Record<string, State>;
    /** 吸附点 */
    activeSnapPoint: { x: number; y: number; side: Side } | null;
    /** 鼠标位置 */
    mousePos: { x: number; y: number };
    /** 获取节点显示位置 */
    getNodeDisplayPosition: (nodeId: string, originalPos: { x: number; y: number }) => { x: number; y: number };
}

/**
 * 临时连线 - 连线创建/修改时的虚线预览
 */
export const TempConnectionLine: React.FC<TempConnectionLineProps> = ({
    linkingState,
    modifyingTransition,
    transitions,
    states,
    activeSnapPoint,
    mousePos,
    getNodeDisplayPosition
}) => {
    if (!linkingState && !modifyingTransition) return null;

    const mouseOrSnap = activeSnapPoint ? { x: activeSnapPoint.x, y: activeSnapPoint.y } : mousePos;

    let p1 = mouseOrSnap;
    let p2 = mouseOrSnap;
    let sSide: Side = 'right';
    let eSide: Side = 'left';

    if (linkingState) {
        const sourceState = states[linkingState.nodeId];
        if (!sourceState) return null;

        const sourcePos = getNodeDisplayPosition(linkingState.nodeId, sourceState.position);
        sSide = Geom.getClosestSide(sourcePos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, mouseOrSnap);
        p1 = Geom.getNodeAnchor(sourcePos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, sSide);
        p2 = mouseOrSnap;
        eSide = activeSnapPoint ? activeSnapPoint.side : Geom.getNaturalEnteringSide(p1, p2);
    } else if (modifyingTransition) {
        const trans = transitions[modifyingTransition.id];
        if (!trans) return null;

        if (modifyingTransition.handle === 'target') {
            const fromState = states[trans.fromStateId];
            if (!fromState) return null;

            const sourcePos = getNodeDisplayPosition(trans.fromStateId, fromState.position);
            sSide = trans.fromSide || Geom.getClosestSide(sourcePos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, mouseOrSnap);
            p1 = Geom.getNodeAnchor(sourcePos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, sSide);
            p2 = mouseOrSnap;
            eSide = activeSnapPoint ? activeSnapPoint.side : Geom.getNaturalEnteringSide(p1, p2);
        } else {
            const toState = states[trans.toStateId];
            if (!toState) return null;

            const destPos = getNodeDisplayPosition(trans.toStateId, toState.position);
            eSide = trans.toSide || Geom.getClosestSide(destPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, mouseOrSnap);
            p2 = Geom.getNodeAnchor(destPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, eSide);
            p1 = mouseOrSnap;
            sSide = activeSnapPoint
                ? activeSnapPoint.side
                : Geom.getClosestSide(
                    { x: p1.x - Geom.STATE_WIDTH / 2, y: p1.y - Geom.STATE_ESTIMATED_HEIGHT / 2 } as any,
                    Geom.STATE_WIDTH,
                    Geom.STATE_ESTIMATED_HEIGHT,
                    p2
                );
        }
    }

    return (
        <path
            d={Geom.getBezierPathData(p1, p2, sSide, eSide)}
            fill="none"
            stroke="#888"
            strokeWidth="2"
            strokeDasharray="5,5"
            markerEnd="url(#arrow-temp)"
        />
    );
};

/** HTML 控件层 Props */
interface TransitionsControlsLayerProps {
    /** FSM transitions 数据 */
    transitions: Record<string, Transition>;
    /** FSM states 数据 */
    states: Record<string, State>;
    /** 当前修改连线状态 */
    modifyingTransition: { id: string; handle: 'source' | 'target' } | null;
    /** 获取节点显示位置 */
    getNodeDisplayPosition: (nodeId: string, originalPos: { x: number; y: number }) => { x: number; y: number };
    /** 当前选中对象 */
    selection: { type: string; id: string | null };
    /** 右键菜单目标 */
    contextMenuTarget?: { type: string; targetId?: string } | null;
    /** 校验结果 */
    validationResults: Record<string, TransitionValidation>;
    /** PuzzleNode ID */
    nodeId: string;
    /** 只读模式 */
    readOnly?: boolean;
    /** 选中连线 */
    onSelect: (e: React.MouseEvent, id: string) => void;
    /** 右键菜单 */
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    /** 开始修改连线端点 */
    onHandleDown: (e: React.MouseEvent, id: string, type: 'source' | 'target') => void;
}

/**
 * HTML 控件层 - 渲染连线的标签和拖拽手柄
 */
export const TransitionsControlsLayer: React.FC<TransitionsControlsLayerProps> = ({
    transitions,
    states,
    modifyingTransition,
    getNodeDisplayPosition,
    selection,
    contextMenuTarget,
    validationResults,
    nodeId,
    readOnly = false,
    onSelect,
    onContextMenu,
    onHandleDown
}) => {
    return (
        <>
            {Object.values(transitions).map((trans: Transition) => {
                if (modifyingTransition?.id === trans.id) return null;

                const fromState = states[trans.fromStateId];
                const toState = states[trans.toStateId];
                if (!fromState || !toState) return null;

                const fromPos = getNodeDisplayPosition(trans.fromStateId, fromState.position);
                const toPos = getNodeDisplayPosition(trans.toStateId, toState.position);

                const transValidation = validationResults[trans.id];
                const errorTooltip = transValidation?.hasError
                    ? transValidation.issues.map(i => i.message).join('\n')
                    : undefined;

                return (
                    <ConnectionControls
                        key={`ctrl-${trans.id}`}
                        transition={trans}
                        fromPos={fromPos}
                        toPos={toPos}
                        isSelected={selection.type === 'TRANSITION' && selection.id === trans.id}
                        isContextTarget={contextMenuTarget?.type === 'TRANSITION' && contextMenuTarget?.targetId === trans.id}
                        onSelect={(e, id) => onSelect(e, id)}
                        onContextMenu={(e, id) => onContextMenu(e, id)}
                        onHandleDown={(e, id, type) => {
                            e.stopPropagation();
                            onHandleDown(e, id, type);
                        }}
                        readOnly={readOnly}
                        hasError={transValidation?.hasError}
                        errorTooltip={errorTooltip}
                    />
                );
            })}
        </>
    );
};
