/**
 * components/Canvas/Elements/CanvasOverlays.tsx
 * 画布覆盖层组件集合
 * 包括：信息覆盖层、框选区域、吸附点提示、切线视觉
 */

import React from 'react';
import { Side } from '../../../types/common';

// ========== 信息覆盖层 ==========
interface InfoOverlayProps {
    nodeName: string;
    multiSelectCount: number;
    isLineCuttingMode: boolean;
}

/**
 * 画布左上角信息提示
 */
export const CanvasInfoOverlay: React.FC<InfoOverlayProps> = ({
    nodeName,
    multiSelectCount,
    isLineCuttingMode
}) => (
    <div style={{
        position: 'sticky',
        top: 20,
        left: 20,
        zIndex: 100,
        pointerEvents: 'none',
        height: 0,
        overflow: 'visible'
    }}>
        <div style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'inline-block'
        }}>
            <div style={{ fontSize: '10px', color: '#888' }}>FSM 编辑器</div>
            <div style={{ fontSize: '14px', color: '#eee', fontWeight: 600 }}>{nodeName}</div>
            {multiSelectCount > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--accent-color)', marginTop: '4px' }}>
                    已选中 {multiSelectCount} 个节点
                </div>
            )}
            {isLineCuttingMode && (
                <div style={{ fontSize: '10px', color: '#ff6b6b', marginTop: '4px' }}>
                    ✂ 切线模式 (Ctrl+拖拽)
                </div>
            )}
        </div>
    </div>
);

// ========== 框选区域 ==========
interface BoxSelectRect {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

interface BoxSelectOverlayProps {
    rect: BoxSelectRect | null;
}

/**
 * 框选区域视觉反馈
 */
export const BoxSelectOverlay: React.FC<BoxSelectOverlayProps> = ({ rect }) => {
    if (!rect) return null;

    const style: React.CSSProperties = {
        position: 'absolute',
        left: Math.min(rect.startX, rect.endX),
        top: Math.min(rect.startY, rect.endY),
        width: Math.abs(rect.endX - rect.startX),
        height: Math.abs(rect.endY - rect.startY),
        border: '1px dashed var(--accent-color)',
        backgroundColor: 'rgba(79, 193, 255, 0.1)',
        pointerEvents: 'none',
        zIndex: 50
    };

    return <div style={style} />;
};

// ========== 吸附点提示层 ==========
interface SnapPoint {
    nodeId: string;
    side: Side;
    x: number;
    y: number;
}

interface SnapPointsLayerProps {
    snapPoints: SnapPoint[];
    activeSnapPoint: SnapPoint | null;
    visible: boolean;
}

/**
 * 连线/调整时展示所有锚点
 */
export const SnapPointsLayer: React.FC<SnapPointsLayerProps> = ({
    snapPoints,
    activeSnapPoint,
    visible
}) => {
    if (!visible) return null;

    return (
        <>
            {snapPoints.map(sp => {
                const isActive = activeSnapPoint &&
                    activeSnapPoint.nodeId === sp.nodeId &&
                    activeSnapPoint.side === sp.side;
                const size = isActive ? 12 : 8;

                return (
                    <div
                        key={`snap-${sp.nodeId}-${sp.side}`}
                        style={{
                            position: 'absolute',
                            left: sp.x,
                            top: sp.y,
                            width: size,
                            height: size,
                            borderRadius: '50%',
                            backgroundColor: isActive ? 'var(--accent-color)' : 'rgba(255,255,255,0.35)',
                            opacity: isActive ? 1 : 0.5,
                            transform: 'translate(-50%, -50%)',
                            zIndex: 35,
                            pointerEvents: 'none',
                            boxShadow: isActive ? '0 0 0 2px rgba(255,255,255,0.25)' : 'none'
                        }}
                    />
                );
            })}
        </>
    );
};

// ========== 切线视觉 ==========
interface CuttingLineProps {
    start: { x: number; y: number };
    end: { x: number; y: number };
}

/**
 * Ctrl+拖拽切线的视觉反馈
 */
export const CuttingLineOverlay: React.FC<{ line: CuttingLineProps | null }> = ({ line }) => {
    if (!line) return null;

    return (
        <line
            x1={line.start.x}
            y1={line.start.y}
            x2={line.end.x}
            y2={line.end.y}
            stroke="#ff6b6b"
            strokeWidth="2"
            strokeDasharray="6,4"
            style={{ pointerEvents: 'none' }}
        />
    );
};
