/**
 * utils/validation/validator.ts
 * 工程校验逻辑入口
 * 
 * Aggregates all validation rules from ./rules directory
 */

import { ProjectData } from '../../types/project';
import { ValidationResult } from '../../store/types';

import { validateNames } from './rules/validateNames';
import { validateStructure } from './rules/validateStructure';
import { validateReferences } from './rules/validateReferences';
import { validateVariables } from './rules/validateVariables';
import { validateLifecycleUnique } from './rules/validateLifecycleUnique';
import { validateTemporaryParams } from './rules/validateTemporaryParams';

/**
 * 校验规则实现
 * 
 * 1. 命名规范校验 (validateNames)
 *    - 资源名称为空 (Error)
 *    - 资源名称重复 (Error)
 *    - 资源名称格式非法 (Error)
 * 2. 结构完整性校验 (validateStructure)
 *    - StageTree 完整性 (#9-#14)
 *    - Node 关联校验 (#15-#18)
 *    - FSM 结构校验 (#19-#25)
 *    - 演出图结构校验 (#26-#32)
 * 3. 引用完整性校验 (validateReferences)
 *    - 黑板/脚本定义 (#6-#7)
 *    - 脚本/事件/触发器/条件/演出引用 (#33-#56)
 * 4. 变量引用校验 (validateVariables)
 *    - 全局/局部变量引用 (Error)
 * 5. 生命周期脚本唯一性 (validateLifecycleUnique)
 *    - 脚本多绑定检测 (#62-#64)
 * 6. Temporary 参数一致性 (validateTemporaryParams)
 *    - 参数名/类型/冲突检测 (#57-#61)
 */

export const validateProject = (project: ProjectData): ValidationResult[] => {
    let results: ValidationResult[] = [];

    // 1. Name Check (Missing / Duplicate / Invalid Format)
    results = results.concat(validateNames(project));

    // 2. Structure Check (Missing Roots, Cycles, etc.)
    results = results.concat(validateStructure(project));

    // 3. Reference Check (Missing Scripts/Events/Structural Links)
    results = results.concat(validateReferences(project));

    // 4. Variable Validation (Global & Local)
    results = results.concat(validateVariables(project));

    // 5. Unique Lifecycle Script Check (ERROR if reused)
    results = results.concat(validateLifecycleUnique(project));

    // 6. Temporary Parameter Consistency (#57-#61)
    results = results.concat(validateTemporaryParams(project));

    return results;
};
