import { useEffect } from 'react';
import { registerEditGuard } from '../services/editBarrier';
/** 业务输入只登记语义有效性，屏障和提示由共同应用服务负责。 */
export function useEditGuard(pendingEdits: boolean, invalid = false, busy = false): void {
  useEffect(
    () => registerEditGuard({ pendingEdits, invalid, busy }),
    [pendingEdits, invalid, busy],
  );
}
