import { describe, expect, it } from 'vitest';
import { editorReducer } from '../../store/reducer';
import type { Action, EditorState } from '../../store/types';
import { createEditorFixture, createProjectFixture, saveAcknowledgement } from '../fixtures/editor';

const rename = (state: EditorState, name: string) => editorReducer(state, { type: 'UPDATE_PROJECT_META', payload: { name } });

describe('保存版本与编辑分支', () => {
    it('保存期间继续修改，只确认实际写入版本', () => {
        const versionA = rename(createEditorFixture(), 'A');
        const acknowledgement = saveAcknowledgement(versionA);
        const versionB = rename(versionA, 'B');
        const savedA = editorReducer(versionB, { type: 'PROJECT_SAVE_SUCCEEDED', payload: acknowledgement });
        expect(savedA.project.meta.name).toBe('B');
        expect(savedA.ui.isDirty).toBe(true);
        const undone = editorReducer(savedA, { type: 'UNDO' });
        expect(undone.project.meta.name).toBe('A');
        expect(undone.ui.isDirty).toBe(false);
        expect(undone.project.meta.updatedAt).toBe(acknowledgement.savedAt);
        expect(editorReducer(undone, { type: 'REDO' }).ui.isDirty).toBe(true);
    });

    it('撤销后创建新分支不复用已保存版本，也不留下 redo', () => {
        const versionA = rename(createEditorFixture(), 'A');
        const saved = editorReducer(versionA, { type: 'PROJECT_SAVE_SUCCEEDED', payload: saveAcknowledgement(versionA) });
        const undone = editorReducer(saved, { type: 'UNDO' });
        const branched = rename(undone, 'Branch');
        expect(branched.document.revision).toBeGreaterThan(saved.document.revision);
        expect(branched.ui.isDirty).toBe(true);
        expect(branched.history.future).toHaveLength(0);
    });

    it('同值操作保留 redo 和当前保存状态', () => {
        const undone = editorReducer(rename(createEditorFixture(), 'A'), { type: 'UNDO' });
        expect(rename(undone, undone.project.meta.name)).toBe(undone);
        expect(editorReducer(undone, { type: 'REDO' }).project.meta.name).toBe('A');
    });

    it.each<Action>([
        { type: 'INIT_SUCCESS', payload: createProjectFixture() },
        { type: 'RESET_PROJECT' }
    ])('切换或重置后忽略旧保存确认：$type', action => {
        const original = rename(createEditorFixture(), 'A');
        const next = editorReducer(original, action);
        expect(next.document.sessionId).toBeGreaterThan(original.document.sessionId);
        expect(next.history).toEqual({ past: [], future: [] });
        expect(next.ui.isDirty).toBe(false);
        expect(editorReducer(next, { type: 'PROJECT_SAVE_SUCCEEDED', payload: saveAcknowledgement(original) })).toBe(next);
    });

    it('同会话更改路径后忽略旧路径保存结果', () => {
        const original = rename(createEditorFixture(), 'A');
        const next = editorReducer(original, { type: 'SET_PROJECT_PATH', payload: 'different.puzzle.json' });
        expect(editorReducer(next, { type: 'PROJECT_SAVE_SUCCEEDED', payload: saveAcknowledgement(original) })).toBe(next);
    });

    it('新建未落盘项目没有保存基线，撤销回初始内容仍 dirty', () => {
        const initial = editorReducer(createEditorFixture(), { type: 'INIT_SUCCESS', payload: createProjectFixture(), saved: false });
        expect(initial.document.savedRevision).toBeNull();
        expect(initial.runtime.isNewUnsavedProject).toBe(true);
        expect(editorReducer(rename(initial, 'A'), { type: 'UNDO' }).ui.isDirty).toBe(true);
    });

    it('只保留最近 50 次编辑，反复 Undo/Redo 不超过限制', () => {
        let state = createEditorFixture();
        for (let index = 1; index <= 60; index++) state = rename(state, `Name ${index}`);
        expect(state.history.past).toHaveLength(50);
        for (let index = 0; index < 50; index++) state = editorReducer(state, { type: 'UNDO' });
        expect(state.project.meta.name).toBe('Name 10');
        expect(editorReducer(state, { type: 'UNDO' })).toBe(state);
        for (let index = 0; index < 50; index++) state = editorReducer(state, { type: 'REDO' });
        expect(state.project.meta.name).toBe('Name 60');
        expect(state.history.past).toHaveLength(50);
    });
});

describe('UI、系统同步与内容操作的边界', () => {
    it('撤销创建当前图会清除失效选择、导航和多选', () => {
        let state = editorReducer(createEditorFixture(), { type: 'ADD_PRESENTATION_GRAPH', payload: { graph: { id: 'new', name: 'New', startNodeId: null, nodes: {} } } });
        state = editorReducer(state, { type: 'NAVIGATE_TO', payload: { graphId: 'new', selection: { type: 'PRESENTATION_GRAPH', id: 'new' } } });
        state.ui.navStack.push({ stageId: null, nodeId: null, graphId: 'new' });
        state.ui.multiSelectPresentationNodeIds = ['deleted'];
        const undone = editorReducer(state, { type: 'UNDO' });
        expect(undone.ui.selection).toEqual({ type: 'NONE', id: null });
        expect(undone.ui.currentGraphId).toBeNull();
        expect(undone.ui.multiSelectPresentationNodeIds).toEqual([]);
        expect(undone.ui.navStack.every(context => context.graphId !== 'new')).toBe(true);
    });

    it('有效的图选择和导航在 Undo/Redo 中保留', () => {
        let state = editorReducer(createEditorFixture(), { type: 'NAVIGATE_TO', payload: { graphId: 'graph', selection: { type: 'PRESENTATION_NODE', id: 'first', contextId: 'graph' } } });
        const selected = state.ui.selection;
        state = rename(state, 'Edited');
        const undone = editorReducer(state, { type: 'UNDO' });
        expect(undone.ui.selection).toBe(selected);
        expect(undone.ui.currentGraphId).toBe('graph');
    });

    it.each<Action>([
        { type: 'NAVIGATE_TO', payload: { graphId: 'graph' } },
        { type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_GRAPH', id: 'graph' } },
        { type: 'SET_MULTI_SELECT_PRESENTATION_NODES', payload: ['first'] },
        { type: 'SET_PANEL_SIZES', payload: { explorerWidth: 350 } },
        { type: 'SET_STAGE_EXPANDED', payload: { id: 'STAGE_1', expanded: false } },
        { type: 'SET_VALIDATION_RESULTS', payload: [] },
        { type: 'ADD_MESSAGE', payload: { id: 'msg', text: 'Test', level: 'info', timestamp: '2026-10-07T00:00:00.000Z' } }
    ])('只读允许 $type，且不改变内容与保存状态', action => {
        const state = createEditorFixture();
        state.ui.readOnly = true;
        const next = editorReducer(state, action);
        expect(next.project).toBe(state.project);
        expect(next.document).toBe(state.document);
        expect(next.history).toBe(state.history);
        expect(next.ui.isDirty).toBe(false);
    });

    it('内容拖拽与排序可撤销，禁止只读操作', () => {
        const actions: Action[] = [
            { type: 'UPDATE_PRESENTATION_NODE', payload: { graphId: 'graph', nodeId: 'first', data: { position: { x: 25, y: 30 } } } },
            { type: 'REORDER_PRESENTATION_GRAPHS', payload: { orderedIds: ['graph'] } }
        ];
        for (const action of actions) {
            const state = createEditorFixture();
            const next = editorReducer(state, action);
            expect(next.ui.isDirty).toBe(true);
            expect(editorReducer(next, { type: 'UNDO' }).project).toEqual(state.project);
            const locked = { ...state, ui: { ...state.ui, readOnly: true } };
            expect(editorReducer(locked, action)).toBe(locked);
        }
    });

    it('外部同步保留用户字段并形成历史边界，无变化同步不清理历史', () => {
        const original = rename(createEditorFixture(), 'User edit');
        const external = createProjectFixture();
        expect(editorReducer(original, { type: 'SYNC_RESOURCE_STATES', payload: external, sessionId: original.document.sessionId })).toBe(original);
        external.blackboard.events.event.state = 'MarkedForDelete';
        const synced = editorReducer(original, { type: 'SYNC_RESOURCE_STATES', payload: external, sessionId: original.document.sessionId });
        expect(synced.project.meta.name).toBe('User edit');
        expect(synced.project.blackboard.events.event.state).toBe('MarkedForDelete');
        expect(synced.ui.isDirty).toBe(true);
        expect(synced.history).toEqual({ past: [], future: [] });
        expect(editorReducer(synced, { type: 'UNDO' })).toBe(synced);
    });

    it('旧会话外部同步被拒绝；当前只读会话仍允许受控同步', () => {
        const state = editorReducer(createEditorFixture(), { type: 'INIT_SUCCESS', payload: createProjectFixture() });
        state.ui.readOnly = true;
        const external = createProjectFixture();
        external.blackboard.events.event.state = 'MarkedForDelete';
        expect(editorReducer(state, { type: 'SYNC_RESOURCE_STATES', payload: external, sessionId: state.document.sessionId - 1 })).toBe(state);
        expect(editorReducer(state, { type: 'SYNC_RESOURCE_STATES', payload: external, sessionId: state.document.sessionId }).project.blackboard.events.event.state).toBe('MarkedForDelete');
    });

    it('边属性同值/无方向/不存在的边都不产生新版本', () => {
        const edited = editorReducer(createEditorFixture(), { type: 'UPDATE_EDGE_PROPERTIES', payload: { graphId: 'graph', fromNodeId: 'first', toNodeId: 'second', fromSide: 'bottom' } });
        const actions: Action[] = [
            { type: 'UPDATE_EDGE_PROPERTIES', payload: { graphId: 'graph', fromNodeId: 'first', toNodeId: 'second', fromSide: 'bottom' } },
            { type: 'UPDATE_EDGE_PROPERTIES', payload: { graphId: 'graph', fromNodeId: 'first', toNodeId: 'second' } },
            { type: 'UPDATE_EDGE_PROPERTIES', payload: { graphId: 'graph', fromNodeId: 'second', toNodeId: 'first', toSide: 'top' } }
        ];
        for (const action of actions) expect(editorReducer(edited, action)).toBe(edited);
    });
});
