/**
 * 比较纯 JSON 项目数据。不可变更新中的共享分支立即命中引用，
 * 只检查新建分支，过滤同值编辑；不用序列化整个项目来判断 dirty。
 */
export function equalProjectData(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left) && Array.isArray(right) && left.length === right.length
            && left.every((value, index) => equalProjectData(value, right[index]));
    }
    const a = left as Record<string, unknown>;
    const b = right as Record<string, unknown>;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length
        && keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && equalProjectData(a[key], b[key]));
}
