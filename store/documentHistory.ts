import type { Action, EditorState, HistoryEntry, HistorySnapshot, ProjectContent, SaveAcknowledgement } from './types';
import { compareProjectResources } from '../utils/projectResources';
import { reconcileHistoryUi } from './historyUi';

export const MAX_HISTORY_LENGTH = 50;

export function getHistoryEntry(state: EditorState): HistorySnapshot {
    const { stageTree, nodes, stateMachines, presentationGraphs, blackboard, meta, scripts } = state.project;
    return { content: { stageTree, nodes, stateMachines, presentationGraphs, blackboard, meta, scripts }, revision: state.document.revision, restrictedRevisions: state.document.restrictedRevisions };
}

/** 记录的是内容变动这一条操作；稳定身份不随撤销、重做或保存重新分配。 */
export function recordHistoryEntry(state: EditorState, action: Action): HistoryEntry {
    const agent = action.type === 'COMMIT_AUTOMATION';
    return { ...getHistoryEntry(state), operation: {
        entryId: `${state.document.sessionId}:${state.document.nextRevision}`,
        source: agent ? 'agent' : action.type === 'SYNC_RESOURCE_STATES' ? 'system' : 'human',
        summary: agent ? action.history?.summary ?? 'Apply domain plan' : action.type.toLowerCase().replaceAll('_', ' '),
        requiredCapabilities: agent ? [...(action.history?.requiredCapabilities ?? [])] : []
    } };
}

export function historyTop(state: EditorState, direction: 'UNDO' | 'REDO'): HistoryEntry | undefined {
    return direction === 'UNDO' ? state.history.past.at(-1) : state.history.future[0];
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

export function restoreHistory(state: EditorState, direction: 'UNDO' | 'REDO', agent?: Extract<Action, { type: 'RESTORE_AUTOMATION_HISTORY' }>): EditorState {
    const { past, future } = state.history;
    const entry = historyTop(state, direction);
    if (!entry || (agent && entry.operation.entryId !== agent.entryId)) return state;
    const current = { ...getHistoryEntry(state), operation: entry.operation };
    // Agent 的每次历史移动分配新限制，不能复用已被一次主动保存认可的标记。
    const restriction = agent?.restrictAutoSave ? state.document.nextRevision : null;
    const restrictedRevisions = restriction === null ? entry.restrictedRevisions
        : [...(entry.restrictedRevisions ?? []), restriction];
    const barrier = isPermanentResourceDeletion(state.project, entry.content);
    return {
        ...state,
        project: {
            ...state.project, ...entry.content,
            // 保存时间不是用户编辑，撤销不应把最近一次成功保存时间倒退。
            meta: { ...entry.content.meta, updatedAt: state.project.meta.updatedAt }
        },
        manifest: { ...state.manifest, scripts: Object.values(entry.content.scripts.scripts) },
        document: { ...state.document, revision: entry.revision, restrictedRevisions,
            nextRevision: restriction === null ? state.document.nextRevision : restriction + 1 },
        history: barrier ? { past: [], future: [] } : direction === 'UNDO'
            ? { past: past.slice(0, -1), future: [current, ...future] }
            : { past: [...past, current].slice(-MAX_HISTORY_LENGTH), future: future.slice(1) },
        ui: { ...reconcileHistoryUi(state.ui, entry.content),
            ...(agent ? { validationResults: agent.validationResults } : {}),
            isDirty: entry.revision !== state.document.savedRevision }
    };
}

/** 按实际前后资源差异建立边界，父级级联与整体替换也不能被 Undo 恢复。 */
export function isPermanentResourceDeletion(before: ProjectContent, after: ProjectContent): boolean {
    if (before.stageTree === after.stageTree && before.nodes === after.nodes && before.blackboard === after.blackboard && before.scripts === after.scripts) return false;
    return compareProjectResources(before, after).permanent.length > 0;
}
