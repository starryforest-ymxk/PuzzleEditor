import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createEditorStore, type EditorStore } from '../../store/editorStore';
import { ProjectSession } from '../../services/projectSession';
import { createEditorFixture, createProjectFixture } from '../fixtures/editor';
import { useProjectActions } from '../../hooks/useProjectActions';

const io = vi.hoisted(() => ({ writeProject: vi.fn(), readProject: vi.fn(), saveFileDialog: vi.fn(), exportProject: vi.fn() }));
const store = vi.hoisted(() => ({ editor: undefined as EditorStore | undefined, session: undefined as ProjectSession | undefined }));
vi.mock('../../store/context', () => ({ useEditorState: () => store.editor!.getState(), useEditorDispatch: () => store.editor!.dispatch, useProjectSession: () => store.session! }));
/** 使用真实 React Hook 执行环境，仅替换 Store 边界与磁盘 I/O。 */
function renderActions(): ReturnType<typeof useProjectActions> {
    let actions: ReturnType<typeof useProjectActions>;
    function Probe() { actions = useProjectActions(); return null; }
    renderToStaticMarkup(createElement(Probe));
    return actions!;
}

beforeEach(() => {
    vi.clearAllMocks();
    const initial = createEditorFixture();
    initial.runtime.currentProjectPath = 'test.puzzle.json';
    store.editor = createEditorStore(initial);
    store.session = new ProjectSession(store.editor, {
        isDesktop: () => true, read: io.readProject, write: io.writeProject,
        chooseOpen: async () => null, chooseSave: async () => null,
        chooseExport:async (defaultPath,name)=>{const result=await io.saveFileDialog(defaultPath,name);return result&&!result.canceled?result.filePath:null;}, exportFile:io.exportProject,
        activate: async () => ({ success: true }), download: vi.fn()
    });
    store.editor.dispatch({ type: 'UPDATE_PROJECT_META', payload: { name: 'Version A' } });
});

describe('实际保存 Hook 的版本确认', () => {
    it('允许加载的业务错误仍阻断实际导出入口', async () => {
        const project = createProjectFixture(); project.presentationGraphs.graph.startNodeId = null;
        store.editor!.dispatch({ type: 'INIT_SUCCESS', payload: project });
        await renderActions().exportProject();
        expect(io.saveFileDialog).not.toHaveBeenCalled(); expect(io.exportProject).not.toHaveBeenCalled();
        expect(store.editor!.getState().ui.messages.some(message => message.text.startsWith('Export failed:'))).toBe(true);
        expect(store.editor!.getState().ui.showValidationPanel).toBe(true);
        expect(store.editor!.getState().ui.validationResults.some(result => result.level === 'error')).toBe(true);
    });

    it('修复后重新校验刷新列表并能重新打开已关闭的问题面板', () => {
        const project = createProjectFixture(); project.presentationGraphs.graph.startNodeId = null;
        store.editor!.dispatch({ type: 'INIT_SUCCESS', payload: project });
        renderActions().validateProject();
        expect(store.editor!.getState().ui.validationResults.some(result => result.id === 'err-graph-no-start-graph')).toBe(true);
        store.editor!.dispatch({ type: 'UPDATE_PRESENTATION_GRAPH', payload: { graphId: 'graph', data: { startNodeId: 'first' } } });
        store.editor!.dispatch({ type: 'SET_SHOW_VALIDATION_PANEL', payload: false });
        renderActions().validateProject();
        expect(store.editor!.getState().ui.validationResults.some(result => result.id === 'err-graph-no-start-graph')).toBe(false);
        expect(store.editor!.getState().ui.showValidationPanel).toBe(true);
    });

    it('延迟保存完成时保留后续编辑，序列化不包含会话版本', async () => {
        let finish: (result: { success: boolean }) => void;
        io.writeProject.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const actions = renderActions();
        const saving = actions.saveProject();
        await vi.waitFor(() => expect(io.writeProject).toHaveBeenCalledTimes(1));
        const file = JSON.parse(io.writeProject.mock.calls[0][1]);
        expect(file.project.meta.name).toBe('Version A');
        expect(file.project.document).toBeUndefined();
        expect(file.document).toBeUndefined();
        store.editor!.dispatch({ type: 'UPDATE_PROJECT_META', payload: { name: 'Version B' } });
        finish!({ success: true });
        await expect(saving).resolves.toMatchObject({ status: 'saved' });
        expect(store.editor!.getState().project.meta.name).toBe('Version B');
        expect(store.editor!.getState().ui.isDirty).toBe(true);
        store.editor!.dispatch({ type: 'UNDO' });
        expect(store.editor!.getState().project.meta.name).toBe('Version A');
        expect(store.editor!.getState().ui.isDirty).toBe(false);
    });

    it('写入失败不确认保存版本', async () => {
        io.writeProject.mockResolvedValueOnce({ success: false, error: 'Test write failure' });
        const baseline = store.editor!.getState().document.savedRevision;
        await expect(renderActions().saveProject()).resolves.toMatchObject({ status: 'failed' });
        expect(store.editor!.getState().document.savedRevision).toBe(baseline);
        expect(store.editor!.getState().ui.isDirty).toBe(true);
        expect(store.editor!.getState().ui.messages.at(-1)?.level).toBe('error');
    });

    it('旧保存迟到不会改变新项目的 dirty、版本和保存时间', async () => {
        let finish: (result: { success: boolean }) => void;
        io.writeProject.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const saving = renderActions().saveProject();
        await vi.waitFor(() => expect(io.writeProject).toHaveBeenCalledTimes(1));
        store.editor!.dispatch({ type: 'INIT_SUCCESS', payload: createProjectFixture(), saved: false });
        const expectedDocument = store.editor!.getState().document;
        const expectedTimestamp = store.editor!.getState().project.meta.updatedAt;
        finish!({ success: true });
        await saving;
        expect(store.editor!.getState().document).toBe(expectedDocument);
        expect(store.editor!.getState().project.meta.updatedAt).toBe(expectedTimestamp);
        expect(store.editor!.getState().ui.isDirty).toBe(true);
    });

    it('多个 Hook 入口共享同一保存函数，调用时读取最新状态', async () => {
        io.writeProject.mockResolvedValue({ success: true });
        const first = renderActions(); const second = renderActions();
        expect(first.saveProject).toBe(second.saveProject);
        store.editor!.dispatch({ type: 'UPDATE_PROJECT_META', payload: { name: 'Fresh' } });
        await first.saveProject();
        expect(JSON.parse(io.writeProject.mock.calls[0][1]).project.meta.name).toBe('Fresh');
    });
});
