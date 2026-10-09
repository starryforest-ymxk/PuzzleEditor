import type { ProjectData } from '../types/project';
import { collectLocalVariables, localVariableKey } from './blackboard';
import { collectResourceReferences } from './resourceReferences';

export interface BlackboardReferenceCounts {
  globalVariableRefCounts: Record<string, number>;
  localVariableRefCounts: Record<string, number>;
  scriptRefCounts: Record<string, number>;
  eventRefCounts: Record<string, number>;
  graphRefCounts: Record<string, number>;
}

/** 一次遍历引用建立黑板计数，位置列表与数量使用同一套实际作用域语义。 */
export function buildBlackboardReferenceCounts(project: ProjectData): BlackboardReferenceCounts {
  const empty = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 0]));
  const result: BlackboardReferenceCounts = {
    globalVariableRefCounts: empty(Object.keys(project.blackboard.globalVariables)),
    localVariableRefCounts: empty(collectLocalVariables(project).map(localVariableKey)),
    scriptRefCounts: empty(Object.keys(project.scripts.scripts)),
    eventRefCounts: empty(Object.keys(project.blackboard.events)),
    graphRefCounts: empty(Object.keys(project.presentationGraphs)),
  };
  for (const ref of collectResourceReferences(project)) {
    let key = ref.id;
    let counts: Record<string, number>;
    if (ref.type === 'variable') {
      if (ref.ownerType === 'project') counts = result.globalVariableRefCounts;
      else if (ref.ownerType === 'stage' || ref.ownerType === 'puzzle') {
        counts = result.localVariableRefCounts;
        key = JSON.stringify([ref.ownerType === 'stage' ? 'Stage' : 'Node', ref.ownerId, ref.id]);
      } else continue;
    } else
      counts =
        ref.type === 'script'
          ? result.scriptRefCounts
          : ref.type === 'event'
            ? result.eventRefCounts
            : result.graphRefCounts;
    if (Object.hasOwn(counts, key)) counts[key]++;
  }
  return result;
}
