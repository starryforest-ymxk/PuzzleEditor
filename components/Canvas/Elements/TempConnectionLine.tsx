/**
 * components/Canvas/Elements/TempConnectionLine.tsx
 * 连线箭头标记定义组件
 * 
 * 注：TempConnectionLine 临时连线组件已迁移至 TransitionsLayer.tsx
 * 本文件仅保留 SVG 箭头标记定义
 */

import React from 'react';

// ========== SVG Arrow Markers ==========
/**
 * 连线箭头标记定义
 * 包含：普通、选中、右键目标、错误、临时 五种状态的箭头
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
