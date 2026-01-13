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

/**
 * 校验规则实现
 * 
 * 1. 命名规范校验 (validateNames)
 *    - 资源名称为空 (Warning)
 *    - 资源名称重复 (Error)
 * 2. 结构完整性校验 (validateStructure)
 *    - 孤儿节点、FSM 缺失初始状态 (Error)
 *    - 舞台树/演出图结构 (Error)
 * 3. 引用完整性校验 (validateReferences)
 *    - 资源是否存在
 *    - 资源是否已删除 (Error)
 * 4. 变量引用校验 (validateVariables)
 *    - 未声明的全局/局部变量 (Error)
 */

export const validateProject = (project: ProjectData): ValidationResult[] => {
    let results: ValidationResult[] = [];

    // 1. Name Check (Missing / Duplicate)
    results = results.concat(validateNames(project));

    // 2. Structure Check (Missing Roots, etc.)
    results = results.concat(validateStructure(project));

    // 3. Reference Check (Missing Scripts/Events/Structural Links)
    results = results.concat(validateReferences(project));

    // 4. Variable Validation (Global & Local)
    results = results.concat(validateVariables(project));

    // 5. Unique Lifecycle Script Check (ERROR if reused)
    results = results.concat(validateLifecycleUnique(project));

    return results;
};
