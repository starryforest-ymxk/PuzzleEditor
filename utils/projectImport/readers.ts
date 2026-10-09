/** 外部 JSON 只在此边界收窄；错误始终带文件内位置，不依赖 TypeScript 断言猜测结构。 */
export class ProjectImportError extends Error {
    constructor(public readonly path: string, reason: string) {
        super(`${path}: ${reason}`);
        this.name = 'ProjectImportError';
    }
}

export interface ImportNotice { path: string; message: string }
/** 离线预览注入固定上下文；GUI 省略时保留当前时间与随机项目身份。 */
export interface ProjectImportOptions { now?: string; runtimeProjectId?: string }
export class ImportContext {
    readonly now: string;
    readonly runtimeProjectId?: string;
    constructor(options: ProjectImportOptions = {}) {
        this.now = options.now ?? new Date().toISOString();
        this.runtimeProjectId = options.runtimeProjectId;
    }
    notices: ImportNotice[] = [];
    migrated = false;
    legacyBooleanVariables = new Set<string>();
    note(path: string, message: string, migration = false): void {
        this.notices.push({ path, message });
        if (migration) this.migrated = true;
    }
}

export type Reader<T> = (value: unknown, path: string, context: ImportContext, index?: number) => T;
export type JsonObject = Record<string, unknown>;
export function fail(path: string, message: string): never { throw new ProjectImportError(path, message); }
export const fieldPath = (path: string, key: string): string => /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;

export function asObject(value: unknown, path: string): JsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'Expected an object.');
    return value as JsonObject;
}
export function knownFields(value: unknown, path: string, fields: readonly string[]): JsonObject {
    const object = asObject(value, path);
    for (const key of Object.keys(object)) {
        if (!fields.includes(key)) fail(fieldPath(path, key), 'Unsupported field. Import was stopped to avoid losing data.');
    }
    return object;
}

export const string: Reader<string> = (value, path) => typeof value === 'string' ? value : fail(path, 'Expected a string.');
export const boolean: Reader<boolean> = (value, path) => typeof value === 'boolean' ? value : fail(path, 'Expected a boolean.');
export const number: Reader<number> = (value, path) => typeof value === 'number' && Number.isFinite(value)
    ? value : fail(path, 'Expected a finite number.');
export const id: Reader<string> = (value, path, context) => {
    const result = string(value, path, context);
    if (['__proto__', 'prototype', 'constructor'].includes(result)) fail(path, 'Reserved identifier is not supported.');
    return result;
};
export const entityId: Reader<string> = (value, path, context) => {
    const result = id(value, path, context);
    return result.trim() ? result : fail(path, 'Expected a non-empty identifier.');
};

export function oneOf<const T extends readonly string[]>(...values: T): Reader<T[number]> {
    return (value, path) => typeof value === 'string' && values.includes(value)
        ? value as T[number] : fail(path, `Expected one of: ${values.join(', ')}.`);
}
export const optional = <T>(read: Reader<T>): Reader<T | undefined> => (value, path, context) =>
    value === undefined ? undefined : read(value, path, context);
export const nullable = <T>(read: Reader<T>): Reader<T | null> => (value, path, context) =>
    value === null ? null : read(value, path, context);
export const defaulted = <T>(read: Reader<T>, fallback: T): Reader<T> => (value, path, context) => {
    if (value !== undefined) return read(value, path, context);
    context.note(path, 'Missing optional field was filled with its default.');
    return structuredClone(fallback);
};
export const array = <T>(read: Reader<T>): Reader<T[]> => (value, path, context) => {
    if (!Array.isArray(value)) fail(path, 'Expected an array.');
    return (value as unknown[]).map((item, index) => read(item, `${path}[${index}]`, context, index));
};
export const dictionary = <T>(read: Reader<T>, identified = false): Reader<Record<string, T>> => (value, path, context) => {
    const entries = Object.entries(asObject(value, path));
    return Object.fromEntries(entries.map(([key, item], index) => {
        const itemPath = fieldPath(path, key);
        entityId(key, itemPath, context);
        const result = read(item, itemPath, context, index);
        if (identified && asObject(result, itemPath).id !== key) {
            fail(`${itemPath}.id`, `Identifier must match the map key ${JSON.stringify(key)}.`);
        }
        return [key, result];
    }));
};

type Shape = Record<string, Reader<unknown>>;
type Decoded<S extends Shape> = { [K in keyof S]: S[K] extends Reader<infer T> ? T : never };
export function object<S extends Shape>(shape: S): Reader<Decoded<S>> {
    return (value, path, context) => {
        const input = knownFields(value, path, Object.keys(shape));
        // 每个字段先经过对应 Reader；这里的断言仅用于描述映射后的键类型。
        return Object.fromEntries(Object.entries(shape).map(([key, read]) =>
            [key, read(input[key], fieldPath(path, key), context)])) as Decoded<S>;
    };
}
export function variants<T>(choices: Record<string, Reader<T>>): Reader<T> {
    return (value, path, context) => {
        const input = asObject(value, path);
        const type = string(input.type, `${path}.type`, context);
        if (!Object.hasOwn(choices, type)) fail(`${path}.type`, `Unsupported type ${JSON.stringify(type)}.`);
        return choices[type](input, path, context);
    };
}

/** 避免极深 JSON/条件触发递归溢出；常量内容允许任意合法 JSON，不套用实体字段白名单。 */
export function checkJsonDepth(value: unknown): void {
    const pending = [{ value, path: '$', depth: 0 }];
    while (pending.length) {
        const current = pending.pop()!;
        if (current.depth > 128) fail(current.path, 'JSON nesting exceeds the supported depth of 128.');
        if (typeof current.value === 'number' && !Number.isFinite(current.value)) fail(current.path, 'Expected a finite number.');
        if (current.value && typeof current.value === 'object') {
            for (const [key, child] of Object.entries(current.value)) {
                pending.push({ value: child, path: fieldPath(current.path, key), depth: current.depth + 1 });
            }
        }
    }
}
