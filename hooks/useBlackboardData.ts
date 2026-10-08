import { useMemo } from 'react';
import type { ProjectData } from '../types/project';
import { selectBlackboardResources, type BlackboardFilters } from '../utils/blackboard';
import { buildBlackboardReferenceCounts } from '../utils/blackboardReferences';

/** 引用统计与文本筛选分开：输入搜索文本不触发全工程引用扫描。 */
export function useBlackboardData(project: ProjectData, filters: BlackboardFilters) {
  const { filter, stateFilter, varTypeFilter } = filters;
  const lists = useMemo(
    () => selectBlackboardResources(project, { filter, stateFilter, varTypeFilter }),
    [project, filter, stateFilter, varTypeFilter],
  );
  // 缓存限于当前 Hook 与不可变项目身份：切换工程、编辑、Undo/Redo 都会正确刷新。
  const references = useMemo(() => buildBlackboardReferenceCounts(project), [project]);
  return { ...lists, ...references };
}
