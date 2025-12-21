import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { VariableDefinition } from '../../types/blackboard';
import type { VariableType } from '../../types/common';
import type { MessageLevel } from '../../store/types';
import { useEditorDispatch, useEditorState } from '../../store/context';
import { withScope } from '../../utils/variableScope';
import { findNodeVariableReferences } from '../../utils/variableReferences';
import { generateResourceId } from '../../utils/resourceIdGenerator';
import { ConfirmDialog } from './ConfirmDialog';
import { LocalVariableCard } from './localVariable/LocalVariableCard';
import type { VariableReferenceInfo, ReferenceNavigationContext } from '../../utils/validation/globalVariableReferences';

export type LocalVariableOwner = 'node' | 'stage';

export interface LocalVariableEditorProps {
    variables: Record<string, VariableDefinition>;
    ownerType: LocalVariableOwner;
    ownerId?: string;
    readOnly?: boolean;
    // 可选外部引用解析器，便于 Stage 等场景自定义引用检查
    resolveReferences?: (varId: string) => string[];
    // 可选外部处理函数，便于 Stage/其他场景复用编辑逻辑
    onAddVariable?: (variable: VariableDefinition) => void;
    onUpdateVariable?: (varId: string, data: Partial<VariableDefinition>) => void;
    onDeleteVariable?: (varId: string) => void;
}

type ConfirmMode = 'soft-delete' | 'hard-delete' | 'delete';

// 按类型返回默认值，避免类型不匹配
const getDefaultValueByType = (type: VariableType) => {
    switch (type) {
        case 'boolean': return false;
        case 'integer': return 0;
        case 'float': return 0;
        case 'string': return '';
        default: return '';
    }
};

// 根据类型规范化输入值，保障存入 store 的值合法
const normalizeValueByType = (type: VariableType, raw: any) => {
    if (type === 'boolean') return raw === true || raw === 'true';
    if (type === 'integer') return Number.isNaN(parseInt(raw, 10)) ? 0 : parseInt(raw, 10);
    if (type === 'float') return Number.isNaN(parseFloat(raw)) ? 0 : parseFloat(raw);
    return raw ?? '';
};

// 通用局部变量编辑器，支持 Node/Stage 复用；Node 默认直接派发 store，Stage 可传入自定义回调
export const LocalVariableEditor: React.FC<LocalVariableEditorProps> = ({
    variables,
    ownerType,
    ownerId,
    readOnly = false,
    resolveReferences,
    onAddVariable,
    onUpdateVariable,
    onDeleteVariable
}) => {
    const { project } = useEditorState();
    const dispatch = useEditorDispatch();
    const vars = useMemo(() => Object.values(variables), [variables]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [confirmDialog, setConfirmDialog] = useState<{
        varId: string;
        title: string;
        message: string;
        refs: string[];
        mode: ConfirmMode;
    } | null>(null);
    const [prevDefaults, setPrevDefaults] = useState<Record<string, any>>({});

    // 仅 Node 场景默认提供内置引用解析；其他场景可由 resolveReferences 自定义
    // 现在返回完整的 VariableReferenceInfo，包含导航上下文
    const referenceMap = useMemo(() => {
        const map: Record<string, VariableReferenceInfo[]> = {};
        const resolver = resolveReferences;
        vars.forEach(v => {
            if (resolver) {
                // 外部解析器返回的是字符串数组，转换为 VariableReferenceInfo
                map[v.id] = (resolver(v.id) || []).map(loc => ({ location: loc }));
            } else if (ownerType === 'node' && ownerId) {
                // 内置解析器返回完整的引用信息，包含导航上下文
                map[v.id] = findNodeVariableReferences(project, ownerId, v.id);
            } else {
                map[v.id] = [];
            }
        });
        return map;
    }, [project, ownerId, ownerType, resolveReferences, vars]);

    /**
     * 点击引用项时导航到对应的编辑器界面并选中目标对象
     * 根据 navContext 中的目标类型进行不同的导航操作
     * 参考 BlackboardPanel 的 handleDoubleClickLocalVariable 模式：
     * 使用两次 dispatch，先导航再选中，确保视图切换后选中状态正确应用
     */
    const handleReferenceClick = useCallback((navContext: ReferenceNavigationContext) => {
        const { targetType, stageId, nodeId, stateId, transitionId, graphId, presentationNodeId } = navContext;

        switch (targetType) {
            case 'STAGE':
                // 导航到 Stage 并选中
                if (stageId) {
                    dispatch({ type: 'NAVIGATE_TO', payload: { stageId, nodeId: null, graphId: null } });
                    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: stageId } });
                }
                break;

            case 'NODE':
                if (nodeId) {
                    const node = project.nodes[nodeId];
                    if (node) {
                        // 先导航到目标位置
                        dispatch({
                            type: 'NAVIGATE_TO',
                            payload: {
                                stageId: node.stageId,
                                nodeId,
                                graphId: null
                            }
                        });
                        // 再选中目标对象
                        dispatch({
                            type: 'SELECT_OBJECT',
                            payload: { type: 'NODE', id: nodeId, contextId: nodeId }
                        });
                    }
                }
                break;

            case 'STATE':
                if (nodeId && stateId) {
                    const node = project.nodes[nodeId];
                    if (node) {
                        dispatch({
                            type: 'NAVIGATE_TO',
                            payload: {
                                stageId: node.stageId,
                                nodeId,
                                graphId: null
                            }
                        });
                        dispatch({
                            type: 'SELECT_OBJECT',
                            payload: { type: 'STATE', id: stateId, contextId: nodeId }
                        });
                    }
                }
                break;

            case 'TRANSITION':
                if (nodeId && transitionId) {
                    const node = project.nodes[nodeId];
                    if (node) {
                        dispatch({
                            type: 'NAVIGATE_TO',
                            payload: {
                                stageId: node.stageId,
                                nodeId,
                                graphId: null
                            }
                        });
                        dispatch({
                            type: 'SELECT_OBJECT',
                            payload: { type: 'TRANSITION', id: transitionId, contextId: nodeId }
                        });
                    }
                }
                break;

            case 'PRESENTATION_GRAPH':
                if (graphId) {
                    dispatch({
                        type: 'NAVIGATE_TO',
                        payload: { graphId }
                    });
                    dispatch({
                        type: 'SELECT_OBJECT',
                        payload: { type: 'PRESENTATION_GRAPH', id: graphId }
                    });
                }
                break;

            case 'PRESENTATION_NODE':
                if (graphId && presentationNodeId) {
                    dispatch({
                        type: 'NAVIGATE_TO',
                        payload: { graphId }
                    });
                    dispatch({
                        type: 'SELECT_OBJECT',
                        payload: { type: 'PRESENTATION_NODE', id: presentationNodeId, contextId: graphId }
                    });
                }
                break;
        }
    }, [project.nodes, dispatch]);

    // 同步已存在的值，用于数值失焦时回退
    useEffect(() => {
        setPrevDefaults((prev) => {
            const next: Record<string, any> = {};
            vars.forEach(v => {
                next[v.id] = prev[v.id] !== undefined ? prev[v.id] : v.value;
            });
            return next;
        });
    }, [vars]);

    const pushMessage = (level: MessageLevel, text: string) => {
        dispatch({
            type: 'ADD_MESSAGE',
            payload: { id: `msg-${Date.now()}`, level, text, timestamp: new Date().toISOString() }
        });
    };

    const hasNameConflict = (name: string, excludeId?: string) =>
        vars.some(v => v.id !== excludeId && v.name.trim().toLowerCase() === name.trim().toLowerCase());

    // 生成唯一名称，避免自动创建时重名
    const makeUniqueName = (base: string) => {
        let candidate = base;
        let counter = 2;
        while (hasNameConflict(candidate)) {
            candidate = `${base} (${counter})`;
            counter += 1;
        }
        return candidate;
    };

    const scopeLabel = ownerType === 'stage' ? 'stage-local' : 'node-local';
    const scopeKey = ownerType === 'stage' ? 'StageLocal' : 'NodeLocal';
    const supportsBuiltInActions = ownerType === 'node' && !!ownerId;
    const hasCustomHandlers = Boolean(onAddVariable || onUpdateVariable || onDeleteVariable);
    const canMutate = !readOnly && (supportsBuiltInActions || hasCustomHandlers);

    const handleAdd = () => {
        if (!canMutate || !ownerId) return;
        const normalizedName = makeUniqueName('New Variable');
        // 生成带 owner 前缀的局部变量 ID，确保项目内唯一性
        // 格式: {ownerId}_{STAGEVAR/NODEVAR}_{N}
        // 例如: STAGE_1_STAGEVAR_1, NODE_5_NODEVAR_2
        const existingIds = Object.keys(variables);
        const varTypePrefix = ownerType === 'stage' ? 'STAGEVAR' : 'NODEVAR';
        const pattern = new RegExp(`^${ownerId}_${varTypePrefix}_(\\d+)$`);
        let maxCount = 0;
        for (const existingId of existingIds) {
            const match = existingId.match(pattern);
            if (match) {
                maxCount = Math.max(maxCount, parseInt(match[1], 10));
            }
        }
        const id = `${ownerId}_${varTypePrefix}_${maxCount + 1}`;
        // 按作用域写入 scope，保持 P1 规范
        const variable: VariableDefinition = withScope({
            id,
            name: normalizedName,
            type: 'string',
            value: normalizeValueByType('string', ''),
            state: 'Draft',
            scope: scopeKey as any
        }, scopeKey as any);

        if (onAddVariable) {
            onAddVariable(variable);
        } else if (supportsBuiltInActions) {
            dispatch({ type: 'ADD_NODE_PARAM', payload: { nodeId: ownerId, variable } });
        }
        pushMessage('info', `Added ${scopeLabel} variable "${normalizedName}".`);
    };

    const handleUpdate = (id: string, field: string, value: any) => {
        if (!canMutate || !ownerId) return;
        const variable = variables[id];
        if (!variable || variable.state === 'MarkedForDelete') return;

        if (field === 'name') {
            const trimmed = String(value).trim();
            if (!trimmed) {
                setErrors(prev => ({ ...prev, [id]: 'Name cannot be empty' }));
                return;
            }
            if (hasNameConflict(trimmed, id)) {
                setErrors(prev => ({ ...prev, [id]: 'Duplicate variable name' }));
                pushMessage('warning', `Rename conflict: "${trimmed}" is already used.`);
                return;
            }
            value = trimmed;
        }

        const data: any = { [field]: value };
        if (field === 'type') {
            // 切换类型时同步重置值，避免类型不匹配
            data.value = getDefaultValueByType(value as VariableType);
        }

        if (onUpdateVariable) {
            onUpdateVariable(id, data);
        } else if (supportsBuiltInActions) {
            dispatch({ type: 'UPDATE_NODE_PARAM', payload: { nodeId: ownerId, varId: id, data } });
        }
        setErrors(prev => ({ ...prev, [id]: '' }));
    };

    // 软删/硬删统一出口，保持消息语义一致
    const applyDeleteAction = (varId: string, mode: ConfirmMode, refs: string[]) => {
        const variable = variables[varId];
        if (!variable) {
            setConfirmDialog(null);
            return;
        }

        if (onDeleteVariable) {
            onDeleteVariable(varId);
        } else if (supportsBuiltInActions) {
            dispatch({ type: 'DELETE_NODE_PARAM', payload: { nodeId: ownerId!, varId } });
        }

        if (mode === 'soft-delete' && variable.state === 'Implemented') {
            pushMessage('warning', `Marked ${scopeLabel} variable "${variable.name}" for delete. Editing is now locked.`);
        } else if (mode === 'hard-delete' || variable.state === 'MarkedForDelete') {
            pushMessage(refs.length > 0 ? 'warning' : 'info', `Permanently deleted ${scopeLabel} variable "${variable.name}".`);
        } else {
            pushMessage(refs.length > 0 ? 'warning' : 'info', `Deleted ${scopeLabel} variable "${variable.name}".`);
        }

        setConfirmDialog(null);
    };

    const handleRestore = (id: string) => {
        if (!canMutate || !ownerId) return;
        const variable = variables[id];
        if (!variable || variable.state !== 'MarkedForDelete') return;

        if (onUpdateVariable) {
            onUpdateVariable(id, { state: 'Implemented' });
        } else if (supportsBuiltInActions) {
            dispatch({ type: 'UPDATE_NODE_PARAM', payload: { nodeId: ownerId, varId: id, data: { state: 'Implemented' } } });
        }
        pushMessage('info', `Restored ${scopeLabel} variable "${variable.name}" to Implemented state.`);
    };

    const handleDelete = (id: string) => {
        if (!canMutate || !ownerId) return;
        const variable = variables[id];
        if (!variable) return;
        const refs = referenceMap[id] || [];
        // 提取位置字符串用于 ConfirmDialog 显示
        const refLocations = refs.map(r => r.location);
        const preview = refLocations.slice(0, 5);
        const hasRefs = refs.length > 0;

        if (variable.state === 'MarkedForDelete') {
            setConfirmDialog({
                varId: id,
                title: 'Apply Delete (Irreversible)',
                message: 'This variable is already marked for delete. Applying delete will permanently remove it. This action cannot be undone.',
                refs: preview,
                mode: 'hard-delete'
            });
            return;
        }

        if (hasRefs) {
            const isImplemented = variable.state === 'Implemented';
            setConfirmDialog({
                varId: id,
                title: isImplemented ? 'Mark For Delete' : 'Confirm Delete',
                message: `Variable "${variable.name}" is referenced ${refs.length} time(s). ${isImplemented ? 'It will be marked as "MarkedForDelete" and locked.' : 'Deleting it will require fixing those references manually.'}`,
                refs: preview,
                mode: isImplemented ? 'soft-delete' : 'delete'
            });
            return;
        }

        if (variable.state === 'Implemented') {
            applyDeleteAction(id, 'soft-delete', refs);
            return;
        }

        applyDeleteAction(id, 'delete', refs);
    };

    const handleConfirmDelete = () => {
        if (!confirmDialog || !canMutate || !ownerId) return;
        const { varId, mode, refs } = confirmDialog;
        const actualRefs = referenceMap[varId] || refs;
        applyDeleteAction(varId, mode, actualRefs);
    };

    // 数值类型失焦校验：无效则回退到上一次合法值
    const handleNumberBlur = (varId: string, raw: any) => {
        if (!canMutate || !ownerId) return;
        const variable = variables[varId];
        if (!variable) return;
        if (variable.state === 'MarkedForDelete') return;
        const type = variable.type;
        if (type !== 'integer' && type !== 'float') return;

        const parsed = type === 'integer' ? parseInt(raw, 10) : parseFloat(raw);
        const prevValue = prevDefaults[varId] !== undefined ? prevDefaults[varId] : variable.value;

        if (Number.isNaN(parsed)) {
            if (onUpdateVariable) {
                onUpdateVariable(varId, { value: prevValue });
            } else if (supportsBuiltInActions) {
                dispatch({ type: 'UPDATE_NODE_PARAM', payload: { nodeId: ownerId, varId, data: { value: prevValue } } });
            }
        } else {
            if (onUpdateVariable) {
                onUpdateVariable(varId, { value: parsed });
            } else if (supportsBuiltInActions) {
                dispatch({ type: 'UPDATE_NODE_PARAM', payload: { nodeId: ownerId, varId, data: { value: parsed } } });
            }
            setPrevDefaults((old) => ({ ...old, [varId]: parsed }));
        }
    };

    const confirmButtonLabel = confirmDialog?.mode === 'hard-delete'
        ? 'Apply Delete'
        : confirmDialog?.mode === 'soft-delete'
            ? 'Mark for Delete'
            : 'Delete';

    return (
        <div className="inspector-list-container">
            {vars.length === 0 && (
                <div className="inspector-empty-hint">
                    No local variables defined
                </div>
            )}

            {vars.map(v => (
                <LocalVariableCard
                    key={v.id}
                    variable={v}
                    canMutate={canMutate}
                    readOnly={readOnly}
                    referenceCount={referenceMap[v.id]?.length || 0}
                    references={referenceMap[v.id] || []}
                    error={errors[v.id]}
                    onUpdate={(field, val) => handleUpdate(v.id, field as string, val)}
                    onDelete={() => handleDelete(v.id)}
                    onRestore={() => handleRestore(v.id)}
                    onNumberBlur={(raw) => handleNumberBlur(v.id, raw)}
                    onReferenceClick={handleReferenceClick}
                />
            ))}

            {canMutate && (
                <button className="btn-add-ghost btn-add-ghost--with-margin" onClick={handleAdd} disabled={!canMutate}>
                    + Add Variable
                </button>
            )}

            {confirmDialog && canMutate && (
                <ConfirmDialog
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    confirmText={confirmButtonLabel}
                    references={confirmDialog.refs}
                    totalReferences={referenceMap[confirmDialog.varId]?.length}
                    onCancel={() => setConfirmDialog(null)}
                    onConfirm={handleConfirmDelete}
                />
            )}
        </div>
    );
};
