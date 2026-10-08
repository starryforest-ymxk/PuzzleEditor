// @vitest-environment jsdom
import React, { act, StrictMode, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { MenuSurface, MenuItem, MenuSeparator } from '../../components/shared/Menu';
import { StateNode } from '../../components/Canvas/Elements/StateNode';
import { ConnectionControls } from '../../components/Canvas/Elements/ConnectionLine';
import { GraphEdgeControls } from '../../components/Canvas/shared/GraphEdge';
import { GraphBindingSection } from '../../components/Inspector/presentation/GraphBindingSection';
import { ResourceSelect } from '../../components/Inspector/ResourceSelect';
import { VariableSelector } from '../../components/Inspector/VariableSelector';
import { VariableCard } from '../../components/Blackboard/VariableCard';
import { variableTypeColor, variableScopeColor } from '../../components/shared/uiTokens';
import type { Transition } from '../../types/stateMachine';

let host: HTMLDivElement, root: Root;
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
const click = (element: Element) =>
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const key = (element: EventTarget, value: string) =>
  act(() =>
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
    ),
  );

it('方向键跳过禁用项并循环；禁用菜单不会触发业务动作', async () => {
  const disabled = vi.fn();
  await act(() =>
    root.render(
      <MenuSurface>
        <MenuItem>First</MenuItem>
        <MenuItem disabled onClick={disabled}>
          Disabled
        </MenuItem>
        <MenuSeparator />
        <MenuItem>Last</MenuItem>
      </MenuSurface>,
    ),
  );
  const menu = host.querySelector('[role="menu"]')!,
    items = host.querySelectorAll<HTMLElement>('[role="menuitem"]');
  await key(menu, 'ArrowDown');
  expect(document.activeElement).toBe(items[0]);
  await key(items[0], 'ArrowDown');
  expect(document.activeElement).toBe(items[2]);
  await key(items[2], 'ArrowDown');
  expect(document.activeElement).toBe(items[0]);
  await key(items[0], 'End');
  expect(document.activeElement).toBe(items[2]);
  await click(items[1]);
  expect(disabled).not.toHaveBeenCalled();
});

it('子菜单点击保持菜单；StrictMode 外部关闭只执行一次并隔离画布事件', async () => {
  const close = vi.fn(),
    background = vi.fn();
  window.addEventListener('mousedown', background);
  try {
    await act(() =>
      root.render(
        <StrictMode>
          <MenuSurface consumeOutside onClose={close}>
            <MenuItem as="div">
              Submenu
              <MenuSurface submenu>
                <MenuItem>Child</MenuItem>
              </MenuSurface>
            </MenuItem>
          </MenuSurface>
        </StrictMode>,
      ),
    );
    await act(() =>
      host
        .querySelector('[role="menuitem"]')!
        .dispatchEvent(new MouseEvent('mousedown', { bubbles: true })),
    );
    expect(close).not.toHaveBeenCalled();
    background.mockClear();
    await act(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    expect(close).toHaveBeenCalledTimes(1);
    expect(background).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener('mousedown', background);
  }
});

it('Escape 关闭菜单并将焦点还给触发器；再次点击触发器可以收起', async () => {
  function Example() {
    const [open, setOpen] = useState(false),
      ref = useRef<HTMLDivElement>(null);
    return (
      <div ref={ref}>
        <button onClick={() => setOpen(!open)}>Open</button>
        {open && (
          <MenuSurface boundaryRef={ref} onClose={() => setOpen(false)}>
            <MenuItem>Item</MenuItem>
          </MenuSurface>
        )}
      </div>
    );
  }
  await act(() => root.render(<Example />));
  const button = host.querySelector('button')!;
  await click(button);
  await act(() => host.querySelector<HTMLElement>('[role="menuitem"]')!.focus());
  await key(window, 'Escape');
  expect(host.querySelector('[role="menu"]')).toBeNull();
  expect(document.activeElement).toBe(button);
  await click(button);
  await act(() => button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  await click(button);
  expect(host.querySelector('[role="menu"]')).toBeNull();
});

it('FSM 适配器保持业务 ID、拖动事件和校验提示优先级', async () => {
  const down = vi.fn(),
    context = vi.fn();
  await act(() =>
    root.render(
      <StateNode
        state={{
          id: 'state',
          name: 'State',
          position: { x: 0, y: 0 },
          description: 'Description',
          eventListeners: [],
        }}
        position={{ x: 25, y: 40 }}
        isSelected
        isInitial
        isContextTarget={false}
        hasError
        hasWarning
        errorTooltip="Missing resource"
        warningTooltip="Warning"
        onMouseDown={down}
        onMouseUp={() => {}}
        onContextMenu={context}
      />,
    ),
  );
  const node = host.querySelector<HTMLElement>('[data-node-id="state"]')!;
  expect(node.style.left).toBe('25px');
  expect(node.title).toBe('Missing resource');
  await act(() => node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  await act(() => node.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })));
  expect(down.mock.calls[0][1]).toBe('state');
  expect(context.mock.calls[0][1]).toBe('state');
});

it('两类边标签均保留选择 ID，只有可编辑图显示端点手柄', async () => {
  const select = vi.fn(),
    down = vi.fn();
  const transition = {
    id: 'transition',
    name: 'Go',
    fromStateId: 'a',
    toStateId: 'b',
  } as Transition;
  await act(() =>
    root.render(
      <>
        <ConnectionControls
          transition={transition}
          fromPos={{ x: 0, y: 0 }}
          toPos={{ x: 300, y: 0 }}
          isSelected={false}
          isContextTarget={false}
          onSelect={select}
          onContextMenu={() => {}}
          onHandleDown={down}
        />
        <GraphEdgeControls
          edge={{ id: 'edge', fromNodeId: 'a', toNodeId: 'b' }}
          fromPos={{ x: 0, y: 100 }}
          toPos={{ x: 300, y: 100 }}
          isSelected={false}
          isContextTarget={false}
          readOnly
          defaultLabel="Next"
          onSelect={select}
          onContextMenu={() => {}}
          onHandleDown={down}
        />
      </>,
    ),
  );
  const labels = host.querySelectorAll('.ui-edge-label');
  await click(labels[0]);
  await click(labels[1]);
  expect(select.mock.calls.map((call) => call[1])).toEqual(['transition', 'edge']);
  expect(host.querySelectorAll('.handle')).toHaveLength(2);
  await act(() =>
    host.querySelector('.handle')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })),
  );
  expect(down.mock.calls[0].slice(1)).toEqual(['transition', 'source']);
});

it('资源选择保留当前已删除项并展示警告，其余已删除资源不能成为新选项', async () => {
  const clear = vi.fn();
  await act(() =>
    root.render(
      <ResourceSelect
        value="deleted"
        options={[
          { id: 'active', name: 'Active', state: 'Implemented' },
          { id: 'deleted', name: 'Current Deleted', state: 'MarkedForDelete' },
          { id: 'other', name: 'Other Deleted', state: 'MarkedForDelete' },
        ]}
        onChange={() => {}}
        onClear={clear}
        showDetails
        warnOnMarkedDelete
      />,
    ),
  );
  expect([...host.querySelectorAll('option')].map((option) => option.value)).toEqual([
    '',
    'active',
    'deleted',
  ]);
  expect(host.querySelector('.ui-notice')?.textContent).toContain('marked for delete');
  expect(host.querySelector('.ui-resource-preview')?.textContent).toContain('Current Deleted');
  await click(host.querySelector('[title="Clear selection"]')!);
  expect(clear).toHaveBeenCalledTimes(1);
});

it('图预览随数据变化更新摘要，跳转及丢失引用提示保持可用', async () => {
  const navigate = vi.fn(),
    binding = { type: 'Graph' as const, graphId: 'g' };
  const props = {
    binding,
    onChange: () => {},
    graphOptions: [
      { id: 'g', name: 'Graph', description: 'Details', state: 'Implemented' as const },
    ],
    onNavigateToGraph: navigate,
  };
  await act(() =>
    root.render(
      <GraphBindingSection
        {...props}
        graphData={{
          g: {
            id: 'g',
            name: 'Graph',
            startNodeId: 'n',
            nodes: {
              n: {
                id: 'n',
                name: 'Start',
                type: 'Wait',
                duration: 1,
                position: { x: 0, y: 0 },
                nextIds: [],
              },
            },
          },
        }}
      />,
    ),
  );
  expect(host.textContent).toContain('Nodes:1Start Node:Start');
  await click(host.querySelector('.ui-resource-preview__footer button')!);
  expect(navigate).toHaveBeenCalledWith('g');
  await act(() => root.render(<GraphBindingSection {...props} graphOptions={[]} />));
  expect(host.querySelector('.ui-notice')?.textContent).toContain('not found');
});

it('变量卡片和选择器共享类型颜色；选择器保留过滤、选择及清空回调', async () => {
  const pick = vi.fn(),
    variable = {
      id: 'v',
      name: 'Count',
      type: 'integer' as const,
      value: 0,
      scope: 'Global' as const,
      state: 'Implemented' as const,
    };
  await act(() =>
    root.render(
      <>
        <VariableCard
          variable={variable}
          isSelected={false}
          referenceCount={0}
          onClick={() => {}}
        />
        <VariableSelector variables={[variable]} value="v" onChange={pick} />
      </>,
    ),
  );
  expect(host.querySelector<HTMLElement>('.card-type-value-row .value')!.style.color).toBe(
    variableTypeColor('integer'),
  );
  const badge = host.querySelector<HTMLElement>('.ui-badge:not(.ui-badge--compact)')!;
  expect(badge.style.color).toBe(variableTypeColor('integer'));
  expect(variableScopeColor('Global')).toBe('var(--scope-Global)');
  await click(host.querySelector('button')!);
  const row = [...host.querySelectorAll('div')].find(
    (element) => element.textContent === 'CountintegerGlobal' && element.hasAttribute('style'),
  )!;
  await click(row);
  expect(pick).toHaveBeenCalledWith('v', 'Global', variable);
  await click(host.querySelector('button')!);
  const clear = [...host.querySelectorAll('div')].find(
    (element) => element.textContent?.trim() === 'Clear selection',
  )!;
  await click(clear);
  expect(pick).toHaveBeenLastCalledWith('', 'Global');
});
