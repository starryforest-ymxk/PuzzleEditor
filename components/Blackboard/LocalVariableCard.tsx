/**
 * components/Blackboard/LocalVariableCard.tsx
 * 局部变量卡片组件 - 用于显示 Stage/Node 级别的局部变量信息
 * 
 * 重构说明：
 * - LocalVarWithScope 类型已移至 types/blackboard.ts
 * - 内联样式已替换为 CSS 类
 */

import React from 'react';
import { LocalVarWithScope } from '../../types/blackboard';
import { StateBadge } from './StateBadge';
import { getTypeColor } from './VariableCard';

// 导出类型以保持向后兼容
export type { LocalVarWithScope } from '../../types/blackboard';

// ========== 组件 Props ==========

interface LocalVariableCardProps {
    /** 局部变量数据（带作用域信息） */
    variable: LocalVarWithScope;
    /** 是否被选中 */
    isSelected: boolean;
    /** 点击卡片的回调 */
    onClick: () => void;
}

// ========== 组件 ==========

/**
 * 局部变量卡片组件
 * 显示变量的名称、Key、作用域、类型、默认值和描述
 */
export const LocalVariableCard: React.FC<LocalVariableCardProps> = ({
    variable,
    isSelected,
    onClick
}) => {
    const isDeleted = variable.state === 'MarkedForDelete';
    // Stage 使用蓝色，Node 使用橙色
    const scopeTypeClass = variable.scopeType === 'Stage' ? 'scope-type--stage' : 'scope-type--node';

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

            {/* 作用域信息 */}
            <div className="scope-badge">
                <span className="scope-label">Scope:</span>
                <span className={`scope-type ${scopeTypeClass}`}>
                    {variable.scopeType}
                </span>
                <span className="scope-separator">→</span>
                <span className="scope-name">{variable.scopeName}</span>
            </div>

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

export default LocalVariableCard;

