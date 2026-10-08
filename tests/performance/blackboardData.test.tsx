// @vitest-environment jsdom
import React, { act, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi } from 'vitest';
import { useBlackboardData } from '../../hooks/useBlackboardData';
import * as references from '../../utils/blackboardReferences';
import { createEditorStore } from '../../store/editorStore';
import { createPerformanceProject } from './fixtures';
import { referenceOracle } from './referenceOracle';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('黑板引用计算的更新边界', () => {
  it('筛选/选择复用统计，业务修改/撤销/切换更新，卸载不保留项目缓存', async () => {
    const store = createEditorStore();
    store.dispatch({ type: 'INIT_SUCCESS', payload: createPerformanceProject('medium') });
    const spy = vi.spyOn(references, 'buildBlackboardReferenceCounts');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    function Probe() {
      const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
      const result = useBlackboardData(state.project, state.ui.blackboardView);
      return <output>{JSON.stringify(result.globalVariableRefCounts)}</output>;
    }
    const check = () =>
      expect(JSON.parse(host.textContent || '{}')).toEqual(
        referenceOracle(store.getState().project).globalVariableRefCounts,
      );
    try {
      await act(async () => root.render(<Probe />));
      check();
      expect(spy).toHaveBeenCalledTimes(1);
      await act(async () =>
        store.dispatch({
          type: 'SET_BLACKBOARD_VIEW',
          payload: { filter: 'Global 1', activeTab: 'Scripts' },
        }),
      );
      await act(async () =>
        store.dispatch({ type: 'SELECT_OBJECT', payload: { type: 'VARIABLE', id: 'global_1' } }),
      );
      expect(spy).toHaveBeenCalledTimes(1);
      check();
      await act(async () =>
        store.dispatch({
          type: 'UPDATE_TRANSITION',
          payload: {
            fsmId: 'fsm_0',
            transitionId: 'transition_1',
            data: { condition: { type: 'Literal', value: false } },
          },
        }),
      );
      expect(spy).toHaveBeenCalledTimes(2);
      check();
      await act(async () => store.dispatch({ type: 'UNDO' }));
      check();
      await act(async () => store.dispatch({ type: 'REDO' }));
      check();
      await act(async () =>
        store.dispatch({ type: 'INIT_SUCCESS', payload: createPerformanceProject('large') }),
      );
      check();
      const calls = spy.mock.calls.length;
      await act(async () => root.render(null));
      await act(async () => root.render(<Probe />));
      expect(spy).toHaveBeenCalledTimes(calls + 1);
      check();
    } finally {
      await act(async () => root.unmount());
      host.remove();
      spy.mockRestore();
    }
  });
});
