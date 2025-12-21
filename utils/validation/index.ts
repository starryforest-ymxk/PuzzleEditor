/**
 * utils/validation/index.ts
 * 统一校验模块入口 - 导出所有校验相关类型和工具函数
 */

// ========== 通用类型定义（推荐使用） ==========
export {
    type ValidationSeverity,
    type ValidatableResourceType,
    type ValidationIssue,
    type ValidationResult,
    type Validator,
    createValidResult,
    createResult,
    mergeResults,
    createIssue
} from './types';

// ========== 变量校验 ==========
export * from './variableValidation';

// ========== FSM 校验 ==========
// 使用命名导出避免 ValidationIssue 冲突
export {
    type FsmValidationIssue,
    type StateValidation,
    type TransitionValidation,
    checkStateValidation,
    checkTransitionValidation,
    validateStateMachine
} from './fsmValidation';

// 为向后兼容，也导出 fsmValidation 中的 ValidationIssue 别名
export { type ValidationIssue as FsmIssue } from './fsmValidation';

// ========== 变量引用追踪 ==========
export * from './variableReferences';
export * from './stageVariableReferences';
