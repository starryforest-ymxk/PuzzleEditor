/**
 * utils/variableReferences.ts
 * 节点局部变量引用追踪工具，用于删除前提示引用位置
 */
import { ProjectData } from '../types/project';
import { ConditionExpression, StateMachine, Transition } from '../types/stateMachine';
import { EventListener, ParameterBinding, ParameterModifier, PresentationBinding, ValueSource } from '../types/common';
import { PresentationGraph } from '../types/presentation';

export interface VariableReferenceInfo {
  location: string;   // 引用发生的具体位置描述
  detail?: string;    // 额外说明（如所属对象名称）
}

const collectFromValueSource = (
  source: ValueSource | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string
) => {
  if (!source || source.type !== 'VariableRef') return;
  if (source.variableId === variableId && source.scope === 'NodeLocal') {
    collector({ location: origin });
  }
};

const collectFromBindings = (
  bindings: ParameterBinding[] | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string
) => {
  bindings?.forEach(b => collectFromValueSource(b.source, variableId, collector, `${origin} · 参数 ${b.paramName}`));
};

const collectFromModifier = (
  modifier: ParameterModifier | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string
) => {
  if (!modifier) return;
  if (modifier.targetVariableId === variableId && modifier.targetScope === 'NodeLocal') {
    collector({ location: `${origin} · 目标` });
  }
  collectFromValueSource(modifier.source, variableId, collector, `${origin} · 源`);
};

const collectFromCondition = (
  condition: ConditionExpression | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string
) => {
  if (!condition) return;
  if (condition.type === 'VARIABLE_REF') {
    if (condition.variableScope === 'NodeLocal' && condition.variableId === variableId) {
      collector({ location: origin });
    }
    return;
  }

  if (condition.type === 'AND' || condition.type === 'OR') {
    condition.children?.forEach((c, idx) => collectFromCondition(c, variableId, collector, `${origin} · 子条件${idx + 1}`));
  }

  if (condition.type === 'NOT' && condition.operand) {
    collectFromCondition(condition.operand, variableId, collector, `${origin} · 取反`);
  }

  if (condition.type === 'COMPARISON') {
    if (condition.left) collectFromCondition(condition.left, variableId, collector, `${origin} · 左侧`);
    if (condition.right) collectFromCondition(condition.right, variableId, collector, `${origin} · 右侧`);
  }
};

const collectFromEventListeners = (
  listeners: EventListener[] | undefined,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string
) => {
  listeners?.forEach((l, idx) => {
    const base = `${origin} · 监听${idx + 1}`;
    if (l.action.type === 'InvokeScript') {
      collectFromBindings(l.action.parameters, variableId, collector, `${base} · 调用脚本参数`);
    } else if (l.action.type === 'ModifyParameter') {
      l.action.modifiers.forEach((m, mIdx) => {
        collectFromModifier(m, variableId, collector, `${base} · 参数修改${mIdx + 1}`);
      });
    }
  });
};

const collectFromPresentationBinding = (
  binding: PresentationBinding | undefined,
  graphs: Record<string, PresentationGraph>,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void,
  origin: string
) => {
  if (!binding) return;
  if (binding.type === 'Script') {
    collectFromBindings(binding.parameters, variableId, collector, `${origin} · 演出脚本参数`);
  } else if (binding.type === 'Graph') {
    const graph = graphs[binding.graphId];
    if (!graph) return;
    Object.values(graph.nodes).forEach(node => {
      collectFromBindings(node.parameters, variableId, collector, `${origin} · 子图节点 ${node.name || node.id}`);
    });
  }
};

const collectFromTransition = (
  trans: Transition,
  stateMachine: StateMachine,
  graphs: Record<string, PresentationGraph>,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void
) => {
  collectFromCondition(trans.condition, variableId, collector, `转移 ${trans.name || trans.id} · 条件`);
  collectFromPresentationBinding(trans.presentation, graphs, variableId, collector, `转移 ${trans.name || trans.id} · 演出`);
  (trans.parameterModifiers || []).forEach((m, idx) =>
    collectFromModifier(m, variableId, collector, `转移 ${trans.name || trans.id} · 参数修改${idx + 1}`)
  );
};

const collectFromStatePresentation = (
  state: any,
  graphs: Record<string, PresentationGraph>,
  variableId: string,
  collector: (info: VariableReferenceInfo) => void
) => {
  if (!state) return;
  collectFromPresentationBinding(state.presentation, graphs, variableId, collector, `状态 ${state.name || state.id} · 演出`);
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

  // 1) PuzzleNode 自身的事件监听
  collectFromEventListeners(node.eventListeners, variableId, push, `PuzzleNode ${node.name || node.id} 事件监听`);

  // 2) 状态机内部
  if (fsm) {
    Object.values(fsm.states || {}).forEach(state => {
      collectFromEventListeners(state.eventListeners, variableId, push, `状态 ${state.name || state.id} 事件监听`);
      collectFromStatePresentation(state as any, graphs, variableId, push);
    });

    Object.values(fsm.transitions || {}).forEach(trans => collectFromTransition(trans, fsm, graphs, variableId, push));
  }

  // 3) 演出子图直接被此节点引用的情况（防御性遍历：若外部直接关联也能检测到）
  Object.values(project.presentationGraphs || {}).forEach(graph => {
    Object.values(graph.nodes).forEach(nodeItem => {
      collectFromBindings(nodeItem.parameters, variableId, push, `演出图 ${graph.name || graph.id} · 节点 ${nodeItem.name || nodeItem.id}`);
    });
  });

  return refs;
};
