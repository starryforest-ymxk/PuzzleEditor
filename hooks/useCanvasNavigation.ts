import React, { useState, useRef, useEffect, MouseEvent } from 'react';

interface UseCanvasNavigationProps {
    canvasRef: React.RefObject<HTMLDivElement>;
}

export const useCanvasNavigation = ({ canvasRef }: UseCanvasNavigationProps) => {
    const isPanning = useRef(false);
    const [isPanningActive, setIsPanningActive] = useState(false);
    const lastPanPos = useRef({ x: 0, y: 0 });
    const spacePressed = useRef(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat) {
                const target = e.target as HTMLElement;
                if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
                spacePressed.current = true;
                setIsPanningActive(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                spacePressed.current = false;
                if (!isPanning.current) setIsPanningActive(false);
            }
        };

        const handleWindowMouseMove = (e: globalThis.MouseEvent) => {
            if (isPanning.current && canvasRef.current) {
                e.preventDefault();
                const dx = e.clientX - lastPanPos.current.x;
                const dy = e.clientY - lastPanPos.current.y;
                canvasRef.current.scrollLeft -= dx;
                canvasRef.current.scrollTop -= dy;
                lastPanPos.current = { x: e.clientX, y: e.clientY };
            }
        };

        const handleWindowMouseUp = () => {
            if (isPanning.current) {
                isPanning.current = false;
                if (!spacePressed.current) setIsPanningActive(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, [canvasRef]);

    const handleMouseDown = (e: MouseEvent) => {
        const isMiddleClick = e.button === 1;
        const isSpacePan = e.button === 0 && spacePressed.current;
        const isAltPan = e.button === 0 && e.altKey;

        if (isMiddleClick || isSpacePan || isAltPan) {
            e.preventDefault();
            e.stopPropagation();
            isPanning.current = true;
            setIsPanningActive(true);
            lastPanPos.current = { x: e.clientX, y: e.clientY };
            return true; // Handled
        }
        return false; // Not handled
    };

    return {
        isPanningActive,
        handleMouseDown
    };
};