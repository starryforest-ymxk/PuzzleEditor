/**
 * hooks/useLineCutting.ts
 * 切线模式 Hook
 * 从 StateMachineCanvas.tsx 拆分而来，处理 Ctrl+拖拽切断连线的逻辑
 */

import { useState, useRef, useEffect } from 'react';
import { Transition } from '../types/stateMachine';
import * as Geom from '../utils/geometry';

interface CuttingLine {
    start: { x: number; y: number };
    end: { x: number; y: number };
}

interface UseLineCuttingOptions {
    /** 获取本地坐标的函数 */
    getLocalCoordinates: (clientX: number, clientY: number) => { x: number; y: number };
    /** 获取节点显示位置的函数 */
    getNodeDisplayPosition: (nodeId: string, position: { x: number; y: number }) => { x: number; y: number };
    /** 所有转移 */
    transitions: Record<string, Transition>;
    /** 所有状态 */
    states: Record<string, { position: { x: number; y: number } }>;
    /** 删除转移的回调 */
    onDeleteTransition: (transitionId: string) => void;
    /** 是否只读模式 */
    readOnly: boolean;
}

interface UseLineCuttingReturn {
    /** 是否处于切线模式（Ctrl键按下） */
    isLineCuttingMode: boolean;
    /** 当前切线的起点和终点 */
    cuttingLine: CuttingLine | null;
    /** 开始切线拖拽 */
    startCutting: (clientX: number, clientY: number) => void;
    /** 是否正在切线 */
    isCutting: boolean;
}

/**
 * 切线模式 Hook
 * 处理 Ctrl+拖拽切断连线的交互逻辑
 */
export const useLineCutting = ({
    getLocalCoordinates,
    getNodeDisplayPosition,
    transitions,
    states,
    onDeleteTransition,
    readOnly
}: UseLineCuttingOptions): UseLineCuttingReturn => {
    // Ctrl键切线模式状态
    const [isLineCuttingMode, setIsLineCuttingMode] = useState(false);
    // 切线拖拽状态
    const [cuttingLine, setCuttingLine] = useState<CuttingLine | null>(null);
    const cuttingPrevPos = useRef<{ x: number; y: number } | null>(null);
    const cutTransitionsSet = useRef<Set<string>>(new Set());

    // 监听 Ctrl 键
    useEffect(() => {
        if (readOnly) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsLineCuttingMode(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsLineCuttingMode(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [readOnly]);

    // 开始切线
    const startCutting = (clientX: number, clientY: number) => {
        if (readOnly) return;
        const pos = getLocalCoordinates(clientX, clientY);
        setCuttingLine({ start: pos, end: pos });
        cuttingPrevPos.current = pos;
        cutTransitionsSet.current = new Set();
    };

    // 切线拖拽的鼠标移动和抬起处理
    useEffect(() => {
        if (!cuttingLine) return;

        const handleMouseMove = (e: MouseEvent) => {
            const pos = getLocalCoordinates(e.clientX, e.clientY);
            setCuttingLine(prev => prev ? { ...prev, end: pos } : null);

            // 检测与连线的交点
            if (cuttingPrevPos.current && transitions) {
                const prevPos = cuttingPrevPos.current;

                Object.values(transitions).forEach((trans: Transition) => {
                    // 已经标记过的不再检测
                    if (cutTransitionsSet.current.has(trans.id)) return;

                    const fromState = states[trans.fromStateId];
                    const toState = states[trans.toStateId];
                    if (!fromState || !toState) return;

                    const fromPos = getNodeDisplayPosition(trans.fromStateId, fromState.position);
                    const toPos = getNodeDisplayPosition(trans.toStateId, toState.position);

                    const fromSide = trans.fromSide || Geom.getClosestSide(fromPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, toPos);
                    const toSide = trans.toSide || Geom.getClosestSide(toPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, fromPos);

                    const curveStart = Geom.getNodeAnchor(fromPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, fromSide);
                    const curveEnd = Geom.getNodeAnchor(toPos, Geom.STATE_WIDTH, Geom.STATE_ESTIMATED_HEIGHT, toSide);

                    if (Geom.doesLineIntersectBezier(prevPos, pos, curveStart, curveEnd, fromSide, toSide)) {
                        cutTransitionsSet.current.add(trans.id);
                    }
                });
            }

            cuttingPrevPos.current = pos;
        };

        const handleMouseUp = () => {
            // 释放鼠标时执行删除
            if (cutTransitionsSet.current.size > 0) {
                cutTransitionsSet.current.forEach(transId => {
                    onDeleteTransition(transId);
                });
            }
            setCuttingLine(null);
            cuttingPrevPos.current = null;
            cutTransitionsSet.current = new Set();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [cuttingLine, transitions, states, getLocalCoordinates, getNodeDisplayPosition, onDeleteTransition]);

    return {
        isLineCuttingMode,
        cuttingLine,
        startCutting,
        isCutting: cuttingLine !== null
    };
};
