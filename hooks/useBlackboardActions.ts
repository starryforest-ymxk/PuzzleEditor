import { createPresentationGraph } from '../utils/presentation';
import { useEditorDispatch } from '../store/context';
import type { ProjectData } from '../types/project';
import type { VariableDefinition, EventDefinition, LocalVarWithScope } from '../types/blackboard';
import type { ScriptDefinition } from '../types/manifest';
import type { ScriptCategory } from '../types/common';
import {
  generateVariableId,
  generateEventId,
  generateScriptId,
  generateGraphId,
} from '../utils/resourceIdGenerator';
import { findNodeByFsmId } from '../utils/puzzleNodeUtils';
import { navigateAndSelect } from '../store/navigation/referenceNavigation';

/** 资源意图统一映射为 Store 动作，视图不自行拼接导航或生成资源 ID。 */
export function useBlackboardActions(project: ProjectData) {
  const dispatch = useEditorDispatch();
  // ========== Selection Handlers ==========
  const handleSelectVariable = (id: string) =>
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'VARIABLE', id } });
  const handleSelectScript = (id: string) =>
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'SCRIPT', id } });
  const handleSelectEvent = (id: string) =>
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'EVENT', id } });
  const handleSelectGraph = (id: string) =>
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_GRAPH', id } });
  const handleOpenGraph = (id: string) =>
    dispatch({ type: 'NAVIGATE_TO', payload: { graphId: id, stageId: null, nodeId: null } });
  const handleSelectFsm = (id: string) =>
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'FSM', id } });
  const handleOpenFsm = (fsmId: string) => {
    // 查找拥有此 FSM 的节点并导航
    const ownerNode = findNodeByFsmId(project.nodes, fsmId);
    if (ownerNode) {
      dispatch({
        type: 'NAVIGATE_TO',
        payload: { nodeId: ownerNode.id, stageId: ownerNode.stageId, graphId: null },
      });
    }
  };

  /**
   * 双击局部变量卡片：跳转到变量声明处并选中拥有者
   * - Stage 局部变量：导航到对应 Stage 并选中
   * - Node 局部变量：导航到对应 Node 所在的 Stage，然后选中该 Node
   */
  const handleDoubleClickLocalVariable = (localVar: LocalVarWithScope) => {
    if (localVar.scopeType === 'Stage') {
      // Stage 局部变量：导航到 Stage 并选中
      navigateAndSelect(
        dispatch,
        { stageId: localVar.scopeId, nodeId: null, graphId: null },
        { type: 'STAGE', id: localVar.scopeId },
      );
    } else if (localVar.scopeType === 'Node') {
      // Node 局部变量：查找 Node 所在的 Stage，导航并选中 Node
      const ownerNode = project.nodes[localVar.scopeId];
      if (ownerNode) {
        navigateAndSelect(
          dispatch,
          { stageId: ownerNode.stageId, nodeId: null, graphId: null },
          { type: 'NODE', id: localVar.scopeId },
        );
      }
    }
  };

  // ========== Creation Handlers ==========
  const handleAddVariable = () => {
    // 使用"资源类型_计数器"格式生成 ID（ID 由系统生成，不可编辑）
    const id = generateVariableId(project);
    const newVar: VariableDefinition = {
      id,
      name: 'New Variable',
      type: 'boolean',
      value: false,
      state: 'Draft',
      description: '',
      scope: 'Global',
    };
    dispatch({ type: 'ADD_GLOBAL_VARIABLE', payload: { variable: newVar } });
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'VARIABLE', id } });
  };

  const handleAddEvent = () => {
    // 使用"资源类型_计数器"格式生成 ID（ID 由系统生成，不可编辑）
    const id = generateEventId(project);
    const newEvent: EventDefinition = {
      id,
      name: 'New Event',
      state: 'Draft',
      description: '',
    };
    dispatch({ type: 'ADD_EVENT', payload: { event: newEvent } });
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'EVENT', id } });
  };

  const handleAddScript = (
    category: ScriptCategory,
    lifecycleType?: 'Stage' | 'Node' | 'State',
  ) => {
    // 使用按类型区分的 ID 格式（如 SCRIPT_PERF_1, SCRIPT_LIFE_1 等）
    const id = generateScriptId(project, category);
    const newScript: ScriptDefinition = {
      id,
      name: lifecycleType ? `New ${lifecycleType} Lifecycle Script` : `New ${category} Script`,
      category,
      state: 'Draft',
      description: '',
      ...(lifecycleType ? { lifecycleType } : {}),
    };
    dispatch({ type: 'ADD_SCRIPT', payload: { script: newScript } });
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'SCRIPT', id } });
  };

  const handleAddPresentationGraph = () => {
    // 使用统一 ID 格式：GRAPH_{N}
    const id = generateGraphId(project);
    const newGraph = createPresentationGraph({ id, name: 'New Presentation Graph' });
    dispatch({ type: 'ADD_PRESENTATION_GRAPH', payload: { graph: newGraph } });
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_GRAPH', id } });
  };

  const reorderVariables = (orderedIds: string[]) =>
    dispatch({ type: 'REORDER_GLOBAL_VARIABLES', payload: { orderedIds } });
  const reorderEvents = (orderedIds: string[]) =>
    dispatch({ type: 'REORDER_EVENTS', payload: { orderedIds } });
  const reorderFsms = (orderedIds: string[]) =>
    dispatch({ type: 'REORDER_FSMS', payload: { orderedIds } });
  const reorderGraphs = (orderedIds: string[]) =>
    dispatch({ type: 'REORDER_PRESENTATION_GRAPHS', payload: { orderedIds } });
  const reorderScripts = (
    category: string,
    lifecycleType: string | undefined,
    orderedIds: string[],
  ) => dispatch({ type: 'REORDER_SCRIPTS', payload: { category, lifecycleType, orderedIds } });
  const reorderLocalVariables = (
    scopeType: 'Stage' | 'Node',
    scopeId: string,
    orderedIds: string[],
  ) => dispatch({ type: 'REORDER_LOCAL_VARIABLES', payload: { scopeType, scopeId, orderedIds } });
  return {
    handleSelectVariable,
    handleSelectScript,
    handleSelectEvent,
    handleSelectGraph,
    handleOpenGraph,
    handleSelectFsm,
    handleOpenFsm,
    handleDoubleClickLocalVariable,
    handleAddVariable,
    handleAddEvent,
    handleAddScript,
    handleAddPresentationGraph,
    reorderVariables,
    reorderEvents,
    reorderFsms,
    reorderGraphs,
    reorderScripts,
    reorderLocalVariables,
  };
}
