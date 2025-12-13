/**
 * utils/validation/variableValidation.ts
 * 变量校验工具 - 从 LocalVariableEditor 抽取的通用变量校验逻辑
 */

import type { VariableType } from '../../types/common';
import type { ValidationResult, ValidationIssue } from './types';
import { createResult, createIssue, createValidResult } from './types';

// ========== 错误代码常量 ==========

export const VAR_VALIDATION_CODES = {
    EMPTY_NAME: 'VAR_EMPTY_NAME',
    DUPLICATE_NAME: 'VAR_DUPLICATE_NAME',
    INVALID_NUMBER: 'VAR_INVALID_NUMBER',
    TYPE_MISMATCH: 'VAR_TYPE_MISMATCH',
} as const;

// ========== 变量名称校验 ==========

/**
 * 校验变量名称
 * @param name 待校验的名称
 * @param existingNames 已存在的名称列表（用于重名检测）
 * @param currentName 当前变量原名称（排除自身）
 * @returns 校验结果
 */
export function validateVariableName(
    name: string,
    existingNames: string[],
    currentName?: string
): ValidationResult {
    const issues: ValidationIssue[] = [];
    const trimmed = name.trim();

    // 检查空名称
    if (!trimmed) {
        issues.push(createIssue(
            'error',
            VAR_VALIDATION_CODES.EMPTY_NAME,
            'Variable name cannot be empty'
        ));
        return createResult(issues);
    }

    // 检查重名（忽略大小写）
    const lowerName = trimmed.toLowerCase();
    const currentLower = currentName?.trim().toLowerCase();
    const hasDuplicate = existingNames.some(
        n => n.trim().toLowerCase() === lowerName && n.trim().toLowerCase() !== currentLower
    );

    if (hasDuplicate) {
        issues.push(createIssue(
            'error',
            VAR_VALIDATION_CODES.DUPLICATE_NAME,
            `Variable name "${trimmed}" is already used`
        ));
    }

    return createResult(issues);
}

/**
 * 检查名称是否与已有名称冲突
 * @param name 待检查的名称
 * @param existingNames 已存在的名称列表
 * @param excludeName 要排除的名称（通常是当前变量自身）
 * @returns 是否有冲突
 */
export function hasNameConflict(
    name: string,
    existingNames: string[],
    excludeName?: string
): boolean {
    const result = validateVariableName(name, existingNames, excludeName);
    return result.issues.some(i => i.code === VAR_VALIDATION_CODES.DUPLICATE_NAME);
}

// ========== 变量值校验 ==========

/**
 * 校验变量值是否符合类型要求
 * @param value 待校验的值
 * @param type 变量类型
 * @returns 校验结果
 */
export function validateVariableValue(
    value: any,
    type: VariableType
): ValidationResult {
    const issues: ValidationIssue[] = [];

    switch (type) {
        case 'integer': {
            const parsed = parseInt(value, 10);
            if (Number.isNaN(parsed)) {
                issues.push(createIssue(
                    'error',
                    VAR_VALIDATION_CODES.INVALID_NUMBER,
                    'Invalid integer value'
                ));
            }
            break;
        }
        case 'float': {
            const parsed = parseFloat(value);
            if (Number.isNaN(parsed)) {
                issues.push(createIssue(
                    'error',
                    VAR_VALIDATION_CODES.INVALID_NUMBER,
                    'Invalid float value'
                ));
            }
            break;
        }
        case 'boolean': {
            if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
                issues.push(createIssue(
                    'warning',
                    VAR_VALIDATION_CODES.TYPE_MISMATCH,
                    'Value will be converted to boolean'
                ));
            }
            break;
        }
        // string 类型不需要特殊校验
    }

    return createResult(issues);
}

// ========== 默认值工具 ==========

/**
 * 根据类型返回默认值
 * @param type 变量类型
 * @returns 对应类型的默认值
 */
export function getDefaultValueByType(type: VariableType): any {
    switch (type) {
        case 'integer': return 0;
        case 'float': return 0.0;
        case 'boolean': return false;
        case 'string':
        default: return '';
    }
}

/**
 * 根据类型规范化输入值
 * @param type 变量类型
 * @param raw 原始输入值
 * @returns 规范化后的值
 */
export function normalizeValueByType(type: VariableType, raw: any): any {
    switch (type) {
        case 'integer': return parseInt(raw, 10) || 0;
        case 'float': return parseFloat(raw) || 0;
        case 'boolean': return raw === true || raw === 'true';
        case 'string':
        default: return String(raw ?? '');
    }
}

/**
 * 生成唯一名称（避免与已有名称冲突）
 * @param baseName 基础名称
 * @param existingNames 已存在的名称列表
 * @returns 唯一名称
 */
export function makeUniqueName(baseName: string, existingNames: string[]): string {
    let candidate = baseName;
    let counter = 2;

    while (hasNameConflict(candidate, existingNames)) {
        candidate = `${baseName} (${counter})`;
        counter += 1;
    }

    return candidate;
}
