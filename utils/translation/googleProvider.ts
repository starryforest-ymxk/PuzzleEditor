/**
 * utils/translation/googleProvider.ts
 * Google Translate API 翻译服务
 * 
 * 使用 Google Cloud Translation API 将中文翻译为英文，然后转换为 PascalCase
 */

import type { TranslationSettings } from '../../types/settings';

/**
 * 翻译结果类型
 */
export interface TranslationResult {
    success: boolean;
    text?: string;
    error?: string;
}

/**
 * 将翻译结果转换为 PascalCase 变量名
 */
function toPascalCase(text: string): string {
    // 去除常见冠词/介词等停用词，避免生成的标识符带无意义的连接词
    const STOP_WORDS = new Set([
        'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from',
        'into', 'onto', 'over', 'under', 'off', 'up', 'down', 'about', 'above', 'below', 'near',
        'before', 'after'
    ]);

    return text
        .split(/[\s_\-]+/)
        .filter(word => {
            const cleaned = word.trim();
            return cleaned && !STOP_WORDS.has(cleaned.toLowerCase());
        })
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

/**
 * 使用 Google Translate API 翻译中文为英文变量名
 * @param text 中文文本
 * @param settings 翻译设置
 * @returns 翻译结果
 */
export async function translateWithGoogle(
    text: string,
    settings: TranslationSettings
): Promise<TranslationResult> {
    const apiKey = settings.googleApiKey;
    if (!apiKey) {
        return { success: false, error: 'Google API Key not configured' };
    }

    try {
        let baseUrl = 'https://translation.googleapis.com';
        if (settings.googleBaseUrl) {
            baseUrl = settings.googleBaseUrl.trim().replace(/\/+$/, '');
        }

        const url = new URL(`${baseUrl}/language/translate/v2`);
        url.searchParams.set('key', apiKey);

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: text,
                source: 'zh-CN',
                target: 'en',
                format: 'text'
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
            return { success: false, error: `Google API error: ${errorMessage}` };
        }

        const data = await response.json();
        const translatedText = data.data?.translations?.[0]?.translatedText;

        if (!translatedText) {
            return { success: false, error: 'Empty response from Google Translate' };
        }

        // 转换为 PascalCase 并清理
        const pascalCase = toPascalCase(translatedText);
        const cleaned = pascalCase.replace(/[^a-zA-Z0-9_]/g, '');

        if (!cleaned) {
            return { success: false, error: 'Invalid translation result' };
        }

        return { success: true, text: cleaned };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `Network error: ${message}` };
    }
}
