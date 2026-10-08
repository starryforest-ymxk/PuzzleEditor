import { describe, expect, it } from 'vitest';
import { editorReducer } from '../../store/reducer';
import type { Action, EditorState } from '../../store/types';
import type { ResourceState } from '../../types/common';
import { createEditorFixture } from '../fixtures/editor';

interface ResourceCase {
    name: string;
    remove: Action;
    target: (state: EditorState) => { state: ResourceState } | undefined;
}

const resources: ResourceCase[] = [
    { name: '事件', remove: { type: 'APPLY_DELETE_EVENT', payload: { id: 'event' } }, target: s => s.project.blackboard.events.event },
    { name: '脚本', remove: { type: 'APPLY_DELETE_SCRIPT', payload: { id: 'script' } }, target: s => s.project.scripts.scripts.script },
    { name: '全局变量', remove: { type: 'APPLY_DELETE_GLOBAL_VARIABLE', payload: { id: 'variable' } }, target: s => s.project.blackboard.globalVariables.variable },
    { name: 'Stage 变量', remove: { type: 'APPLY_DELETE_STAGE_VARIABLE', payload: { stageId: 'STAGE_1', varId: 'variable' } }, target: s => s.project.stageTree.stages.STAGE_1.localVariables.variable },
    { name: 'Node 变量', remove: { type: 'DELETE_NODE_PARAM', payload: { nodeId: 'node', varId: 'variable' } }, target: s => s.project.nodes.node.localVariables.variable }
];

function fixture(resourceState: ResourceState): EditorState {
    const state = createEditorFixture();
    const variable = { id: 'variable', name: 'Variable', state: resourceState, type: 'integer' as const, scope: 'Global' as const, value: 0 };
    state.project.blackboard.events.event.state = resourceState;
    state.project.blackboard.globalVariables.variable = variable;
    state.project.scripts.scripts.script = { id: 'script', name: 'Script', state: resourceState, category: 'Performance' };
    state.project.stageTree.stages.STAGE_1.localVariables.variable = { ...variable, scope: 'StageLocal' };
    state.project.nodes.node = { id: 'node', name: 'Node', stageId: 'STAGE_1', stateMachineId: 'fsm', eventListeners: [], localVariables: { variable: { ...variable, scope: 'NodeLocal' } } };
    return state;
}

describe('资源删除历史语义', () => {
    it.each(resources)('Draft $name 删除可以撤销', resource => {
        const initial = fixture('Draft');
        const removed = editorReducer(initial, resource.remove);
        expect(resource.target(removed)).toBeUndefined();
        expect(removed.history.past).toHaveLength(1);
        expect(editorReducer(removed, { type: 'UNDO' }).project).toEqual(initial.project);
    });

    it.each(resources)('MarkedForDelete $name 永久删除形成历史边界', resource => {
        let initial = editorReducer(fixture('MarkedForDelete'), { type: 'UPDATE_PROJECT_META', payload: { name: 'Before deletion' } });
        initial = editorReducer(initial, { type: 'UNDO' });
        expect(initial.history.future).toHaveLength(1);
        const removed = editorReducer(initial, resource.remove);
        expect(resource.target(removed)).toBeUndefined();
        expect(removed.history).toEqual({ past: [], future: [] });
        expect(removed.ui.isDirty).toBe(true);
        expect(editorReducer(removed, { type: 'UNDO' })).toBe(removed);
        expect(editorReducer(removed, { type: 'REDO' })).toBe(removed);
    });

    it.each<Action>([
        { type: 'SOFT_DELETE_EVENT', payload: { id: 'event' } },
        { type: 'SOFT_DELETE_SCRIPT', payload: { id: 'script' } },
        { type: 'SOFT_DELETE_GLOBAL_VARIABLE', payload: { id: 'variable' } },
        { type: 'SOFT_DELETE_STAGE_VARIABLE', payload: { stageId: 'STAGE_1', varId: 'variable' } },
        { type: 'DELETE_NODE_PARAM', payload: { nodeId: 'node', varId: 'variable' } }
    ])('Implemented 软删除 $type 可以撤销', action => {
        const initial = fixture('Implemented');
        const marked = editorReducer(initial, action);
        expect(marked.history.past).toHaveLength(1);
        expect(editorReducer(marked, { type: 'UNDO' }).project).toEqual(initial.project);
    });

    it('复原脚本可撤销，派生清单跟随项目内容更新', () => {
        const marked = fixture('MarkedForDelete');
        const restored = editorReducer(marked, { type: 'UPDATE_SCRIPT', payload: { id: 'script', data: { state: 'Implemented' } } });
        expect(restored.manifest.scripts[0].state).toBe('Implemented');
        const undone = editorReducer(restored, { type: 'UNDO' });
        expect(undone.project.scripts.scripts.script.state).toBe('MarkedForDelete');
        expect(undone.manifest.scripts[0].state).toBe('MarkedForDelete');
    });

    it('同一个状态和 Action 可重复计算，不修改输入对象', () => {
        const initial = fixture('MarkedForDelete');
        const snapshot = structuredClone(initial);
        const action: Action = { type: 'DELETE_NODE_PARAM', payload: { nodeId: 'node', varId: 'variable' } };
        expect(editorReducer(initial, action)).toEqual(editorReducer(initial, action));
        expect(initial).toEqual(snapshot);
    });
});
