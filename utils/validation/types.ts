/**
 * utils/validation/types.ts
 * 统一校验类型定义 - 定义通用的校验结果、问题和校验器接口
 */

import { StateMachine } from '../../types/stateMachine';
import { PresentationGraph } from '../../types/presentation';
import { PuzzleNode } from '../../types/puzzleNode';
import { StageNode } from '../../types/stage';

// ========== 项目数据最小接口 ==========

/**
 * 统一的项目数据最小接口，供引用追踪和校验函数使用
 * 取所有使用场景的字段并集，可选字段保证向后兼容
 */
export interface ProjectLike {
    nodes: Record<string, PuzzleNode>;
    stateMachines?: Record<string, StateMachine>;
    presentationGraphs?: Record<string, PresentationGraph>;
    stageTree: {
        stages: Record<string, StageNode>;
    };
}

// ========== 校验严重级别 ==========

/**
 * 校验问题严重级别
 * - error: 阻止操作的错误（如引用已删除资源）
 * - warning: 警告但不阻止（如命名建议）
 * - info: 信息提示
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

// ========== 资源类型 ==========

/**
 * 可校验的资源类型
 */
export type ValidatableResourceType =
    | 'script'
    | 'event'
    | 'variable'
    | 'graph'
    | 'state'
    | 'transition'
    | 'node'
    | 'stage';

// ========== 校验问题 ==========

/**
 * 单个校验问题
 * 包含问题描述、位置和相关资源信息
 */
export interface ValidationIssue {
    /** 严重级别 */
    severity: ValidationSeverity;

    /** 错误代码，用于程序化处理（如 'DELETED_ScriptRef', 'DUPLICATE_NAME'） */
    code: string;

    /** 用户可读的错误消息 */
    message: string;

    /** 问题定位路径（如 'state.eventListeners[0].action'） */
    path?: string;

    /** 相关资源类型 */
    resourceType?: ValidatableResourceType;

    /** 相关资源 ID */
    resourceId?: string;
}

// ========== 校验结果 ==========

/**
 * 通用校验结果
 * valid 为 true 表示没有 error 级别的问题
 */
export interface ValidationResult {
    /** 是否有效（无 error 级别问题） */
    valid: boolean;

    /** 所有校验问题列表 */
    issues: ValidationIssue[];
}

// ========== 校验器接口 ==========

/**
 * 通用校验器接口
 * @template T 被校验的目标类型
 * @template C 校验上下文类型
 */
export interface Validator<T, C = unknown> {
    /**
     * 执行校验
     * @param target 校验目标
     * @param context 校验上下文（可选）
     * @returns 校验结果
     */
    validate(target: T, context?: C): ValidationResult;
}

// ========== 工具函数类型 ==========

/**
 * 创建空的有效校验结果
 */
export const createValidResult = (): ValidationResult => ({
    valid: true,
    issues: []
});

/**
 * 创建包含问题的校验结果
 * @param issues 问题列表
 */
export const createResult = (issues: ValidationIssue[]): ValidationResult => ({
    valid: !issues.some(i => i.severity === 'error'),
    issues
});

/**
 * 合并多个校验结果
 * @param results 校验结果数组
 */
export const mergeResults = (...results: ValidationResult[]): ValidationResult => {
    const allIssues = results.flatMap(r => r.issues);
    return createResult(allIssues);
};

/**
 * 创建单个问题的校验结果（便捷方法）
 */
export const createIssue = (
    severity: ValidationSeverity,
    code: string,
    message: string,
    options?: Partial<Pick<ValidationIssue, 'path' | 'resourceType' | 'resourceId'>>
): ValidationIssue => ({
    severity,
    code,
    message,
    ...options
});
