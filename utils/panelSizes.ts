/**
 * utils/panelSizes.ts
 * 统一处理面板尺寸的约束，避免非法历史数据导致布局异常。
 */

export interface PanelSizes {
  explorerWidth: number;
  inspectorWidth: number;
  stagesHeight: number;
}

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 500;
const MIN_STAGES_HEIGHT = 20;
const MAX_STAGES_HEIGHT = 80;

/**
 * 对数值做上下界约束。
 */
const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
};

/**
 * 归一化 panelSizes，确保历史文件中的异常值不会破坏布局。
 */
export const normalizePanelSizes = (sizes?: Partial<PanelSizes> | null): PanelSizes => {
  return {
    explorerWidth: clamp(Number(sizes?.explorerWidth ?? 280), MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH),
    inspectorWidth: clamp(Number(sizes?.inspectorWidth ?? 320), MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH),
    stagesHeight: clamp(Number(sizes?.stagesHeight ?? 55), MIN_STAGES_HEIGHT, MAX_STAGES_HEIGHT)
  };
};
