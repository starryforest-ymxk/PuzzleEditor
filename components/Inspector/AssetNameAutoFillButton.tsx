/**
 * components/Inspector/AssetNameAutoFillButton.tsx
 * AssetName 自动填充按钮组件
 * 
 * 点击后使用翻译服务将 Name 翻译为英文变量名
 */

import React, { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { translateToAssetName } from '../../utils/translation/translationService';

interface AssetNameAutoFillButtonProps {
    /** 源名称（用于翻译） */
    sourceName: string;
    /** 填充回调 */
    onFill: (assetName: string) => void;
    /** 是否禁用 */
    disabled?: boolean;
    /** 尺寸：default (28px) 或 compact (26px) */
    size?: 'default' | 'compact';
}

export const AssetNameAutoFillButton: React.FC<AssetNameAutoFillButtonProps> = ({
    sourceName,
    onFill,
    disabled = false,
    size = 'default'
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const { settings } = useEditorState();
    const dispatch = useEditorDispatch();

    const handleClick = async () => {
        if (disabled || isLoading || !sourceName) return;

        setIsLoading(true);
        try {
            const result = await translateToAssetName(sourceName, settings.translation);

            if (result.success && result.text) {
                onFill(result.text);
            } else if (result.error) {
                // 显示错误消息
                dispatch({
                    type: 'ADD_MESSAGE',
                    payload: {
                        id: `translate-error-${Date.now()}`,
                        level: 'warning',
                        text: result.error,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Translation failed';
            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: `translate-error-${Date.now()}`,
                    level: 'error',
                    text: message,
                    timestamp: new Date().toISOString()
                }
            });
        } finally {
            setIsLoading(false);
        }
    };

    // 根据 size 确定尺寸
    const dimension = size === 'compact' ? '26px' : '28px';

    return (
        <button
            type="button"
            className="asset-name-autofill-btn"
            onClick={handleClick}
            disabled={disabled || isLoading || !sourceName}
            title="Auto-generate from name"
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: dimension,
                height: dimension,
                padding: 0,
                border: '1px solid var(--border-color, #444)',
                borderRadius: '4px',
                background: 'var(--bg-secondary, #2d2d2d)',
                color: disabled ? 'var(--text-dim, #666)' : 'var(--text-secondary, #aaa)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                opacity: isLoading ? 0.6 : 1,
                transition: 'all 0.15s ease'
            }}
        >
            <Wand2 size={14} style={{
                animation: isLoading ? 'spin 1s linear infinite' : undefined
            }} />
        </button>
    );
};
