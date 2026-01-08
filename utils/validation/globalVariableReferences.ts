/**
 * utils/validation/globalVariableReferences.ts
 * 全局变量引用追踪工具，用于删除前提示引用位置
 * 
 * 与 variableReferences.ts 类似，但专门处理 Global 作用域的变量
 */
import { ConditionExpression, StateMachine, Transition } from '../../types/stateMachine';
import { EventListener, ParameterModifier, ValueSource, ParameterBinding, PresentationBinding } from '../../types/common';
import { PresentationGraph } from '../../types/presentation';
import { PuzzleNode } from '../../types/puzzleNode';
import { StageNode } from '../../types/stage';

// 定义函数所需的最小项目数据结构（兼容 store.project 和 ProjectData）
interface ProjectLike {
  nodes: Record<string, PuzzleNode>;
  stateMachines?: Record<string, StateMachine>;
  presentationGraphs?: Record<string, PresentationGraph>;
  stageTree: {
    stages: Record<string, StageNode>;
  };
}

/**
 * 导航上下文类型，定义引用跳转时的目标
 */
export interface ReferenceNavigationContext {
  /** 目标类型：Stage/Node/State/Transition/PresentationGraph/PresentationNode */
  targetType: 'STAGE' | 'NODE' | 'STATE' | 'TRANSITION' | 'PRESENTATION_GRAPH' | 'PRESENTATION_NODE';
  /** Stage ID - Stage 相关导航 */
  stageId?: string;
  /** Node ID - 大多数情况需要先导航到 Node */
  nodeId?: string;
  /** State ID - 状态节点选择 */
  stateId?: string;
  /** Transition ID - 转移选择 */
  transitionId?: string;
  /** Presentation Graph ID - 演出图 */
  graphId?: string;
  /** Presentation Node ID - 演出图节点 */
  presentationNodeId?: string;
}

export interface VariableReferenceInfo {
  location: string;   // 引用发生的具体位置描述
  detail?: string;    // 额外说明（如所属对象名称）
  /** 导航上下文，用于点击跳转 */
  navContext?: ReferenceNavigationContext;
}

/**
 * 检查 ValueSource 是否引用了指定的全局变量
 */
const collectFromValueSource = (
  source: ValueSource | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string,
  navContext?: ReferenceNavigationContext
) => {
  if (!source || source.type !== 'VariableRef') return;
  if (source.variableId === variableId && source.scope === 'Global') {
    collector({ location: origin, navContext });
  }
};

/**
 * 检查参数绑定列表是否引用了指定的全局变量
 */
const collectFromBindings = (
  bindings: ParameterBinding[] | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string,
  navContext?: ReferenceNavigationContext
) => {
  bindings?.forEach(b => collectFromValueSource(b.source, variableId, collector, `${origin} > Param ${b.paramName}`, navContext));
};

/**
 * 检查参数修改器是否引用了指定的全局变量
 */
const collectFromModifier = (
  modifier: ParameterModifier | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string,
  navContext?: ReferenceNavigationContext
) => {
  if (!modifier) return;
  // 检查目标变量
  if (modifier.targetVariableId === variableId && modifier.targetScope === 'Global') {
    collector({ location: `${origin} > Target`, navContext });
  }
  // 检查源值
  collectFromValueSource(modifier.source, variableId, collector, `${origin} > Source`, navContext);
};

/**
 * 递归检查条件表达式是否引用了指定的全局变量
 */
const collectFromCondition = (
  condition: ConditionExpression | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string,
  navContext?: ReferenceNavigationContext
) => {
  if (!condition) return;

  if (condition.type === 'VARIABLE_REF') {
    if (condition.variableScope === 'Global' && condition.variableId === variableId) {
      collector({ location: origin, navContext });
    }
    return;
  }

  if (condition.type === 'AND' || condition.type === 'OR') {
    condition.children?.forEach((c, idx) =>
      collectFromCondition(c, variableId, collector, `${origin} > Sub condition ${idx + 1}`, navContext)
    );
  }

  if (condition.type === 'NOT' && condition.operand) {
    collectFromCondition(condition.operand, variableId, collector, `${origin} > Not`, navContext);
  }

  if (condition.type === 'COMPARISON') {
    if (condition.left) collectFromCondition(condition.left, variableId, collector, `${origin} > Left`, navContext);
    if (condition.right) collectFromCondition(condition.right, variableId, collector, `${origin} > Right`, navContext);
  }
};

/**
 * 检查事件监听器列表是否引用了指定的全局变量
 */
const collectFromEventListeners = (
  listeners: EventListener[] | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string,
  navContext?: ReferenceNavigationContext
) => {
  listeners?.forEach((l, idx) => {
    const base = `${origin} > Listener ${idx + 1}`;
    if (l.action.type === 'ModifyParameter') {
      l.action.modifiers.forEach((m, mIdx) => {
        collectFromModifier(m, variableId, collector, `${base} > Param modifier ${mIdx + 1}`, navContext);
      });
    }
  });
};

/**
 * 检查演出绑定是否引用了指定的全局变量
 * 注意：仅检查 type: 'Script' 类型的直接脚本绑定
 * type: 'Graph' 的情况不在此处理，演出图内部的参数引用由主函数最后统一遍历
 */
const collectFromPresentationBinding = (
  binding: any,
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
 * 检查状态转移是否引用了指定的全局变量
 */
const collectFromTransition = (
  trans: Transition,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  fsmName: string,
  nodeId: string
) => {
  const transName = `FSM ${fsmName} > Transition ${trans.name || trans.id}`;
  // Transition 的导航上下文
  const navContext: ReferenceNavigationContext = {
    targetType: 'TRANSITION',
    nodeId,
    transitionId: trans.id
  };
  collectFromCondition(trans.condition, variableId, collector, `${transName} > Condition`, navContext);
  collectFromPresentationBinding(trans.presentation, variableId, collector, `${transName} > Presentation`, navContext);
  (trans.parameterModifiers || []).forEach((m, idx) =>
    collectFromModifier(m, variableId, collector, `${transName} > Param modifier ${idx + 1}`, navContext)
  );
};

/**
 * 检查 Stage 是否引用了指定的全局变量
 * 
 * 扫描范围：
 * - 解锁条件 (unlockCondition)
 * - OnEnter 演出绑定 (onEnterPresentation)
 * - OnExit 演出绑定 (onExitPresentation)
 * - 事件监听器 (eventListeners)
 */
const collectFromStage = (
  stage: StageNode,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void
) => {
  const stageName = stage.name || stage.id;
  // Stage 的导航上下文
  const navContext: ReferenceNavigationContext = {
    targetType: 'STAGE',
    stageId: stage.id
  };

  // 1) 解锁条件
  collectFromCondition(
    stage.unlockCondition,
    variableId,
    collector,
    `Stage ${stageName} > Unlock Condition`,
    navContext
  );

  // 2) OnEnter 演出绑定
  collectFromPresentationBinding(
    stage.onEnterPresentation,
    variableId,
    collector,
    `Stage ${stageName} > OnEnter Presentation`,
    navContext
  );

  // 3) OnExit 演出绑定
  collectFromPresentationBinding(
    stage.onExitPresentation,
    variableId,
    collector,
    `Stage ${stageName} > OnExit Presentation`,
    navContext
  );

  // 4) 事件监听器
  collectFromEventListeners(
    stage.eventListeners,
    variableId,
    collector,
    `Stage ${stageName} event listeners`,
    navContext
  );
};

/**
 * 收集指定全局变量在整个项目中被引用的位置
 * 
 * 检查范围：
 * 1. 所有 Stage 的解锁条件、演出绑定和事件监听器
 * 2. 所有 PuzzleNode 的事件监听器
 * 3. 所有状态机的状态和转移
 * 4. 所有演出图的节点参数
 */
export const findGlobalVariableReferences = (
  project: ProjectLike,
  variableId: string
): VariableReferenceInfo[] => {
  const refs: VariableReferenceInfo[] = [];
  const push = (info: VariableReferenceInfo) => refs.push(info);
  const graphs = project.presentationGraphs || {};

  // 1) 遍历所有 Stage
  Object.values<StageNode>(project.stageTree.stages || {}).forEach(stage => {
    collectFromStage(stage, variableId, push);
  });

  // 2) 遍历所有 PuzzleNode
  Object.values<PuzzleNode>(project.nodes || {}).forEach(node => {
    const nodeName = node.name || node.id;

    // 节点事件监听器 - 导航到 Node
    const nodeNavContext: ReferenceNavigationContext = {
      targetType: 'NODE',
      nodeId: node.id
    };
    collectFromEventListeners(node.eventListeners, variableId, push, `Node ${nodeName} event listeners`, nodeNavContext);

    // 节点关联的状态机
    const fsm = project.stateMachines?.[node.stateMachineId];
    if (fsm) {
      // 使用节点名称作为 FSM 的标识（FSM 本身没有 name 属性）
      const fsmName = `${nodeName}'s FSM`;

      // 状态机中的状态
      Object.values(fsm.states || {}).forEach(state => {
        // State 的导航上下文
        const stateNavContext: ReferenceNavigationContext = {
          targetType: 'STATE',
          nodeId: node.id,
          stateId: state.id
        };
        collectFromEventListeners(
          state.eventListeners,
          variableId,
          push,
          `FSM ${fsmName} > State ${state.name || state.id} event listeners`,
          stateNavContext
        );
      });

      // 状态机中的转移
      Object.values(fsm.transitions || {}).forEach(trans =>
        collectFromTransition(trans, variableId, push, fsmName, node.id)
      );
    }
  });

  // 3) 遍历所有演出图（可能被多处引用）
  Object.values<PresentationGraph>(graphs).forEach(graph => {
    const graphName = graph.name || graph.id;
    Object.values(graph.nodes).forEach(graphNode => {
      // Presentation Node 的导航上下文
      const navContext: ReferenceNavigationContext = {
        targetType: 'PRESENTATION_NODE',
        graphId: graph.id,
        presentationNodeId: graphNode.id
      };
      const nodeBinding = graphNode.presentation;
      collectFromBindings(
        nodeBinding?.type === 'Script' ? nodeBinding.parameters : [],
        variableId,
        push,
        `Presentation graph ${graphName} > Node ${graphNode.name || graphNode.id}`,
        navContext
      );

      if (graphNode.condition) {
        collectFromCondition(
          graphNode.condition,
          variableId,
          push,
          `Presentation graph ${graphName} > Node ${graphNode.name || graphNode.id} > Condition`,
          navContext
        );
      }
    });
  });

  return refs;
};
