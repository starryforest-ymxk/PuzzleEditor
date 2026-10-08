// @vitest-environment jsdom
import { act, useSyncExternalStore, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StateContext, DispatchContext } from '../../store/context';
import { createEditorStore, type EditorStore } from '../../store/editorStore';
import { createEditorFixture } from '../fixtures/editor';
import { StageInspector } from '../../components/Inspector/StageInspector';
import { StageOverview } from '../../components/Canvas/StageOverview';
import { LocalVariableEditor } from '../../components/Inspector/LocalVariableEditor';
import { VariableValueInput } from '../../components/Inspector/localVariable/VariableValueInput';
import { useInspectorNameFields } from '../../hooks/useInspectorNameFields';

// 使用真实 React DOM 和 Store；测试只创建内存夹具，不读取用户文件或调用翻译服务。
function FixtureProvider({ store, children }: { store: EditorStore; children: ReactNode }) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={store.dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  vi.restoreAllMocks();
});

describe('组件生命周期与输入回归', () => {
  it.each([
    { name: 'StageOverview', Component: StageOverview },
    { name: 'StageInspector', Component: StageInspector },
  ])('$name 在存在、缺失、恢复阶段之间切换时保持 Hook 顺序', async ({ Component }) => {
    const store = createEditorStore(createEditorFixture());
    const stageId = store.getState().project.stageTree.rootId;
    const render = (id: string) =>
      act(() =>
        root.render(
          <FixtureProvider store={store}>
            <Component stageId={id} />
          </FixtureProvider>,
        ),
      );
    await render(stageId);
    expect(host.textContent).toContain('Root Stage');
    await render('missing-stage');
    expect(host.textContent).toBe('Stage not found');
    await render(stageId);
    expect(host.textContent).toContain('Root Stage');
  });

  it('同一对象的无关更新保留名称草稿，切换同名对象时重置草稿', async () => {
    const store = createEditorStore(createEditorFixture());
    const update = vi.fn();
    let current: ReturnType<typeof useInspectorNameFields> | undefined;
    function Probe({ entity }: { entity: { id: string; name: string; assetName: string } }) {
      current = useInspectorNameFields({ entity, onUpdate: update });
      return <span>{current.localName}</span>;
    }
    const render = (id: string) =>
      act(() =>
        root.render(
          <FixtureProvider store={store}>
            <Probe entity={{ id, name: 'Same Name', assetName: 'SameAsset' }} />
          </FixtureProvider>,
        ),
      );
    await render('first');
    await act(() => current?.setLocalName('Uncommitted draft'));
    await render('first');
    expect(host.textContent).toBe('Uncommitted draft');
    await render('second');
    expect(host.textContent).toBe('Same Name');
    expect(update).not.toHaveBeenCalled();
  });

  it('名称在失焦时提交一次，外部更新仍能同步到输入', async () => {
    const store = createEditorStore(createEditorFixture());
    const update = vi.fn();
    let current: ReturnType<typeof useInspectorNameFields> | undefined;
    function Probe({ name }: { name: string }) {
      current = useInspectorNameFields({
        entity: { id: 'test', name, assetName: 'ExistingAsset' },
        onUpdate: update,
      });
      return <span>{current.localName}</span>;
    }
    const render = (name: string) =>
      act(() =>
        root.render(
          <FixtureProvider store={store}>
            <Probe name={name} />
          </FixtureProvider>,
        ),
      );
    await render('Original');
    await act(() => current?.setLocalName(' New Name '));
    await act(async () => {
      await current?.handleNameBlur();
    });
    expect(update).toHaveBeenCalledExactlyOnceWith({ name: 'New Name' });
    await render('Updated elsewhere');
    expect(host.textContent).toBe('Updated elsewhere');
  });

  it('删除被引用的局部变量时显示位置文字，确认后派发真实 Store 操作', async () => {
    const state = createEditorFixture();
    const stageId = state.project.stageTree.rootId;
    const variable = {
      id: 'flag',
      name: 'Flag',
      type: 'boolean',
      value: false,
      scope: 'StageLocal',
      state: 'Draft',
    } as const;
    state.project.stageTree.stages[stageId].localVariables.flag = variable;
    const store = createEditorStore(state);
    const onDelete = vi.fn((varId: string) =>
      store.dispatch({ type: 'DELETE_STAGE_VARIABLE', payload: { stageId, varId } }),
    );
    await act(() =>
      root.render(
        <FixtureProvider store={store}>
          <LocalVariableEditor
            variables={{ flag: variable }}
            ownerType="stage"
            ownerId={stageId}
            resolveReferences={() => ['Stage / Root / Unlock Condition']}
            onDeleteVariable={onDelete}
          />
        </FixtureProvider>,
      ),
    );
    const remove = host.querySelector<HTMLButtonElement>('button[title="Delete variable"]');
    expect(remove).not.toBeNull();
    await act(() => remove?.click());
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain(
      'Stage / Root / Unlock Condition',
    );
    expect(document.body.querySelector('[role="dialog"]')?.textContent).not.toContain(
      '[object Object]',
    );
    const confirm = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ).find((button) => button.textContent === 'Delete');
    expect(confirm).toBeDefined();
    await act(() => confirm?.click());
    expect(onDelete).toHaveBeenCalledExactlyOnceWith('flag');
    expect(store.getState().project.stageTree.stages[stageId].localVariables.flag).toBeUndefined();
  });

  it('布尔 False 保持布尔值，数值 0 和空字符串正确显示', async () => {
    const change = vi.fn();
    const blur = vi.fn();
    await act(() =>
      root.render(
        <VariableValueInput
          type="boolean"
          value={true}
          disabled={false}
          canMutate
          onChange={change}
          onNumberBlur={blur}
        />,
      ),
    );
    const select = host.querySelector('select');
    expect(select).not.toBeNull();
    await act(() => {
      if (select) {
        select.value = 'false';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    expect(change).toHaveBeenCalledExactlyOnceWith(false);
    for (const value of [0, '']) {
      await act(() =>
        root.render(
          <VariableValueInput
            type="integer"
            value={value}
            disabled={false}
            canMutate
            onChange={change}
            onNumberBlur={blur}
          />,
        ),
      );
      expect(host.querySelector('input')?.value).toBe(String(value));
    }
  });
});
