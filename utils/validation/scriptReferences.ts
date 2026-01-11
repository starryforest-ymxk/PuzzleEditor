/**
 * utils/validation/scriptReferences.ts
 * 脚本引用追踪工具，用于显示脚本被引用的位置
 */

import { ConditionExpression, StateMachine, Transition, State } from '../../types/stateMachine';
import { PresentationGraph } from '../../types/presentation';
import { PuzzleNode } from '../../types/puzzleNode';
import { StageNode } from '../../types/stage';
import { PresentationBinding } from '../../types/common';
import { ReferenceNavigationContext, VariableReferenceInfo } from './globalVariableReferences';

// 定义函数所需的最小项目数据结构
interface ProjectLike {
    nodes: Record<string, PuzzleNode>;
    stateMachines?: Record<string, StateMachine>;
    presentationGraphs?: Record<string, PresentationGraph>;
    stageTree: {
        stages: Record<string, StageNode>;
    };
}

/**
 * 检查条件表达式是否引用了指定的脚本
 */
const collectScriptFromCondition = (
    condition: ConditionExpression | undefined,
    scriptId: string,
    collector: (info: VariableReferenceInfo) => void,
    origin: string,
    navContext?: ReferenceNavigationContext
) => {
    if (!condition) return;

    // 检查 ScriptRef 类型
    if (condition.type === 'ScriptRef') {
        if ((condition as any).scriptId === scriptId) {
            collector({ location: origin, navContext });
        }
        return;
    }

    // 递归处理复合条件
    if (condition.type === 'And' || condition.type === 'Or') {
        condition.children?.forEach((c, idx) =>
            collectScriptFromCondition(c, scriptId, collector, `${origin} > Sub condition ${idx + 1}`, navContext)
        );
    }

    if (condition.type === 'Not' && condition.operand) {
        collectScriptFromCondition(condition.operand, scriptId, collector, `${origin} > Not`, navContext);
    }
};

/**
 * 检查触发器是否引用了指定的脚本
 */
const collectScriptFromTriggers = (
    triggers: any[] | undefined,
    scriptId: string,
    collector: (info: VariableReferenceInfo) => void,
    origin: string,
    navContext?: ReferenceNavigationContext
) => {
    if (!triggers) return;
    triggers.forEach((trigger, idx) => {
        if (trigger.type === 'CustomScript' && trigger.scriptId === scriptId) {
            collector({ location: `${origin} > Trigger ${idx + 1}`, navContext });
        }
    });
};

/**
 * 检查演出绑定是否引用了指定的脚本
 * 注意：仅检查 type: 'Script' 类型的直接脚本绑定
 * type: 'Graph' 的情况不在此处理，演出图内部的脚本引用由主函数最后统一遍历
 */
const collectScriptFromPresentationBinding = (
    binding: PresentationBinding | undefined,
    scriptId: string,
    collector: (info: VariableReferenceInfo) => void,
    origin: string,
    navContext?: ReferenceNavigationContext
) => {
    if (!binding) return;
    // 仅处理直接脚本绑定
    if (binding.type === 'Script' && binding.scriptId === scriptId) {
        collector({ location: `${origin} > Script Binding`, navContext });
    }
    // type: 'Graph' 不在此处理，避免重复遍历
};

/**
 * 检查状态的生命周期脚本是否引用了指定的脚本
 */
const collectScriptFromState = (
    state: State,
    scriptId: string,
    collector: (info: VariableReferenceInfo) => void,
    fsmName: string,
    nodeId: string
) => {
    const navContext: ReferenceNavigationContext = {
        targetType: 'STATE',
        nodeId,
        stateId: state.id
    };
    const stateName = state.name || state.id;

    // 检查统一的生命周期脚本字段
    if (state.lifecycleScriptId === scriptId) {
        collector({ location: `FSM ${fsmName} > State ${stateName} > Lifecycle Script`, navContext });
    }
};

/**
 * 检查转移是否引用了指定的脚本
 */
const collectScriptFromTransition = (
    trans: Transition,
    scriptId: string,
    collector: (info: VariableReferenceInfo) => void,
    fsmName: string,
    nodeId: string
) => {
    const transName = `FSM ${fsmName} > Transition ${trans.name || trans.id}`;
    const navContext: ReferenceNavigationContext = {
        targetType: 'TRANSITION',
        nodeId,
        transitionId: trans.id
    };

    // 检查条件中的脚本引用
    collectScriptFromCondition(trans.condition, scriptId, collector, `${transName} > Condition`, navContext);
    // 检查触发器
    collectScriptFromTriggers(trans.triggers, scriptId, collector, transName, navContext);
    // 检查演出绑定（仅 type: 'Script' 类型）
    collectScriptFromPresentationBinding(trans.presentation, scriptId, collector, `${transName} > Presentation`, navContext);
};

/**
 * 检查 PuzzleNode 是否引用了指定的脚本
 */
const collectScriptFromNode = (
    node: PuzzleNode,
    scriptId: string,
    collector: (info: VariableReferenceInfo) => void
) => {
    const navContext: ReferenceNavigationContext = {
        targetType: 'NODE',
        nodeId: node.id
    };
    const nodeName = node.name || node.id;

    // 检查节点的生命周期脚本
    if (node.lifecycleScriptId === scriptId) {
        collector({ location: `Node ${nodeName} > Lifecycle Script`, navContext });
    }
};

/**
 * 检查 Stage 是否引用了指定的脚本
 * 
 * 扫描范围：
 * - 生命周期脚本 (lifecycleScriptId)
 * - 解锁条件中的脚本引用 (unlockCondition)
 * - OnEnter 演出绑定 (onEnterPresentation)
 * - OnExit 演出绑定 (onExitPresentation)
 */
const collectScriptFromStage = (
    stage: StageNode,
    scriptId: string,
    collector: (info: VariableReferenceInfo) => void
) => {
    const stageName = stage.name || stage.id;
    const navContext: ReferenceNavigationContext = {
        targetType: 'STAGE',
        stageId: stage.id
    };

    // 检查 Stage 的生命周期脚本
    if (stage.lifecycleScriptId === scriptId) {
        collector({ location: `Stage ${stageName} > Lifecycle Script`, navContext });
    }

    // 检查解锁条件中的脚本引用
    collectScriptFromCondition(stage.unlockCondition, scriptId, collector, `Stage ${stageName} > Unlock Condition`, navContext);

    // 检查解锁触发器 (Unlock Triggers)
    collectScriptFromTriggers(stage.unlockTriggers, scriptId, collector, `Stage ${stageName}`, navContext);

    // 检查 OnEnter 演出绑定
    collectScriptFromPresentationBinding(stage.onEnterPresentation, scriptId, collector, `Stage ${stageName} > OnEnter Presentation`, navContext);

    // 检查 OnExit 演出绑定
    collectScriptFromPresentationBinding(stage.onExitPresentation, scriptId, collector, `Stage ${stageName} > OnExit Presentation`, navContext);
};

/**
 * 收集指定脚本在整个项目中被引用的位置
 * 
 * 检查范围：
 * 1. 所有 Stage 的生命周期脚本
 * 2. 所有 PuzzleNode 的生命周期脚本
 * 3. 所有状态机的状态生命周期脚本
 * 4. 所有转移的条件、触发器
 * 5. 所有演出图节点的脚本绑定（scriptId 字段）
 */
export const findScriptReferences = (
    project: ProjectLike,
    scriptId: string
): VariableReferenceInfo[] => {
    const refs: VariableReferenceInfo[] = [];
    const push = (info: VariableReferenceInfo) => refs.push(info);
    const graphs = project.presentationGraphs || {};

    // 1) 遍历所有 Stage
    Object.values(project.stageTree?.stages || {}).forEach(stage => {
        if (!stage) return;
        collectScriptFromStage(stage, scriptId, push);
    });

    // 2) 遍历所有 PuzzleNode
    Object.values(project.nodes || {}).forEach(node => {
        if (!node) return;
        collectScriptFromNode(node, scriptId, push);

        // 3) 遍历关联的状态机
        const fsm = project.stateMachines?.[node.stateMachineId];
        if (fsm) {
            const fsmName = node.name || node.id;

            // 状态的生命周期脚本
            Object.values(fsm.states || {}).forEach(state => {
                if (!state) return;
                collectScriptFromState(state, scriptId, push, fsmName, node.id);
            });

            // 转移
            Object.values(fsm.transitions || {}).forEach(trans => {
                if (!trans) return;
                collectScriptFromTransition(trans, scriptId, push, fsmName, node.id);
            });
        }
    });

    // 4) 遍历所有演出图节点（严格模式：仅通过 node.presentation.type === 'Script' 引用脚本）
    Object.values(graphs).forEach(graph => {
        if (!graph) return;
        const graphName = graph.name || graph.id;
        Object.values(graph.nodes || {}).forEach(pNode => {
            // 检查 PresentationNode 类型节点的 Script 绑定
            if (pNode.presentation?.type === 'Script' && pNode.presentation.scriptId === scriptId) {
                const navContext: ReferenceNavigationContext = {
                    targetType: 'PRESENTATION_NODE',
                    graphId: graph.id,
                    presentationNodeId: pNode.id
                };
                push({
                    location: `Presentation ${graphName} > Node ${pNode.name || pNode.id}`,
                    navContext
                });
            }
        });
    });

    return refs;
};
