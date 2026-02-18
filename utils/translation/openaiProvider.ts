/**
 * utils/translation/openaiProvider.ts
 * OpenAI API 翻译服务
 * 
 * 使用 OpenAI Chat API 将中文名称翻译为符合变量命名规则的英文标识符
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
 * 使用 OpenAI API 翻译中文为英文变量名
 * @param text 中文文本
 * @param settings 翻译设置
 * @returns 翻译结果
 */
export async function translateWithOpenAI(
    text: string,
    settings: TranslationSettings
): Promise<TranslationResult> {
    const apiKey = settings.openaiApiKey;
    if (!apiKey) {
        return { success: false, error: 'OpenAI API Key not configured' };
    }

    const model = settings.openaiModel || 'gpt-4o-mini';

    // 处理 API URL
    let apiUrl = 'https://api.openai.com/v1/chat/completions';
    if (settings.openaiBaseUrl) {
        let baseUrl = settings.openaiBaseUrl.trim().replace(/\/+$/, '');
        // 智能修正路径
        if (baseUrl.endsWith('/chat/completions')) {
            apiUrl = baseUrl;
        } else if (baseUrl.endsWith('/v1')) {
            apiUrl = `${baseUrl}/chat/completions`;
        } else {
            apiUrl = `${baseUrl}/v1/chat/completions`;
        }
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'system',
                        content: `You are a translator that converts Chinese names to English variable names. 
                        Rules:
                        1. Use PascalCase format (e.g., DoorLock, GameStart)
                        2. Only use letters and underscores, no spaces
                        3. Keep it concise but meaningful
                        4. Return ONLY the variable name, nothing else, without any explanation or reasoning process.`
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                max_tokens: 50,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
            return { success: false, error: `OpenAI API error: ${errorMessage}` };
        }

        const data = await response.json();
        const result = data.choices?.[0]?.message?.content?.trim();

        if (!result) {
            return { success: false, error: 'Incorrect response from OpenAI service. Response details: ' + JSON.stringify(data) };
        }

        // 清理结果，确保符合变量名规则
        const cleaned = result.replace(/[^a-zA-Z0-9_]/g, '');
        if (!cleaned) {
            return { success: false, error: 'Invalid translation result' };
        }

        return { success: true, text: cleaned };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `Network error: ${message}` };
    }
}
