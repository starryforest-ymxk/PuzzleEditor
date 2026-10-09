import { createResourceReferenceIndex } from '../../utils/resourceReferences';
import type { ProjectData } from '../../types/project';
import { collectLocalVariables, localVariableKey } from '../../utils/blackboard';
import { findGlobalVariableReferences } from '../../utils/validation/globalVariableReferences';
import { findStageVariableReferences } from '../../utils/validation/stageVariableReferences';
import { findNodeVariableReferences } from '../../utils/validation/variableReferences';
import { findScriptReferences } from '../../utils/validation/scriptReferences';
import { findEventReferences } from '../../utils/validation/eventReferences';
import { findPresentationGraphReferences } from '../../utils/validation/presentationGraphReferences';

/** 校验引用查询兼容入口与黑板计数一致；独立手工预期另见 CLI C4 领域回归。 */
export function referenceOracle(project: ProjectData) {
  const index = createResourceReferenceIndex(project);
  const counts = (ids: string[], find: (id: string) => unknown[]) =>
    Object.fromEntries(ids.map((id) => [id, find(id).length]));
  return {
    globalVariableRefCounts: counts(Object.keys(project.blackboard.globalVariables), (id) =>
      findGlobalVariableReferences(project, id, index),
    ),
    localVariableRefCounts: Object.fromEntries(
      collectLocalVariables(project).map((v) => [
        localVariableKey(v),
        (v.scopeType === 'Node'
          ? findNodeVariableReferences(project, v.scopeId, v.id, index)
          : findStageVariableReferences(project, v.scopeId, v.id, index)
        ).length,
      ]),
    ),
    scriptRefCounts: counts(Object.keys(project.scripts.scripts), (id) =>
      findScriptReferences(project, id, index),
    ),
    eventRefCounts: counts(Object.keys(project.blackboard.events), (id) =>
      findEventReferences(project, id, index),
    ),
    graphRefCounts: counts(Object.keys(project.presentationGraphs), (id) =>
      findPresentationGraphReferences(project, id, index),
    ),
  };
}
