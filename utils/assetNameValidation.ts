/**
 * utils/assetNameValidation.ts
 * 资产名校验工具函数
 * 
 * 资产名规则：
 * - 只允许字母、数字和下划线
 * - 不允许数字开头
 * - 符合变量命名规则
 */

/**
 * 资产名校验正则表达式
 * 规则：字母或下划线开头，后跟任意数量的字母、数字或下划线
 */
export const ASSET_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * 校验资产名是否有效
 * @param assetName 资产名
 * @returns 是否有效，空字符串视为有效（assetName 是可选字段）
 */
export function isValidAssetName(assetName: string): boolean {
    if (!assetName) return true; // 空值有效（可选字段）
    return ASSET_NAME_REGEX.test(assetName);
}
