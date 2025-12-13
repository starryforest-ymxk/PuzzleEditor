/**
 * utils/constants.ts
 * 统一交互常量定义 - 抽取分散在组件中的 Magic Numbers
 */

// ========== 画布交互常量 ==========

/**
 * 画布尺寸与交互阈值
 */
export const CANVAS = {
    /** 画布总尺寸（像素） */
    SIZE: 4000,
    /** 默认缩放级别 */
    DEFAULT_ZOOM: 1,
    /** 最小缩放级别 */
    MIN_ZOOM: 0.25,
    /** 最大缩放级别 */
    MAX_ZOOM: 2,
} as const;

/**
 * 交互阈值常量
 */
export const INTERACTION = {
    /** 拖拽开始阈值（像素），超过此距离视为拖拽而非点击 */
    DRAG_THRESHOLD: 4,
    /** 点击识别阈值（像素），鼠标移动小于此值视为点击 */
    CLICK_THRESHOLD: 3,
    /** 吸附距离阈值（像素），连线端点靠近节点时自动吸附 */
    SNAP_DISTANCE: 20,
    /** 双击间隔阈值（毫秒） */
    DOUBLE_CLICK_INTERVAL: 300,
} as const;

// ========== 节点尺寸常量 ==========

/**
 * 状态节点尺寸（与 geometry.ts 保持同步）
 */
export const STATE_NODE = {
    /** 节点宽度 */
    WIDTH: 140,
    /** 节点估计高度 */
    ESTIMATED_HEIGHT: 80,
} as const;

// ========== 动画常量 ==========

/**
 * UI 动画时长
 */
export const ANIMATION = {
    /** 快速过渡（毫秒） */
    FAST: 100,
    /** 普通过渡（毫秒） */
    NORMAL: 200,
    /** 慢速过渡（毫秒） */
    SLOW: 300,
} as const;

// ========== 颜色常量 ==========

/**
 * 常用颜色值
 */
export const COLORS = {
    /** 选中状态边框 */
    SELECTION: '#4fc1ff',
    /** 错误状态 */
    ERROR: '#ef4444',
    /** 警告状态 */
    WARNING: '#fbbf24',
    /** 成功状态 */
    SUCCESS: '#22c55e',
    /** 主题色 */
    ACCENT: 'var(--accent-color)',
} as const;
