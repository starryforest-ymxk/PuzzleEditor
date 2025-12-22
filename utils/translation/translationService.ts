/**
 * utils/translation/translationService.ts
 * 翻译服务主入口
 * 
 * 根据设置选择对应的翻译提供商并执行翻译
 */

import type { TranslationSettings } from '../../types/settings';
import { translateWithLocalDictionary } from './localDictionary';
import { translateWithOpenAI } from './openaiProvider';
import { translateWithGoogle } from './googleProvider';

/**
 * 翻译结果类型
 */
export interface TranslationResult {
    success: boolean;
    text?: string;
    error?: string;
}

/**
 * 将文本转换为有效的 AssetName（仅英文时使用）
 */
function toAssetName(text: string): string {
    if (!text) return '';

    // 移除特殊字符，保留字母数字和空格
    const cleaned = text.replace(/[^a-zA-Z0-9\s]/g, '');

    // 转 PascalCase
    return cleaned
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

/**
 * 翻译文本为 AssetName
 * 根据设置选择翻译服务
 * 
 * @param text 源文本（可能是中文）
 * @param settings 翻译设置
 * @returns 翻译结果
 */
export async function translateToAssetName(
    text: string,
    settings: TranslationSettings
): Promise<TranslationResult> {
    if (!text) {
        return { success: false, error: 'Empty input' };
    }

    // 去除首尾空格
    const trimmed = text.trim();

    // 如果是纯英文，直接转 PascalCase
    if (/^[a-zA-Z0-9\s]+$/.test(trimmed)) {
        const result = toAssetName(trimmed);
        return result ? { success: true, text: result } : { success: false, error: 'Conversion failed' };
    }

    // 根据设置选择翻译服务
    switch (settings.provider) {
        case 'openai':
            return translateWithOpenAI(trimmed, settings);

        case 'google':
            return translateWithGoogle(trimmed, settings);

        case 'local':
        default: {
            // 本地词典翻译
            const result = translateWithLocalDictionary(trimmed);
            if (result) {
                return { success: true, text: result };
            }
            return {
                success: false,
                error: `"${trimmed}" not found in local dictionary. Try a simpler term or use OpenAI/Google.`
            };
        }
    }
}

/**
 * 获取翻译服务的显示名称
 */
export function getProviderDisplayName(provider: TranslationSettings['provider']): string {
    switch (provider) {
        case 'openai': return 'OpenAI';
        case 'google': return 'Google Translate';
        case 'local': return 'Local Dictionary';
        default: return 'Unknown';
    }
}
