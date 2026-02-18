/**
 * hooks/useFsmVisibleVariables.ts
 * 提供 FSM 编辑场景下的"可见变量"列表
 * 
 * 统一了 TransitionInspector 和 StateInspector 中重复的
 * owningNode + collectVisibleVariables + filterActiveResources 计算模式。
 */

import { useMemo } from 'react';
import { useEditorState } from '../store/context';
import { findNodeByFsmId } from '../utils/puzzleNodeUtils';
import { collectVisibleVariables } from '../utils/variableScope';
import { filterActiveResources } from '../utils/resourceFilters';
import type { PuzzleNode } from '../types/puzzleNode';
import type { VariableDefinition } from '../types/blackboard';

/**
 * 根据 fsmId 查找所属 PuzzleNode，并收集该节点可见的全部活跃变量。
 * 
 * @param fsmId - 状态机 ID
 * @returns owningNode: 所属节点（可能为 null）；visibleVars: 过滤掉 MarkedForDelete 的变量列表
 */
export function useFsmVisibleVariables(fsmId: string): {
  owningNode: PuzzleNode | null;
  visibleVars: VariableDefinition[];
} {
  const state = useEditorState();
  const { project } = state;

  // 查找拥有该 FSM 的 PuzzleNode
  const owningNode = useMemo(
    () => findNodeByFsmId(project.nodes, fsmId) || null,
    [project.nodes, fsmId]
  );

  // 收集可见变量并过滤已标记删除的
  const visibleVars = useMemo(() => {
    const vars = collectVisibleVariables(state, owningNode?.stageId, owningNode?.id);
    return filterActiveResources(vars.all);
  }, [state, owningNode]);

  return { owningNode, visibleVars };
}
