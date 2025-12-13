/**
 * useCuttingLine.ts - 剪线交互逻辑 Hook
 * 处理 Ctrl + 拖拽 切断连线的完整逻辑
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Transition } from '../types/stateMachine';
import * as Geom from '../utils/geometry';

/** 剪线状态：起点和终点坐标 */
export interface CuttingLineState {
    start: { x: number; y: number };
    end: { x: number; y: number };
}

/** Hook 参数 */
interface UseCuttingLineOptions {
    /** 获取画布局部坐标的函数 */
    getLocalCoordinates: (clientX: number, clientY: number) => { x: number; y: number };
    /** FSM transitions 数据 */
    transitions: Record<string, Transition>;
    /** FSM states 数据 */
    states: Record<string, { position: { x: number; y: number } }>;
    /** 获取节点显示位置（考虑拖拽偏移） */
    getNodeDisplayPosition: (nodeId: string, originalPos: { x: number; y: number }) => { x: number; y: number };
    /** 删除连线的回调 */
    onDeleteTransition: (transitionId: string) => void;
    /** 只读模式 */
    readOnly?: boolean;
}

/** Hook 返回值 */
interface UseCuttingLineReturn {
    /** 当前剪线状态 */
    cuttingLine: CuttingLineState | null;
    /** 开始剪线：在 Ctrl+mousedown 时调用 */
    startCutting: (clientX: number, clientY: number) => void;
    /** 是否处于剪线模式（Ctrl 按住） */
    isLineCuttingMode: boolean;
    /** 设置剪线模式提示 */
    setIsLineCuttingMode: (value: boolean) => void;
}

/**
 * 剪线交互逻辑 Hook
 * 职责：
 * 1. 管理剪线状态（起点/终点）
 * 2. 检测剪线路径与连线的碰撞
 * 3. 在 mouseup 时执行批量删除
 */
export function useCuttingLine({
    getLocalCoordinates,
    transitions,
    states,
    getNodeDisplayPosition,
    onDeleteTransition,
    readOnly = false
}: UseCuttingLineOptions): UseCuttingLineReturn {
    // 剪线模式提示（Ctrl 按住时显示）
    const [isLineCuttingMode, setIsLineCuttingMode] = useState(false);

    // 剪线拖拽状态：记录起点/终点
    const [cuttingLine, setCuttingLine] = useState<CuttingLineState | null>(null);

    // 前一帧位置：用于计算线段移动
    const cuttingPrevPos = useRef<{ x: number; y: number } | null>(null);

    // 已检测到碰撞的连线 ID 集合（避免重复删除）
    const cutTransitionsSet = useRef<Set<string>>(new Set());

    /**
     * 开始剪线：记录起点
     */
    const startCutting = useCallback((clientX: number, clientY: number) => {
        if (readOnly) return;
        const pos = getLocalCoordinates(clientX, clientY);
        setCuttingLine({ start: pos, end: pos });
        cuttingPrevPos.current = pos;
        cutTransitionsSet.current = new Set();
        // 开发调试日志
        if (import.meta.env.DEV) {
            console.log('[Cutting] Started at', pos);
        }
    }, [getLocalCoordinates, readOnly]);

    /**
     * 剪线拖拽的鼠标移动和抬起处理
     */
    useEffect(() => {
        if (!cuttingLine) return;

        const handleMouseMove = (e: MouseEvent) => {
            const pos = getLocalCoordinates(e.clientX, e.clientY);
            setCuttingLine(prev => (prev ? { ...prev, end: pos } : null));

            // 检测剪线路径与连线的碰撞
            if (cuttingPrevPos.current && transitions && states) {
                const prevPos = cuttingPrevPos.current;

                Object.values(transitions).forEach((trans: Transition) => {
                    // 已标记的跳过
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

                    // 检测剪线段与贝塞尔曲线是否相交
                    if (Geom.doesLineIntersectBezier(prevPos, pos, curveStart, curveEnd, fromSide, toSide)) {
                        cutTransitionsSet.current.add(trans.id);
                    }
                });
            }

            cuttingPrevPos.current = pos;
        };

        const handleMouseUp = () => {
            // 批量删除所有被剪断的连线
            if (cutTransitionsSet.current.size > 0) {
                cutTransitionsSet.current.forEach(transId => {
                    onDeleteTransition(transId);
                });
            }
            // 重置状态
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
        cuttingLine,
        startCutting,
        isLineCuttingMode,
        setIsLineCuttingMode
    };
}
