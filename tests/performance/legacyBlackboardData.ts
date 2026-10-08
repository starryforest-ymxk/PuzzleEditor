/** 第五批基线实现，仅用于可重复性能对照，不进入正式应用。 */
import { useMemo } from 'react';
import type { ProjectData } from '../../types/project';
import {
  collectLocalVariables,
  localVariableKey,
  selectBlackboardResources,
  type BlackboardFilters,
} from '../../utils/blackboard';
import { findGlobalVariableReferences } from '../../utils/validation/globalVariableReferences';
import { findStageVariableReferences } from '../../utils/validation/stageVariableReferences';
import { findNodeVariableReferences } from '../../utils/validation/variableReferences';
import { findScriptReferences } from '../../utils/validation/scriptReferences';
import { findEventReferences } from '../../utils/validation/eventReferences';
import { findPresentationGraphReferences } from '../../utils/validation/presentationGraphReferences';

/** 引用统计与文本筛选分开：输入搜索文本不触发全工程引用扫描。 */
export function useBlackboardData(project: ProjectData, filters: BlackboardFilters) {
  const { filter, stateFilter, varTypeFilter } = filters;
  const lists = useMemo(
    () => selectBlackboardResources(project, { filter, stateFilter, varTypeFilter }),
    [project, filter, stateFilter, varTypeFilter],
  );
  const references = useMemo(() => {
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
  }, [project]);
  return { ...lists, ...references };
}
