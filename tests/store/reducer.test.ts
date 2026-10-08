import { describe, expect, it } from 'vitest';
import { editorReducer } from '../../store/reducer';
import type { Action } from '../../store/types';
import { createEditorFixture, saveAcknowledgement } from '../fixtures/editor';

describe('项目内容、历史和未保存标记', () => {
    const graphOperations: Action[] = [
        { type: 'ADD_PRESENTATION_GRAPH', payload: { graph: { id: 'new', name: 'New', startNodeId: null, nodes: {} } } },
        { type: 'UPDATE_PRESENTATION_GRAPH', payload: { graphId: 'graph', data: { name: 'Renamed' } } },
        { type: 'DELETE_PRESENTATION_GRAPH', payload: { graphId: 'graph' } },
        { type: 'UPDATE_EDGE_PROPERTIES', payload: { graphId: 'graph', fromNodeId: 'first', toNodeId: 'second', fromSide: 'bottom' } }
    ];

    it.each(graphOperations)('$type 能撤销并标记未保存', action => {
        const initial = createEditorFixture();
        const edited = editorReducer(initial, action);
        expect(edited.project).not.toEqual(initial.project);
        expect(edited.ui.isDirty).toBe(true);
        expect(edited.history.past).toHaveLength(1);
        expect(editorReducer(edited, { type: 'UNDO' }).project).toEqual(initial.project);
        expect(editorReducer(editorReducer(edited, { type: 'UNDO' }), { type: 'REDO' }).project).toEqual(edited.project);
    });

    it.each(graphOperations)('只读拒绝 $type', action => {
        const initial = createEditorFixture();
        initial.ui.readOnly = true;
        expect(editorReducer(initial, action)).toBe(initial);
    });

    it('保存后撤销是未保存，重做回保存版本为 clean', () => {
        const initial = createEditorFixture();
        const edited = editorReducer(initial, { type: 'UPDATE_PROJECT_META', payload: { name: 'Edited' } });
        const saved = editorReducer(edited, { type: 'PROJECT_SAVE_SUCCEEDED', payload: saveAcknowledgement(edited) });
        const undone = editorReducer(saved, { type: 'UNDO' });
        expect(undone.ui.isDirty).toBe(true);
        expect(editorReducer(undone, { type: 'REDO' }).ui.isDirty).toBe(false);
    });

    it('只读拒绝已有历史的撤销与重做', () => {
        const edited = editorReducer(createEditorFixture(), { type: 'UPDATE_PROJECT_META', payload: { name: 'Edited' } });
        const readOnly = editorReducer(edited, { type: 'SET_READ_ONLY', payload: true });
        expect(editorReducer(readOnly, { type: 'UNDO' })).toBe(readOnly);
        const undone = editorReducer(edited, { type: 'UNDO' });
        const lockedUndo = editorReducer(undone, { type: 'SET_READ_ONLY', payload: true });
        expect(editorReducer(lockedUndo, { type: 'REDO' })).toBe(lockedUndo);
    });

    it.each<Action>([
        { type: 'UPDATE_PRESENTATION_GRAPH', payload: { graphId: 'graph', data: { name: 'Graph' } } },
        { type: 'DELETE_PRESENTATION_GRAPH', payload: { graphId: 'missing' } },
        { type: 'UPDATE_PROJECT_META', payload: { name: 'Test Project' } },
        { type: 'UPDATE_EVENT', payload: { id: 'event', data: { name: 'Event' } } }
    ])('无变化的 $type 不产生历史', action => {
        const initial = createEditorFixture();
        const result = editorReducer(initial, action);
        expect(result.project).toEqual(initial.project);
        expect(result.history.past).toHaveLength(0);
        expect(result.ui.isDirty).toBe(false);
    });

    it('确认永久删除后，旧历史不能复活该资源', () => {
        let state = editorReducer(createEditorFixture(), { type: 'UPDATE_PROJECT_META', payload: { name: 'Edited' } });
        state = editorReducer(state, { type: 'SOFT_DELETE_EVENT', payload: { id: 'event' } });
        state = editorReducer(state, { type: 'APPLY_DELETE_EVENT', payload: { id: 'event' } });
        expect(state.history.past).toHaveLength(0);
        expect(state.history.future).toHaveLength(0);
        expect(state.ui.isDirty).toBe(true);
        expect(editorReducer(state, { type: 'UNDO' }).project.blackboard.events.event).toBeUndefined();
    });
});
