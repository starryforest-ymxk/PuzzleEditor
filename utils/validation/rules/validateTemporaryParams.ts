/**
 * utils/validation/rules/validateTemporaryParams.ts
 * 校验 Temporary 参数一致性
 * 
 * 对应后端校验规则：
 * #57: Temporary paramName 为空
 * #58: Temporary paramName 非法 C# 标识符
 * #59: Temporary param 缺少 type
 * #60: Temporary param type 不在白名单
 * #61: Temporary param 类型冲突（同名参数在不同位置声明了不同类型）
 */

import { ValidationResult } from '../../../store/types';
import { ProjectData } from '../../../types/project';
import { PresentationBinding, ParameterBinding, VariableType } from '../../../types/common';
import { ASSET_NAME_REGEX } from '../../assetNameValidation';

// 允许的 Temporary 参数类型白名单
const ALLOWED_TEMP_TYPES: Set<string> = new Set(['boolean', 'integer', 'float', 'string']);

/**
 * 从一个 PresentationBinding 中提取所有 Temporary 参数
 */
function extractTemporaryParams(
    binding: PresentationBinding | undefined
): ParameterBinding[] {
    if (!binding || binding.type !== 'Script') return [];
    return (binding.parameters || []).filter(p => p.kind === 'Temporary');
}

/**
 * 用于追踪已出现的 Temporary 参数（按脚本分组）
 */
interface TempParamRecord {
    scriptId: string;
    scriptName: string;
    paramName: string;
    type: VariableType | string;
    location: string;
}

export const validateTemporaryParams = (project: ProjectData): ValidationResult[] => {
    const results: ValidationResult[] = [];

    // 收集所有 Temporary 参数记录，用于跨位置类型冲突检测
    const allTempParams: TempParamRecord[] = [];

    // Helper: 处理一个 binding 的 Temporary 参数
    const validateBinding = (
        binding: PresentationBinding | undefined,
        locationContext: { objectType: ValidationResult['objectType'], objectId: string, location: string }
    ) => {
        const tempParams = extractTemporaryParams(binding);
        if (tempParams.length === 0 || binding?.type !== 'Script') return;

        const scriptId = binding.scriptId;
        const scriptDef = project.scripts?.scripts[scriptId];
        const scriptName = scriptDef?.name || scriptId;

        tempParams.forEach((param, idx) => {
            // #57: Temporary paramName 为空
            if (!param.paramName || param.paramName.trim() === '') {
                results.push({
                    id: `err-temp-empty-name-${locationContext.objectId}-${idx}`,
                    level: 'error',
                    message: `Temporary parameter name is empty in script "${scriptName}".`,
                    ...locationContext
                });
                return;
            }

            // #58: Temporary paramName 非法 C# 标识符
            if (!ASSET_NAME_REGEX.test(param.paramName)) {
                results.push({
                    id: `err-temp-invalid-name-${locationContext.objectId}-${param.paramName}`,
                    level: 'error',
                    message: `Temporary parameter name "${param.paramName}" is not a valid C# identifier (script: "${scriptName}").`,
                    ...locationContext
                });
            }

            // #59: Temporary param 缺少 type
            if (!param.tempVariable?.type) {
                results.push({
                    id: `err-temp-no-type-${locationContext.objectId}-${param.paramName}`,
                    level: 'error',
                    message: `Temporary parameter "${param.paramName}" has no type (script: "${scriptName}").`,
                    ...locationContext
                });
                return;
            }

            // #60: Temporary param type 不在白名单
            if (!ALLOWED_TEMP_TYPES.has(param.tempVariable.type)) {
                results.push({
                    id: `err-temp-bad-type-${locationContext.objectId}-${param.paramName}`,
                    level: 'error',
                    message: `Temporary parameter "${param.paramName}" has unsupported type "${param.tempVariable.type}" (script: "${scriptName}"). Allowed: boolean, integer, float, string.`,
                    ...locationContext
                });
            }

            // 记录用于 #61 冲突检测
            allTempParams.push({
                scriptId,
                scriptName,
                paramName: param.paramName,
                type: param.tempVariable.type,
                location: locationContext.location
            });
        });
    };

    // =========================================================================
    // 1. 遍历 Stage 的演出绑定
    // =========================================================================
    Object.values(project.stageTree.stages).forEach(stage => {
        const ctx = { objectType: 'STAGE' as const, objectId: stage.id, location: `Stage: ${stage.name}` };
        validateBinding(stage.onEnterPresentation, { ...ctx, location: `${ctx.location} > OnEnter` });
        validateBinding(stage.onExitPresentation, { ...ctx, location: `${ctx.location} > OnExit` });
    });

    // =========================================================================
    // 2. 遍历 Node → FSM → Transition 的演出绑定
    // =========================================================================
    Object.values(project.nodes).forEach(node => {
        const fsm = project.stateMachines[node.stateMachineId];
        if (!fsm) return;

        Object.values(fsm.transitions || {}).forEach(trans => {
            const fromState = fsm.states[trans.fromStateId];
            const transCtx = {
                objectType: 'TRANSITION' as const,
                objectId: trans.id,
                location: `Node: ${node.name} > State: ${fromState?.name || trans.fromStateId} > Transition`
            };
            validateBinding(trans.presentation, transCtx);
        });
    });

    // =========================================================================
    // 3. 遍历 Presentation Graph 节点的演出绑定
    // =========================================================================
    Object.values(project.presentationGraphs || {}).forEach(graph => {
        Object.values(graph.nodes || {}).forEach(pNode => {
            const nodeCtx = {
                objectType: 'PRESENTATION_GRAPH' as const,
                objectId: graph.id,
                location: `Graph: ${graph.name} > Node: ${pNode.name || pNode.id}`
            };
            validateBinding(pNode.presentation, nodeCtx);
        });
    });

    // =========================================================================
    // 4. #61: 跨位置类型冲突检测
    // 按 (scriptId, paramName) 分组，检查是否存在不同的 type
    // =========================================================================
    const paramGroups = new Map<string, TempParamRecord[]>();
    allTempParams.forEach(record => {
        const key = `${record.scriptId}::${record.paramName}`;
        if (!paramGroups.has(key)) {
            paramGroups.set(key, []);
        }
        paramGroups.get(key)!.push(record);
    });

    paramGroups.forEach((records, _key) => {
        if (records.length < 2) return;

        const types = new Set(records.map(r => r.type));
        if (types.size > 1) {
            // 存在类型冲突
            const typesStr = Array.from(types).join(' vs ');
            const locationsStr = records.map(r => r.location).join('; ');

            // 只对第一个记录报一次错误（避免重复）
            const first = records[0];
            results.push({
                id: `err-temp-type-conflict-${first.scriptId}-${first.paramName}`,
                level: 'error',
                message: `Conflicting Temporary parameter type for script="${first.scriptName}", param="${first.paramName}": ${typesStr}. Used in: ${locationsStr}`,
                objectType: 'SCRIPT',
                objectId: first.scriptId,
                location: `Script: ${first.scriptName} > Param: ${first.paramName}`
            });
        }
    });

    return results;
};
