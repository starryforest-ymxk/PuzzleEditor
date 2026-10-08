import type { ProjectData } from '../../types/project';
import { collectLocalVariables, localVariableKey } from '../../utils/blackboard';
import { findGlobalVariableReferences } from '../../utils/validation/globalVariableReferences';
import { findStageVariableReferences } from '../../utils/validation/stageVariableReferences';
import { findNodeVariableReferences } from '../../utils/validation/variableReferences';
import { findScriptReferences } from '../../utils/validation/scriptReferences';
import { findEventReferences } from '../../utils/validation/eventReferences';
import { findPresentationGraphReferences } from '../../utils/validation/presentationGraphReferences';

/** 第五批现有位置查询作为独立行为对照，禁止以新索引自身生成期望值。 */
export function referenceOracle(project: ProjectData) {
  const counts = (ids: string[], find: (id: string) => unknown[]) =>
    Object.fromEntries(ids.map((id) => [id, find(id).length]));
  return {
    globalVariableRefCounts: counts(Object.keys(project.blackboard.globalVariables), (id) =>
      findGlobalVariableReferences(project, id),
    ),
    localVariableRefCounts: Object.fromEntries(
      collectLocalVariables(project).map((v) => [
        localVariableKey(v),
        (v.scopeType === 'Node'
          ? findNodeVariableReferences(project, v.scopeId, v.id)
          : findStageVariableReferences(project, v.scopeId, v.id)
        ).length,
      ]),
    ),
    scriptRefCounts: counts(Object.keys(project.scripts.scripts), (id) =>
      findScriptReferences(project, id),
    ),
    eventRefCounts: counts(Object.keys(project.blackboard.events), (id) =>
      findEventReferences(project, id),
    ),
    graphRefCounts: counts(Object.keys(project.presentationGraphs), (id) =>
      findPresentationGraphReferences(project, id),
    ),
  };
}
