/**
 * components/Blackboard/VariableCard.tsx
 * 全局变量卡片组件 - 用于显示单个全局变量的信息
 * 
 * 重构说明：
 * - 内联样式已替换为 CSS 类
 */

import React from 'react';
import { VariableDefinition } from '../../types/blackboard';
import { StateBadge } from './StateBadge';

// ========== 工具函数 ==========

/**
 * 根据变量类型返回对应的颜色
 */
export const getTypeColor = (type: string): string => {
    switch (type) {
        case 'boolean':
            return '#60a5fa';
        case 'integer':
            return '#a3e635';
        case 'float':
            return '#2dd4bf';
        case 'string':
            return '#fbbf24';
        case 'enum':
            return '#c084fc';
        default:
            return 'var(--text-secondary)';
    }
};

// ========== 组件 Props ==========

interface VariableCardProps {
    /** 变量定义数据 */
    variable: VariableDefinition;
    /** 是否被选中 */
    isSelected: boolean;
    /** 点击卡片的回调 */
    onClick: () => void;
}

// ========== 组件 ==========

/**
 * 全局变量卡片组件
 * 显示变量的名称、Key、类型、默认值和描述
 */
export const VariableCard: React.FC<VariableCardProps> = ({
    variable,
    isSelected,
    onClick
}) => {
    const isDeleted = variable.state === 'MarkedForDelete';

    return (
        <div
            onClick={onClick}
            className={`overview-card ${isSelected ? 'selected' : ''}`}
            style={{
                opacity: isDeleted ? 0.5 : 1,
                cursor: 'pointer',
                marginBottom: '8px',
                height: 'auto',
                padding: '12px'
            }}
        >
            {/* 头部：名称 + 状态徽章 */}
            <div className="card-header">
                <span className="card-name">{variable.name}</span>
                <StateBadge state={variable.state} />
            </div>

            {/* Key */}
            <div className="card-key">{variable.key}</div>

            {/* 类型和默认值 */}
            <div className="card-type-value-row">
                <div>
                    <span className="label">Type: </span>
                    <span className="value" style={{ color: getTypeColor(variable.type) }}>
                        {variable.type}
                    </span>
                </div>
                <div>
                    <span className="label">Default: </span>
                    <span className="value">
                        {variable.defaultValue !== undefined ? String(variable.defaultValue) : '-'}
                    </span>
                </div>
            </div>

            {/* 描述（可选） */}
            {variable.description && (
                <div className="card-description">{variable.description}</div>
            )}
        </div>
    );
};

export default VariableCard;

