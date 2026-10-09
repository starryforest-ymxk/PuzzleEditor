/** 画布、初始 Puzzle 模板与 CLI 共用状态/迁移默认值；ID 与资产名由调用方负责。 */
import type { State, Transition } from '../types/stateMachine';

export function createState(data: Pick<State, 'id' | 'name' | 'position'> & Partial<State>): State {
  return { eventListeners: [], ...data };
}

export function createTransition(
  data: Pick<Transition, 'id' | 'name' | 'fromStateId' | 'toStateId'> & Partial<Transition>,
): Transition {
  return { priority: 0, triggers: [{ type: 'Always' }], parameterModifiers: [], ...data };
}
