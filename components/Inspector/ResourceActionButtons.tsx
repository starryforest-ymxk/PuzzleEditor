/**
 * components/Inspector/ResourceActionButtons.tsx
 * 资源操作按钮组件
 * 
 * 职责：
 * - 统一渲染 Restore/Delete 按钮的条件逻辑
 * - MarkedForDelete 状态：显示 Restore + Delete 两个按钮
 * - 其他状态：显示单个 Delete 图标按钮
 * 
 * 设计动机：
 * - 3个 Inspector 文件（Script/Event/Variable）中存在完全相同的
 *   按钮条件渲染 JSX（~96 行重复），本组件将其统一
 */

import React from 'react';
import { Trash2, RotateCcw } from 'lucide-react';

// ========== Props 类型定义 ==========
interface ResourceActionButtonsProps {
    /** 资源是否处于 MarkedForDelete 状态 */
    isMarkedForDelete: boolean;
    /** 删除按钮点击回调 */
    onDelete: () => void;
    /** 恢复按钮点击回调 */
    onRestore: () => void;
    /** 资源类型标签，用于生成 tooltip 文案，如 "script" / "event" / "variable" */
    resourceLabel: string;
    /** 非 MarkedForDelete 状态时的删除按钮 tooltip，默认 "Delete" */
    deleteTooltip?: string;
}

/**
 * 资源操作按钮：根据 MarkedForDelete 状态切换显示模式
 * - MarkedForDelete: Restore 按钮 + Delete 按钮（文字+图标）
 * - 其他: 单个 Delete 图标按钮
 */
export const ResourceActionButtons: React.FC<ResourceActionButtonsProps> = ({
    isMarkedForDelete,
    onDelete,
    onRestore,
    resourceLabel,
    deleteTooltip = 'Delete',
}) => {
    return (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {isMarkedForDelete ? (
                <>
                    <button
                        className="btn-xs-restore"
                        onClick={onRestore}
                        title="Restore to Implemented state"
                    >
                        <RotateCcw size={10} style={{ marginRight: '2px' }} />
                        Restore
                    </button>
                    <button
                        className="btn-xs-delete"
                        onClick={onDelete}
                        title={`Permanently delete this ${resourceLabel}`}
                    >
                        <Trash2 size={10} style={{ marginRight: '2px' }} />
                        Delete
                    </button>
                </>
            ) : (
                <button
                    className="btn-icon btn-icon--danger"
                    onClick={onDelete}
                    title={deleteTooltip}
                >
                    <Trash2 size={14} />
                </button>
            )}
        </div>
    );
};
