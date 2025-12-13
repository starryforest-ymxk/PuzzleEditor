/**
 * components/Canvas/Elements/TempConnectionLine.tsx
 * 临时连线组件
 * 显示创建新连线或修改连线时的预览线
 */

import React from 'react';
import { Side } from '../../../types/common';
import * as Geom from '../../../utils/geometry';

interface TempConnectionLineProps {
    /** 连线起点坐标 */
    startPoint: { x: number; y: number };
    /** 连线终点坐标 */
    endPoint: { x: number; y: number };
    /** 起点方向 */
    startSide: Side;
    /** 终点方向 */
    endSide: Side;
}

/**
 * 临时连线组件
 * 用于创建新连线或修改现有连线时的预览显示
 */
export const TempConnectionLine: React.FC<TempConnectionLineProps> = ({
    startPoint,
    endPoint,
    startSide,
    endSide
}) => {
    const pathData = Geom.getBezierPathData(startPoint, endPoint, startSide, endSide);

    return (
        <path
            d={pathData}
            fill="none"
            stroke="#888"
            strokeWidth="2"
            strokeDasharray="5,5"
            markerEnd="url(#arrow-temp)"
        />
    );
};

// ========== SVG Arrow Markers ==========
/**
 * 连线箭头标记定义
 * 包含：普通、选中、右键目标、临时 四种状态的箭头
 */
export const ConnectionArrowMarkers: React.FC = () => (
    <defs>
        <marker id="arrow-normal" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#666" />
        </marker>
        <marker id="arrow-selected" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="var(--accent-color)" />
        </marker>
        <marker id="arrow-context" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="var(--accent-warning)" />
        </marker>
        <marker id="arrow-error" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
        </marker>
        <marker id="arrow-temp" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#888" fillOpacity="0.8" />
        </marker>
    </defs>
);
