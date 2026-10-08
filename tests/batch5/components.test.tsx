// @vitest-environment jsdom
import React, { act, useSyncExternalStore, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { StateContext, DispatchContext, useEditorState } from '../../store/context';
import { createEditorStore, type EditorStore } from '../../store/editorStore';
import { createEditorFixture } from '../fixtures/editor';
import { BlackboardPanel } from '../../components/Blackboard/BlackboardPanel';
import { ConditionEditor } from '../../components/Inspector/condition/ConditionEditor';
import { PresentationCanvas } from '../../components/Canvas/PresentationCanvas';
import type { ConditionExpression } from '../../types/stateMachine';

let host: HTMLDivElement, root: Root;
function Provider({ store, children }: { store: EditorStore; children: ReactNode }) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={store.dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}
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
});
const button = (text: string) => {
  const result = [...document.body.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  );
  if (!result) throw Error('Missing button: ' + text);
  return result;
};
const click = (target: Element) =>
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

async function mouse(target: EventTarget, type: string, options: MouseEventInit) {
  await act(() => {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, ...options }));
  });
}

describe('演出画布真实组件手势', () => {
  async function setup(readOnly = false) {
    const initial = createEditorFixture();
    initial.project.presentationGraphs.graph.nodes.second.position.x = 300;
    const store = createEditorStore(initial);
    function Canvas() {
      const { project } = useEditorState();
      return <PresentationCanvas graph={project.presentationGraphs.graph} readOnly={readOnly} />;
    }
    await act(() =>
      root.render(
        <Provider store={store}>
          <Canvas />
        </Provider>,
      ),
    );
    return {
      store,
      canvas: host.querySelector('.canvas-grid') as HTMLDivElement,
      first: host.querySelector('[data-node-id="first"]')!,
      second: host.querySelector('[data-node-id="second"]')!,
    };
  }
  it('连线模式点击目标不会同时启动节点拖动或在后续鼠标移动时漂移', async () => {
    const { store, first, second } = await setup();
    await act(() =>
      store.dispatch({
        type: 'UNLINK_PRESENTATION_NODES',
        payload: { graphId: 'graph', fromNodeId: 'first', toNodeId: 'second' },
      }),
    );
    await mouse(first, 'mousedown', { button: 0, shiftKey: true, clientX: 80, clientY: 42 });
    await mouse(window, 'mousemove', { clientX: 300, clientY: 42.5 });
    await mouse(second, 'mousedown', { button: 0, clientX: 300, clientY: 42.5 });
    await mouse(second, 'mouseup', { button: 0, clientX: 300, clientY: 42.5 });
    expect(store.getState().project.presentationGraphs.graph.nodes.first.nextIds).toEqual([
      'second',
    ]);
    await mouse(window, 'mousemove', { clientX: 450, clientY: 150 });
    expect((second as HTMLElement).style.left).toBe('300px');
    await mouse(window, 'mouseup', { button: 0, clientX: 450, clientY: 150 });
    expect(store.getState().project.presentationGraphs.graph.nodes.second.position).toEqual({
      x: 300,
      y: 0,
    });
  });
  it('Ctrl 拖动剪线删除交叉边，撤销恢复连接', async () => {
    const { store, canvas } = await setup();
    await mouse(canvas, 'mousedown', { button: 0, ctrlKey: true, clientX: 220, clientY: 0 });
    await mouse(window, 'mousemove', { ctrlKey: true, clientX: 220, clientY: 100 });
    await mouse(window, 'mouseup', { button: 0, ctrlKey: true, clientX: 220, clientY: 100 });
    expect(store.getState().project.presentationGraphs.graph.nodes.first.nextIds).toEqual([]);
    await act(() => store.dispatch({ type: 'UNDO' }));
    expect(store.getState().project.presentationGraphs.graph.nodes.first.nextIds).toEqual([
      'second',
    ]);
  });
  it('中键平移只改变滚动位置，释放后停止平移', async () => {
    const { store, canvas } = await setup();
    const before = store.getState().project;
    canvas.scrollLeft = 100;
    canvas.scrollTop = 100;
    await mouse(canvas, 'mousedown', { button: 1, clientX: 200, clientY: 200 });
    await mouse(window, 'mousemove', { clientX: 180, clientY: 160 });
    expect([canvas.scrollLeft, canvas.scrollTop]).toEqual([120, 140]);
    await mouse(window, 'mouseup', { button: 1, clientX: 180, clientY: 160 });
    await mouse(window, 'mousemove', { clientX: 0, clientY: 0 });
    expect([canvas.scrollLeft, canvas.scrollTop]).toEqual([120, 140]);
    expect(store.getState().project).toBe(before);
  });
  it('只读画布不能通过 Ctrl 剪线修改文档', async () => {
    const { store, canvas } = await setup(true);
    const before = store.getState().project;
    await mouse(canvas, 'mousedown', { button: 0, ctrlKey: true, clientX: 220, clientY: 0 });
    await mouse(window, 'mousemove', { ctrlKey: true, clientX: 220, clientY: 100 });
    await mouse(window, 'mouseup', { button: 0, ctrlKey: true, clientX: 220, clientY: 100 });
    expect(store.getState().project).toBe(before);
  });
});

// 模拟浏览器原生 DnD 事件的数据载体；事件仍由真实组件响应。
function dragData() {
  const data = new Map<string, string>();
  return {
    effectAllowed: '',
    dropEffect: '',
    get types() {
      return [...data.keys()];
    },
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) || '',
  };
}
async function drag(target: Element, type: string, data: ReturnType<typeof dragData>) {
  await act(() => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: data });
    target.dispatchEvent(event);
  });
}

describe('Blackboard 组合与分组交互', () => {
  async function setup() {
    const store = createEditorStore(createEditorFixture());
    await act(() =>
      root.render(
        <Provider store={store}>
          <BlackboardPanel />
        </Provider>,
      ),
    );
    return store;
  }
  it('Store 视图更新立即同步工具栏，不保留另一份本地筛选状态', async () => {
    const store = await setup();
    await act(() =>
      store.dispatch({
        type: 'SET_BLACKBOARD_VIEW',
        payload: { activeTab: 'Events', filter: 'Event' },
      }),
    );
    expect(button('New Event')).toBeTruthy();
    expect(host.querySelector('input')?.value).toBe('Event');
    await act(() =>
      store.dispatch({
        type: 'SET_BLACKBOARD_VIEW',
        payload: { activeTab: 'Variables', filter: '' },
      }),
    );
    expect(button('New Variable')).toBeTruthy();
    expect(host.querySelector('input')?.value).toBe('');
  });
  it('四页签创建后选中正确资源，生命周期脚本不附带旧参数字段', async () => {
    const store = await setup();
    await click(button('New Variable'));
    expect(store.getState().ui.selection.type).toBe('VARIABLE');
    await click(button('Events'));
    await click(button('New Event'));
    expect(store.getState().ui.selection.type).toBe('EVENT');
    await click(button('Scripts'));
    await click(button('New Script'));
    // 浏览器先悬停再点击，不能因点击取反而把刚展开的子菜单关掉。
    await mouse(button('Lifecycle Script▶'), 'mouseover', {});
    await click(button('Lifecycle Script▶'));
    await click(button('Node Lifecycle'));
    const script = store.getState().project.scripts.scripts[store.getState().ui.selection.id!];
    expect(script).toMatchObject({ category: 'Lifecycle', lifecycleType: 'Node', state: 'Draft' });
    expect(script).not.toHaveProperty('parameters');
    expect(host.querySelector('[role="menu"]')).toBeNull();
    await click(button('Graphs'));
    await click(button('New Presentation'));
    expect(store.getState().ui.selection.type).toBe('PRESENTATION_GRAPH');
  });
  it('双击演出图导航到画布', async () => {
    const store = await setup();
    await click(button('Graphs'));
    const graph = [...host.querySelectorAll('[draggable]')].find((e) =>
      e.textContent?.includes('Graph'),
    )!;
    const title = [...graph.querySelectorAll('*')].find((e) => e.textContent === 'Graph')!;
    await act(() => {
      title.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(store.getState().ui.currentGraphId).toBe('graph');
  });
  it('局部变量同组拖拽保留完整含连字符的作用域 ID，撤销恢复顺序', async () => {
    const initial = createEditorFixture();
    const rootStage = initial.project.stageTree.stages[initial.project.stageTree.rootId];
    rootStage.id = 'stage-with-hyphens';
    initial.project.stageTree.rootId = rootStage.id;
    initial.project.stageTree.stages = { [rootStage.id]: rootStage };
    rootStage.localVariables = {
      a: {
        id: 'a',
        name: 'Alpha',
        scope: 'StageLocal',
        type: 'integer',
        value: 1,
        state: 'Draft',
        displayOrder: 0,
      },
      b: {
        id: 'b',
        name: 'Beta',
        scope: 'StageLocal',
        type: 'integer',
        value: 2,
        state: 'Draft',
        displayOrder: 1,
      },
    };
    const store = createEditorStore(initial);
    await act(() =>
      root.render(
        <Provider store={store}>
          <BlackboardPanel />
        </Provider>,
      ),
    );
    const cards = [...host.querySelectorAll('[draggable="true"]')];
    const data = dragData();
    await drag(cards[0], 'dragstart', data);
    await drag(cards[1], 'dragover', data);
    await drag(cards[0], 'dragend', data);
    expect(
      store.getState().project.stageTree.stages[rootStage.id].localVariables?.b.displayOrder,
    ).toBe(0);
    await act(() => store.dispatch({ type: 'UNDO' }));
    expect(
      store.getState().project.stageTree.stages[rootStage.id].localVariables?.a.displayOrder,
    ).toBe(0);
    const alpha = [...host.querySelectorAll('*')].find((e) => e.textContent === 'Alpha')!;
    await act(() => {
      alpha.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    });
    expect(store.getState().ui.selection).toMatchObject({ type: 'STAGE', id: rootStage.id });
  });
});

describe('条件树递归操作', () => {
  let condition: ConditionExpression | undefined;
  async function render(initial?: ConditionExpression) {
    function Host() {
      const [value, setValue] = useState(initial);
      condition = value;
      return <ConditionEditor condition={value} onChange={setValue} />;
    }
    await act(() => root.render(<Host />));
  }
  it('空态添加叶子，显式添加组保持组包装', async () => {
    await render();
    await click(button('+ Add▼'));
    await click(button('Add Group'));
    expect(condition).toEqual({ type: 'And', children: [] });
    await click(button('+ Add▼'));
    await click(button('Add Condition'));
    expect(condition?.type).toBe('And');
    expect(condition?.children?.[0].type).toBe('Comparison');
  });
  it('Not 包裹多项保持数据和脚本条件，不允许添加第二个 operand', async () => {
    const children: ConditionExpression[] = [
      { type: 'Literal', value: false },
      { type: 'ScriptRef', scriptId: 'test-script' },
    ];
    await render({ type: 'Or', children });
    await click(button('Not'));
    expect(condition).toEqual({ type: 'Not', operand: { type: 'Or', children } });
    const adds = [...host.querySelectorAll('button')].filter((b) =>
      b.textContent?.includes('+ Add'),
    );
    expect(adds.some((b) => b.disabled)).toBe(true);
  });
  it('嵌套删除先确认；取消保持原树，确认才清空根组', async () => {
    const initial: ConditionExpression = {
      type: 'And',
      children: [{ type: 'Not', operand: { type: 'Literal', value: true } }],
    };
    await render(initial);
    await click(host.querySelector('[title="Delete Group"]')!);
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('its 2 items');
    await click(button('Cancel'));
    expect(condition).toEqual(initial);
    await click(host.querySelector('[title="Delete Group"]')!);
    await click(button('Confirm'));
    expect(condition).toBeUndefined();
  });
  it('同组叶子拖拽改变顺序，条件数据完整保留', async () => {
    const children: ConditionExpression[] = [
      { type: 'ScriptRef', scriptId: 'first' },
      { type: 'ScriptRef', scriptId: 'second' },
    ];
    await render({ type: 'And', children });
    const rows = [...host.querySelectorAll('.condition-child')];
    const data = dragData();
    await drag(rows[0].querySelector('[draggable]')!, 'dragstart', data);
    await drag(rows[1], 'dragover', data);
    await drag(rows[1], 'drop', data);
    expect(condition?.children).toEqual([children[1], children[0]]);
  });
});
