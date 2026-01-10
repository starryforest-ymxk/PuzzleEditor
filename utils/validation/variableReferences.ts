/**
 * utils/validation/variableReferences.ts
 * 节点局部变量引用追踪工具，用于删除前提示引用位置
 * 
 * 注意：此文件已从 utils/variableReferences.ts 迁移到 utils/validation/ 目录
 * 原位置保留兼容性重导出
 */
import { ProjectData } from '../../types/project';
import { ConditionExpression, Transition } from '../../types/stateMachine';
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

  // 逻辑组合：递归子节点
  if (condition.type === 'AND' || condition.type === 'OR') {
    condition.children?.forEach((c, idx) => collectFromCondition(c, variableId, collector, `${origin} > Sub condition ${idx + 1}`, navContext));
    return;
  }

  if (condition.type === 'NOT') {
    if (condition.operand) collectFromCondition(condition.operand, variableId, collector, `${origin} > Not`, navContext);
    return;
  }

  // 比较表达式：检查左右操作数 (ValueSource)
  if (condition.type === 'COMPARISON') {
    collectFromValueSource(condition.left, variableId, collector, `${origin} > Left`, navContext);
    collectFromValueSource(condition.right, variableId, collector, `${origin} > Right`, navContext);
    return;
  }



  // SCRIPT_REF 和 LITERAL 不需要处理变量引用
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

/**
 * 检查演出绑定是否引用了指定的节点局部变量
 * 注意：仅检查 type: 'Script' 类型的直接脚本绑定
 * type: 'Graph' 的情况不在此处理，演出图内部的参数引用由主函数最后统一遍历
 */
const collectFromPresentationBinding = (
  binding: PresentationBinding | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string,
  baseNavContext?: ReferenceNavigationContext
) => {
  if (!binding) return;
  // 仅处理直接脚本绑定，演出图引用由最后统一遍历处理
  if (binding.type === 'Script') {
    collectFromBindings(binding.parameters, variableId, collector, `${origin} > Presentation script params`, baseNavContext);
  }
  // type: 'Graph' 不在此处理，避免重复遍历
};

/**
 * 检查状态转移是否引用了指定的节点局部变量
 */
const collectFromTransition = (
  trans: Transition,
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
  collectFromPresentationBinding(trans.presentation, variableId, collector, `Transition ${trans.name || trans.id} > Presentation`, navContext);
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

    Object.values(fsm.transitions || {}).forEach(trans => collectFromTransition(trans, variableId, push, nodeId));
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

      // 1. 检查 Script 绑定参数
      const nodeBinding = nodeItem.presentation;
      if (nodeBinding?.type === 'Script') {
        collectFromBindings(nodeBinding.parameters, variableId, push, `Presentation graph ${graph.name || graph.id} > Node ${nodeItem.name || nodeItem.id}`, navContext);
      }

      // 2. 检查 Branch 节点的条件表达式
      if (nodeItem.condition) {
        collectFromCondition(
          nodeItem.condition,
          variableId,
          push,
          `Presentation graph ${graph.name || graph.id} > Node ${nodeItem.name || nodeItem.id} > Condition`,
          navContext
        );
      }
    });
  });

  return refs;
};
