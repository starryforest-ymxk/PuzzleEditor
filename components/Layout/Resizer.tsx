/**
 * Resizer.tsx
 * Reusable resizable border component for panel resizing
 */

import React, { useCallback, useEffect, useState } from 'react';

interface ResizerProps {
    direction: 'horizontal' | 'vertical';
    onResize: (delta: number) => void;
    onResizeEnd?: () => void;
    style?: React.CSSProperties;
}

export const Resizer: React.FC<ResizerProps> = ({ direction, onResize, onResizeEnd, style }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setStartPos(direction === 'horizontal' ? e.clientX : e.clientY);
    }, [direction]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
            const delta = currentPos - startPos;
            if (delta !== 0) {
                onResize(delta);
                setStartPos(currentPos);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            onResizeEnd?.();
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, startPos, direction, onResize, onResizeEnd]);

    const isHorizontal = direction === 'horizontal';

    const baseStyle: React.CSSProperties = {
        position: 'relative',
        flexShrink: 0,
        background: isDragging ? 'var(--accent-color)' : 'transparent',
        transition: isDragging ? 'none' : 'background 0.15s ease',
        zIndex: 10,
        ...(isHorizontal ? {
            width: '4px',
            cursor: 'col-resize',
            height: '100%'
        } : {
            height: '4px',
            cursor: 'row-resize',
            width: '100%'
        }),
        ...style
    };

    const hoverAreaStyle: React.CSSProperties = {
        position: 'absolute',
        ...(isHorizontal ? {
            left: '-4px',
            right: '-4px',
            top: 0,
            bottom: 0
        } : {
            top: '-4px',
            bottom: '-4px',
            left: 0,
            right: 0
        })
    };

    return (
        <div
            style={baseStyle}
            onMouseDown={handleMouseDown}
            onMouseEnter={(e) => {
                if (!isDragging) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--border-color)';
                }
            }}
            onMouseLeave={(e) => {
                if (!isDragging) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
            }}
        >
            <div style={hoverAreaStyle} />
        </div>
    );
};
