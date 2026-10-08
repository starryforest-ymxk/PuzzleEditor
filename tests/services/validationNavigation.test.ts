import { describe, expect, it } from 'vitest';
import { validationNavigation } from '../../store/navigation/validationNavigation';
import { createEditorStore } from '../../store/editorStore';
import { createEditorFixture } from '../fixtures/editor';
import type { ValidationResult } from '../../types/validation';

function setup() {
    const state = createEditorFixture();
    state.project.nodes.node = { id: 'node', name: 'Node', stageId: state.project.stageTree.rootId, stateMachineId: 'fsm', localVariables: {}, eventListeners: [] };
    state.project.stateMachines.fsm = { id: 'fsm', initialStateId: null, states: { state: { id: 'state', name: 'State', position: { x: 0, y: 0 }, eventListeners: [] } }, transitions: {
        transition: { id: 'transition', name: 'Transition', fromStateId: 'state', toStateId: 'state', priority: 0, triggers: [], parameterModifiers: [] }
    } };
    return createEditorStore(state);
}
describe('导入后的校验修复导航', () => {
    it.each(['node', 'fsm'])('状态/连线的 %s 上下文解析为真实 Node 归属', contextId => {
        for (const [type, id] of [['STATE', 'state'], ['TRANSITION', 'transition']] as const) {
            const store = setup();
            validationNavigation(store.getState().project, { objectType: type, objectId: id, contextId } as ValidationResult).forEach(store.dispatch);
            expect(store.getState().ui.currentNodeId).toBe('node');
            expect(store.getState().ui.currentStageId).toBe(store.getState().project.stageTree.rootId);
            expect(store.getState().ui.selection).toEqual({ type, id, contextId: 'node' });
        }
    });
    it('从其他图跳转 Node 时清除旧图并选择节点', () => {
        const store = setup(); store.dispatch({ type: 'NAVIGATE_TO', payload: { graphId: 'graph' } });
        validationNavigation(store.getState().project, { objectType: 'NODE', objectId: 'node' } as ValidationResult).forEach(store.dispatch);
        expect(store.getState().ui.currentGraphId).toBeNull();
        expect(store.getState().ui.selection).toEqual({ type: 'NODE', id: 'node' });
    });
    it('未绑定 FSM 的诊断定位到 FSM Inspector', () => {
        const store = setup(); delete store.getState().project.nodes.node;
        validationNavigation(store.getState().project, { objectType: 'NODE', objectId: 'fsm', contextId: 'fsm' } as ValidationResult).forEach(store.dispatch);
        expect(store.getState().ui.selection).toEqual({ type: 'FSM', id: 'fsm' });
        expect(store.getState().ui.view).toBe('BLACKBOARD');
    });
    it('黑板诊断切换正确页签并清除筛选，能看到待删除资源', () => {
        const store = setup(); store.dispatch({ type: 'SET_BLACKBOARD_VIEW', payload: { filter: 'hidden', stateFilter: 'Draft' } });
        validationNavigation(store.getState().project, { objectType: 'EVENT', objectId: 'event' } as ValidationResult).forEach(store.dispatch);
        expect(store.getState().ui.blackboardView).toMatchObject({ activeTab: 'Events', filter: '', stateFilter: 'ALL' });
        expect(store.getState().ui.selection).toEqual({ type: 'EVENT', id: 'event' });
    });
    it('已删除对象的旧诊断不会导航到不存在的位置', () => {
        const store = setup();
        expect(validationNavigation(store.getState().project, { objectType: 'NODE', objectId: 'removed' } as ValidationResult)).toEqual([]);
        expect(validationNavigation(store.getState().project, {
            objectType: 'PRESENTATION_NODE', objectId: 'removed', contextId: 'graph'
        } as ValidationResult)).toEqual([]);
    });
});
