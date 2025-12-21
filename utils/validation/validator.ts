/**
 * utils/validation/validator.ts
 * 工程校验逻辑
 */

import { ProjectData } from '../../types/project';
import { ValidationResult } from '../../store/types'; // We will define this next
import { hasStageContent } from '../../utils/stageTreeUtils';

/**
 * 校验规则实现
 * 
 * 1. 引用完整性校验 (Reference Integrity)
 *    - Script/Variable/Event 是否存在且未处于 MarkedForDelete
 * 2. 结构完整性校验 (Structural Integrity)
 *    - FSM 是否有初始状态
 *    - Stage 是否孤立（简单检查）
 */

export const validateProject = (project: ProjectData): ValidationResult[] => {
    const results: ValidationResult[] = [];

    // --- 1. Blackboard Check ---
    // (目前黑板资源本身不太容易出错，除非有内部逻辑错误，暂时跳过黑板自身的一致性检查)

    // --- 2. Stage Tree Check ---
    Object.values(project.stageTree.stages).forEach(stage => {
        // 检查生命周期脚本引用
        if (stage.lifecycleScriptId) {
            const script = project.scripts?.scripts[stage.lifecycleScriptId];
            if (!script) {
                results.push({
                    id: `err-stage-script-${stage.id}`,
                    level: 'error',
                    message: `Stage "${stage.name}" references missing script: ${stage.lifecycleScriptId}`,
                    objectType: 'STAGE',
                    objectId: stage.id,
                    location: `Stage: ${stage.name}`
                });
            } else if (script.state === 'MarkedForDelete') {
                results.push({
                    id: `warn-stage-script-del-${stage.id}`,
                    level: 'warning',
                    message: `Stage "${stage.name}" uses script marked for delete: ${script.name}`,
                    objectType: 'STAGE',
                    objectId: stage.id,
                    location: `Stage: ${stage.name}`
                });
            }
        }

        // 检查 Unlock Triggers
        if (stage.unlockTriggers && stage.unlockTriggers.length > 0) {
            stage.unlockTriggers.forEach((trigger, idx) => {
                if (trigger.type === 'CustomScript') {
                    if (trigger.scriptId) {
                        const script = project.scripts?.scripts[trigger.scriptId];
                        if (!script) {
                            results.push({
                                id: `err-stage-trigger-${stage.id}-${idx}`,
                                level: 'error',
                                message: `Stage "${stage.name}" trigger #${idx + 1} references missing script: ${trigger.scriptId}`,
                                objectType: 'STAGE',
                                objectId: stage.id,
                                location: `Stage: ${stage.name}`
                            });
                        } else if (script.state === 'MarkedForDelete') {
                            results.push({
                                id: `warn-stage-trigger-del-${stage.id}-${idx}`,
                                level: 'warning',
                                message: `Stage "${stage.name}" trigger #${idx + 1} uses script marked for delete: ${script.name}`,
                                objectType: 'STAGE',
                                objectId: stage.id,
                                location: `Stage: ${stage.name}`
                            });
                        }
                    }
                } else if (trigger.type === 'OnEvent') {
                    if (trigger.eventId) {
                        const evt = project.blackboard.events[trigger.eventId];
                        if (!evt) {
                            results.push({
                                id: `err-stage-evt-${stage.id}-${idx}`,
                                level: 'error',
                                message: `Stage "${stage.name}" trigger #${idx + 1} references missing event: ${trigger.eventId}`,
                                objectType: 'STAGE',
                                objectId: stage.id,
                                location: `Stage: ${stage.name}`
                            });
                        } else if (evt.state === 'MarkedForDelete') {
                            results.push({
                                id: `warn-stage-evt-del-${stage.id}-${idx}`,
                                level: 'warning',
                                message: `Stage "${stage.name}" trigger #${idx + 1} uses event marked for delete: ${evt.name}`,
                                objectType: 'STAGE',
                                objectId: stage.id,
                                location: `Stage: ${stage.name}`
                            });
                        }
                    }
                }
            });
        }
    });

    // --- 3. Puzzle Node & FSM Check ---
    Object.values(project.nodes).forEach(node => {
        const fsm = project.stateMachines[node.stateMachineId];
        if (!fsm) {
            // Should not happen if data integrity is kept, but good to check
            results.push({
                id: `err-node-no-fsm-${node.id}`,
                level: 'error',
                message: `Puzzle Node "${node.name}" references missing FSM: ${node.stateMachineId}.`,
                objectType: 'NODE',
                objectId: node.id,
                location: `Node: ${node.name}`
            });
            return;
        }

        // FSM Initial State Check
        const hasStates = Object.keys(fsm.states || {}).length > 0;
        if (hasStates && !fsm.initialStateId) {
            results.push({
                id: `err-node-no-init-${node.id}`,
                level: 'error',
                message: `Puzzle Node "${node.name}" has states but no Initial State set.`,
                objectType: 'NODE',
                objectId: node.id,
                location: `Node: ${node.name}`
            });
        }

        // Check States
        Object.values(fsm.states || {}).forEach(state => {
            // Check State Script
            if (state.lifecycleScriptId) {
                const script = project.scripts?.scripts[state.lifecycleScriptId];
                if (!script) {
                    results.push({
                        id: `err-state-script-${state.id}`,
                        level: 'error',
                        message: `State "${state.name}" (in ${node.name}) references missing script.`,
                        objectType: 'STATE',
                        objectId: state.id,
                        contextId: node.id,
                        location: `Node: ${node.name} > State: ${state.name}`
                    });
                }
            }

            // Check Transitions
            const outgoingTransitions = Object.values(fsm.transitions || {}).filter(t => t.fromStateId === state.id);
            outgoingTransitions.forEach((trans, idx) => {
                if (!fsm.states[trans.toStateId]) {
                    results.push({
                        id: `err-trans-target-${state.id}-${trans.id}`,
                        level: 'error',
                        message: `Transition from "${state.name}" points to missing state: ${trans.toStateId}`,
                        objectType: 'TRANSITION',
                        objectId: trans.id,
                        contextId: node.id,
                        location: `Node: ${node.name} > State: ${state.name}`
                    });
                }
            });
        });
    });

    // --- 4. Presentation Graph Check ---
    Object.values(project.presentationGraphs).forEach(graph => {
        if (!graph.startNodeId && Object.keys(graph.nodes).length > 0) {
            results.push({
                id: `warn-graph-no-start-${graph.id}`,
                level: 'warning',
                message: `Presentation Graph "${graph.name}" has nodes but no Start Node.`,
                objectType: 'PRESENTATION_GRAPH',
                objectId: graph.id,
                location: `Graph: ${graph.name}`
            });
        }
    });

    return results;
};
