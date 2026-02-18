/**
 * utils/referenceNavigation.ts
 * 引用导航工具函数
 *
 * 职责：
 * 将 Inspector / Editor 中重复的 handleReferenceClick switch-case 逻辑
 * 统一收敛为一个纯函数，供所有需要「点击引用项跳转」的组件复用。
 *
 * 导航模式：先 dispatch NAVIGATE_TO（切换视图/打开画布），
 * 再 dispatch SELECT_OBJECT（选中目标对象），确保视图切换后选中状态正确应用。
 */

import type { ReferenceNavigationContext } from './validation/globalVariableReferences';
import type { PuzzleNode } from '../types/puzzleNode';
import type { Action } from '../store/types';

/**
 * 低级辅助函数：先导航再选中
 * 将 NAVIGATE_TO + SELECT_OBJECT 两步 dispatch 合为一次调用
 * @param dispatch  store dispatch 函数
 * @param navigatePayload  NAVIGATE_TO 的 payload
 * @param selectPayload    SELECT_OBJECT 的 payload（可选，不传则只导航不选中）
 */
export function navigateAndSelect(
    dispatch: (action: Action) => void,
    navigatePayload: {
        stageId?: string | null;
        nodeId?: string | null;
        graphId?: string | null;
    },
    selectPayload?: {
        type: string;
        id: string;
        contextId?: string;
    }
): void {
    dispatch({ type: 'NAVIGATE_TO', payload: navigatePayload });
    if (selectPayload) {
        dispatch({ type: 'SELECT_OBJECT', payload: selectPayload as any });
    }
}

/**
 * 根据引用上下文导航到目标对象并选中
 * @param dispatch  store dispatch 函数
 * @param nodes     当前项目的 PuzzleNode 字典（用于查找 stageId）
 * @param navContext 引用导航上下文，包含目标类型和所需 ID
 */
export function navigateToReference(
    dispatch: (action: Action) => void,
    nodes: Record<string, PuzzleNode>,
    navContext: ReferenceNavigationContext
): void {
    const { targetType, stageId, nodeId, stateId, transitionId, graphId, presentationNodeId } = navContext;

    switch (targetType) {
        case 'STAGE':
            // 导航到 Stage 概览并选中
            if (stageId) {
                navigateAndSelect(dispatch,
                    { stageId, nodeId: null, graphId: null },
                    { type: 'STAGE', id: stageId }
                );
            }
            break;

        case 'NODE':
            // 导航到 Node 的 FSM Canvas 并选中 Node
            if (nodeId) {
                const node = nodes[nodeId];
                if (node) {
                    navigateAndSelect(dispatch,
                        { stageId: node.stageId, nodeId, graphId: null },
                        { type: 'NODE', id: nodeId, contextId: nodeId }
                    );
                }
            }
            break;

        case 'STATE':
            // 导航到 Node 的 FSM Canvas 并选中 State
            if (nodeId && stateId) {
                const node = nodes[nodeId];
                if (node) {
                    navigateAndSelect(dispatch,
                        { stageId: node.stageId, nodeId, graphId: null },
                        { type: 'STATE', id: stateId, contextId: nodeId }
                    );
                }
            }
            break;

        case 'TRANSITION':
            // 导航到 Node 的 FSM Canvas 并选中 Transition
            if (nodeId && transitionId) {
                const node = nodes[nodeId];
                if (node) {
                    navigateAndSelect(dispatch,
                        { stageId: node.stageId, nodeId, graphId: null },
                        { type: 'TRANSITION', id: transitionId, contextId: nodeId }
                    );
                }
            }
            break;

        case 'PRESENTATION_GRAPH':
            // 导航到演出图编辑画布并选中
            if (graphId) {
                navigateAndSelect(dispatch,
                    { graphId },
                    { type: 'PRESENTATION_GRAPH', id: graphId }
                );
            }
            break;

        case 'PRESENTATION_NODE':
            // 导航到演出图并选中演出节点
            if (graphId && presentationNodeId) {
                navigateAndSelect(dispatch,
                    { graphId },
                    { type: 'PRESENTATION_NODE', id: presentationNodeId, contextId: graphId }
                );
            }
            break;
    }
}
