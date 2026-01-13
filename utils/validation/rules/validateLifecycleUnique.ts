/**
 * utils/validation/rules/validateLifecycleUnique.ts
 * 校验生命周期脚本的唯一性引用
 * 规则：同一个生命周期脚本只能被一个对象（Stage/Node/State）绑定
 */

import { ValidationResult } from '../../../store/types';
import { ProjectData } from '../../../types/project';

interface UsageLocation {
    objectType: 'STAGE' | 'NODE' | 'STATE';
    objectId: string;
    location: string;
}

export const validateLifecycleUnique = (project: ProjectData): ValidationResult[] => {
    const results: ValidationResult[] = [];
    const scriptUsage = new Map<string, UsageLocation[]>();

    // Helper to record usage
    const recordUsage = (scriptId: string | undefined, usage: UsageLocation) => {
        if (!scriptId) return;
        
        if (!scriptUsage.has(scriptId)) {
            scriptUsage.set(scriptId, []);
        }
        scriptUsage.get(scriptId)!.push(usage);
    };

    // 1. Scan Stages
    Object.values(project.stageTree.stages).forEach(stage => {
        recordUsage(stage.lifecycleScriptId, {
            objectType: 'STAGE',
            objectId: stage.id,
            location: `Stage: ${stage.name}`
        });
    });

    // 2. Scan Nodes
    Object.values(project.nodes).forEach(node => {
        recordUsage(node.lifecycleScriptId, {
            objectType: 'NODE',
            objectId: node.id,
            location: `Node: ${node.name}`
        });

        // 3. Scan FSM States within Node
        const fsm = project.stateMachines[node.stateMachineId];
        if (fsm) {
            Object.values(fsm.states || {}).forEach(state => {
                recordUsage(state.lifecycleScriptId, {
                    objectType: 'STATE',
                    objectId: state.id,
                    location: `Node: ${node.name} > State: ${state.name}`
                });
            });
        }
    });

    // 4. Validate Uniqueness
    scriptUsage.forEach((usages, scriptId) => {
        if (usages.length > 1) {
            // Found duplicate usage
            const scriptName = project.scripts.scripts[scriptId]?.name || scriptId;
            const locations = usages.map(u => u.location).join('; ');
            
            // Generate error for EACH usage to ensure visibility
            usages.forEach(usage => {
                results.push({
                    id: `err-lifecycle-dup-${usage.objectType.toLowerCase()}-${usage.objectId}-${scriptId}`,
                    level: 'error',
                    message: `Lifecycle script "${scriptName}" is reused in multiple locations (${usages.length}). It must be unique.\nUsed in: ${locations}`,
                    objectType: usage.objectType as any,
                    objectId: usage.objectId,
                    location: usage.location
                });
            });
        }
    });

    return results;
};
