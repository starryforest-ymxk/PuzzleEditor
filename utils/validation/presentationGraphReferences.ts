/**
 * utils/validation/presentationGraphReferences.ts
 * 演出图引用追踪工具，用于显示演出图被引用的位置
 */

import { StateMachine, Transition, State } from '../../types/stateMachine';
import { PuzzleNode } from '../../types/puzzleNode';
import { StageNode } from '../../types/stage';
import { PresentationBinding } from '../../types/common';
import { ReferenceNavigationContext, VariableReferenceInfo } from './globalVariableReferences';

// 定义函数所需的最小项目数据结构
interface ProjectLike {
    nodes: Record<string, PuzzleNode>;
    stateMachines?: Record<string, StateMachine>;
    stageTree: {
        stages: Record<string, StageNode>;
    };
}

/**
 * 检查演出绑定是否引用了指定的演出图
 */
const checkPresentationBinding = (
    binding: PresentationBinding | undefined,
    graphId: string
): boolean => {
    return binding?.type === 'Graph' && binding.graphId === graphId;
};

/**
 * 收集 Stage 中对演出图的引用
 */
const collectGraphFromStage = (
    stage: StageNode,
    graphId: string,
    collector: (info: VariableReferenceInfo) => void
) => {
    const stageName = stage.name || stage.id;

    if (checkPresentationBinding(stage.onEnterPresentation, graphId)) {
        collector({
            location: `Stage ${stageName} > OnEnter Presentation`,
            navContext: undefined // Stage 目前不支持导航
        });
    }

    if (checkPresentationBinding(stage.onExitPresentation, graphId)) {
        collector({
            location: `Stage ${stageName} > OnExit Presentation`,
            navContext: undefined
        });
    }
};

/**
 * 收集 State 中对演出图的引用
 */
const collectGraphFromState = (
    state: State,
    graphId: string,
    collector: (info: VariableReferenceInfo) => void,
    fsmName: string,
    nodeId: string
) => {
    const stateName = state.name || state.id;
    const navContext: ReferenceNavigationContext = {
        targetType: 'STATE',
        nodeId,
        stateId: state.id
    };

    if (checkPresentationBinding(state.presentation, graphId)) {
        collector({
            location: `FSM ${fsmName} > State ${stateName} > Presentation`,
            navContext
        });
    }
};

/**
 * 收集 Transition 中对演出图的引用
 */
const collectGraphFromTransition = (
    trans: Transition,
    graphId: string,
    collector: (info: VariableReferenceInfo) => void,
    fsmName: string,
    nodeId: string
) => {
    const transName = trans.name || trans.id;
    const navContext: ReferenceNavigationContext = {
        targetType: 'TRANSITION',
        nodeId,
        transitionId: trans.id
    };

    if (checkPresentationBinding(trans.presentation, graphId)) {
        collector({
            location: `FSM ${fsmName} > Transition ${transName} > Presentation`,
            navContext
        });
    }
};

/**
 * 收集指定演出图在整个项目中被引用的位置
 * 
 * 检查范围：
 * 1. 所有 Stage 的 onEnter/onExit Presentation
 * 2. 所有状态机的状态 presentation
 * 3. 所有转移的 presentation
 */
export const findPresentationGraphReferences = (
    project: ProjectLike,
    graphId: string
): VariableReferenceInfo[] => {
    const refs: VariableReferenceInfo[] = [];
    const push = (info: VariableReferenceInfo) => refs.push(info);

    // 1) 遍历所有 Stage
    Object.values(project.stageTree.stages || {}).forEach(stage => {
        collectGraphFromStage(stage, graphId, push);
    });

    // 2) 遍历所有 PuzzleNode 关联的状态机
    Object.values(project.nodes).forEach(node => {
        const fsm = project.stateMachines?.[node.stateMachineId];
        if (fsm) {
            const fsmName = node.name || node.id;

            // 状态的 presentation
            Object.values(fsm.states || {}).forEach(state => {
                collectGraphFromState(state, graphId, push, fsmName, node.id);
            });

            // 转移的 presentation
            Object.values(fsm.transitions || {}).forEach(trans =>
                collectGraphFromTransition(trans, graphId, push, fsmName, node.id)
            );
        }
    });

    return refs;
};
