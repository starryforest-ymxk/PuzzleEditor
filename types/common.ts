
export type ID = string;

export type Side = 'top' | 'right' | 'bottom' | 'left';

export interface Vector2 {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * 基础的可识别实体接口
 */
export interface Entity {
  id: ID;
  name: string;
  description?: string;
}