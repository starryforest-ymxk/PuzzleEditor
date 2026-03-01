/**
 * utils/validation/rules/validateNames.ts
 * 校验资源名称是否存在、重复以及格式合法性
 * 
 * 重点校验 assetName (资源名称)，用于生成代码时的标识符
 * - 缺失 assetName -> Warning
 * - 重复 assetName -> Error
 * - 格式非法 (Invalid Format) -> Error (New)
 * 
 * 注意：Name (显示名称) 由前端 UI 保护，不在此处校验
 */

import { ValidationResult } from '../../../store/types';
import { ProjectData } from '../../../types/project';
import { ASSET_NAME_REGEX } from '../../assetNameValidation';

/**
 * Helper to validate asset names (Resource Name)
 * - Warning if assetName is missing
 * - Error if assetName is duplicated
 * - Error if assetName has invalid format
 */
function validateAssetNames(
    results: ValidationResult[],
    items: { id: string, assetName?: string, name: string }[],
    objectType: ValidationResult['objectType'],
    humanType: string,
    locationPrefix: string = ''
) {
    const nameMap = new Map<string, typeof items>(); // AssetName -> List of Items

    items.forEach(item => {
        // 1. Check Missing Asset Name
        // 允许空值，但给出警告
        if (!item.assetName || item.assetName.trim() === '') {
            results.push({
                id: `err-${objectType.toLowerCase()}-no-asset-name-${item.id}`,
                level: 'error',
                message: `${humanType} has no resource name (assetName).`,
                objectType: objectType,
                objectId: item.id,
                location: `${locationPrefix}${humanType}: [${item.id}] ${item.name}`
            });
            return; // Skip duplicate check for empty names
        }

        const assetName = item.assetName.trim();

        // 2. Check Format (New Strict Check)
        if (!ASSET_NAME_REGEX.test(assetName)) {
            results.push({
                id: `err-${objectType.toLowerCase()}-invalid-name-fmt-${item.id}`,
                level: 'error',
                message: `${humanType} resource name "${assetName}" is invalid. Must match /^[a-zA-Z_][a-zA-Z0-9_]*$/.`,
                objectType: objectType,
                objectId: item.id,
                location: `${locationPrefix}${humanType}: [${item.id}] ${item.name}`
            });
        }

        if (!nameMap.has(assetName)) {
            nameMap.set(assetName, []);
        }
        nameMap.get(assetName)?.push(item);
    });

    // 3. Check Duplicates
    nameMap.forEach((duplicates, assetName) => {
        if (duplicates.length > 1) {
            duplicates.forEach(item => {
                results.push({
                    id: `err-${objectType.toLowerCase()}-dup-asset-name-${item.id}`,
                    level: 'error',
                    message: `${humanType} resource name "${assetName}" is duplicated.`,
                    objectType: objectType,
                    objectId: item.id,
                    location: `${locationPrefix}${humanType}: [${item.id}] ${item.name}`
                });
            });
        }
    });
}

export const validateNames = (project: ProjectData): ValidationResult[] => {
    const results: ValidationResult[] = [];

    // 1. Blackboard Check
    // 1.1 Global Variables
    const globalVars = Object.values(project.blackboard.globalVariables || {});
    validateAssetNames(results, globalVars, 'VARIABLE', 'Global Variable');

    // 1.2 Events
    const events = Object.values(project.blackboard.events || {});
    validateAssetNames(results, events, 'EVENT', 'Event');

    // 1.3 Scripts (All categories together)
    const scripts = Object.values(project.scripts?.scripts || {});
    validateAssetNames(results, scripts, 'SCRIPT', 'Script');

    // 2. Stage Tree Check (Stages)
    const allStages = Object.values(project.stageTree.stages);
    validateAssetNames(results, allStages, 'STAGE', 'Stage');

    // 3. Puzzle Node Check (Global uniqueness for Nodes)
    const allNodes = Object.values(project.nodes);
    validateAssetNames(results, allNodes, 'NODE', 'Node');

    // 4. State Check (Per FSM)
    Object.values(project.nodes).forEach(node => {
        if (!node.stateMachineId) return;
        const fsm = project.stateMachines[node.stateMachineId];
        if (!fsm) return;

        if (fsm.states) {
            const states = Object.values(fsm.states);
            validateAssetNames(results, states, 'STATE', 'State', `Node: ${node.name} > `);
        }
    });

    return results;
};
