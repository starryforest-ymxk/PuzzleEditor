/**
 * utils/resourceFilters.ts
 * 资源过滤工具函数
 *
 * 职责：
 * 统一收敛 MarkedForDelete 状态过滤逻辑，避免相同的 .filter() 在 10+ 个文件中重复书写。
 * 提供两种变体：
 * 1. filterActiveResources — 完全排除已标记删除的资源
 * 2. filterActiveOrSelected — 排除已标记删除，但保留当前选中项（用于下拉选择器，防止当前值丢失）
 */

/**
 * 过滤掉已标记删除的资源
 * 用于变量列表、事件列表等不需要保留已删除项的场景
 */
export function filterActiveResources<T>(items: T[]): T[] {
    return items.filter(item => (item as Record<string, unknown>).state !== 'MarkedForDelete');
}

/**
 * 过滤掉已标记删除的资源，但保留指定的当前选中项
 * 用于下拉选择器等场景：已选中的 MarkedForDelete 资源仍需要显示以便用户看到警告并手动切换
 * @param items       资源列表
 * @param selectedId  当前选中项的 ID（可选），该项即使是 MarkedForDelete 也会保留
 */
export function filterActiveOrSelected<T>(items: T[], selectedId?: string): T[] {
    return items.filter(item => {
        const r = item as Record<string, unknown>;
        return r.state !== 'MarkedForDelete' || r.id === selectedId;
    });
}
