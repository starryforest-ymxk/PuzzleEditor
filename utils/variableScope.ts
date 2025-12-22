/**
 * 作用域工具：收集可见变量与规范化作用域
 * - 按 Global / StageLocal / NodeLocal / Temporary 组合返回
 * - 在新增局部变量时强制设置正确的 scope
 */

import { StageId, PuzzleNodeId, VariableScope } from '../types/common';
import { VariableDefinition } from '../types/blackboard';
import { EditorState } from '../store/types';

export interface VisibleVariables {
  global: VariableDefinition[];
  stage: VariableDefinition[];
  node: VariableDefinition[];
  // Temporary 仅在参数绑定时生成，默认为空
  temporary: VariableDefinition[];
  all: VariableDefinition[];
}

/**
 * 规范化变量作用域：用于新增局部变量时强制绑定正确 scope
 */
export const withScope = (variable: VariableDefinition, scope: VariableScope): VariableDefinition => ({
  ...variable,
  scope
});

/**
 * 收集当前上下文可见变量
 * @param state 全局编辑器状态
 * @param stageId 所在 Stage（可选；若未提供且 nodeId 存在，则从 node 推断）
 * @param nodeId  所在 Node（可选）
 */
export const collectVisibleVariables = (
  state: EditorState,
  stageId?: StageId | null,
  nodeId?: PuzzleNodeId | null
): VisibleVariables => {
  let resolvedStageId = stageId ?? null;

  if (!resolvedStageId && nodeId) {
    const node = state.project.nodes[nodeId];
    resolvedStageId = node?.stageId ?? null;
  }

  // 全局黑板变量
  const globalVisible: VariableDefinition[] = Object.values(state.project.blackboard?.globalVariables || {});

  // 收集当前 Stage 及其所有祖先 Stage 的局部变量
  // 按照从根到当前的顺序，子级变量会覆盖同名父级变量
  const stageVisible: VariableDefinition[] = [];
  if (resolvedStageId) {
    // 向上遍历父级链，收集所有祖先 Stage
    const ancestorChain: StageId[] = [];
    let currentStageId: StageId | null = resolvedStageId;

    while (currentStageId) {
      ancestorChain.unshift(currentStageId); // 从根到当前的顺序
      const currentStage = state.project.stageTree.stages[currentStageId];
      currentStageId = currentStage?.parentId ?? null;
    }

    // 按从根到当前的顺序收集变量（后面的会覆盖前面的同名变量）
    const stageVarMap: Record<string, VariableDefinition> = {};
    for (const stageId of ancestorChain) {
      const stage = state.project.stageTree.stages[stageId];
      if (stage?.localVariables) {
        Object.assign(stageVarMap, stage.localVariables);
      }
    }
    stageVisible.push(...Object.values(stageVarMap));
  }

  const nodeVisible: VariableDefinition[] = [];
  if (nodeId) {
    const node = state.project.nodes[nodeId];
    if (node?.localVariables) {
      nodeVisible.push(...Object.values(node.localVariables));
    }
  }

  const temporary: VariableDefinition[] = []; // 由参数绑定 UI 生成，一般不在 store 中持久化

  return {
    global: globalVisible,
    stage: stageVisible,
    node: nodeVisible,
    temporary,
    all: [...globalVisible, ...stageVisible, ...nodeVisible]
  };
};
