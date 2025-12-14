/**
 * 几何计算工具库
 * 提供画布元素定位、连线绘制等几何计算功能
 */

import { Side } from '../types/common';
import { STATE_NODE } from './constants';

// ========== 常量定义 ==========
/** 状态节点默认宽度（与 constants.STATE_NODE 保持一致） */
export const STATE_WIDTH = STATE_NODE.WIDTH;
/** 状态节点预估高度（与 constants.STATE_NODE 保持一致） */
export const STATE_ESTIMATED_HEIGHT = STATE_NODE.ESTIMATED_HEIGHT;
/** 演出节点宽度 */
export const NODE_WIDTH = 160;
/** 演出节点高度 */
export const NODE_HEIGHT = 50;
/** 贝塞尔曲线最小控制点距离 */
export const MIN_CONTROL_DISTANCE = 60;
/** 贝塞尔曲线控制点距离系数 */
export const CONTROL_DISTANCE_FACTOR = 0.4;

// ========== 类型定义 ==========
export interface Point {
    x: number;
    y: number;
}

export interface ControlPoints {
    cp1: Point;
    cp2: Point;
}

// ========== 基础几何计算 ==========
/**
 * 计算矩形节点的中心点
 */
export const getNodeCenter = (pos: Point, width: number, height: number): Point => ({
    x: pos.x + width / 2,
    y: pos.y + height / 2
});

/**
 * 根据角度判断目标点相对于节点最近的边
 */
export const getClosestSide = (nodePos: Point, width: number, height: number, target: Point): Side => {
    const center = getNodeCenter(nodePos, width, height);
    const dx = target.x - center.x;
    const dy = target.y - center.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    if (angle >= -45 && angle < 45) return 'right';
    if (angle >= 45 && angle < 135) return 'bottom';
    if (angle >= -135 && angle < -45) return 'top';
    return 'left';
};

/**
 * 确定连线进入节点时的自然方向
 * 例如：从左边进入时，应该连接到 'left' 边
 */
export const getNaturalEnteringSide = (origin: Point, target: Point): Side => {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    if (angle > -45 && angle <= 45) return 'left';
    if (angle > 45 && angle <= 135) return 'top';
    if (angle > 135 || angle <= -135) return 'right';
    return 'bottom';
};

/**
 * 计算节点指定边的锚点坐标
 */
export const getNodeAnchor = (nodePos: Point, width: number, height: number, side: Side): Point => {
    switch (side) {
        case 'top': return { x: nodePos.x + width / 2, y: nodePos.y };
        case 'bottom': return { x: nodePos.x + width / 2, y: nodePos.y + height };
        case 'left': return { x: nodePos.x, y: nodePos.y + height / 2 };
        case 'right': return { x: nodePos.x + width, y: nodePos.y + height / 2 };
        default: return { x: nodePos.x + width / 2, y: nodePos.y + height / 2 };
    }
};

// ========== 贝塞尔曲线计算（核心优化：消除重复代码）==========

/**
 * 根据边方向获取控制点偏移量
 * @internal
 */
const getControlOffset = (side: Side, amount: number): Point => {
    switch (side) {
        case 'top': return { x: 0, y: -amount };
        case 'bottom': return { x: 0, y: amount };
        case 'left': return { x: -amount, y: 0 };
        case 'right': return { x: amount, y: 0 };
    }
};

/**
 * 计算贝塞尔曲线的控制点
 * 这是一个共享函数，避免在 getBezierPathData 和 getBezierMidPoint 中重复计算
 */
export const calculateControlPoints = (p1: Point, p2: Point, sSide: Side, eSide: Side): ControlPoints => {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const controlDist = Math.max(dist * CONTROL_DISTANCE_FACTOR, MIN_CONTROL_DISTANCE);

    const offset1 = getControlOffset(sSide, controlDist);
    const offset2 = getControlOffset(eSide, controlDist);

    return {
        cp1: { x: p1.x + offset1.x, y: p1.y + offset1.y },
        cp2: { x: p2.x + offset2.x, y: p2.y + offset2.y }
    };
};

/**
 * 生成 SVG 三次贝塞尔曲线路径字符串
 */
export const getBezierPathData = (p1: Point, p2: Point, sSide: Side, eSide: Side): string => {
    const { cp1, cp2 } = calculateControlPoints(p1, p2, sSide, eSide);
    return `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`;
};

/**
 * 计算贝塞尔曲线的中点（用于标签定位）
 * 使用 t=0.5 的三次贝塞尔曲线公式
 */
export const getBezierMidPoint = (p1: Point, p2: Point, sSide: Side, eSide: Side): Point => {
    const { cp1, cp2 } = calculateControlPoints(p1, p2, sSide, eSide);

    // 三次贝塞尔曲线公式 t = 0.5
    const t = 0.5;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
        x: mt3 * p1.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p2.x,
        y: mt3 * p1.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p2.y
    };
};

/**
 * 计算贝塞尔曲线上任意位置的点
 * @param t 参数 (0-1)
 */
export const getBezierPointAtT = (p1: Point, p2: Point, sSide: Side, eSide: Side, t: number): Point => {
    const { cp1, cp2 } = calculateControlPoints(p1, p2, sSide, eSide);

    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
        x: mt3 * p1.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p2.x,
        y: mt3 * p1.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p2.y
    };
};

// ========== 线段相交检测（用于切线功能）==========

/**
 * 检测两条线段是否相交
 * 使用叉积方法
 */
export const doLineSegmentsIntersect = (
    a1: Point, a2: Point,
    b1: Point, b2: Point
): boolean => {
    const ccw = (p1: Point, p2: Point, p3: Point): number => {
        return (p3.y - p1.y) * (p2.x - p1.x) - (p2.y - p1.y) * (p3.x - p1.x);
    };

    const d1 = ccw(b1, b2, a1);
    const d2 = ccw(b1, b2, a2);
    const d3 = ccw(a1, a2, b1);
    const d4 = ccw(a1, a2, b2);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return true;
    }

    return false;
};

/**
 * 检测线段是否与贝塞尔曲线相交
 * 使用曲线采样近似方法（采样成多个线段进行检测）
 * @param lineStart 切割线段起点
 * @param lineEnd 切割线段终点
 * @param curveStart 贝塞尔曲线起点
 * @param curveEnd 贝塞尔曲线终点
 * @param startSide 起点边
 * @param endSide 终点边
 * @param samples 采样数量（默认20）
 */
export const doesLineIntersectBezier = (
    lineStart: Point,
    lineEnd: Point,
    curveStart: Point,
    curveEnd: Point,
    startSide: Side,
    endSide: Side,
    samples: number = 20
): boolean => {
    let prevPoint = curveStart;

    for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        const currPoint = getBezierPointAtT(curveStart, curveEnd, startSide, endSide, t);

        if (doLineSegmentsIntersect(lineStart, lineEnd, prevPoint, currPoint)) {
            return true;
        }

        prevPoint = currPoint;
    }

    return false;
};
