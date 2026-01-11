/**
 * utils/validation/stageVariableReferences.ts
 * Stage 局部变量引用追踪工具，用于删除前提示引用位置
 * 
 * StageLocal 变量作用域：Stage 及其子结构可见
 * 扫描范围：
 * 1. 当前 Stage 及所有子孙 Stage 的字段（解锁条件、演出绑定、事件监听器）
 * 2. 这些 Stage 下所有 Node 的事件监听器
 * 3. Node 关联的状态机（State、Transition）
 * 4. 所有演出图的节点参数（防御性扫描）
 */
import { ProjectData } from '../../types/project';
import { ConditionExpression, Transition, StateMachine } from '../../types/stateMachine';
import { EventListener, ParameterBinding, ParameterModifier, PresentationBinding, ValueSource } from '../../types/common';
import { PresentationGraph } from '../../types/presentation';
import { PuzzleNode } from '../../types/puzzleNode';
import { StageNode } from '../../types/stage';
import type { VariableReferenceInfo, ReferenceNavigationContext } from './globalVariableReferences';

// 重新导出类型供外部使用
export type { VariableReferenceInfo, ReferenceNavigationContext };

// ========== 共用收集函数（匹配 StageLocal 作用域） ==========

const collectFromValueSource = (
    source: ValueSource | undefined,
    variableId: string,
    collector: (info: VariableReferenceInfo) => void,
    origin: string,
    navContext?: ReferenceNavigationContext
) => {
    if (!source || source.type !== 'VariableRef') return;
    if (source.variableId === variableId && source.scope === 'StageLocal') {
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
    if (modifier.targetVariableId === variableId && modifier.targetScope === 'StageLocal') {
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

    if (condition.type === 'And' || condition.type === 'Or') {
        condition.children?.forEach((c, idx) => collectFromCondition(c, variableId, collector, `${origin} > Sub condition ${idx + 1}`, navContext));
    }

    if (condition.type === 'Not' && condition.operand) {
        collectFromCondition(condition.operand, variableId, collector, `${origin} > Not`, navContext);
    }

    if (condition.type === 'Comparison') {
        collectFromValueSource(condition.left, variableId, collector, `${origin} > Left`, navContext);
        collectFromValueSource(condition.right, variableId, collector, `${origin} > Right`, navContext);
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
        if (l.action.type === 'ModifyParameter') {
            l.action.modifiers.forEach((m, mIdx) => {
                collectFromModifier(m, variableId, collector, `${base} > Param modifier ${mIdx + 1}`, navContext);
            });
        }
    });
};

/**
 * 检查演出绑定是否引用了指定的 Stage 局部变量
 */
const collectFromPresentationBinding = (
    binding: PresentationBinding | undefined,
    variableId: string,
    collector: (info: VariableReferenceInfo) => void,
    origin: string,
    baseNavContext?: ReferenceNavigationContext
) => {
    if (!binding) return;
    if (binding.type === 'Script') {
        collectFromBindings(binding.parameters, variableId, collector, `${origin} > Presentation script params`, baseNavContext);
    }
};

/**
 * 检查状态转移是否引用了指定的 Stage 局部变量
 */
const collectFromTransition = (
    trans: Transition,
    variableId: string,
    collector: (info: VariableReferenceInfo) => void,
    nodeId: string
) => {
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
 * 检查 Stage 自身是否引用了指定的 Stage 局部变量
 */
const collectFromStage = (
    stage: StageNode,
    variableId: string,
    collector: (info: VariableReferenceInfo) => void
) => {
    const stageName = stage.name || stage.id;
    const navContext: ReferenceNavigationContext = {
        targetType: 'STAGE',
        stageId: stage.id
    };

    // 解锁条件
    collectFromCondition(stage.unlockCondition, variableId, collector, `Stage ${stageName} > Unlock Condition`, navContext);

    // OnEnter 演出绑定
    collectFromPresentationBinding(stage.onEnterPresentation, variableId, collector, `Stage ${stageName} > OnEnter Presentation`, navContext);

    // OnExit 演出绑定
    collectFromPresentationBinding(stage.onExitPresentation, variableId, collector, `Stage ${stageName} > OnExit Presentation`, navContext);

    // 事件监听器
    collectFromEventListeners(stage.eventListeners, variableId, collector, `Stage ${stageName} event listeners`, navContext);
};

/**
 * 检查 PuzzleNode 是否引用了指定的 Stage 局部变量
 */
const collectFromNode = (
    node: PuzzleNode,
    fsm: StateMachine | undefined,
    variableId: string,
    collector: (info: VariableReferenceInfo) => void
) => {
    const nodeName = node.name || node.id;
    const nodeNavContext: ReferenceNavigationContext = {
        targetType: 'NODE',
        nodeId: node.id
    };

    // Node 事件监听器
    collectFromEventListeners(node.eventListeners, variableId, collector, `Node ${nodeName} event listeners`, nodeNavContext);

    // 状态机内部
    if (fsm) {
        const fsmName = `${nodeName}'s FSM`;

        // 状态的事件监听器
        Object.values(fsm.states || {}).forEach(state => {
            const stateNavContext: ReferenceNavigationContext = {
                targetType: 'STATE',
                nodeId: node.id,
                stateId: state.id
            };
            collectFromEventListeners(
                state.eventListeners,
                variableId,
                collector,
                `FSM ${fsmName} > State ${state.name || state.id} event listeners`,
                stateNavContext
            );
        });

        // 转移
        Object.values(fsm.transitions || {}).forEach(trans =>
            collectFromTransition(trans, variableId, collector, node.id)
        );
    }
};

/**
 * 递归收集 Stage 及其所有子孙 Stage 的 ID
 */
const collectDescendantStageIds = (
    stageId: string,
    stages: Record<string, StageNode>
): string[] => {
    const result: string[] = [stageId];
    const stage = stages[stageId];
    if (stage?.childrenIds) {
        stage.childrenIds.forEach(childId => {
            result.push(...collectDescendantStageIds(childId, stages));
        });
    }
    return result;
};

/**
 * 收集指定 Stage 的 StageLocal 变量被引用的位置
 * 
 * 检查范围：
 * 1. 当前 Stage 及所有子孙 Stage 的字段
 * 2. 这些 Stage 下所有 Node 的事件监听器和 FSM
 * 3. 所有演出图的节点参数（防御性扫描）
 */
export const findStageVariableReferences = (
    project: ProjectData,
    stageId: string,
    variableId: string
): VariableReferenceInfo[] => {
    const refs: VariableReferenceInfo[] = [];
    const push = (info: VariableReferenceInfo) => refs.push(info);
    const stages = project.stageTree.stages || {};

    // 1) 收集当前 Stage 及其所有子孙 Stage 的 ID
    const relevantStageIds = new Set(collectDescendantStageIds(stageId, stages));

    // 2) 扫描这些 Stage 自身的字段
    relevantStageIds.forEach(sid => {
        const stage = stages[sid];
        if (stage) {
            collectFromStage(stage, variableId, push);
        }
    });

    // 3) 扫描这些 Stage 下的所有 Node
    Object.values<PuzzleNode>(project.nodes || {}).forEach(node => {
        if (relevantStageIds.has(node.stageId)) {
            const fsm = project.stateMachines?.[node.stateMachineId];
            collectFromNode(node, fsm, variableId, push);
        }
    });

    // 4) 遍历所有演出图（防御性扫描）
    Object.values<PresentationGraph>(project.presentationGraphs || {}).forEach(graph => {
        const graphName = graph.name || graph.id;
        Object.values(graph.nodes).forEach(graphNode => {
            const navContext: ReferenceNavigationContext = {
                targetType: 'PRESENTATION_NODE',
                graphId: graph.id,
                presentationNodeId: graphNode.id
            };
            const nodeBinding = graphNode.presentation;
            if (nodeBinding?.type === 'Script') {
                collectFromBindings(
                    nodeBinding.parameters,
                    variableId,
                    push,
                    `Presentation graph ${graphName} > Node ${graphNode.name || graphNode.id}`,
                    navContext
                );
            }

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
