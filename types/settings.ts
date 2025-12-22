/**
 * types/settings.ts
 * 编辑器设置类型定义
 * 
 * 包含翻译服务配置等用户偏好设置
 */

/**
 * 翻译服务提供商类型
 */
export type TranslationProvider = 'openai' | 'google' | 'local';

/**
 * 翻译服务设置
 */
export interface TranslationSettings {
    /** 当前使用的翻译服务提供商 */
    provider: TranslationProvider;
    /** OpenAI API Key */
    openaiApiKey?: string;
    /** Google Translate API Key */
    googleApiKey?: string;
    /** OpenAI 模型名称 */
    openaiModel?: string;
    /** OpenAI API Base URL (可选) */
    openaiBaseUrl?: string;
    /** Google API Base URL (可选) */
    googleBaseUrl?: string;
    /** 是否在名称编辑完成时自动翻译并填充 AssetName */
    autoTranslate?: boolean;
}

/**
 * 编辑器设置（用户偏好）
 */
export interface EditorSettings {
    /** 翻译服务配置 */
    translation: TranslationSettings;
}

/**
 * 默认设置
 */
export const DEFAULT_SETTINGS: EditorSettings = {
    translation: {
        provider: 'local',
        openaiModel: 'gpt-3.5-turbo'
    }
};
