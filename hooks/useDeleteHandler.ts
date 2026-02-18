/**
 * hooks/useDeleteHandler.ts
 * 统一删除逻辑处理 Hook
 * 
 * 职责：
 * 1. 封装所有对象（Stage, Variable, Script, Event等）的删除检查逻辑
 * 2. 统一处理引用检查、内容检查
 * 3. 统一处理状态检查（Draft vs Implemented -> Soft Delete vs Hard Delete）
 * 4. 统一触发全局确认弹窗 (SET_CONFIRM_DIALOG)
 */

import { useCallback } from 'react';
import { useEditorState, useEditorDispatch } from '../store/context';
import { hasStageContent, getStageNodeIds } from '../utils/stageTreeUtils';
import { findGlobalVariableReferences } from '../utils/validation/globalVariableReferences';
import { findScriptReferences } from '../utils/validation/scriptReferences';
import { findEventReferences } from '../utils/validation/eventReferences';
import { findPresentationGraphReferences } from '../utils/validation/presentationGraphReferences';
import type { StageId } from '../types/common';
import type { VariableDefinition } from '../types/blackboard';
import type { ScriptDefinition } from '../types/manifest';
import type { EventDefinition } from '../types/blackboard';
import { usePushMessage } from './usePushMessage';

export function useDeleteHandler() {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();

    // 消息推送（复用共享 Hook）
    const pushMessage = usePushMessage();

    // ========== Stage 删除 ==========
    const deleteStage = useCallback((stageId: string) => {
        const stage = project.stageTree.stages[stageId];
        if (!stage) return;

        const contentInfo = hasStageContent(project.stageTree, project.nodes, stageId as StageId);

        if (contentInfo.hasChildren || contentInfo.totalDescendantStages > 0 || contentInfo.totalDescendantNodes > 0) {
            dispatch({
                type: 'SET_CONFIRM_DIALOG',
                payload: {
                    isOpen: true,
                    title: 'Delete Stage',
                    message: `Are you sure you want to delete "${stage.name}"? This will also delete all child content. This action cannot be undone.`,
                    confirmAction: { type: 'DELETE_STAGE', payload: { stageId } },
                    danger: true,
                    references: undefined  // 显式清空
                }
            });
        } else {
            dispatch({ type: 'DELETE_STAGE', payload: { stageId } });
        }
    }, [project.stageTree, project.nodes, dispatch]);

    // ========== Global Variable 删除 ==========
    const deleteGlobalVariable = useCallback((variableId: string) => {
        const variable = project.blackboard.globalVariables[variableId];
        if (!variable) return;

        const references = findGlobalVariableReferences(project, variableId);
        const hasRefs = references.length > 0;
        const isImplemented = variable.state === 'Implemented';
        const isMarkedForDelete = variable.state === 'MarkedForDelete';

        // 1. Hard Delete (已经是 MarkedForDelete)
        if (isMarkedForDelete) {
            dispatch({
                type: 'SET_CONFIRM_DIALOG',
                payload: {
                    isOpen: true,
                    title: 'Apply Delete (Irreversible)',
                    message: 'This variable is already marked for delete. Applying delete will permanently remove it. This action cannot be undone.',
                    confirmAction: { type: 'APPLY_DELETE_GLOBAL_VARIABLE', payload: { id: variableId } },
                    danger: true,
                    references: undefined  // 显式清空
                }
            });
            return;
        }

        // 2. Soft Delete or Delete with References
        if (hasRefs) {
            const refStrings = references.map(r => r.detail ? `${r.location} (${r.detail})` : r.location);
            dispatch({
                type: 'SET_CONFIRM_DIALOG',
                payload: {
                    isOpen: true,
                    title: isImplemented ? 'Mark For Delete' : 'Confirm Delete',
                    message: `Variable "${variable.name}" is referenced ${references.length} time(s). ${isImplemented ? 'It will be marked as "MarkedForDelete" and locked.' : 'Deleting it will require fixing those references manually.'}`,
                    confirmAction: isImplemented
                        ? { type: 'SOFT_DELETE_GLOBAL_VARIABLE', payload: { id: variableId } }
                        : { type: 'APPLY_DELETE_GLOBAL_VARIABLE', payload: { id: variableId } },
                    danger: true,
                    references: refStrings
                }
            });
            return;
        }

        // 3. No References
        if (isImplemented) {
            dispatch({ type: 'SOFT_DELETE_GLOBAL_VARIABLE', payload: { id: variableId } });
            pushMessage('warning', `Marked global variable "${variable.name}" for delete.`);
        } else {
            dispatch({ type: 'APPLY_DELETE_GLOBAL_VARIABLE', payload: { id: variableId } });
            pushMessage('info', `Deleted global variable "${variable.name}".`);
        }

    }, [project, dispatch, pushMessage]);

    // ========== Script 删除 ==========
    const deleteScript = useCallback((scriptId: string) => {
        const script = project.scripts.scripts[scriptId];
        if (!script) return;

        const references = findScriptReferences(project, scriptId);
        const hasRefs = references.length > 0;
        const isImplemented = script.state === 'Implemented';
        const isMarkedForDelete = script.state === 'MarkedForDelete';

        if (isMarkedForDelete) {
            dispatch({
                type: 'SET_CONFIRM_DIALOG',
                payload: {
                    isOpen: true,
                    title: 'Apply Delete (Irreversible)',
                    message: 'This script is already marked for delete. Applying delete will permanently remove it. This action cannot be undone.',
                    confirmAction: { type: 'APPLY_DELETE_SCRIPT', payload: { id: scriptId } },
                    danger: true,
                    references: undefined  // 显式清空
                }
            });
            return;
        }

        if (hasRefs) {
            const refStrings = references.map(r => r.detail ? `${r.location} (${r.detail})` : r.location);
            dispatch({
                type: 'SET_CONFIRM_DIALOG',
                payload: {
                    isOpen: true,
                    title: isImplemented ? 'Mark For Delete' : 'Confirm Delete',
                    message: `Script "${script.name}" is referenced ${references.length} time(s). ${isImplemented ? 'It will be marked as "MarkedForDelete" and locked.' : 'Deleting it will require fixing those references manually.'}`,
                    confirmAction: isImplemented
                        ? { type: 'SOFT_DELETE_SCRIPT', payload: { id: scriptId } }
                        : { type: 'APPLY_DELETE_SCRIPT', payload: { id: scriptId } },
                    danger: true,
                    references: refStrings
                }
            });
            return;
        }

        if (isImplemented) {
            dispatch({ type: 'SOFT_DELETE_SCRIPT', payload: { id: scriptId } });
            pushMessage('warning', `Marked script "${script.name}" for delete.`);
        } else {
            dispatch({ type: 'APPLY_DELETE_SCRIPT', payload: { id: scriptId } });
            pushMessage('info', `Deleted script "${script.name}".`);
        }
    }, [project, dispatch, pushMessage]);

    // ========== Event 删除 ==========
    const deleteEvent = useCallback((eventId: string) => {
        const event = project.blackboard.events[eventId];
        if (!event) return;

        const references = findEventReferences(project, eventId);
        const hasRefs = references.length > 0;
        const isImplemented = event.state === 'Implemented';
        const isMarkedForDelete = event.state === 'MarkedForDelete';

        if (isMarkedForDelete) {
            dispatch({
                type: 'SET_CONFIRM_DIALOG',
                payload: {
                    isOpen: true,
                    title: 'Apply Delete (Irreversible)',
                    message: 'This event is already marked for delete. Applying delete will permanently remove it. This action cannot be undone.',
                    confirmAction: { type: 'APPLY_DELETE_EVENT', payload: { id: eventId } },
                    danger: true,
                    references: undefined  // 显式清空
                }
            });
            return;
        }

        if (hasRefs) {
            const refStrings = references.map(r => r.detail ? `${r.location} (${r.detail})` : r.location);
            dispatch({
                type: 'SET_CONFIRM_DIALOG',
                payload: {
                    isOpen: true,
                    title: isImplemented ? 'Mark For Delete' : 'Confirm Delete',
                    message: `Event "${event.name}" is referenced ${references.length} time(s). ${isImplemented ? 'It will be marked as "MarkedForDelete" and locked.' : 'Deleting it will require fixing those references manually.'}`,
                    confirmAction: isImplemented
                        ? { type: 'SOFT_DELETE_EVENT', payload: { id: eventId } }
                        : { type: 'APPLY_DELETE_EVENT', payload: { id: eventId } },
                    danger: true,
                    references: refStrings
                }
            });
            return;
        }

        if (isImplemented) {
            // Implemented + 无引用：软删除，标记为 MarkedForDelete
            dispatch({ type: 'SOFT_DELETE_EVENT', payload: { id: eventId } });
            pushMessage('warning', `Marked event "${event.name}" for delete.`);
        } else {
            // Draft + 无引用：直接物理删除
            dispatch({ type: 'APPLY_DELETE_EVENT', payload: { id: eventId } });
            pushMessage('info', `Deleted event "${event.name}".`);
        }
    }, [project, dispatch, pushMessage]);

    // ========== Node 删除 ==========
    const deleteNode = useCallback((nodeId: string) => {
        const node = project.nodes[nodeId];
        if (!node) return;

        const stage = project.stageTree.stages[node.stageId];
        const stageNodeIds = getStageNodeIds(project.nodes, node.stageId);
        const siblingCount = stageNodeIds.length - 1;

        dispatch({
            type: 'SET_CONFIRM_DIALOG',
            payload: {
                isOpen: true,
                title: 'Delete Puzzle Node',
                message: `Are you sure you want to delete "${node.name}"? This will also remove its state machine. This action cannot be undone.`,
                confirmAction: { type: 'DELETE_PUZZLE_NODE', payload: { nodeId } },
                danger: true,
                references: undefined // Explicitly clear references
            }
        });
    }, [project.nodes, project.stageTree.stages, dispatch]);

    // ========== Presentation Graph 删除 ==========
    const deletePresentationGraph = useCallback((graphId: string) => {
        const graph = project.presentationGraphs[graphId];
        if (!graph) return;

        // 演出图引用检查
        const refs = findPresentationGraphReferences(project, graphId);
        const nodeCount = Object.keys(graph.nodes || {}).length;

        if (refs.length > 0) {
            // 有外部引用：弹窗确认并展示引用列表
            const refStrings = refs.map(r => r.detail ? `${r.location} (${r.detail})` : r.location);
            dispatch({
                type: 'SET_CONFIRM_DIALOG',
                payload: {
                    isOpen: true,
                    title: 'Delete Presentation Graph',
                    message: `This graph "${graph.name}" is referenced by ${refs.length} PlayGraph node(s). Delete anyway?`,
                    confirmAction: { type: 'DELETE_PRESENTATION_GRAPH', payload: { graphId } },
                    danger: true,
                    references: refStrings
                }
            });
        } else if (nodeCount > 0) {
            // 无外部引用但包含节点：弹窗确认
            dispatch({
                type: 'SET_CONFIRM_DIALOG',
                payload: {
                    isOpen: true,
                    title: 'Delete Presentation Graph',
                    message: `Graph "${graph.name}" contains ${nodeCount} node(s). Are you sure you want to delete it?`,
                    confirmAction: { type: 'DELETE_PRESENTATION_GRAPH', payload: { graphId } },
                    danger: true,
                    references: undefined
                }
            });
        } else {
            // 无引用且无节点：直接删除
            dispatch({ type: 'DELETE_PRESENTATION_GRAPH', payload: { graphId } });
            pushMessage('info', `Deleted presentation graph "${graph.name}".`);
        }
    }, [project, dispatch, pushMessage]);

    // ========== 通用 Selection 删除 ==========
    const deleteSelection = useCallback(() => {
        // 1. Multi-Select
        if (ui.multiSelectStateIds.length > 0 && ui.selection.contextId) {
            const nodeId = ui.selection.contextId;
            const node = project.nodes[nodeId];
            if (node && node.stateMachineId) {
                const fsmId = node.stateMachineId;
                ui.multiSelectStateIds.forEach(stateId => {
                    dispatch({ type: 'DELETE_STATE', payload: { fsmId, stateId } });
                });
                dispatch({ type: 'SET_MULTI_SELECT_STATES', payload: [] });
            }
            return;
        }

        if (ui.multiSelectPresentationNodeIds.length > 0 && ui.selection.contextId) {
            const graphId = ui.selection.contextId;
            ui.multiSelectPresentationNodeIds.forEach(nodeId => {
                dispatch({ type: 'DELETE_PRESENTATION_NODE', payload: { graphId, nodeId } });
            });
            dispatch({ type: 'SET_MULTI_SELECT_PRESENTATION_NODES', payload: [] });
            return;
        }

        // 2. Single Selection
        const { type, id, contextId } = ui.selection;
        if (!id || type === 'NONE') return;

        switch (type) {
            case 'STAGE':
                deleteStage(id);
                break;
            case 'VARIABLE':
                // 目前只处理全局变量快捷键删除，局部变量需上下文判断（暂时仅Global）
                if (project.blackboard.globalVariables[id]) {
                    deleteGlobalVariable(id);
                }
                break;
            case 'SCRIPT':
                deleteScript(id);
                break;
            case 'EVENT':
                deleteEvent(id);
                break;
            case 'PRESENTATION_GRAPH':
                // Blackboard 视图下允许通过快捷键删除演出图
                if (ui.view === 'BLACKBOARD') {
                    deletePresentationGraph(id);
                }
                // Editor 视图下不执行任何操作（防止误删）
                break;
            // Canvas Elements (Direct Delete)
            case 'NODE':
                // 现在 FSM 画布背景点击不再设置为 NODE，因此这里的 NODE 选中必定来自 Explorer 或其他明确操作
                // 允许删除
                deleteNode(id);
                break;
            case 'STATE':
                if (contextId) {
                    const node = project.nodes[contextId];
                    if (node && node.stateMachineId) {
                        dispatch({ type: 'DELETE_STATE', payload: { fsmId: node.stateMachineId, stateId: id } });
                    }
                }
                break;
            case 'TRANSITION':
                if (contextId) {
                    const node = project.nodes[contextId];
                    if (node && node.stateMachineId) {
                        dispatch({ type: 'DELETE_TRANSITION', payload: { fsmId: node.stateMachineId, transitionId: id } });
                    }
                }
                break;
            case 'PRESENTATION_NODE':
                if (contextId) dispatch({ type: 'DELETE_PRESENTATION_NODE', payload: { graphId: contextId, nodeId: id } });
                break;
        }
    }, [ui.selection, ui.multiSelectStateIds, ui.multiSelectPresentationNodeIds, deleteStage, deleteGlobalVariable, deleteScript, deleteEvent, deletePresentationGraph, dispatch, project.blackboard.globalVariables, project.nodes]);

    // ========== 通用恢复操作 ==========
    /**
     * 将 MarkedForDelete 状态的资源恢复为 Implemented
     * 适用于 Script / Event / GlobalVariable 三种资源类型
     */
    const restoreResource = useCallback((
        resourceType: 'SCRIPT' | 'EVENT' | 'GLOBAL_VARIABLE',
        resourceId: string,
        resourceName: string
    ) => {
        const actionTypeMap: Record<string, string> = {
            'SCRIPT': 'UPDATE_SCRIPT',
            'EVENT': 'UPDATE_EVENT',
            'GLOBAL_VARIABLE': 'UPDATE_GLOBAL_VARIABLE',
        };
        const labelMap: Record<string, string> = {
            'SCRIPT': 'script',
            'EVENT': 'event',
            'GLOBAL_VARIABLE': 'global variable',
        };
        dispatch({
            type: actionTypeMap[resourceType] as any,
            payload: { id: resourceId, data: { state: 'Implemented' } }
        });
        pushMessage('info', `Restored ${labelMap[resourceType]} "${resourceName}" to Implemented state.`);
    }, [dispatch, pushMessage]);

    return {
        deleteStage,
        deleteGlobalVariable,
        deleteScript,
        deleteEvent,
        deletePresentationGraph,
        deleteNode,
        deleteSelection,
        restoreResource
    };
}
