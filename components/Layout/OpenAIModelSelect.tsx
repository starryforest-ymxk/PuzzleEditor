/**
 * components/Layout/OpenAIModelSelect.tsx
 * OpenAI 模型选择组件
 * 
 * 支持预设模型列表和自定义模型输入
 */

import React, { useState, useEffect } from 'react';

interface ModelOption {
    value: string;
    label: string;
}

// 预设模型列表 - 只显示模型名称
const MODEL_OPTIONS: ModelOption[] = [
    // Latest Flagship
    { value: 'gpt-5.2', label: 'gpt-5.2' },
    { value: 'gpt-5.2-pro', label: 'gpt-5.2-pro' },
    { value: 'gpt-5.1', label: 'gpt-5.1' },
    { value: 'gpt-5', label: 'gpt-5' },

    // ChatGPT Series
    { value: 'gpt-5.2-chatgpt', label: 'gpt-5.2-chatgpt' },
    { value: 'gpt-5.1-chatgpt', label: 'gpt-5.1-chatgpt' },
    { value: 'gpt-5-chatgpt', label: 'gpt-5-chatgpt' },

    // GPT-4 Series
    { value: 'gpt-4.1', label: 'gpt-4.1' },
    { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
    { value: 'gpt-4.1-nano', label: 'gpt-4.1-nano' },
    { value: 'gpt-4o', label: 'gpt-4o' },
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini' }
];

// 特殊的 Custom 选项值，用于标识自定义模式
const CUSTOM_OPTION_VALUE = '__custom__';

interface OpenAIModelSelectProps {
    value: string;
    onChange: (value: string) => void;
    style?: React.CSSProperties;
}

export const OpenAIModelSelect: React.FC<OpenAIModelSelectProps> = ({ value, onChange, style }) => {
    // 判断当前值是否为自定义模型（不在预设列表中）
    const isPresetModel = MODEL_OPTIONS.some(opt => opt.value === value);

    // 控制是否显示自定义输入框
    const [isCustomMode, setIsCustomMode] = useState(!isPresetModel && value !== '');

    // 自定义模型名称（仅在自定义模式下使用）
    const [customModel, setCustomModel] = useState(isPresetModel ? '' : value);

    // 当外部 value 变化时，同步内部状态
    useEffect(() => {
        const preset = MODEL_OPTIONS.some(opt => opt.value === value);
        if (preset) {
            setIsCustomMode(false);
        } else if (value !== '' && value !== CUSTOM_OPTION_VALUE) {
            setIsCustomMode(true);
            setCustomModel(value);
        }
    }, [value]);

    // 处理下拉框变化
    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selected = e.target.value;
        if (selected === CUSTOM_OPTION_VALUE) {
            // 切换到自定义模式
            setIsCustomMode(true);
            // 如果之前有自定义值，保留；否则清空等待用户输入
            if (customModel) {
                onChange(customModel);
            }
        } else {
            // 选择预设模型
            setIsCustomMode(false);
            onChange(selected);
        }
    };

    // 处理自定义输入框变化
    const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        setCustomModel(inputValue);
        onChange(inputValue);
    };

    // 获取下拉框当前显示的值
    const selectValue = isCustomMode ? CUSTOM_OPTION_VALUE : value;

    return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
            {/* 模型选择下拉框 */}
            <select
                value={selectValue}
                onChange={handleSelectChange}
                style={{
                    ...style,
                    flex: isCustomMode ? '0 0 120px' : '1 1 auto',
                    width: isCustomMode ? '120px' : '100%'
                }}
            >
                {MODEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
                {/* Custom 选项 */}
                <option value={CUSTOM_OPTION_VALUE}>Custom</option>
            </select>

            {/* 自定义模型输入框，仅在选择 Custom 时显示 */}
            {isCustomMode && (
                <input
                    type="text"
                    value={customModel}
                    onChange={handleCustomInputChange}
                    placeholder="e.g. gpt-4o-mini"
                    style={{
                        ...style,
                        flex: '1 1 auto',
                        minWidth: 0
                    }}
                />
            )}
        </div>
    );
};
