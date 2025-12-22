
import React from 'react';

interface ModelOption {
    value: string;
    label: string;
}

// Model definitions - Flat list, English UI
const MODEL_OPTIONS: ModelOption[] = [
    // Latest Flagship
    { value: 'gpt-5.2', label: 'gpt-5.2 — Latest & Strongest Reasoning' },
    { value: 'gpt-5.2-pro', label: 'gpt-5.2 pro — High Precision & Capability' },
    { value: 'gpt-5.1', label: 'gpt-5.1 — Strong Reasoning & Chat' },
    { value: 'gpt-5', label: 'gpt-5 — Previous Flagship' },

    // ChatGPT Series
    { value: 'gpt-5.2-chatgpt', label: 'gpt-5.2 ChatGPT — ChatGPT v5.2' },
    { value: 'gpt-5.1-chatgpt', label: 'gpt-5.1 ChatGPT — ChatGPT v5.1' },
    { value: 'gpt-5-chatgpt', label: 'gpt-5 ChatGPT — Early ChatGPT Version' },

    // GPT-4 Series
    { value: 'gpt-4.1', label: 'gpt-4.1 — High Quality Instruction Following' },
    { value: 'gpt-4.1-mini', label: 'gpt-4.1 mini — Fast & Cost Effective' },
    { value: 'gpt-4.1-nano', label: 'gpt-4.1 nano — Extremely Lightweight' },
    { value: 'gpt-4o', label: 'gpt-4o — Flagship Multimodal' },
    { value: 'gpt-4o-mini', label: 'gpt-4o mini — Cost Effective Chat' }
];

interface OpenAIModelSelectProps {
    value: string;
    onChange: (value: string) => void;
    style?: React.CSSProperties;
}

export const OpenAIModelSelect: React.FC<OpenAIModelSelectProps> = ({ value, onChange, style }) => {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={style}
        >
            {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    );
};
