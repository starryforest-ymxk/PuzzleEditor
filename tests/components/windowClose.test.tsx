// @vitest-environment jsdom
import { act, StrictMode, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWindowClose } from '../../hooks/useWindowClose';
import { StateContext, DispatchContext, SessionContext } from '../../store/context';
import { createEditorStore } from '../../store/editorStore';
import { createEditorFixture } from '../fixtures/editor';
import { ProjectSession } from '../../services/projectSession';
import { projectPlatform } from '../../services/projectPlatform';
import { StageInspector } from '../../components/Inspector/StageInspector';
import { ConfirmSaveDialog } from '../../components/Layout/ConfirmSaveDialog';

const bridge = vi.hoisted(() => ({
  listen: vi.fn<(callback: (requestId: string) => void) => () => void>(),
  resolve: vi.fn<(requestId: string, allow: boolean) => Promise<boolean>>(),
}));
vi.mock('../../platform/electron', async (original) => ({
  ...(await original<typeof import('../../platform/electron')>()),
  isElectron: () => true,
  onWindowCloseRequested: bridge.listen,
  resolveWindowClose: bridge.resolve,
}));

let host: HTMLDivElement;
let root: Root;
let request: (id: string) => void;
const stop = vi.fn();
beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  bridge.resolve.mockResolvedValue(true);
  bridge.listen.mockImplementation((callback) => {
    request = callback;
    return stop;
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
});

function setup() {
  const store = createEditorStore(createEditorFixture());
  const write = vi.fn(async () => ({ success: true }));
  const session = new ProjectSession(store, {
    ...projectPlatform,
    write,
    chooseSave: async () => 'C:/test/close.puzzle.json',
    claim: async () => ({ success: true, data: 'close-save-claim' }),
    releaseClaim: async () => ({ success: true }),
    activate: async () => ({ success: true }),
  });
  function Editor() {
    useWindowClose();
    const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
    const operation = state.runtime.projectOperation;
    return (
      <StateContext.Provider value={state}>
        <DispatchContext.Provider value={store.dispatch}>
          <StageInspector stageId={state.project.stageTree.rootId} />
          {operation.phase !== 'idle' && (
            <ConfirmSaveDialog
              nextAction={operation.nextAction!}
              busy={operation.phase !== 'confirming'}
              message={operation.message}
              onSave={() => session.choose('save')}
              onDiscard={() => session.choose('discard')}
              onCancel={() => session.choose('cancel')}
            />
          )}
        </DispatchContext.Provider>
      </StateContext.Provider>
    );
  }
  const element = (
    <StrictMode>
      <SessionContext.Provider value={session}>
        <Editor />
      </SessionContext.Provider>
    </StrictMode>
  );
  return { store, session, write, element };
}

describe('关闭弹窗与应用接线', () => {
  it.each([false, true])(
    '原生关闭先提交实际 Inspector 名称草稿（后台无 blur=%s），取消保留修改',
    async (inactive) => {
      const { store, element } = setup();
      await act(() => root.render(element));
      const input = Array.from(host.querySelectorAll('input')).find(
        (field) => field.value === 'Root Stage',
      )!;
      expect(input).toBeDefined();
      await act(() => {
        input.focus();
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
          input,
          'Last typed name',
        );
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(store.getState().ui.isDirty).toBe(false);
      if (inactive) vi.spyOn(input, 'blur').mockImplementation(() => {});
      await act(() => request('close-1'));
      expect(
        store.getState().project.stageTree.stages[store.getState().project.stageTree.rootId].name,
      ).toBe('Last typed name');
      expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('Save & Close');
      expect(document.activeElement?.textContent).toBe('Cancel');
      await act(() =>
        document.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        ),
      );
      expect(bridge.resolve).toHaveBeenCalledExactlyOnceWith('close-1', false);
      expect(store.getState().ui.isDirty).toBe(true);
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    },
  );
  it.each(['Save & Close', 'Discard & Close'])(
    '%s 使用真实会话，确认之前不答复主进程',
    async (buttonText) => {
      const { store, element, write } = setup();
      store.dispatch({ type: 'UPDATE_PROJECT_META', payload: { name: 'Dirty' } });
      await act(() => root.render(element));
      await act(() => request('close-2'));
      expect(bridge.resolve).not.toHaveBeenCalled();
      const buttons = Array.from(
        document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
      );
      await act(() =>
        buttons[0].dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
        ),
      );
      expect(document.activeElement).toBe(buttons.at(-1));
      await act(async () => {
        buttons.find((button) => button.textContent === buttonText)!.click();
        await vi.waitFor(() => expect(bridge.resolve).toHaveBeenCalledWith('close-2', true));
      });
      expect(bridge.resolve).toHaveBeenCalledExactlyOnceWith('close-2', true);
      expect(write).toHaveBeenCalledTimes(buttonText === 'Save & Close' ? 1 : 0);
    },
  );
  it('StrictMode 只留一份有效订阅，卸载取消正在确认的关闭', async () => {
    const { store, element } = setup();
    store.dispatch({ type: 'UPDATE_PROJECT_META', payload: { name: 'Dirty' } });
    await act(() => root.render(element));
    expect(bridge.listen).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalledTimes(1);
    await act(() => request('close-3'));
    await act(() => root.render(null));
    expect(stop).toHaveBeenCalledTimes(2);
    expect(bridge.resolve).toHaveBeenCalledExactlyOnceWith('close-3', false);
    expect(store.getState().runtime.projectOperation.phase).toBe('idle');
  });
});
