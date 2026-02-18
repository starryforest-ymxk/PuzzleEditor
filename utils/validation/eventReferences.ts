/**
 * utils/validation/eventReferences.ts
 * 事件引用追踪工具，用于显示事件被引用的位置
 */

import { StateMachine, Transition, State } from '../../types/stateMachine';
import { PuzzleNode } from '../../types/puzzleNode';
import { StageNode } from '../../types/stage';
import { EventListener } from '../../types/common';
import { ReferenceNavigationContext, VariableReferenceInfo } from './globalVariableReferences';
import { ProjectLike } from './types';

/**
 * 检查事件监听器列表是否引用了指定的事件
 */
const collectEventFromListeners = (
    listeners: EventListener[] | undefined,
    eventId: string,
    collector: (info: VariableReferenceInfo) => void,
    origin: string,
    navContext?: ReferenceNavigationContext
) => {
    if (!listeners) return;
    listeners.forEach((listener, idx) => {
        if (listener.eventId === eventId) {
            collector({
                location: `${origin} > Listener ${idx + 1}`,
                navContext
            });
        }
    });
};

/**
 * 检查转移的触发器是否引用了指定的事件
 */
const collectEventFromTransition = (
    trans: Transition,
    eventId: string,
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

    // 检查触发器中的 OnEvent 类型
    trans.triggers?.forEach((trigger, idx) => {
        if (trigger.type === 'OnEvent' && trigger.eventId === eventId) {
            collector({
                location: `FSM ${fsmName} > Transition ${transName} > Trigger ${idx + 1}`,
                navContext
            });
        }
    });
};

/**
 * 检查状态的事件监听器是否引用了指定的事件
 */
const collectEventFromState = (
    state: State,
    eventId: string,
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

    collectEventFromListeners(
        state.eventListeners,
        eventId,
        collector,
        `FSM ${fsmName} > State ${stateName}`,
        navContext
    );
};

/**
 * 检查 PuzzleNode 的事件监听器是否引用了指定的事件
 */
const collectEventFromNode = (
    node: PuzzleNode,
    eventId: string,
    collector: (info: VariableReferenceInfo) => void
) => {
    const navContext: ReferenceNavigationContext = {
        targetType: 'NODE',
        nodeId: node.id
    };
    const nodeName = node.name || node.id;

    collectEventFromListeners(
        node.eventListeners,
        eventId,
        collector,
        `Node ${nodeName}`,
        navContext
    );
};

/**
 * 检查 Stage 的事件监听器是否引用了指定的事件
 */
const collectEventFromStage = (
    stage: StageNode,
    eventId: string,
    collector: (info: VariableReferenceInfo) => void
) => {
    const stageName = stage.name || stage.id;
    const navContext: ReferenceNavigationContext = {
        targetType: 'STAGE',
        stageId: stage.id
    };

    collectEventFromListeners(
        stage.eventListeners,
        eventId,
        collector,
        `Stage ${stageName}`,
        navContext
    );

    // 检查解锁触发器 (Unlock Triggers) 中的事件引用
    stage.unlockTriggers?.forEach((trigger, idx) => {
        if (trigger.type === 'OnEvent' && trigger.eventId === eventId) {
            collector({
                location: `Stage ${stageName} > Trigger ${idx + 1}`,
                navContext: {
                    targetType: 'STAGE',
                    stageId: stage.id
                }
            });
        }
    });
};

/**
 * 收集指定事件在整个项目中被引用的位置
 * 
 * 检查范围：
 * 1. 所有 Stage 的事件监听器
 * 2. 所有 PuzzleNode 的事件监听器
 * 3. 所有状态机的状态事件监听器
 * 4. 所有转移的触发器（OnEvent 类型）
 */
export const findEventReferences = (
    project: ProjectLike,
    eventId: string
): VariableReferenceInfo[] => {
    const refs: VariableReferenceInfo[] = [];
    const push = (info: VariableReferenceInfo) => refs.push(info);

    // 1) 遍历所有 Stage
    Object.values(project.stageTree.stages || {}).forEach(stage => {
        collectEventFromStage(stage, eventId, push);
    });

    // 2) 遍历所有 PuzzleNode
    Object.values(project.nodes).forEach(node => {
        collectEventFromNode(node, eventId, push);

        // 3) 遍历关联的状态机
        const fsm = project.stateMachines?.[node.stateMachineId];
        if (fsm) {
            const fsmName = node.name || node.id;

            // 状态的事件监听器
            Object.values(fsm.states || {}).forEach(state => {
                collectEventFromState(state, eventId, push, fsmName, node.id);
            });

            // 转移的触发器
            Object.values(fsm.transitions || {}).forEach(trans =>
                collectEventFromTransition(trans, eventId, push, fsmName, node.id)
            );
        }
    });

    return refs;
};
