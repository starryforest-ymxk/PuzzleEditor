/**
 * hooks/useAutoTranslateAssetName.ts
 * 自动翻译 AssetName 的 Hook
 * 
 * 当设置中启用 autoTranslate 时，在名称编辑完成后自动翻译并填充 AssetName
 */

import { useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../store/context';
import { translateToAssetName } from '../utils/translation/translationService';

interface UseAutoTranslateAssetNameOptions {
    /** 当前的 AssetName 值（用于判断是否已有值） */
    currentAssetName?: string;
    /** 设置 AssetName 的回调 */
    onAssetNameFill: (assetName: string) => void;
}

/**
 * 返回一个函数，当名称编辑完成时调用
 * 如果设置了 autoTranslate 并且名称非空且 AssetName 为空，则自动翻译
 */
export const useAutoTranslateAssetName = (options: UseAutoTranslateAssetNameOptions) => {
    const { settings } = useEditorState();
    const dispatch = useEditorDispatch();
    const { currentAssetName, onAssetNameFill } = options;

    const triggerAutoTranslate = useCallback(async (sourceName: string) => {
        // 仅在启用自动翻译时执行
        if (!settings.translation.autoTranslate) return;

        // 名称为空时不翻译
        if (!sourceName || !sourceName.trim()) return;

        // 如果已经有 AssetName，不覆盖
        if (currentAssetName && currentAssetName.trim()) return;

        try {
            const result = await translateToAssetName(sourceName, settings.translation);

            if (result.success && result.text) {
                onAssetNameFill(result.text);
            } else if (result.error) {
                // 静默失败或显示警告
                dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                        id: `auto-translate-${Date.now()}`,
                        level: 'info',
                        text: `Auto-translate: ${result.error}`,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        } catch (error) {
            // 静默失败
            console.warn('Auto-translate failed:', error);
        }
    }, [settings.translation, currentAssetName, onAssetNameFill, dispatch]);

    return triggerAutoTranslate;
};
