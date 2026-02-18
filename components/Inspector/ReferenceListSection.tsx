/**
 * components/Inspector/ReferenceListSection.tsx
 * 引用列表区块组件
 * 
 * 职责：
 * - 展示资源（脚本/事件/变量/演出图）的引用位置列表
 * - 支持点击引用项导航到对应的编辑器界面
 * - 无引用时显示占位提示
 * 
 * 设计动机：
 * - 4个 Inspector 文件中存在完全相同的引用列表 JSX 模板（~183 行重复）
 * - 5个文件中存在相同的 handleReferenceClick 回调包装（~18 行重复）
 * - 本组件将上述重复统一为一个可复用的 UI 组件
 */

import React, { useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ExternalLink } from 'lucide-react';
import type { VariableReferenceInfo, ReferenceNavigationContext } from '../../utils/validation/globalVariableReferences';
import { navigateToReference } from '../../utils/referenceNavigation';

// ========== Props 类型定义 ==========
interface ReferenceListSectionProps {
    /** 引用信息数组，包含位置描述和可选的导航上下文 */
    references: VariableReferenceInfo[];
    /** 无引用时的提示文案，默认 "No references found in this project." */
    emptyMessage?: string;
    /** 外层 section 的样式覆盖 */
    style?: React.CSSProperties;
}

/**
 * 引用列表区块：展示引用位置列表，支持点击导航
 * 内部自行获取 dispatch 和 project.nodes，无需外部传入
 */
export const ReferenceListSection: React.FC<ReferenceListSectionProps> = ({
    references,
    emptyMessage = 'No references found in this project.',
    style,
}) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();

    // 点击引用项导航，委托给公共工具函数
    const handleReferenceClick = useCallback((navContext?: ReferenceNavigationContext) => {
        if (!navContext) return;
        navigateToReference(dispatch, project.nodes, navContext);
    }, [project.nodes, dispatch]);

    return (
        <div
            className="inspector-section"
            style={style ?? { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
            <div className="inspector-section-title">
                References ({references.length})
            </div>
            {references.length > 0 ? (
                <div style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    flex: 1,
                    overflowY: 'auto'
                }}>
                    {references.map((ref, idx) => (
                        <div
                            key={idx}
                            className={ref.navContext ? 'inspector-reference-item inspector-reference-item--clickable' : 'inspector-reference-item'}
                            style={{
                                padding: '4px 0',
                                borderBottom: idx < references.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                                cursor: ref.navContext ? 'pointer' : 'default',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                            onClick={() => handleReferenceClick(ref.navContext)}
                            title={ref.navContext ? 'Click to navigate to this reference' : undefined}
                        >
                            <span style={{ flex: 1 }}>{ref.location}</span>
                            {ref.navContext && (
                                <ExternalLink size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="inspector-reference-placeholder">
                    <div className="inspector-reference-placeholder__desc">
                        {emptyMessage}
                    </div>
                </div>
            )}
        </div>
    );
};
