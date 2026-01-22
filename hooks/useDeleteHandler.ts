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
import type { MessageLevel } from '../store/types';

export function useDeleteHandler() {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();

    // 辅助：推送消息
    const pushMessage = useCallback((level: MessageLevel, text: string) => {
        dispatch({
            type: 'ADD_MESSAGE',
            payload: { id: `msg-${Date.now()}`, level, text, timestamp: new Date().toISOString() }
        });
    }, [dispatch]);

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
            dispatch({ type: 'SOFT_DELETE_EVENT', payload: { id: eventId } });
            pushMessage('warning', `Marked event "${event.name}" for delete.`);
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

        // Presentation Graph 引用检查
        const refs = findPresentationGraphReferences(project, graphId);

        if (refs.length > 0) {
            const refStrings = refs.map(r => r.detail ? `${r.location} (${r.detail})` : r.location);
            dispatch({
                type: 'SET_CONFIRM_DIALOG',
                payload: {
                    isOpen: true,
                    title: 'Delete Presentation Graph',
                    message: `This graph "${graph.name}" is referenced by ${refs.length} PlayGraph nodes. Delete anyway?`,
                    confirmAction: { type: 'DELETE_PRESENTATION_GRAPH', payload: { graphId } },
                    danger: true,
                    references: refStrings
                }
            });
        } else {
            // 没有引用也需要二次确认
            dispatch({
                type: 'SET_CONFIRM_DIALOG',
                payload: {
                    isOpen: true,
                    title: 'Delete Presentation Graph',
                    message: `Are you sure you want to delete presentation graph "${graph.name}"?`,
                    confirmAction: { type: 'DELETE_PRESENTATION_GRAPH', payload: { graphId } },
                    danger: true,
                    references: undefined  // 显式清空，避免显示旧的引用列表
                }
            });
        }
    }, [project, dispatch]);

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

    return {
        deleteStage,
        deleteGlobalVariable,
        deleteScript,
        deleteEvent,
        deletePresentationGraph,
        deleteNode,
        deleteSelection
    };
}
