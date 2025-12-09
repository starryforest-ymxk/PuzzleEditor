/**
 * hooks/useCanvasNavigation.ts
 * 画布导航 Hook - 处理画布的平移交互
 * 
 * 支持的平移方式：
 * - Space + 左键拖拽
 * - 中键拖拽
 * - Alt + 左键拖拽
 */

import React, { useState, useRef, useEffect, MouseEvent } from 'react';

// ========== 类型定义 ==========
interface UseCanvasNavigationProps {
    /** 画布容器的 ref */
    canvasRef: React.RefObject<HTMLDivElement>;
}

/**
 * 画布导航 Hook
 * 管理画布的平移状态和交互处理
 */
export const useCanvasNavigation = ({ canvasRef }: UseCanvasNavigationProps) => {
    // === 内部状态 ===
    /** 是否正在平移中（鼠标按下状态） */
    const isPanning = useRef(false);
    /** 平移激活状态（用于 UI 反馈，如光标样式） */
    const [isPanningActive, setIsPanningActive] = useState(false);
    /** 上一次平移的鼠标位置 */
    const lastPanPos = useRef({ x: 0, y: 0 });
    /** 空格键是否按下 */
    const spacePressed = useRef(false);
    /** Alt 是否按下（用于即时光标反馈） */
    const altPressed = useRef(false);

    // === 事件监听设置 ===
    useEffect(() => {
        // 空格/Alt 键按下：激活平移模式（在输入框中时忽略）
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                // 阻止浏览器菜单快捷键（Alt / Alt+F 等）抢焦点
                e.preventDefault();
                altPressed.current = true;
                setIsPanningActive(true);
            }

            if (e.code === 'Space') {
                const target = e.target as HTMLElement;
                // 跳过输入元素，避免影响正常输入
                if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
                // 阻止浏览器默认的空格滚动页面行为，避免画布被垂直滚动
                e.preventDefault();
                spacePressed.current = true;
                setIsPanningActive(true);
            }
        };
        // 空格/Alt 释放：取消平移模式
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                // 阻止浏览器菜单弹出
                e.preventDefault();
                altPressed.current = false;
                if (!isPanning.current && !spacePressed.current) setIsPanningActive(false);
            }
            if (e.code === 'Space') {
                // 同样阻止释放时的默认滚动
                e.preventDefault();
                spacePressed.current = false;
                if (!isPanning.current && !altPressed.current) setIsPanningActive(false);
            }
        };

        // 鼠标移动：平移画布（通过修改 scrollLeft/scrollTop）
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

        // 鼠标释放：结束平移
        const handleWindowMouseUp = () => {
            if (isPanning.current) {
                isPanning.current = false;
                if (!spacePressed.current && !altPressed.current) setIsPanningActive(false);
            }
        };

        const handleWindowBlur = () => {
            altPressed.current = false;
            spacePressed.current = false;
            if (!isPanning.current) setIsPanningActive(false);
        };

        window.addEventListener('keydown', handleKeyDown, { capture: false });
        window.addEventListener('keyup', handleKeyUp, { capture: false });
        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
        window.addEventListener('blur', handleWindowBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
            window.removeEventListener('blur', handleWindowBlur);
        };
    }, [canvasRef]);

    /**
     * 处理鼠标按下事件
     * 检测是否触发平移操作（中键/Space+左键/Alt+左键）
     * @returns true 表示已处理（是平移操作），false 表示未处理
     */
    const handleMouseDown = (e: MouseEvent) => {
        const isMiddleClick = e.button === 1;      // 中键
        const isSpacePan = e.button === 0 && spacePressed.current;  // Space + 左键
        const isAltPan = e.button === 0 && (e.altKey || altPressed.current);  // Alt + 左键（即时反馈）

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