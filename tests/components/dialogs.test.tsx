// @vitest-environment jsdom
import React, { act, StrictMode, useState, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../../components/Inspector/ConfirmDialog';
import { ConfirmSaveDialog } from '../../components/Layout/ConfirmSaveDialog';
import { NewProjectDialog } from '../../components/Layout/NewProjectDialog';
import { ProjectSettingsDialog } from '../../components/Layout/ProjectSettingsDialog';
import { PreferencePanel } from '../../components/Layout/PreferencePanel';
import { StateContext, DispatchContext } from '../../store/context';
import { createEditorStore } from '../../store/editorStore';
import { createEditorFixture } from '../fixtures/editor';
import type { UserPreferences } from '../../electron/types';
import type { SessionResult } from '../../services/projectSession';

const bridge = vi.hoisted(() => ({ desktop: true, load: vi.fn(), save: vi.fn(), browse: vi.fn() }));
vi.mock('../../platform/electron', () => ({
  isElectron: () => bridge.desktop,
  loadPreferences: bridge.load,
  savePreferences: bridge.save,
  openDirectoryDialog: bridge.browse,
}));
let host: HTMLDivElement, root: Root;
const preferences: UserPreferences = {
  projectsDirectory: 'C:/test/projects',
  exportDirectory: 'C:/test/export',
  restoreLastProject: false,
  lastProjectPath: null,
  recentProjects: [],
  translation: { provider: 'local', autoTranslate: false },
  autoSave: { enabled: false, intervalMinutes: 1 },
};
beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  bridge.desktop = true;
  bridge.load.mockResolvedValue({ success: true, data: structuredClone(preferences) });
  bridge.save.mockResolvedValue({ success: true });
  bridge.browse.mockResolvedValue({ canceled: false, filePath: 'C:/test/chosen' });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
});
const dialog = () =>
  document.body.querySelector<HTMLDivElement>('[role="dialog"][aria-modal="true"]')!;
const button = (text: string) =>
  Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
    (item) => item.textContent === text,
  )!;
const click = (element: HTMLElement) => act(async () => element.click());
const key = (element: HTMLElement, value: string, extras: KeyboardEventInit = {}) =>
  act(async () => {
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...extras }),
    );
  });
async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      element instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype,
      'value',
    )!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function select(element: HTMLSelectElement, value: string) {
  await act(async () => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
function deferred<T>() {
  let resolve!: (result: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('统一弹窗的真实交互', () => {
  it('危险确认默认 Cancel，保留引用预览；StrictMode 退出恢复触发点和背景状态', async () => {
    const confirm = vi.fn(),
      cancel = vi.fn();
    const trigger = document.createElement('button');
    trigger.textContent = 'Open';
    document.body.append(trigger);
    trigger.focus();
    await act(async () =>
      root.render(
        <StrictMode>
          <ConfirmDialog
            title="Delete Variable"
            message="Delete?"
            references={['Stage / Root']}
            onConfirm={confirm}
            onCancel={cancel}
          />
        </StrictMode>,
      ),
    );
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(button('Cancel'));
    expect(dialog().textContent).toContain('Stage / Root');
    await click(button('Confirm'));
    expect(confirm).toHaveBeenCalledOnce();
    await key(button('Cancel'), 'Escape');
    expect(cancel).toHaveBeenCalledOnce();
    await act(async () => root.render(null));
    expect(host.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('新建过程中叠加保存确认：只响应最上层 Escape，取消保留名称草稿并恢复焦点', async () => {
    const cancelNew = vi.fn();
    const pending = deferred<SessionResult>();
    function Nested() {
      const [confirming, setConfirming] = useState(false);
      return (
        <>
          <NewProjectDialog
            onCancel={cancelNew}
            onConfirm={() => {
              setConfirming(true);
              return pending.promise;
            }}
          />
          {confirming && (
            <ConfirmSaveDialog
              nextAction="create a new project"
              onSave={() => {}}
              onDiscard={() => {}}
              onCancel={() => {
                setConfirming(false);
                pending.resolve({ status: 'cancelled' });
              }}
            />
          )}
        </>
      );
    }
    await act(async () => root.render(<Nested />));
    const name = dialog().querySelector('input')!;
    await type(name, 'Kept Draft');
    await key(name, 'Enter');
    const panels = document.body.querySelectorAll<HTMLElement>('[role="dialog"]');
    expect(panels).toHaveLength(2);
    expect(panels[0].closest<HTMLElement>('.dialog-overlay')!.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(button('Cancel'));
    await key(button('Cancel'), 'Escape');
    expect(cancelNew).not.toHaveBeenCalled();
    expect(dialog().getAttribute('aria-label')).toBe('Create New Project');
    expect(name.value).toBe('Kept Draft');
    expect(document.activeElement).toBe(name);
    await key(name, 'Escape');
    expect(cancelNew).toHaveBeenCalledOnce();
  });

  it('Tab 与 Shift+Tab 限于弹窗，背景聚焦被拦截，遮罩不丢失表单', async () => {
    const cancel = vi.fn();
    await act(async () =>
      root.render(
        <NewProjectDialog onCancel={cancel} onConfirm={async () => ({ status: 'cancelled' })} />,
      ),
    );
    const first = dialog().querySelector('input')!;
    const last = button('Create Project');
    await act(async () => last.focus());
    await key(last, 'Tab');
    expect(document.activeElement).toBe(first);
    await key(first, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(last);
    host.tabIndex = 0;
    await act(async () => host.focus());
    expect(document.activeElement).toBe(first);
    await click(dialog().parentElement!);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('忙碌的关闭确认阻止 Escape、Tab 越界和所有选择', async () => {
    const save = vi.fn(),
      discard = vi.fn(),
      cancel = vi.fn();
    await act(async () =>
      root.render(
        <ConfirmSaveDialog
          busy
          nextAction="close the editor"
          onSave={save}
          onDiscard={discard}
          onCancel={cancel}
        />,
      ),
    );
    expect(document.activeElement).toBe(dialog());
    await key(dialog(), 'Escape');
    await key(dialog(), 'Tab');
    await click(button('Cancel'));
    await click(button('Discard & Close'));
    await click(button('Working...'));
    expect(save).not.toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(dialog());
  });

  it.each([true, false])('保存确认保留桌面/浏览器选择语义（desktop=%s）', async (desktop) => {
    const save = vi.fn(),
      discard = vi.fn();
    await act(async () =>
      root.render(
        <ConfirmSaveDialog
          desktop={desktop}
          nextAction="load another project"
          onSave={save}
          onDiscard={discard}
          onCancel={() => {}}
        />,
      ),
    );
    await click(button(desktop ? 'Save & Continue' : 'Download Copy'));
    await click(button('Discard'));
    expect(save).toHaveBeenCalledOnce();
    expect(discard).toHaveBeenCalledOnce();
  });

  it('新建描述 Enter 不提交；名称校验、默认目录、浏览及创建失败草稿保持', async () => {
    const create = vi.fn(async () => ({ status: 'failed' as const, error: 'Create failed' }));
    await act(async () => root.render(<NewProjectDialog onCancel={() => {}} onConfirm={create} />));
    const name = dialog().querySelector('input')!,
      description = dialog().querySelector('textarea')!;
    await type(description, ' Multi\nline ');
    await key(description, 'Enter');
    expect(create).not.toHaveBeenCalled();
    await type(name, ' ');
    expect(button('Create Project').disabled).toBe(true);
    await type(name, ' Trimmed ');
    await key(name, 'Enter');
    expect(create).toHaveBeenCalledWith('Trimmed', 'Multi\nline', 'C:/test/projects');
    expect(dialog().querySelector('[role="alert"]')?.textContent).toBe('Create failed');
    expect(description.value).toBe(' Multi\nline ');
    await click(
      dialog().querySelector<HTMLButtonElement>('[aria-label="Browse project location"]')!,
    );
    expect(dialog().querySelector<HTMLInputElement>('[id$="-location"]')?.value).toBe(
      'C:/test/chosen',
    );
  });

  it('项目设置保留元信息和导出字段；Ctrl+Enter 从描述保存，失败后可继续编辑', async () => {
    const save = vi.fn(async () => ({ status: 'failed' as const, error: 'Settings failed' }));
    const meta = createEditorFixture().project.meta;
    await act(async () =>
      root.render(<ProjectSettingsDialog meta={meta} onCancel={() => {}} onSave={save} />),
    );
    const description = dialog().querySelector('textarea')!;
    await type(description, ' Updated ');
    await type(dialog().querySelector<HTMLInputElement>('[id$="-version"]')!, '');
    await type(dialog().querySelector<HTMLInputElement>('[id$="-export-name"]')!, ' custom.json ');
    await click(
      dialog().querySelector<HTMLButtonElement>('[aria-label="Browse export directory"]')!,
    );
    await key(description, 'Enter');
    expect(save).not.toHaveBeenCalled();
    await key(description, 'Enter', { ctrlKey: true });
    expect(save).toHaveBeenCalledWith({
      name: meta.name,
      description: 'Updated',
      version: '1.0.0',
      exportPath: 'C:/test/chosen',
      exportFileName: 'custom.json',
    });
    expect(dialog().textContent).toContain(meta.id);
    expect(dialog().textContent).toContain('Settings failed');
    expect(description.matches(':disabled')).toBe(false);
  });
});

async function renderPreferences(close = vi.fn()) {
  const store = createEditorStore(createEditorFixture());
  function Provider() {
    const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
    return (
      <StateContext.Provider value={state}>
        <DispatchContext.Provider value={store.dispatch}>
          <PreferencePanel onClose={close} />
        </DispatchContext.Provider>
      </StateContext.Provider>
    );
  }
  await act(async () => root.render(<Provider />));
  return { store, close };
}
describe('偏好设置接入共享表单', () => {
  it('开关、目录、自动保存间隔及自定义模型持久化后才同步 Store', async () => {
    const { store, close } = await renderPreferences();
    for (const label of ['Restore Last Project', 'Auto Save', 'Auto Translate AssetName'])
      await click(
        dialog().querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${label}"]`)!,
      );
    await type(dialog().querySelector<HTMLInputElement>('[id$="-interval"]')!, '3');
    await click(
      dialog().querySelector<HTMLButtonElement>('[aria-label="Browse projects directory"]')!,
    );
    await select(dialog().querySelector('select')!, 'openai');
    await type(
      dialog().querySelector<HTMLInputElement>('[aria-label="Custom model"]')!,
      'custom-model',
    );
    await click(button('Save Preferences'));
    const saved = bridge.save.mock.calls[0][0] as UserPreferences;
    expect(saved.projectsDirectory).toBe('C:/test/chosen');
    expect(saved.exportDirectory).toBe(preferences.exportDirectory);
    expect(saved.restoreLastProject).toBe(true);
    expect(saved.autoSave).toEqual({ enabled: true, intervalMinutes: 3 });
    expect(saved.translation).toMatchObject({
      provider: 'openai',
      openaiModel: 'custom-model',
      autoTranslate: true,
    });
    expect(store.getState().settings.autoSave).toEqual(saved.autoSave);
    expect(close).toHaveBeenCalledOnce();
  });

  it('写盘中阻止重复提交和关闭；异常保留草稿与旧设置，解除忙碌后可重试', async () => {
    const pending = deferred<{ success: boolean }>();
    bridge.save.mockReturnValueOnce(pending.promise);
    const { store, close } = await renderPreferences();
    const original = store.getState().settings.autoSave;
    await click(dialog().querySelector<HTMLButtonElement>('[aria-label="Auto Save"]')!);
    await click(button('Save Preferences'));
    await key(dialog(), 'Escape');
    await key(dialog(), 'Enter', { ctrlKey: true });
    await click(button('Cancel'));
    expect(close).not.toHaveBeenCalled();
    expect(bridge.save).toHaveBeenCalledOnce();
    expect(store.getState().settings.autoSave).toEqual(original);
    expect(dialog().querySelector('input')!.matches(':disabled')).toBe(true);
    await act(async () => pending.reject(new Error('Disk unavailable')));
    expect(dialog().textContent).toContain('Disk unavailable');
    expect(button('Save Preferences').disabled).toBe(false);
    expect(dialog().querySelector('[aria-label="Auto Save"]')?.getAttribute('aria-checked')).toBe(
      'true',
    );
    await key(button('Save Preferences'), 'Enter', { ctrlKey: true });
    expect(close).toHaveBeenCalledOnce();
    expect(bridge.save).toHaveBeenCalledTimes(2);
    expect(store.getState().settings.autoSave.enabled).toBe(true);
  });

  it.each(['rejected', 'unavailable'])('偏好加载失败 %s 仍有取消入口', async (reason) => {
    if (reason === 'rejected') bridge.load.mockRejectedValue(new Error('IPC unavailable'));
    else bridge.desktop = false;
    const { close } = await renderPreferences();
    expect(dialog().querySelector('[role="alert"]')).not.toBeNull();
    expect(button('Save Preferences').disabled).toBe(true);
    await key(button('Cancel'), 'Escape');
    expect(close).toHaveBeenCalledOnce();
  });
});
