/**
 * utils/validation/variableReferences.ts
 * 节点局部变量引用追踪工具，用于删除前提示引用位置
 * 
 * 注意：此文件已从 utils/variableReferences.ts 迁移到 utils/validation/ 目录
 * 原位置保留兼容性重导出
 */
import { ProjectData } from '../../types/project';
import { ConditionExpression, StateMachine, Transition } from '../../types/stateMachine';
import { EventListener, ParameterBinding, ParameterModifier, PresentationBinding, ValueSource } from '../../types/common';
import { PresentationGraph } from '../../types/presentation';
// 从 globalVariableReferences 导入共享类型
import type { VariableReferenceInfo, ReferenceNavigationContext } from './globalVariableReferences';

// 重新导出类型供外部使用
export type { VariableReferenceInfo, ReferenceNavigationContext };

const collectFromValueSource = (
  source: ValueSource | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string,
  navContext?: ReferenceNavigationContext
) => {
  if (!source || source.type !== 'VariableRef') return;
  if (source.variableId === variableId && source.scope === 'NodeLocal') {
    collector({ location: origin, navContext });
  }
};

const collectFromBindings = (
  bindings: ParameterBinding[] | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string,
  navContext?: ReferenceNavigationContext
) => {
  bindings?.forEach(b => collectFromValueSource(b.source, variableId, collector, `${origin} > Param ${b.paramName}`, navContext));
};

const collectFromModifier = (
  modifier: ParameterModifier | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string,
  navContext?: ReferenceNavigationContext
) => {
  if (!modifier) return;
  if (modifier.targetVariableId === variableId && modifier.targetScope === 'NodeLocal') {
    collector({ location: `${origin} > Target`, navContext });
  }
  collectFromValueSource(modifier.source, variableId, collector, `${origin} > Source`, navContext);
};

const collectFromCondition = (
  condition: ConditionExpression | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string,
  navContext?: ReferenceNavigationContext
) => {
  if (!condition) return;
  if (condition.type === 'VARIABLE_REF') {
    if (condition.variableScope === 'NodeLocal' && condition.variableId === variableId) {
      collector({ location: origin, navContext });
    }
    return;
  }

  if (condition.type === 'AND' || condition.type === 'OR') {
    condition.children?.forEach((c, idx) => collectFromCondition(c, variableId, collector, `${origin} > Sub condition ${idx + 1}`, navContext));
  }

  if (condition.type === 'NOT' && condition.operand) {
    collectFromCondition(condition.operand, variableId, collector, `${origin} > Not`, navContext);
  }

  if (condition.type === 'COMPARISON') {
    if (condition.left) collectFromCondition(condition.left, variableId, collector, `${origin} > Left`, navContext);
    if (condition.right) collectFromCondition(condition.right, variableId, collector, `${origin} > Right`, navContext);
  }
};

const collectFromEventListeners = (
  listeners: EventListener[] | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string,
  navContext?: ReferenceNavigationContext
) => {
  listeners?.forEach((l, idx) => {
    const base = `${origin} > Listener ${idx + 1}`;
    // InvokeScript 类型现在不再携带 parameters，无需收集
    if (l.action.type === 'ModifyParameter') {
      l.action.modifiers.forEach((m, mIdx) => {
        collectFromModifier(m, variableId, collector, `${base} > Param modifier ${mIdx + 1}`, navContext);
      });
    }
  });
};

const collectFromPresentationBinding = (
  binding: PresentationBinding | undefined,
  graphs: Record<string, PresentationGraph>,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string,
  baseNavContext?: ReferenceNavigationContext
) => {
  if (!binding) return;
  if (binding.type === 'Script') {
    collectFromBindings(binding.parameters, variableId, collector, `${origin} > Presentation script params`, baseNavContext);
  } else if (binding.type === 'Graph') {
    const graph = graphs[binding.graphId];
    if (!graph) return;
    Object.values(graph.nodes).forEach(node => {
      // 演出图节点的导航上下文
      const navContext: ReferenceNavigationContext = {
        targetType: 'PRESENTATION_NODE',
        graphId: binding.graphId,
        presentationNodeId: node.id
      };
      const nodeBinding = node.presentation;
      if (nodeBinding?.type === 'Script') {
        collectFromBindings(nodeBinding.parameters, variableId, collector, `${origin} > Subgraph node ${node.name || node.id}`, navContext);
      }
    });
  }
};

const collectFromTransition = (
  trans: Transition,
  stateMachine: StateMachine,
  graphs: Record<string, PresentationGraph>,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  nodeId: string
) => {
  // Transition 的导航上下文
  const navContext: ReferenceNavigationContext = {
    targetType: 'TRANSITION',
    nodeId,
    transitionId: trans.id
  };
  collectFromCondition(trans.condition, variableId, collector, `Transition ${trans.name || trans.id} > Condition`, navContext);
  collectFromPresentationBinding(trans.presentation, graphs, variableId, collector, `Transition ${trans.name || trans.id} > Presentation`, navContext);
  (trans.parameterModifiers || []).forEach((m, idx) =>
    collectFromModifier(m, variableId, collector, `Transition ${trans.name || trans.id} > Param modifier ${idx + 1}`, navContext)
  );
};

/**
 * 收集指定 PuzzleNode 的 NodeLocal 变量被引用的位置
 */
export const findNodeVariableReferences = (
  project: ProjectData,
  nodeId: string,
  variableId: string
): VariableReferenceInfo[] => {
  const refs: VariableReferenceInfo[] = [];
  const node = project.nodes[nodeId];
  if (!node) return refs;

  const fsm = project.stateMachines[node.stateMachineId];
  const graphs = project.presentationGraphs || {};

  const push = (info: VariableReferenceInfo) => refs.push(info);

  // 1) PuzzleNode 自身的事件监听 - 导航到 Node
  const nodeNavContext: ReferenceNavigationContext = {
    targetType: 'NODE',
    nodeId
  };
  collectFromEventListeners(node.eventListeners, variableId, push, `PuzzleNode ${node.name || node.id} event listeners`, nodeNavContext);

  // 2) 状态机内部
  if (fsm) {
    Object.values(fsm.states || {}).forEach(state => {
      // State 的导航上下文
      const stateNavContext: ReferenceNavigationContext = {
        targetType: 'STATE',
        nodeId,
        stateId: state.id
      };
      collectFromEventListeners(state.eventListeners, variableId, push, `State ${state.name || state.id} event listeners`, stateNavContext);
    });

    Object.values(fsm.transitions || {}).forEach(trans => collectFromTransition(trans, fsm, graphs, variableId, push, nodeId));
  }

  // 3) 演出子图直接被此节点引用的情况（防御性遍历：若外部直接关联也能检测到）
  Object.values(project.presentationGraphs || {}).forEach(graph => {
    Object.values(graph.nodes).forEach(nodeItem => {
      // Presentation Node 的导航上下文
      const navContext: ReferenceNavigationContext = {
        targetType: 'PRESENTATION_NODE',
        graphId: graph.id,
        presentationNodeId: nodeItem.id
      };
      const nodeBinding = nodeItem.presentation;
      if (nodeBinding?.type === 'Script') {
        collectFromBindings(nodeBinding.parameters, variableId, push, `Presentation graph ${graph.name || graph.id} > Node ${nodeItem.name || nodeItem.id}`, navContext);
      }
    });
  });

  return refs;
};
