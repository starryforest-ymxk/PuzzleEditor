/** 在线历史只读取共同历史栈，并根据实际恢复效果计算权限；不维护独立快照。 */
import type { EditorState, HistoryEntry, ProjectContent } from '../store/types';
import { MAX_HISTORY_LENGTH } from '../store/documentHistory';
import { analyzePermissions } from './automation/permissions';

export function historyPermissions(
  before: ProjectContent,
  entry: HistoryEntry,
  direction: 'UNDO' | 'REDO',
) {
  const actual = analyzePermissions(before, entry.content);
  return {
    ...actual,
    requiredCapabilities: [
      ...new Set([
        ...actual.requiredCapabilities,
        // Redo 重放原语义；过去对落盘的许可不能自动批准本次落盘。
        ...(direction === 'REDO'
          ? entry.operation.requiredCapabilities.filter((c) => c !== 'overwrite_project')
          : []),
      ]),
    ],
  };
}

export function describeHistory(state: EditorState) {
  const describe = (entries: HistoryEntry[], direction: 'UNDO' | 'REDO') => {
    let before: ProjectContent = state.project;
    return entries.map((entry) => {
      const permissions = historyPermissions(before, entry, direction);
      before = entry.content;
      return { ...entry.operation, targetRevision: entry.revision, ...permissions };
    });
  };
  const past = describe([...state.history.past].reverse(), 'UNDO');
  const future = describe(state.history.future, 'REDO');
  return {
    limit: MAX_HISTORY_LENGTH,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoEntryId: past[0]?.entryId ?? null,
    redoEntryId: future[0]?.entryId ?? null,
    past,
    future,
  };
}
