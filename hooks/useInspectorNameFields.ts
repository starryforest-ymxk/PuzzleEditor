/**
 * hooks/useInspectorNameFields.ts
 * Inspector 名称/资源名称编辑的共享 Hook
 * 
 * 统一了 6 个 Inspector 文件中的 Name/AssetName 本地编辑 + 失焦校验 + 自动翻译样板代码
 * 消除约 374 行重复代码
 */

import { useState, useEffect, useCallback } from 'react';
import { useAutoTranslateAssetName } from './useAutoTranslateAssetName';
import { isValidAssetName } from '../utils/assetNameValidation';

// ========== 类型定义 ==========

/** Hook 配置选项 */
export interface UseInspectorNameFieldsOptions {
    /** 实体对象，包含 name 和可选的 assetName 属性；为 null 时 Hook 不活跃 */
    entity: { name: string; assetName?: string } | null;
    /** 更新回调，接收属性对象（如 { name: 'newName' } 或 { assetName: 'newAsset' }） */
    onUpdate: (updates: Record<string, any>) => void;
    /** 
     * 是否允许空名称提交
     * - true: Node/Stage/State — 空名称也会提交更新
     * - false (默认): Script/Event/Variable — 空名称时回退为原值
     */
    allowEmptyName?: boolean;
}

/** Hook 返回值 */
export interface UseInspectorNameFieldsReturn {
    /** 本地名称状态 */
    localName: string;
    /** 设置本地名称（受控输入框用） */
    setLocalName: (v: string) => void;
    /** 本地资源名称状态 */
    localAssetName: string;
    /** 设置本地资源名称（受控输入框用） */
    setLocalAssetName: (v: string) => void;
    /** Name 输入框失焦处理（含自动翻译） */
    handleNameBlur: () => Promise<void>;
    /** AssetName 输入框失焦校验 */
    handleAssetNameBlur: () => void;
    /** 手动触发自动翻译（外部需要时使用） */
    triggerAutoTranslate: (name: string) => Promise<void>;
}

// ========== Hook 实现 ==========

/**
 * 统一的 Inspector 名称编辑 Hook
 * 
 * 管理 localName 和 localAssetName 的本地状态，并在失焦时执行：
 * - Name: trimmed 后与原值对比，决定提交或回退
 * - AssetName: isValidAssetName 校验后提交或回退
 * - 自动翻译: Name 变更后触发 useAutoTranslateAssetName
 */
export function useInspectorNameFields({
    entity,
    onUpdate,
    allowEmptyName = false,
}: UseInspectorNameFieldsOptions): UseInspectorNameFieldsReturn {
    const [localName, setLocalName] = useState('');
    const [localAssetName, setLocalAssetName] = useState('');

    // 同步外部实体变更到本地状态
    useEffect(() => {
        if (entity) {
            setLocalName(entity.name || '');
            setLocalAssetName(entity.assetName || '');
        }
    }, [entity?.name, entity?.assetName]);

    // 自动翻译 Hook（当 AssetName 为空时，自动从 Name 翻译填充）
    const triggerAutoTranslate = useAutoTranslateAssetName({
        currentAssetName: entity?.assetName,
        onAssetNameFill: (value) => {
            setLocalAssetName(value);
            onUpdate({ assetName: value });
        }
    });

    // Name 输入框失焦处理
    const handleNameBlur = useCallback(async () => {
        if (!entity) return;
        const trimmed = localName.trim();

        if (!allowEmptyName && !trimmed) {
            // 不允许空名称时回退到原值
            setLocalName(entity.name);
        } else if (trimmed !== entity.name) {
            // 名称有变化时提交更新
            onUpdate({ name: trimmed });
        }

        // 触发自动翻译（useAutoTranslateAssetName 内部会处理空值）
        await triggerAutoTranslate(trimmed);
    }, [entity, localName, allowEmptyName, onUpdate, triggerAutoTranslate]);

    // AssetName 输入框失焦校验
    const handleAssetNameBlur = useCallback(() => {
        if (!entity) return;
        const trimmed = localAssetName.trim();

        if (!isValidAssetName(trimmed)) {
            // 校验失败，恢复原值
            setLocalAssetName(entity.assetName || '');
            return;
        }

        if (trimmed !== (entity.assetName || '')) {
            // 值有变化时提交更新
            onUpdate({ assetName: trimmed || undefined });
        }
    }, [entity, localAssetName, onUpdate]);

    return {
        localName,
        setLocalName,
        localAssetName,
        setLocalAssetName,
        handleNameBlur,
        handleAssetNameBlur,
        triggerAutoTranslate,
    };
}
