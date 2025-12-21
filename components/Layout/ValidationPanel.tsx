/**
 * components/Layout/ValidationPanel.tsx
 * 校验结果面板
 */

import React, { useMemo } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ValidationResult } from '../../store/types';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

interface ValidationPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({ isOpen, onClose }) => {
    const { ui } = useEditorState();
    const dispatch = useEditorDispatch();
    const results = ui.validationResults || [];

    const groupedResults = useMemo(() => {
        return {
            error: results.filter(r => r.level === 'error'),
            warning: results.filter(r => r.level === 'warning'),
            hint: results.filter(r => r.level === 'hint')
        };
    }, [results]);

    if (!isOpen) return null;

    const handleNavigate = (result: ValidationResult) => {
        // 构建 Navigation Request
        let navPayload: any = {};

        switch (result.objectType) {
            case 'STAGE':
                navPayload = { stageId: result.objectId };
                // 也要选中
                dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: result.objectId } });
                break;
            case 'NODE':
                navPayload = { stageId: null, nodeId: result.objectId }; // 需要先找到 stage吗？NAVIGATE_TO如果只有 nodeId 会自动找 stage 吗？
                // 目前 reducer 的 NAVIGATE_TO 可能需要 stageId。
                // 暂时假设 NAVIGATE_TO 支持查找或我们在校验结果里多存点信息。
                // 为简便，我们在 validator 生成结果时最好带上 contextId。
                // 如果是 NODE，contextId 可以为空（如果 reducer 能处理）或者 validator 查好 stageId 填入 contextId？
                // 让我们看看 VALIDATOR 的实现，NODE 类型的 check 没有填 contextId (undefined)。
                // 实际上 NAVIGATE_TO 只接受 { stageId, nodeId, graphId }。
                // 如果只给 nodeId，Reducer 可能不知道去哪个 Stage。
                // 但 Node 全局唯一，我们可以遍历查找 (expensive) 或让 validator 预先填好。
                // 我们在 validator 里改进一下？
                // 先尝试只 dispatch SELECT_OBJECT，可能不会跳转视图？
                // 编辑器主要靠 NAVIGATE_TO 切换视图。
                // 
                // 为了简单，我们只 dispatch selection，看 MainLayout 是否响应。
                // 如果不行，我们回头改 validator 把 stageId 塞进 contextId。

                // 妥协方案：尝试只 select，用户可能在 Explorer 看到高亮？
                // 或者我们这里做一个简单的查找 (ui.project.nodes[id].stageId)
                // 幸运的是我们有 useEditorState 拿到 project。
                break;
            case 'STATE':
            case 'TRANSITION':
                // contextId is nodeId
                if (result.contextId) {
                    navPayload = { nodeId: result.contextId };
                    dispatch({ type: 'SELECT_OBJECT', payload: { type: result.objectType, id: result.objectId, contextId: result.contextId } });
                }
                break;
            case 'PRESENTATION_GRAPH':
                navPayload = { graphId: result.objectId };
                dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_GRAPH', id: result.objectId } });
                break;
        }

        // 特殊处理 NODE，需要查找 StageId
        if (result.objectType === 'NODE') {
            // 无法直接访问 project (context里只有 ui? 不，context有 project)
            // 下面这行会报错，因为 handleNavigate 是回调。
            // 我们需要在组件体内获取 project。
        }

        dispatch({ type: 'NAVIGATE_TO', payload: navPayload });
    };

    return (
        <div className="validation-panel" style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '200px',
            background: 'var(--bg-color)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100,
            boxShadow: '0 -4px 12px rgba(0,0,0,0.2)'
        }}>
            <div className="validation-header" style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-secondary)'
            }}>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-error)' }}>
                        <X size={14} /> {groupedResults.error.length} Errors
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-warning)' }}>
                        <AlertTriangle size={14} /> {groupedResults.warning.length} Warnings
                    </div>
                </div>
                <button onClick={onClose} className="btn-icon">
                    <X size={16} />
                </button>
            </div>

            <div className="validation-content" style={{ flex: 1, overflowY: 'auto' }}>
                {results.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        No validation issues found.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <tbody>
                            {results.map((res, idx) => (
                                <TableItem key={idx} result={res} onNavigate={() => handleNavigate(res)} />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

const TableItem: React.FC<{ result: ValidationResult, onNavigate: () => void }> = ({ result, onNavigate }) => {
    // 注入 project 数据以查找 StageId
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();

    const handleClick = () => {
        let navPayload: any = {};

        if (result.objectType === 'NODE') {
            const node = project.nodes[result.objectId];
            if (node) {
                navPayload = { stageId: node.stageId, nodeId: node.id };
            }
        } else if (result.objectType === 'STAGE') {
            navPayload = { stageId: result.objectId };
        } else if (result.objectType === 'PRESENTATION_GRAPH') {
            navPayload = { graphId: result.objectId };
        } else if ((result.objectType === 'STATE' || result.objectType === 'TRANSITION') && result.contextId) {
            const node = project.nodes[result.contextId];
            if (node) {
                navPayload = { stageId: node.stageId, nodeId: node.id };
            }
        }

        if (Object.keys(navPayload).length > 0) {
            dispatch({ type: 'NAVIGATE_TO', payload: navPayload });
        }

        // Select
        if (['STAGE', 'NODE', 'STATE', 'TRANSITION', 'PRESENTATION_GRAPH'].includes(result.objectType)) {
            dispatch({
                type: 'SELECT_OBJECT',
                payload: {
                    type: result.objectType as any,
                    id: result.objectId,
                    contextId: result.contextId
                }
            });
        }
    };

    return (
        <tr
            style={{
                borderBottom: '1px solid var(--border-secondary)',
                cursor: 'pointer',
                // hover effect managed by css usually, imply style here
            }}
            onClick={handleClick}
            className="validation-row"
        >
            <td style={{ padding: '6px 12px', width: '24px' }}>
                {result.level === 'error' && <AlertCircle size={14} color="var(--accent-error)" />}
                {result.level === 'warning' && <AlertTriangle size={14} color="var(--accent-warning)" />}
                {result.level === 'hint' && <Info size={14} color="var(--text-primary)" />}
            </td>
            <td style={{ padding: '6px 12px', color: 'var(--text-primary)' }}>{result.message}</td>
            <td style={{ padding: '6px 12px', color: 'var(--text-secondary)', textAlign: 'right' }}>{result.location}</td>
        </tr>
    );
};
