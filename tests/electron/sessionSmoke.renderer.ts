import { createEditorStore } from '../../store/editorStore';
import { ProjectSession } from '../../services/projectSession';
import { projectPlatform } from '../../services/projectPlatform';
import { normalizeForExport } from '../../utils/exportNormalizer';

// 测试页仅调用真实 preload/IPC 与会话 API，不接触用户窗口或用户项目。
declare global { interface Window { smokeHarness: { directory: string; report(result: unknown): void; writeExternal(path: string, content: string): Promise<void> } } }
const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
async function until(check: () => boolean) {
    const deadline = Date.now() + 5000;
    while (!check()) {
        if (Date.now() >= deadline) throw new Error('Timed out waiting for file synchronization');
        await new Promise(resolve => setTimeout(resolve, 25));
    }
}

async function run() {
    const store = createEditorStore();
    const session = new ProjectSession(store, projectPlatform);
    let externalEvents = 0;
    const unsubscribe = window.electronAPI!.onProjectFileChanged(event => {
        if (event.type === 'change') { externalEvents++; void session.syncExternal(event.path); }
    });
    const path = `${window.smokeHarness.directory}/IPC Verification.puzzle.json`;
    assert((await session.createAndSaveProject('IPC Verification', '', window.smokeHarness.directory)).status === 'loaded', 'Create failed');
    store.dispatch({ type: 'ADD_PRESENTATION_GRAPH', payload: { graph: { id: 'graph', name: 'Saved Graph', startNodeId: null, nodes: {} } } });
    assert((await session.saveProject()).status === 'saved', 'Save failed');
    assert(!store.getState().ui.isDirty, 'Save did not acknowledge revision');
    assert((await session.openProject(path)).status === 'loaded', 'Reopen failed');
    assert(store.getState().project.presentationGraphs.graph?.name === 'Saved Graph', 'Saved graph missing after reopen');
    store.dispatch({ type: 'UPDATE_PRESENTATION_GRAPH', payload: { graphId: 'graph', data: { name: 'Unsaved Graph' } } });
    assert((await session.saveProjectSettings({ description: 'Settings and complete graph saved together' })).status === 'saved', 'Settings save failed');
    assert((await session.openProject(path)).status === 'loaded', 'Second reopen failed');
    assert(store.getState().project.presentationGraphs.graph.name === 'Unsaved Graph', 'Settings overwrote current content');
    const before = store.getState().project;
    assert((await session.createAndSaveProject('IPC Verification', '', window.smokeHarness.directory)).status === 'failed', 'Exclusive create unexpectedly replaced existing file');
    assert(store.getState().project === before, 'Create failure replaced session');
    assert((await session.openProject(path)).status === 'loaded', 'Original file damaged by failed create');
    store.dispatch({ type: 'ADD_EVENT', payload: { event: { id: 'watched', name: 'Watched Event', state: 'Draft' } } });
    await session.saveProject();
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert(externalEvents === 0, 'Internal writes leaked through watcher');
    const disk = await window.electronAPI!.readProject(path);
    assert(disk.success && !!disk.data, 'Read for external fixture failed');
    const otherPath = `${window.smokeHarness.directory}/other.puzzle.json`;
    await window.smokeHarness.writeExternal(otherPath, disk.data!);
    store.dispatch({ type: 'UPDATE_PRESENTATION_GRAPH', payload: { graphId: 'graph', data: { name: 'Keep Local Edit' } } });
    const openOther = session.openProject(otherPath);
    await until(() => store.getState().runtime.projectOperation.phase === 'confirming');
    session.choose('cancel');
    assert((await openOther).status === 'cancelled', 'Candidate cancel failed');
    const external = JSON.parse(disk.data!);
    external.project.blackboard.events.watched.state = 'Implemented';
    await window.smokeHarness.writeExternal(path, JSON.stringify(external, null, 2));
    await until(() => store.getState().project.blackboard.events.watched.state === 'Implemented').catch(error => {
        throw new Error(`${String(error)}; events=${externalEvents}; messages=${JSON.stringify(store.getState().ui.messages)}`);
    });
    assert(store.getState().project.presentationGraphs.graph.name === 'Keep Local Edit', 'External sync replaced user content');
    assert(externalEvents === 1, 'External watcher emitted unexpected events');
    unsubscribe();

    // 实际磁盘中的错误结构必须在提交会话前拒绝，连同未保存内容和路径一起保留。
    const invalidPath = `${window.smokeHarness.directory}/Invalid Structure.puzzle.json`;
    const invalid = structuredClone(external); invalid.project.nodes = [];
    assert((await window.electronAPI!.writeProject(invalidPath, JSON.stringify(invalid))).success, 'Could not write invalid fixture');
    const protectedState = store.getState();
    assert((await session.openProject(invalidPath)).status === 'failed', 'Invalid structure unexpectedly opened');
    assert(store.getState().project === protectedState.project && store.getState().history === protectedState.history
        && store.getState().runtime.currentProjectPath === path && store.getState().ui.isDirty, 'Invalid import changed current session');

    // 选择器只提供隔离目标路径；导入/另存/重开均调用真实 preload、IPC 和文件服务。
    const sourcePath = `${window.smokeHarness.directory}/Runtime Source.export.json`;
    const copyPath = `${window.smokeHarness.directory}/Imported Copy.puzzle.json`;
    const bundle = { fileType: 'puzzle-export', manifestVersion: '1.0.0', exportedAt: external.savedAt,
        projectName: 'Runtime Copy', projectVersion: 'custom-version', data: normalizeForExport(external.project) };
    const sourceContent = JSON.stringify(bundle);
    assert((await window.electronAPI!.writeProject(sourcePath, sourceContent)).success, 'Could not write runtime fixture');
    const importedStore = createEditorStore();
    const importedSession = new ProjectSession(importedStore, { ...projectPlatform, chooseSave: async () => copyPath });
    assert((await importedSession.openProject(sourcePath)).status === 'loaded', 'Runtime import failed');
    assert(importedStore.getState().runtime.currentProjectPath === null && importedStore.getState().ui.isDirty, 'Runtime import inherited source save target');
    assert((await importedSession.saveProject()).status === 'saved', 'Imported copy save failed');
    assert((await importedSession.openProject(copyPath)).status === 'loaded', 'Imported copy reopen failed');
    assert(JSON.stringify(normalizeForExport(importedStore.getState().project)) === JSON.stringify(bundle.data), 'Runtime round trip changed business data');
    assert((await window.electronAPI!.readProject(sourcePath)).data === sourceContent, 'Runtime source was overwritten');
    window.smokeHarness.report({ success: true, path, graphName: store.getState().project.presentationGraphs.graph.name,
        checks: ['create', 'edit/save', 'reopen', 'complete settings save', 'exclusive-create failure preserves current session and disk',
            'internal write echo filtered', 'cancelled candidate does not change watched path', 'external resource sync preserves local edits',
            'invalid import preserves document/history/path', 'runtime import requires a separate project save', 'runtime copy round trip preserves data and source file'] });
}
run().catch(error => window.smokeHarness.report({ success: false, error: String(error), stack: error instanceof Error ? error.stack : undefined }));
