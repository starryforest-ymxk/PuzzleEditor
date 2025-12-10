/**
 * components/Blackboard/FsmCard.tsx
 * 状态机卡片组件 - 用于显示单个 FSM 的信息
 */

import React from 'react';
import { StateMachine } from '../../types/stateMachine';

// ========== 组件 Props ==========

interface FsmCardProps {
    /** 状态机数据 */
    fsm: StateMachine;
    /** 是否被选中 */
    isSelected: boolean;
    /** 点击卡片的回调（选中） */
    onClick: () => void;
    /** 双击卡片的回调（打开编辑器） */
    onDoubleClick: () => void;
}

// ========== 组件 ==========

/**
 * 状态机卡片组件
 * 显示 FSM 的名称、ID、状态数量、转换数量和初始状态
 */
export const FsmCard: React.FC<FsmCardProps> = ({
    fsm,
    isSelected,
    onClick,
    onDoubleClick
}) => {
    const stateCount = Object.keys(fsm.states || {}).length;
    const transitionCount = Object.keys(fsm.transitions || {}).length;
    const initialState = fsm.initialStateId ? fsm.states[fsm.initialStateId] : null;

    return (
        <div
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            className={`overview-card ${isSelected ? 'selected' : ''}`}
            style={{
                cursor: 'pointer',
                marginBottom: '8px',
                height: 'auto',
                padding: '12px'
            }}
        >
            {/* 头部：图标 + 名称 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#4fc1ff', fontSize: '14px' }}>▶</span>
                    <span style={{
                        fontWeight: 600,
                        fontSize: '13px',
                        color: 'var(--text-primary)'
                    }}>
                        {fsm.name}
                    </span>
                </div>
            </div>

            {/* ID */}
            <div style={{
                fontSize: '10px',
                color: 'var(--text-dim)',
                fontFamily: 'monospace',
                marginBottom: '6px'
            }}>
                {fsm.id}
            </div>

            {/* 状态数量和转换数量 */}
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
                <div>
                    <span style={{ color: 'var(--text-secondary)' }}>States: </span>
                    <span style={{ color: 'var(--accent-color)', fontFamily: 'monospace' }}>
                        {stateCount}
                    </span>
                </div>
                <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Transitions: </span>
                    <span style={{ color: 'var(--accent-warning)', fontFamily: 'monospace' }}>
                        {transitionCount}
                    </span>
                </div>
            </div>

            {/* 初始状态（可选） */}
            {initialState && (
                <div style={{ marginTop: '6px', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Initial: </span>
                    <span style={{ color: '#4fc1ff', fontFamily: 'monospace' }}>
                        {initialState.name}
                    </span>
                </div>
            )}
        </div>
    );
};

export default FsmCard;
