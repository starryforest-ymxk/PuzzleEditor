/** 共同编辑屏障：DOM/React 适配在 hooks 中，领域服务仅依赖此契约。 */
export interface EditBarrierState {
  pendingEdits: boolean;
  busy: boolean;
  invalid: boolean;
}
export interface EditBarrier {
  status(): EditBarrierState;
  flush(): void;
}
const guards = new Set<EditBarrierState>();
export function registerEditGuard(state: EditBarrierState): () => void {
  guards.add(state);
  return () => {
    guards.delete(state);
  };
}
export function editGuardState(): EditBarrierState {
  return [...guards].reduce(
    (a, b) => ({
      pendingEdits: a.pendingEdits || b.pendingEdits,
      busy: a.busy || b.busy,
      invalid: a.invalid || b.invalid,
    }),
    { pendingEdits: false, busy: false, invalid: false },
  );
}
