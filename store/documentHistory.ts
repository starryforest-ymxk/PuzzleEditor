import type { Action, EditorState, HistoryEntry, ProjectContent, SaveAcknowledgement } from './types';
import type { ResourceState } from '../types/common';
import { reconcileHistoryUi } from './historyUi';

export const MAX_HISTORY_LENGTH = 50;

export function getHistoryEntry(state: EditorState): HistoryEntry {
    const { stageTree, nodes, stateMachines, presentationGraphs, blackboard, meta, scripts } = state.project;
    return { content: { stageTree, nodes, stateMachines, presentationGraphs, blackboard, meta, scripts }, revision: state.document.revision };
}

/** 成功加载/重置生成新会话，旧异步结果即使项目 ID 相同也不能确认这次保存。 */
export function beginDocument(previous: EditorState, next: EditorState, saved: boolean, path: string | null = null): EditorState {
    return {
        ...next,
        document: { sessionId: previous.document.sessionId + 1, revision: 0, nextRevision: 1, savedRevision: saved ? 0 : null },
        history: { past: [], future: [] },
        runtime: { ...next.runtime, currentProjectPath: path, isNewUnsavedProject: !saved },
        ui: { ...next.ui, isDirty: !saved }
    };
}

/** 保存只确认捕获的版本；并发新编辑继续 dirty，迟到的其他会话结果直接忽略。 */
export function acknowledgeSave(state: EditorState, saved: SaveAcknowledgement): EditorState {
    const expectedPath = saved.previousPath === undefined ? saved.path : saved.previousPath;
    if (saved.sessionId !== state.document.sessionId || expectedPath !== state.runtime.currentProjectPath
        || !Number.isInteger(saved.revision) || saved.revision < 0 || saved.revision >= state.document.nextRevision) return state;
    return {
        ...state,
        document: { ...state.document, savedRevision: saved.revision },
        project: { ...state.project, meta: { ...state.project.meta, updatedAt: saved.savedAt } },
        runtime: { ...state.runtime, currentProjectPath: saved.path, isNewUnsavedProject: false },
        ui: { ...state.ui, isDirty: state.document.revision !== saved.revision }
    };
}

export function restoreHistory(state: EditorState, direction: 'UNDO' | 'REDO'): EditorState {
    const { past, future } = state.history;
    const entry = direction === 'UNDO' ? past[past.length - 1] : future[0];
    if (!entry) return state;
    const current = getHistoryEntry(state);
    return {
        ...state,
        project: {
            ...state.project, ...entry.content,
            // 保存时间不是用户编辑，撤销不应把最近一次成功保存时间倒退。
            meta: { ...entry.content.meta, updatedAt: state.project.meta.updatedAt }
        },
        manifest: { ...state.manifest, scripts: Object.values(entry.content.scripts.scripts) },
        document: { ...state.document, revision: entry.revision },
        history: direction === 'UNDO'
            ? { past: past.slice(0, -1), future: [current, ...future] }
            : { past: [...past, current].slice(-MAX_HISTORY_LENGTH), future: future.slice(1) },
        ui: { ...reconcileHistoryUi(state.ui, entry.content), isDirty: entry.revision !== state.document.savedRevision }
    };
}

function deletionTarget(project: ProjectContent, action: Action): { state: ResourceState } | undefined {
    switch (action.type) {
        case 'SOFT_DELETE_GLOBAL_VARIABLE':
        case 'APPLY_DELETE_GLOBAL_VARIABLE': return project.blackboard.globalVariables[action.payload.id];
        case 'SOFT_DELETE_EVENT':
        case 'APPLY_DELETE_EVENT': return project.blackboard.events[action.payload.id];
        case 'SOFT_DELETE_SCRIPT':
        case 'APPLY_DELETE_SCRIPT': return project.scripts.scripts[action.payload.id];
        case 'SOFT_DELETE_STAGE_VARIABLE':
        case 'APPLY_DELETE_STAGE_VARIABLE':
        case 'DELETE_STAGE_VARIABLE': return project.stageTree.stages[action.payload.stageId]?.localVariables?.[action.payload.varId];
        case 'DELETE_NODE_PARAM': return project.nodes[action.payload.nodeId]?.localVariables?.[action.payload.varId];
        default: return undefined;
    }
}

/** 同一删除入口也可能用于 Draft；仅实际移除非 Draft 资源才形成不可撤销边界。 */
export function isPermanentResourceDeletion(before: ProjectContent, after: ProjectContent, action: Action): boolean {
    const target = deletionTarget(before, action);
    return !!target && target.state !== 'Draft' && !deletionTarget(after, action);
}
