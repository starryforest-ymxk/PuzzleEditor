/**
 * utils/debug.ts
 * 开发调试工具 - 提供 dev-only 日志功能
 */

// ========== 调试模式检测 ==========

/**
 * 是否为开发模式
 */
export const isDev = import.meta.env.DEV;

// ========== 日志分类 ==========

/**
 * 日志分类标签（用于过滤和识别）
 */
export const LOG_TAGS = {
    CANVAS: '[Canvas]',
    LINKING: '[Linking]',
    CUTTING: '[Cutting]',
    DRAG: '[Drag]',
    BOX_SELECT: '[BoxSelect]',
    VALIDATION: '[Validation]',
    STATE: '[State]',
} as const;

export type LogTag = keyof typeof LOG_TAGS;

// ========== 日志样式 ==========

const LOG_STYLES = {
    CANVAS: 'color: #4fc1ff; font-weight: bold',
    LINKING: 'color: #22c55e; font-weight: bold',
    CUTTING: 'color: #ef4444; font-weight: bold',
    DRAG: 'color: #fbbf24; font-weight: bold',
    BOX_SELECT: 'color: #a855f7; font-weight: bold',
    VALIDATION: 'color: #06b6d4; font-weight: bold',
    STATE: 'color: #f97316; font-weight: bold',
} as const;

// ========== 日志函数 ==========

/**
 * 开发环境日志输出
 * @param tag 日志分类标签
 * @param message 日志消息
 * @param data 附加数据（可选）
 */
export function devLog(tag: LogTag, message: string, data?: unknown): void {
    if (!isDev) return;

    const tagLabel = LOG_TAGS[tag];
    const style = LOG_STYLES[tag];

    if (data !== undefined) {
        console.log(`%c${tagLabel}%c ${message}`, style, 'color: inherit', data);
    } else {
        console.log(`%c${tagLabel}%c ${message}`, style, 'color: inherit');
    }
}

/**
 * 开发环境警告输出
 */
export function devWarn(tag: LogTag, message: string, data?: unknown): void {
    if (!isDev) return;

    const tagLabel = LOG_TAGS[tag];

    if (data !== undefined) {
        console.warn(`${tagLabel} ${message}`, data);
    } else {
        console.warn(`${tagLabel} ${message}`);
    }
}

/**
 * 开发环境错误输出
 */
export function devError(tag: LogTag, message: string, data?: unknown): void {
    if (!isDev) return;

    const tagLabel = LOG_TAGS[tag];

    if (data !== undefined) {
        console.error(`${tagLabel} ${message}`, data);
    } else {
        console.error(`${tagLabel} ${message}`);
    }
}

/**
 * 性能计时开始
 * @returns 返回用于 devTimeEnd 的标识符
 */
export function devTimeStart(label: string): string | undefined {
    if (!isDev) return undefined;
    const id = `⏱️ ${label}`;
    console.time(id);
    return id;
}

/**
 * 性能计时结束
 */
export function devTimeEnd(id: string | undefined): void {
    if (!isDev || !id) return;
    console.timeEnd(id);
}

/**
 * 创建带分类的日志器（便于在特定模块中复用）
 */
export function createLogger(tag: LogTag) {
    return {
        log: (message: string, data?: unknown) => devLog(tag, message, data),
        warn: (message: string, data?: unknown) => devWarn(tag, message, data),
        error: (message: string, data?: unknown) => devError(tag, message, data),
    };
}
