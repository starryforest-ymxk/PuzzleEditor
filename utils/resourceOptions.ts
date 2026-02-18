/**
 * utils/resourceOptions.ts
 * ResourceOption 构建工具函数集
 * 将 blackboard 资源（事件、脚本、演出图）转换为 Inspector 下拉选项
 * 
 * 统一了 5 个 Inspector 中重复的选项构建逻辑
 */

import type { ResourceState } from '../types/common';
import type { EventDefinition } from '../types/blackboard';
import type { ScriptDefinition } from '../types/manifest';
import type { PresentationGraph } from '../types/presentation';

// ========== 通用资源选项类型（与 ResourceSelect 组件结构兼容） ==========

/** 资源下拉选项，与 ResourceSelect.ResourceOption 结构兼容 */
export interface ResourceOption {
    id: string;
    name: string;
    state?: ResourceState;
    category?: string;
    description?: string;
}

// ========== 事件选项构建 ==========

/**
 * 从事件定义集合构建事件选项列表
 * @param events - 事件定义集合（project.blackboard.events）
 */
export function buildEventOptions(
    events: Record<string, EventDefinition>
): ResourceOption[] {
    return Object.values<EventDefinition>(events).map(e => ({
        id: e.id,
        name: e.name,
        state: e.state,
        description: e.description
    }));
}

// ========== 脚本选项构建 ==========

/**
 * 从脚本定义集合构建全量脚本选项列表
 * @param scripts - 脚本定义集合（project.scripts.scripts）
 */
export function buildScriptOptions(
    scripts: Record<string, ScriptDefinition>
): ResourceOption[] {
    return Object.values<ScriptDefinition>(scripts).map(s => ({
        id: s.id,
        name: s.name,
        state: s.state,
        description: s.description
    }));
}

/**
 * 按类别过滤脚本选项，可选按 lifecycleType 进一步过滤
 * 
 * lifecycleType 过滤逻辑：若脚本未设置 lifecycleType 则视为通用脚本而通过过滤；
 * 若设置了则必须匹配指定的 lifecycleType
 * 
 * @param scripts - 脚本定义集合
 * @param category - 脚本类别（如 'Lifecycle', 'Trigger', 'Condition', 'Performance'）
 * @param lifecycleType - 可选的生命周期类型过滤（如 'Node', 'Stage', 'State'）
 */
export function buildScriptOptionsByCategory(
    scripts: Record<string, ScriptDefinition>,
    category: string,
    lifecycleType?: string
): ResourceOption[] {
    return Object.values<ScriptDefinition>(scripts)
        .filter(s => {
            // 类别必须匹配
            if (s.category !== category) return false;
            // 若指定了 lifecycleType，则脚本必须未设置或匹配
            if (lifecycleType && s.lifecycleType && s.lifecycleType !== lifecycleType) return false;
            return true;
        })
        .map(s => ({
            id: s.id,
            name: s.name,
            state: s.state,
            category: s.category,
            description: s.description
        }));
}

// ========== 演出图选项构建 ==========

/**
 * 从演出图集合构建选项列表
 * 演出图没有 state 字段，统一使用 'Draft' 作为默认状态
 * 
 * @param graphs - 演出图集合（project.presentationGraphs）
 * @param excludeGraphId - 可选排除的演出图 ID（通常排除自身以避免循环引用）
 */
export function buildGraphOptions(
    graphs: Record<string, PresentationGraph>,
    excludeGraphId?: string
): ResourceOption[] {
    return Object.values<PresentationGraph>(graphs || {})
        .filter(g => !excludeGraphId || g.id !== excludeGraphId)
        .map(g => ({
            id: g.id,
            name: g.name,
            state: 'Draft' as ResourceState,
            description: g.description
        }));
}
