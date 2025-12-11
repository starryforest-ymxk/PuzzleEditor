/**
 * Canvas overlay components: info panel, box select, snap points, cutting line.
 */

import React from 'react';
import { Side } from '../../../types/common';

// ========== Info Overlay ==========
interface InfoOverlayProps {
    nodeName: string;
    multiSelectCount: number;
    isLineCuttingMode: boolean;
    isLinkMode: boolean;
    isPanMode: boolean;
}

export const CanvasInfoOverlay: React.FC<InfoOverlayProps> = ({
    nodeName,
    multiSelectCount,
    isLineCuttingMode,
    isLinkMode,
    isPanMode
}) => (
    <div style={{
        position: 'absolute',
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
            <div style={{ fontSize: '10px', color: '#888' }}>FSM Editor</div>
            <div style={{ fontSize: '14px', color: '#eee', fontWeight: 600 }}>{nodeName}</div>
            {multiSelectCount > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--accent-color)', marginTop: '4px' }}>
                    {`Selected ${multiSelectCount} node(s)`}
                </div>
            )}
            {isLineCuttingMode && (
                <div style={{ fontSize: '10px', color: '#ff6b6b', marginTop: '4px' }}>
                    Cut mode (Ctrl+Drag)
                </div>
            )}
            {isLinkMode && (
                <div style={{ fontSize: '10px', color: '#4fc1ff', marginTop: '4px' }}>
                    Linking mode (Shift+Drag)
                </div>
            )}
            {isPanMode && (
                <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '4px' }}>
                    Pan mode (Space/Alt + Drag)
                </div>
            )}
        </div>
    </div>
);

// ========== Box Select ==========
interface BoxSelectRect {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

interface BoxSelectOverlayProps {
    rect: BoxSelectRect | null;
}

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

// ========== Snap Points Layer ==========
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
                        key={`${sp.nodeId}-${sp.side}-${sp.x}-${sp.y}`}
                        style={{
                            position: 'absolute',
                            left: sp.x - size / 2,
                            top: sp.y - size / 2,
                            width: size,
                            height: size,
                            borderRadius: '50%',
                            backgroundColor: isActive ? 'var(--accent-color)' : '#888',
                            opacity: 0.8,
                            transform: 'translateZ(0)',
                            pointerEvents: 'none',
                            zIndex: 40
                        }}
                    />
                );
            })}
        </>
    );
};

// ========== Cutting Line Overlay ==========
interface CuttingLineProps {
    line: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
}

export const CuttingLineOverlay: React.FC<CuttingLineProps> = ({ line }) => {
    if (!line) return null;
    return (
        <line
            x1={line.start.x}
            y1={line.start.y}
            x2={line.end.x}
            y2={line.end.y}
            stroke="#f97316"
            strokeWidth={2}
            strokeDasharray="6 4"
            pointerEvents="none"
        />
    );
};

// ========== Shortcut Guide (collapsible) ==========
interface ShortcutPanelProps {
    visible: boolean;
    onToggle: () => void;
}

export const ShortcutPanel: React.FC<ShortcutPanelProps> = ({ visible, onToggle }) => (
    <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        zIndex: 120,
        pointerEvents: 'auto'
    }}>
        <div style={{
            background: '#1f1f23',
            border: '1px solid #3f3f46',
            borderRadius: '6px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
            width: '260px',
            overflow: 'hidden'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#2d2d30',
                borderBottom: '1px solid #3f3f46',
                color: '#e4e4e7',
                fontSize: '12px',
                letterSpacing: '0.5px'
            }}>
                <span>Shortcuts</span>
                <button
                    onClick={onToggle}
                    style={{
                        background: 'transparent',
                        border: '1px solid #3f3f46',
                        color: '#ccc',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {visible ? 'Hide' : 'Show'}
                </button>
            </div>
            {visible && (
                <div style={{ padding: '10px 12px', color: '#d4d4d8', fontSize: '12px', lineHeight: 1.6 }}>
                    <div>- Pan: Space/Alt + Drag</div>
                    <div>- Link: Shift + Drag from state</div>
                    <div>- Cut: Ctrl + Drag across transitions</div>
                    <div>- Box Select: Drag on empty area</div>
                    <div>- Delete: Del/Backspace</div>
                    <div>- Undo/Redo: Ctrl+Z / Ctrl+Shift+Z</div>
                </div>
            )}
        </div>
    </div>
);
