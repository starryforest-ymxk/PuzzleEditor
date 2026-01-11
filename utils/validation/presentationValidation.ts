/**
 * utils/validation/presentationValidation.ts
 * 演出图校验工具 - 检测节点中引用已删除资源的问题
 */

import { PresentationGraph, PresentationNode } from '../../types/presentation';
import { PresentationBinding } from '../../types/common';
import { ConditionExpression } from '../../types/stateMachine';
import { EditorState, ValidationResult } from '../../store/types';
import { FsmValidationIssue } from './fsmValidation';

/** 
 * 演出节点校验结果 
 * 复用 FSM 的 Issue 结构
 */
export interface PresentationNodeValidation {
    hasError: boolean;
    hasWarning: boolean;
    issues: FsmValidationIssue[];
}

/**
 * 检查演出节点校验
 */
export function checkPresentationNodeValidation(
    node: PresentationNode,
    editorState: EditorState
): PresentationNodeValidation {
    const issues: FsmValidationIssue[] = [];

    // 1. 检查 Branch 节点分支数量
    if (node.type === 'Branch' && node.nextIds.filter(id => !!id).length > 2) {
        issues.push({
            type: 'error',
            message: 'Branch nodes can only have 2 paths (True/False)',
            resourceType: 'graph',
            resourceId: node.id
        });
    }

    // 2. 检查 Branch 节点缺失条件
    if (node.type === 'Branch' && !node.condition) {
        issues.push({
            type: 'warning',
            message: 'Branch node has no condition (Results in True)',
            resourceType: 'variable',
            resourceId: node.id
        });
    }

    // 3. 检查演出绑定 (Script Ref / Graph Ref)
    if (node.presentation) {
        checkPresentationBinding(node.presentation, editorState, issues);
    }

    // 4. 检查 Condition 中的 Script Ref (对于 Branch 节点)
    if (node.condition) {
        checkConditionScriptRefs(node.condition, editorState, issues);
    }

    return {
        hasError: issues.some(i => i.type === 'error'),
        hasWarning: issues.some(i => i.type === 'warning'),
        issues
    };
}

/**
 * 递归检查条件表达式中的脚本引用
 */
function checkConditionScriptRefs(
    condition: ConditionExpression,
    state: EditorState,
    issues: FsmValidationIssue[]
): void {
    const project = state.project;

    // 检查 ScriptRef
    if (condition.type === 'ScriptRef' && condition.scriptId) {
        const script = project.scripts?.scripts[condition.scriptId];
        if (!script) {
            issues.push({
                type: 'error',
                message: `Condition references missing script: ${condition.scriptId}`,
                resourceType: 'script',
                resourceId: condition.scriptId
            });
        } else if (script.state === 'MarkedForDelete') {
            issues.push({
                type: 'error',
                message: `Condition references deleted script: ${condition.scriptId}`,
                resourceType: 'script',
                resourceId: condition.scriptId
            });
        }
    }

    // 递归检查子节点
    if (condition.children) {
        condition.children.forEach(child => checkConditionScriptRefs(child, state, issues));
    }

    // 递归检查操作数 (Not)
    if (condition.operand) {
        checkConditionScriptRefs(condition.operand, state, issues);
    }
}

/**
 * 检查演出绑定中的资源引用 (复用逻辑简化版)
 */
function checkPresentationBinding(
    binding: PresentationBinding,
    state: EditorState,
    issues: FsmValidationIssue[]
): void {
    const project = state.project;

    if (binding.type === 'Script' && binding.scriptId) {
        const script = project.scripts?.scripts[binding.scriptId];
        if (!script) {
            issues.push({
                type: 'error',
                message: `Presentation references missing script: ${binding.scriptId}`,
                resourceType: 'script',
                resourceId: binding.scriptId
            });
        } else if (script.state === 'MarkedForDelete') {
            issues.push({
                type: 'error',
                message: `Presentation references deleted script: ${binding.scriptId}`,
                resourceType: 'script',
                resourceId: binding.scriptId
            });
        }
    }

    if (binding.type === 'Graph' && binding.graphId) {
        // 演出图暂无软删除，仅检查是否存在
        const graph = project.presentationGraphs[binding.graphId];
        if (!graph) {
            issues.push({
                type: 'error',
                message: `Presentation references missing graph: ${binding.graphId}`,
                resourceType: 'graph',
                resourceId: binding.graphId
            });
        }
    }
}

/**
 * 批量校验演出图中所有节点
 */
export function validatePresentationGraph(
    graph: PresentationGraph,
    editorState: EditorState
): Record<string, PresentationNodeValidation> {
    const results: Record<string, PresentationNodeValidation> = {};
    const inDegrees = new Map<string, number>();

    // 初始化所有节点入度为 0
    Object.keys(graph.nodes).forEach(id => inDegrees.set(id, 0));

    // 计算入度
    Object.values(graph.nodes).forEach(node => {
        node.nextIds.forEach(targetId => {
            if (targetId && inDegrees.has(targetId)) {
                inDegrees.set(targetId, (inDegrees.get(targetId) || 0) + 1);
            }
        });
    });

    Object.values(graph.nodes).forEach(node => {
        const result = checkPresentationNodeValidation(node, editorState);

        // 1. 检查孤立节点 (Warning): 非 Start Node 且入度为 0
        if (node.id !== graph.startNodeId && (inDegrees.get(node.id) || 0) === 0) {
            result.issues.push({
                type: 'warning',
                message: 'Unreachable node: No incoming connections',
                resourceType: 'graph',
                resourceId: node.id
            });
        }

        // 2. 检查多出边 (Warning): 非 Branch/Parallel 节点若有多条出边，标记为 Warning
        if (node.type !== 'Branch' && node.type !== 'Parallel') {
            const validOutputs = node.nextIds.filter(id => !!id);
            if (validOutputs.length > 1) {
                result.issues.push({
                    type: 'warning',
                    message: `Multiple outgoing edges ignored. Only the first edge will be executed.`,
                    resourceType: 'graph',
                    resourceId: node.id
                });
            }
        }

        // 重新计算 hasError/hasWarning
        result.hasError = result.issues.some(i => i.type === 'error');
        result.hasWarning = result.issues.some(i => i.type === 'warning');

        results[node.id] = result;
    });

    return results;
}
