import { describe, it, expect, vi } from 'vitest';
import { createEditorStore } from '../../store/editorStore';
import { ProjectSession } from '../../services/projectSession';
import type { ProjectPlatform } from '../../services/projectPlatform';
import { createEditorFixture } from '../fixtures/editor';

function setup(desktop = true) {
  const initial = createEditorFixture();
  initial.project.stageTree.stages[initial.project.stageTree.rootId].assetName = 'RootStage';
  initial.project.blackboard.events.event.assetName = 'Event';
  const store = createEditorStore(initial);
  const platform = {
    isDesktop: () => desktop,
    chooseOpen: async () => null,
    read: async () => ({ success: false }),
    chooseSave: async () => null,
    write: async () => ({ success: true }),
    activate: async () => ({ success: true }),
    download: vi.fn(),
    chooseExport: vi.fn(async () => 'C:/test/runtime.export.json'),
    exportFile: vi.fn<ProjectPlatform['exportFile']>(async () => ({ success: true })),
  } satisfies ProjectPlatform;
  return { store, platform, session: new ProjectSession(store, platform) };
}
describe('统一会话的运行时导出', () => {
  it('导出 runtime 文件，保留编辑器脏状态与历史版本', async () => {
    const { store, platform, session } = setup();
    store.dispatch({ type: 'UPDATE_PROJECT_META', payload: { name: 'Runtime Test' } });
    const document = store.getState().document;
    await session.exportProject();
    expect(platform.exportFile).toHaveBeenCalledOnce();
    const [path, content] = platform.exportFile.mock.calls[0];
    expect(path).toBe('C:/test/runtime.export.json');
    expect(JSON.parse(content)).toMatchObject({
      fileType: 'puzzle-export',
      projectName: 'Runtime Test',
    });
    expect(JSON.parse(content)).not.toHaveProperty('editorState');
    expect(store.getState().document).toEqual(document);
    expect(store.getState().ui.isDirty).toBe(true);
  });
  it('阻止覆盖工程文件，其他 json 后缀自动补成 export.json', async () => {
    const { platform, session } = setup();
    platform.chooseExport.mockResolvedValueOnce('C:/test/project.puzzle.json');
    await session.exportProject();
    expect(platform.exportFile).not.toHaveBeenCalled();
    platform.chooseExport.mockResolvedValueOnce('C:/test/custom.json');
    await session.exportProject();
    expect(platform.exportFile).toHaveBeenCalledWith(
      'C:/test/custom.export.json',
      expect.any(String),
    );
  });
  it('浏览器统一下载且不触发桌面写入', async () => {
    const { platform, session } = setup(false);
    await session.exportProject();
    expect(platform.download).toHaveBeenCalledWith(
      expect.stringContaining('puzzle-export'),
      'Test Project.export.json',
    );
    expect(platform.chooseExport).not.toHaveBeenCalled();
    expect(platform.exportFile).not.toHaveBeenCalled();
  });
  it('导出平台异常转为消息，不留下被拒绝的异步任务', async () => {
    const { store, platform, session } = setup();
    platform.chooseExport.mockRejectedValueOnce(new Error('test dialog failure'));
    await expect(session.exportProject()).resolves.toBeUndefined();
    expect(store.getState().ui.messages.at(-1)?.text).toContain(
      'Export failed: test dialog failure',
    );
    await session.exportProject();
    expect(platform.exportFile).toHaveBeenCalledOnce();
  });
});
