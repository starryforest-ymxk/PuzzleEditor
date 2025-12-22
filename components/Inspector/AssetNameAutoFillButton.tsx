/**
 * components/Inspector/AssetNameAutoFillButton.tsx
 * AssetName 自动填充按钮组件
 * 
 * 点击后将 Name 翻译为英文并填入 AssetName
 * 目前为占位实现，后续接入翻译 API
 */

import React, { useState } from 'react';
import { Wand2 } from 'lucide-react';

interface AssetNameAutoFillButtonProps {
    /** 源名称（用于翻译） */
    sourceName: string;
    /** 填充回调 */
    onFill: (assetName: string) => void;
    /** 是否禁用 */
    disabled?: boolean;
}

/**
 * 将文本转换为有效的 AssetName（PascalCase）
 * 临时实现：移除非字母字符，转为 PascalCase
 */
function toAssetName(text: string): string {
    if (!text) return '';

    // 移除特殊字符，保留字母数字和空格
    const cleaned = text.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s]/g, '');

    // 如果是纯英文，直接转 PascalCase
    if (/^[a-zA-Z0-9\s]+$/.test(cleaned)) {
        return cleaned
            .split(/\s+/)
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }

    // 包含中文时，暂时返回空（后续接入翻译 API）
    return '';
}

export const AssetNameAutoFillButton: React.FC<AssetNameAutoFillButtonProps> = ({
    sourceName,
    onFill,
    disabled = false
}) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        if (disabled || isLoading || !sourceName) return;

        setIsLoading(true);
        try {
            // TODO: 后续接入翻译 API
            const result = toAssetName(sourceName);
            if (result) {
                onFill(result);
            }
        } finally {
            setIsLoading(false);
        }
    };

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
                width: '26px',
                height: '100%',
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
