import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditorStore } from '../../store/editorStore';
import { INITIAL_STATE } from '../../store/types';
import { ProjectSession } from '../../services/projectSession';
import type { ProjectPlatform } from '../../services/projectPlatform';
import { serializeProject } from '../../services/projectFiles';
import { scheduleAutoSave } from '../../services/autoSaveScheduler';
import { createEditorFixture, createProjectFixture } from '../fixtures/editor';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}
function setup(desktop = true, empty = false) {
    const initial = empty ? structuredClone(INITIAL_STATE) : createEditorFixture();
    if (!empty && desktop) initial.runtime.currentProjectPath = 'C:/test/current.puzzle.json';
    const store = createEditorStore(initial);
    const candidate = createProjectFixture(); candidate.meta.name = 'Candidate';
    const json = serializeProject(candidate, undefined, candidate.meta.updatedAt);
    const platform = {
        isDesktop: () => desktop,
        chooseOpen: vi.fn<ProjectPlatform['chooseOpen']>(async () => ({ content: json, path: desktop ? 'C:/test/next.puzzle.json' : null })),
        read: vi.fn<ProjectPlatform['read']>(async () => ({ success: true, data: json })),
        chooseSave: vi.fn<ProjectPlatform['chooseSave']>(async () => 'C:/test/saved.puzzle.json'),
        write: vi.fn<ProjectPlatform['write']>(async () => ({ success: true })),
        chooseExport:vi.fn<ProjectPlatform['chooseExport']>(async()=> 'C:/test/runtime.export.json'),
        exportFile:vi.fn<ProjectPlatform['exportFile']>(async()=>({success:true})),
        activate: vi.fn<ProjectPlatform['activate']>(async () => ({ success: true })), download: vi.fn()
    } satisfies ProjectPlatform;
    const session = new ProjectSession(store, platform);
    const edit = (name = 'Edited') => store.dispatch({ type: 'UPDATE_PROJECT_META', payload: { name } });
    const waitPhase = async (phase: string) => vi.waitFor(() => expect(store.getState().runtime.projectOperation.phase).toBe(phase));
    return { store, platform, session, edit, waitPhase, json };
}
afterEach(() => vi.useRealTimers());

describe('C8 候选所有权与会话提交顺序', () => {
    it('目标被占用时保留原文档、历史、路径与 dirty', async () => {
        const { store, session, platform, edit, waitPhase } = setup(); edit();
        const before = store.getState();
        const claim = vi.fn(async () => ({ success: false, error: 'Project is held by another editor' }));
        Object.assign(platform, { claim });
        const result = session.openProject();
        await waitPhase('confirming'); session.choose('discard');
        expect((await result).status).toBe('failed');
        expect(store.getState().project).toBe(before.project);
        expect(store.getState().history).toBe(before.history);
        expect(store.getState().runtime.currentProjectPath).toBe(before.runtime.currentProjectPath);
        expect(store.getState().ui.isDirty).toBe(true);
        expect(platform.activate).not.toHaveBeenCalled();
    });
    it('取得候选后才提交，activate 使用同一 token', async () => {
        const { store, session, platform, json } = setup();
        const claim = vi.fn(async () => {
            expect(store.getState().runtime.currentProjectPath).toBe('C:/test/current.puzzle.json');
            return { success: true, data: 'candidate-token' };
        });
        const releaseClaim = vi.fn(async () => ({ success: true }));
        Object.assign(platform, { claim, releaseClaim });
        expect((await session.openProject()).status).toBe('loaded');
        expect(claim).toHaveBeenCalledWith('C:/test/next.puzzle.json', json, undefined);
        expect(platform.activate).toHaveBeenCalledWith('C:/test/next.puzzle.json', 'Candidate', 'candidate-token');
        expect(releaseClaim).toHaveBeenCalledWith('candidate-token');
    });
    it('新建目标占用在磁盘写入前拒绝', async () => {
        const { store, session, platform } = setup();
        const before = store.getState().project;
        Object.assign(platform, { claim: vi.fn(async () => ({ success: false, error: 'Project held' })) });
        expect((await session.createAndSaveProject('Created', '', 'C:/test')).status).toBe('failed');
        expect(platform.write).not.toHaveBeenCalled(); expect(store.getState().project).toBe(before);
    });
    it('另存写盘失败释放候选，不改变路径或确认 dirty', async () => {
        const { store, session, platform, edit } = setup(); edit();
        store.dispatch({ type: 'SET_PROJECT_PATH', payload: null });
        const releaseClaim = vi.fn(async () => ({ success: true }));
        Object.assign(platform, { claim: vi.fn(async () => ({ success: true, data: 'save-token' })), releaseClaim });
        platform.write.mockResolvedValueOnce({ success: false, error: 'Disk full' });
        expect((await session.saveProject()).status).toBe('failed');
        expect(store.getState().runtime.currentProjectPath).toBeNull(); expect(store.getState().ui.isDirty).toBe(true);
        expect(platform.activate).not.toHaveBeenCalled(); expect(releaseClaim).toHaveBeenCalledWith('save-token');
    });
    it('启动恢复等待 claim 时的新意图取消恢复并释放候选', async () => {
        const { store, session, platform } = setup(true, true);
        const pending = deferred<{ success: boolean; data: string }>();
        const claim = vi.fn(() => pending.promise), releaseClaim = vi.fn(async () => ({ success: true }));
        Object.assign(platform, { claim, releaseClaim });
        const restoring = session.restoreProject('C:/test/restore.puzzle.json', session.captureStartup());
        await vi.waitFor(() => expect(claim).toHaveBeenCalled());
        session.markUserIntent(); pending.resolve({ success: true, data: 'restore-token' });
        expect((await restoring).status).toBe('cancelled'); expect(store.getState().project.isLoaded).toBe(false);
        expect(platform.activate).not.toHaveBeenCalled(); expect(releaseClaim).toHaveBeenCalledWith('restore-token');
    });
});

describe('原生关闭的会话保护', () => {
    it.each([true, false])('空会话或干净项目直接放行（empty=%s）并冻结内容', async empty => {
        const { session, store, edit, platform } = setup(true, empty);
        const confirm = vi.fn(async () => true);
        expect(await session.requestClose(confirm)).toBe(true);
        const before = store.getState().project;
        edit('Too late');
        expect(store.getState().project).toBe(before);
        expect(store.getState().runtime.projectOperation.phase).toBe('committing');
        expect(confirm).toHaveBeenCalledTimes(1);
        expect(platform.write).not.toHaveBeenCalled();
        expect((await session.openProject()).status).toBe('cancelled');
    });
    it.each(['cancel', 'discard'] as const)('%s 保留未保存标记，仅放弃时授权退出', async choice => {
        const { session, store, edit, platform, waitPhase } = setup(); edit();
        const confirm = vi.fn(async () => true);
        const closing = session.requestClose(confirm);
        await waitPhase('confirming'); session.choose(choice);
        expect(await closing).toBe(choice === 'discard');
        expect(confirm).toHaveBeenCalledTimes(choice === 'discard' ? 1 : 0);
        expect(platform.write).not.toHaveBeenCalled();
        expect(store.getState().ui.isDirty).toBe(true);
        expect(store.getState().runtime.projectOperation.phase).toBe(choice === 'discard' ? 'committing' : 'idle');
    });
    it('保存完成后才放行，保存期间的新修改需要再次确认', async () => {
        const { session, store, edit, platform, waitPhase } = setup(); edit('First');
        const write = deferred<{ success: boolean }>();
        platform.write.mockImplementationOnce(() => write.promise);
        const confirm = vi.fn(async () => true);
        const closing = session.requestClose(confirm);
        await waitPhase('confirming'); session.choose('save');
        await vi.waitFor(() => expect(platform.write).toHaveBeenCalledTimes(1));
        edit('Latest');
        expect(confirm).not.toHaveBeenCalled();
        write.resolve({ success: true });
        await waitPhase('confirming');
        expect(store.getState().runtime.projectOperation.message).toContain('New changes');
        session.choose('save');
        expect(await closing).toBe(true);
        expect(JSON.parse(platform.write.mock.calls[1][1]).project.meta.name).toBe('Latest');
        expect(store.getState().ui.isDirty).toBe(false);
    });
    it.each(['cancel-picker', 'write-failure'] as const)('%s 不关闭，允许随后重试保存', async failure => {
        const { session, store, edit, platform, waitPhase } = setup(); edit();
        store.dispatch({ type: 'SET_PROJECT_PATH', payload: null });
        if (failure === 'cancel-picker') platform.chooseSave.mockResolvedValueOnce(null);
        else platform.write.mockResolvedValueOnce({ success: false, error: 'Disk full' });
        const confirm = vi.fn(async () => true);
        const closing = session.requestClose(confirm);
        await waitPhase('confirming'); session.choose('save');
        await vi.waitFor(() => expect(store.getState().runtime.projectOperation.message).toContain(failure === 'cancel-picker' ? 'Save was cancelled' : 'Disk full'));
        expect(store.getState().ui.isDirty).toBe(true);
        expect(confirm).not.toHaveBeenCalled();
        session.choose('save');
        expect(await closing).toBe(true);
        expect(store.getState().runtime.currentProjectPath).toBe('C:/test/saved.puzzle.json');
        expect(store.getState().ui.isDirty).toBe(false);
    });
    it('等待已经开始的保存；最终版本已保存时不再重复询问', async () => {
        const { session, edit, platform } = setup(); edit();
        const write = deferred<{ success: boolean }>();
        platform.write.mockImplementationOnce(() => write.promise);
        const saving = session.saveProject();
        const confirm = vi.fn(async () => true);
        const closing = session.requestClose(confirm);
        await vi.waitFor(() => expect(platform.write).toHaveBeenCalledTimes(1));
        expect(confirm).not.toHaveBeenCalled();
        write.resolve({ success: true });
        await saving;
        expect(await closing).toBe(true);
        expect(platform.write).toHaveBeenCalledTimes(1);
    });
    it('放弃确认后的排队写入产生新版本时重新询问，不把旧同意用于新内容', async () => {
        const { session, store, edit, platform, waitPhase } = setup(); edit();
        const confirm = vi.fn(async () => true);
        const closing = session.requestClose(confirm);
        await waitPhase('confirming');
        const read = deferred<{ success: boolean; data: string }>();
        platform.read.mockImplementationOnce(() => read.promise);
        const sync = session.syncExternal(store.getState().runtime.currentProjectPath!);
        session.choose('discard');
        await vi.waitFor(() => expect(platform.read).toHaveBeenCalledTimes(1));
        edit('Changed after discard');
        read.resolve({ success: true, data: 'invalid' });
        await sync;
        await waitPhase('confirming');
        expect(confirm).not.toHaveBeenCalled();
        session.choose('cancel');
        expect(await closing).toBe(false);
    });
    it.each(['reject', 'throw'] as const)('主进程 %s 后恢复编辑且保持 dirty', async mode => {
        const { session, store, edit, waitPhase } = setup(); edit();
        const closing = session.requestClose(async () => { if (mode === 'throw') throw new Error('IPC unavailable'); return false; });
        await waitPhase('confirming'); session.choose('discard');
        expect(await closing).toBe(false);
        expect(store.getState().runtime.projectOperation.phase).toBe('idle');
        edit('Still editable');
        expect(store.getState().project.meta.name).toBe('Still editable');
        expect(store.getState().ui.isDirty).toBe(true);
    });
    it('正在切换时拒绝关闭，保留原确认框；重复关闭也不替换当前确认', async () => {
        const { session, store, edit, waitPhase } = setup(); edit();
        const opening = session.openProject();
        await waitPhase('confirming');
        expect(await session.requestClose(async () => true)).toBe(false);
        expect(store.getState().runtime.projectOperation.nextAction).toBe('open another project');
        session.choose('cancel'); await opening;
        const closing = session.requestClose(async () => true);
        await waitPhase('confirming');
        expect(await session.requestClose(async () => true)).toBe(false);
        session.choose('cancel'); expect(await closing).toBe(false);
    });
    it('卸载取消待确认请求；启动恢复不能覆盖关闭中的会话', async () => {
        const { session, store, edit, waitPhase } = setup(); edit();
        const signal = new AbortController();
        const confirm = vi.fn(async () => true);
        const closing = session.requestClose(confirm, signal.signal);
        await waitPhase('confirming'); signal.abort();
        expect(await closing).toBe(false);
        expect(confirm).not.toHaveBeenCalled();
        expect(store.getState().runtime.projectOperation.phase).toBe('idle');
        const empty = setup(true, true);
        const token = empty.session.captureStartup();
        await empty.session.requestClose(async () => true);
        expect((await empty.session.restoreProject('C:/restore.puzzle.json', token)).status).toBe('cancelled');
    });
    it('等待保存时被卸载或会话被替换，不能批准退出', async () => {
        const { session, store, edit, platform } = setup(); edit();
        const write = deferred<{ success: boolean }>();
        platform.write.mockImplementationOnce(() => write.promise);
        const saving = session.saveProject();
        const confirm = vi.fn(async () => true);
        const closing = session.requestClose(confirm);
        await vi.waitFor(() => expect(platform.write).toHaveBeenCalledTimes(1));
        store.dispatch({ type: 'INIT_SUCCESS', payload: createProjectFixture(), saved: false });
        write.resolve({ success: true }); await saving;
        expect(await closing).toBe(false);
        expect(confirm).not.toHaveBeenCalled();
    });
});

describe('所有导入入口的边界与会话保护', () => {
    it.each(['picker', 'recent', 'string', 'restore'] as const)('%s 入口拒绝结构损坏的 JSON，保留数据、路径、历史和校验结果', async entry => {
        const { store, platform, session, edit } = setup(true, entry === 'restore');
        if (entry !== 'restore') edit('Keep all edits');
        const token = session.captureStartup();
        const before = store.getState();
        const corrupt = JSON.stringify({ fileType: 'puzzle-project', editorVersion: '1.0.0', savedAt: 'today', project: { meta: {}, nodes: [] } });
        platform.read.mockResolvedValue({ success: true, data: corrupt });
        platform.chooseOpen.mockResolvedValue({ path: 'C:/bad.puzzle.json', content: corrupt });
        const result = entry === 'picker' ? await session.openProject()
            : entry === 'recent' ? await session.openProject('C:/bad.puzzle.json')
            : entry === 'restore' ? await session.restoreProject('C:/bad.puzzle.json', token)
            : await session.loadProjectFromString(corrupt, 'C:/bad.puzzle.json');
        expect(result.status).toBe('failed');
        const after = store.getState();
        expect(after.project).toBe(before.project); expect(after.document).toBe(before.document); expect(after.history).toBe(before.history);
        expect(after.runtime.currentProjectPath).toBe(before.runtime.currentProjectPath);
        expect(after.ui.selection).toBe(before.ui.selection); expect(after.ui.validationResults).toBe(before.ui.validationResults); expect(after.ui.isDirty).toBe(before.ui.isDirty);
        expect(platform.activate).not.toHaveBeenCalled(); expect(platform.write).not.toHaveBeenCalled();
        expect(after.ui.messages.at(-1)?.text).toContain('$.project');
    });
    it('有业务错误的项目仍加载，原子提供可导航的问题列表', async () => {
        const { session, store } = setup();
        const project = createProjectFixture(); project.presentationGraphs.graph.startNodeId = null;
        expect((await session.loadProjectFromString(serializeProject(project, undefined, project.meta.updatedAt))).status).toBe('loaded');
        expect(store.getState().ui.showValidationPanel).toBe(true);
        expect(store.getState().ui.validationResults.some(issue => issue.objectId === 'graph' && issue.level === 'error')).toBe(true);
        expect(store.getState().ui.messages.some(message => message.text.includes('validation panel'))).toBe(true);
    });
    it('取消兼容导入时不发布候选诊断，不覆盖旧校验结果', async () => {
        const { session, store, edit, waitPhase } = setup(); edit();
        const before = store.getState();
        const loading = session.loadProjectFromString(JSON.stringify(createProjectFixture()));
        await waitPhase('confirming'); session.choose('cancel');
        expect((await loading).status).toBe('cancelled');
        expect(store.getState().ui.messages).toBe(before.ui.messages);
        expect(store.getState().ui.validationResults).toBe(before.ui.validationResults);
    });
    it('外部资源同步拒绝结构错误，保留本地资源状态及编辑内容', async () => {
        const { session, store, platform, edit } = setup(); edit();
        const before = store.getState();
        const project = createProjectFixture(); project.blackboard.events.event.state = 'InvalidState' as never;
        platform.read.mockResolvedValue({ success: true, data: serializeProject(project, undefined, project.meta.updatedAt) });
        await session.syncExternal(before.runtime.currentProjectPath!);
        expect(store.getState().project).toBe(before.project); expect(store.getState().history).toBe(before.history);
        expect(store.getState().ui.messages.at(-1)?.text).toContain('blackboard.events.event.state');
    });
});

describe('共享保存队列', () => {
    it('自动保存 A 与手动保存 B 重叠时按请求顺序写入，A 完成不会清除 B 的 dirty', async () => {
        const { store, platform, session, edit } = setup();
        const first = deferred<{ success: boolean }>();
        const second = deferred<{ success: boolean }>();
        platform.write.mockImplementationOnce(() => first.promise);
        platform.write.mockImplementationOnce(() => second.promise);
        store.dispatch({ type: 'UPDATE_AUTO_SAVE_SETTINGS', payload: { enabled: true, intervalMinutes: 1 } });
        edit('A'); const savingA = session.autoSave();
        edit('B'); const savingB = session.saveProject();
        await vi.waitFor(() => expect(platform.write).toHaveBeenCalledTimes(1));
        expect(JSON.parse(platform.write.mock.calls[0][1]).project.meta.name).toBe('A');
        first.resolve({ success: true });
        await savingA;
        expect(store.getState().ui.isDirty).toBe(true);
        second.resolve({ success: true });
        await savingB;
        expect(JSON.parse(platform.write.mock.calls[1][1]).project.meta.name).toBe('B');
        expect(store.getState().ui.isDirty).toBe(false);
    });
    it('拒绝异常写入后仍可重试，失败保留保存基线与完整内容', async () => {
        const { store, platform, session, edit } = setup(); edit();
        const before = store.getState();
        platform.write.mockRejectedValueOnce(new Error('Disk unavailable'));
        expect((await session.saveProject()).status).toBe('failed');
        expect(store.getState().project).toBe(before.project);
        expect(store.getState().document).toBe(before.document);
        expect((await session.saveProject()).status).toBe('saved');
        expect(store.getState().ui.isDirty).toBe(false);
    });
    it('项目设置保存完整内存内容，不读取磁盘旧副本', async () => {
        const { store, platform, session } = setup();
        store.dispatch({ type: 'UPDATE_PRESENTATION_GRAPH', payload: { graphId: 'graph', data: { name: 'Unsaved Graph' } } });
        await session.saveProjectSettings({ name: 'Settings' });
        const file = JSON.parse(platform.write.mock.calls[0][1]);
        expect(file.project.meta.name).toBe('Settings');
        expect(file.project.presentationGraphs.graph.name).toBe('Unsaved Graph');
        expect(file.document).toBeUndefined();
        expect(platform.read).not.toHaveBeenCalled();
        expect(store.getState().ui.isDirty).toBe(false);
    });
    it('保存选择器取消保留路径和 dirty；随后成功时原子更新路径和基线', async () => {
        const { store, platform, session, edit } = setup(); edit();
        store.dispatch({ type: 'SET_PROJECT_PATH', payload: null });
        platform.chooseSave.mockResolvedValueOnce(null);
        expect((await session.saveProject()).status).toBe('cancelled');
        expect(store.getState().runtime.currentProjectPath).toBeNull();
        expect(store.getState().ui.isDirty).toBe(true);
        await session.saveProject();
        expect(store.getState().runtime.currentProjectPath).toBe('C:/test/saved.puzzle.json');
        expect(store.getState().ui.isDirty).toBe(false);
        expect(platform.activate).toHaveBeenCalledTimes(1);
    });
    it('无路径的重叠保存只选择一次路径', async () => {
        const { store, platform, session, edit } = setup();
        store.dispatch({ type: 'SET_PROJECT_PATH', payload: null });
        edit('A'); const first = session.saveProject(); edit('B'); const second = session.saveProject();
        await Promise.all([first, second]);
        expect(platform.chooseSave).toHaveBeenCalledTimes(1);
        expect(platform.write.mock.calls.map(call => call[0])).toEqual(['C:/test/saved.puzzle.json', 'C:/test/saved.puzzle.json']);
        expect(store.getState().ui.isDirty).toBe(false);
    });
    it('下载不伪造保存成功，不改变 dirty 或保存时间', async () => {
        const { store, session, platform, edit } = setup(false); edit();
        const before = store.getState();
        expect((await session.saveProject()).status).toBe('downloadInitiated');
        expect(platform.download).toHaveBeenCalledTimes(1);
        expect(store.getState().project).toBe(before.project);
        expect(store.getState().document).toBe(before.document);
        expect(store.getState().ui.isDirty).toBe(true);
    });
    it('持续编辑不延后自动保存周期，自动/手动请求共用队列', async () => {
        vi.useFakeTimers();
        const { store, platform, session, edit } = setup();
        store.dispatch({ type: 'UPDATE_AUTO_SAVE_SETTINGS', payload: { enabled: true, intervalMinutes: 1 } });
        const stop = scheduleAutoSave(session.autoSave, 1);
        for (let index = 1; index <= 6; index++) { edit(`Edit ${index}`); await vi.advanceTimersByTimeAsync(10_000); }
        expect(platform.write).toHaveBeenCalledTimes(1);
        expect(JSON.parse(platform.write.mock.calls[0][1]).project.meta.name).toBe('Edit 6');
        edit('Manual'); await session.saveProject();
        edit('Automatic'); await vi.advanceTimersByTimeAsync(60_000);
        expect(platform.write).toHaveBeenCalledTimes(3);
        expect(JSON.parse(platform.write.mock.calls[2][1]).project.meta.name).toBe('Automatic');
        stop(); edit(); await vi.advanceTimersByTimeAsync(60_000);
        expect(platform.write).toHaveBeenCalledTimes(3);
    });
    it('旧会话保存结果不污染新会话；未开始的旧请求被取消', async () => {
        const { store, platform, session, edit } = setup();
        const deferredWrite = deferred<{ success: boolean }>();
        platform.write.mockImplementationOnce(() => deferredWrite.promise);
        edit(); const first = session.saveProject(); const second = session.saveProject();
        await vi.waitFor(() => expect(platform.write).toHaveBeenCalledTimes(1));
        store.dispatch({ type: 'INIT_SUCCESS', payload: createProjectFixture(), saved: false });
        const document = store.getState().document;
        deferredWrite.resolve({ success: true });
        await first; expect((await second).status).toBe('cancelled');
        expect(store.getState().document).toBe(document);
        expect(platform.write).toHaveBeenCalledTimes(1);
    });
});

describe('候选会话与保存保护', () => {
    it.each(['open', 'recent', 'string', 'new'] as const)('%s 入口取消时完整保留原会话，不更新最近项目', async entry => {
        const { store, platform, session, edit, waitPhase, json } = setup(); edit();
        const before = store.getState();
        const request = entry === 'open' ? session.openProject() : entry === 'recent' ? session.openProject('C:/recent.puzzle.json')
            : entry === 'string' ? session.loadProjectFromString(json) : session.createAndSaveProject('New', '', 'C:/test');
        await waitPhase('confirming'); session.choose('cancel');
        expect((await request).status).toBe('cancelled');
        expect(store.getState().project).toBe(before.project);
        expect(store.getState().history).toBe(before.history);
        expect(store.getState().document).toBe(before.document);
        expect(store.getState().runtime.currentProjectPath).toBe(before.runtime.currentProjectPath);
        expect(platform.activate).not.toHaveBeenCalled(); expect(platform.write).not.toHaveBeenCalled();
    });
    it('候选选择器取消或读取/解析失败，不提前清 dirty、路径或历史', async () => {
        const { store, platform, session, edit } = setup(); edit(); const before = store.getState();
        platform.chooseOpen.mockResolvedValueOnce(null);
        expect((await session.openProject()).status).toBe('cancelled');
        platform.read.mockRejectedValueOnce(new Error('Missing file'));
        expect((await session.openProject('missing')).status).toBe('failed');
        expect((await session.loadProjectFromString('{broken')).status).toBe('failed');
        expect(store.getState().project).toBe(before.project); expect(store.getState().history).toBe(before.history);
        expect(store.getState().ui.isDirty).toBe(true); expect(platform.activate).not.toHaveBeenCalled();
    });
    it('Save & Continue 等待保存成功；失败后原项目保留，可取消', async () => {
        const { store, platform, session, edit, waitPhase } = setup(); edit();
        const result = deferred<{ success: boolean; error?: string }>(); platform.write.mockImplementationOnce(() => result.promise);
        const request = session.openProject(); await waitPhase('confirming'); session.choose('save'); await waitPhase('saving');
        expect(store.getState().project.meta.name).toBe('Edited');
        result.resolve({ success: false, error: 'Disk full' }); await waitPhase('confirming');
        expect(store.getState().runtime.projectOperation.message).toContain('Disk full');
        expect(store.getState().ui.isDirty).toBe(true);
        session.choose('cancel'); expect((await request).status).toBe('cancelled');
    });
    it('保存取消后可重试，只有成功才提交候选', async () => {
        const { store, platform, session, edit, waitPhase } = setup(); edit();
        store.dispatch({ type: 'SET_PROJECT_PATH', payload: null }); platform.chooseSave.mockResolvedValueOnce(null);
        const request = session.openProject(); await waitPhase('confirming'); session.choose('save');
        await vi.waitFor(() => expect(store.getState().runtime.projectOperation.message).toContain('cancelled'));
        expect(store.getState().project.meta.name).toBe('Edited'); session.choose('save');
        expect((await request).status).toBe('loaded'); expect(store.getState().project.meta.name).toBe('Candidate');
    });
    it('保存期间新增修改不能自动继续，Discard 只授权当次替换', async () => {
        const { store, platform, session, edit, waitPhase } = setup(); edit('A');
        const result = deferred<{ success: boolean }>(); platform.write.mockImplementationOnce(() => result.promise);
        const request = session.openProject(); await waitPhase('confirming'); session.choose('save'); await waitPhase('saving');
        edit('B'); result.resolve({ success: true }); await waitPhase('confirming');
        expect(store.getState().project.meta.name).toBe('B'); expect(store.getState().ui.isDirty).toBe(true);
        session.choose('discard'); expect((await request).status).toBe('loaded');
        expect(store.getState().history).toEqual({ past: [], future: [] }); expect(platform.activate).toHaveBeenCalledTimes(1);
    });
    it('浏览器 Download Copy 不继续；Discard 后原子提交新项目且路径为 null', async () => {
        const { store, session, edit, waitPhase } = setup(false); edit();
        const request = session.openProject(); await waitPhase('confirming'); session.choose('save');
        await vi.waitFor(() => expect(store.getState().runtime.projectOperation.message).toContain('Download started'));
        expect(store.getState().project.meta.name).toBe('Edited'); session.choose('discard');
        await request; expect(store.getState().project.meta.name).toBe('Candidate'); expect(store.getState().runtime.currentProjectPath).toBeNull();
    });
    it('新建写入失败保留旧会话；最终提交阶段拒绝旧内容编辑', async () => {
        const { store, platform, session, edit, waitPhase } = setup(); edit(); const before = store.getState();
        const result = deferred<{ success: boolean; error?: string }>(); platform.write.mockImplementationOnce(() => result.promise);
        const request = session.createAndSaveProject('New', '', 'C:/test'); await waitPhase('confirming'); session.choose('discard'); await waitPhase('committing');
        edit('Lost edit'); expect(store.getState().project).toBe(before.project);
        result.resolve({ success: false, error: 'Already exists' }); expect((await request).status).toBe('failed');
        expect(store.getState().project).toBe(before.project); expect(store.getState().history).toBe(before.history);
        expect(store.getState().ui.isDirty).toBe(true); expect(platform.write.mock.calls[0][2]).toEqual({ exclusive: true });
        expect(platform.activate).not.toHaveBeenCalled();
    });
    it('重新打开同一路径先保存再重读，避免载入确认前的旧快照', async () => {
        const { store, platform, session, edit, waitPhase } = setup(); edit('Latest');
        const path = store.getState().runtime.currentProjectPath!;
        platform.write.mockImplementation(async (_, data) => { platform.read.mockResolvedValue({ success: true, data }); return { success: true }; });
        const request = session.openProject(path); await waitPhase('confirming'); session.choose('save'); await request;
        expect(store.getState().project.meta.name).toBe('Latest'); expect(store.getState().ui.isDirty).toBe(false);
    });
    it('加载时一次性恢复 UI，清理失效位置，避免原项目校验残留', async () => {
        const { store, session } = setup();
        const project = createProjectFixture();
        const json = serializeProject(project, { panelSizes: { explorerWidth: 300, inspectorWidth: 320, stagesHeight: 55 }, stageExpanded: { STAGE_1: true },
            currentStageId: 'missing', currentNodeId: null, currentGraphId: 'graph', view: 'BLACKBOARD' }, project.meta.updatedAt);
        await session.loadProjectFromString(json);
        const state = store.getState(); expect(state.ui.currentGraphId).toBe('graph'); expect(state.ui.view).toBe('BLACKBOARD');
        expect(state.ui.currentStageId).toBe(project.stageTree.rootId); expect(state.ui.panelSizes.explorerWidth).toBe(300);
    });
    it('启动读取迟到不能覆盖手动新建表单或已提交项目', async () => {
        const { store, platform, session, json } = setup(true, true);
        const read = deferred<{ success: boolean; data: string }>(); platform.read.mockImplementationOnce(() => read.promise);
        const restoring = session.restoreProject('old', session.captureStartup());
        await vi.waitFor(() => expect(platform.read).toHaveBeenCalledTimes(1));
        session.markUserIntent(); read.resolve({ success: true, data: json });
        expect((await restoring).status).toBe('cancelled'); expect(store.getState().project.isLoaded).toBe(false);
        expect(platform.activate).not.toHaveBeenCalled();
    });
    it('外部同步读取期间切换项目时，旧结果不产生新项目数据或消息', async () => {
        const { store, platform, session, json } = setup();
        const read = deferred<{ success: boolean; data: string }>(); platform.read.mockImplementationOnce(() => read.promise);
        const sync = session.syncExternal(store.getState().runtime.currentProjectPath!);
        await vi.waitFor(() => expect(platform.read).toHaveBeenCalledTimes(1));
        store.dispatch({ type: 'INIT_SUCCESS', payload: createProjectFixture() }); const current = store.getState();
        read.resolve({ success: true, data: json }); await sync;
        expect(store.getState()).toBe(current);
    });
    it('等待保存选择时仍处理原项目的外部同步，取消切换不会遗漏事件', async () => {
        const { store, platform, session, edit, waitPhase, json } = setup(); edit();
        const opening = session.openProject(); await waitPhase('confirming');
        const external = JSON.parse(json); external.project.blackboard.events.event.state = 'MarkedForDelete';
        platform.read.mockResolvedValueOnce({ success: true, data: JSON.stringify(external) });
        await session.syncExternal(store.getState().runtime.currentProjectPath!);
        session.choose('cancel'); await opening;
        expect(store.getState().project.blackboard.events.event.state).toBe('MarkedForDelete');
        expect(store.getState().project.meta.name).toBe('Edited');
    });
});
