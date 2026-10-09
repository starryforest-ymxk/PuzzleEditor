/** 纯领域与真实 Store 回归：删除归属、局部资源身份、权限组合和历史边界。 */
import { describe, expect, it } from 'vitest';
import { planSchema, type Plan } from '../../contracts/automation/planSchemas';
import { executePlan } from '../../store/commands/automation/execute';
import { planHierarchyDeletion } from '../../utils/hierarchyDeletion';
import { compareProjectResources } from '../../utils/projectResources';
import { findDeletionReferenceConflicts } from '../../utils/deletionReferences';
import { analyzePermissions, assertCapabilities } from '../../services/automation/permissions';
import { editorReducer } from '../../store/reducer';
import { INITIAL_STATE, type Action } from '../../store/types';
import { validateProject } from '../../utils/validation/validator';
import { deletionProject } from './c6Fixtures';

const plan = (commands: Plan['commands'], scope: Plan['scope'] = { project: true }) =>
  planSchema.parse({ apiVersion: '1.0.0', scope, commands });
const removeRoom: Plan['commands'][number] = {
  op: 'stage.delete',
  target: { id: 'room' },
  cascade: true,
};

describe('C6 层级领域边界', () => {
  it('深层子树、独占 FSM 同批移除，完整保留共享图与全局资源并更新初始项', () => {
    const before = deletionProject(),
      snapshot = structuredClone(before);
    const result = planHierarchyDeletion(before, { type: 'stage', id: 'room', cascade: true });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.stageIds).toEqual(['room', 'deep']);
    expect(result.puzzleIds).toEqual(['door', 'lock']);
    expect(result.fsmIds).toEqual(['door-fsm', 'lock-fsm']);
    expect(result.project.nodes).toEqual({});
    expect(result.project.stateMachines).toEqual({});
    expect(result.project.presentationGraphs).toBe(before.presentationGraphs);
    expect(result.project.blackboard).toBe(before.blackboard);
    expect(result.project.scripts).toBe(before.scripts);
    expect(result.project.stageTree.stages.sibling.isInitial).toBe(true);
    expect(result.project.stageTree.stages.sibling.unlockCondition).toBeUndefined();
    expect(validateProject(result.project).filter((item) => item.level === 'error')).toEqual([]);
    expect(before).toEqual(snapshot);
  });
  it('只删指定 Puzzle 及 FSM，保留同名另一个 Puzzle 和其局部状态 ID', () => {
    const project = deletionProject();
    const result = executePlan(
      project,
      plan([{ op: 'puzzle.delete', target: { id: 'door' } }], { puzzles: [{ id: 'door' }] }),
    );
    expect(result.project.nodes.door).toBeUndefined();
    expect(result.project.stateMachines['door-fsm']).toBeUndefined();
    expect(result.project.nodes.lock).toEqual(project.nodes.lock);
    expect(result.project.stateMachines['lock-fsm']).toEqual(project.stateMachines['lock-fsm']);
    expect(result.project.stageTree).toEqual(project.stageTree);
  });
  it('根节点及未声明的非空级联拒绝', () => {
    const project = deletionProject();
    expect(
      planHierarchyDeletion(project, {
        type: 'stage',
        id: project.stageTree.rootId,
        cascade: true,
      }),
    ).toMatchObject({ ok: false, code: 'ROOT_STAGE_PROTECTED' });
    expect(planHierarchyDeletion(project, { type: 'stage', id: 'room' })).toMatchObject({
      ok: false,
      code: 'CASCADE_REQUIRED',
    });
    const onlyLocal = structuredClone(project);
    onlyLocal.stageTree.stages.sibling.localVariables = structuredClone(
      project.stageTree.stages.room.localVariables,
    );
    expect(planHierarchyDeletion(onlyLocal, { type: 'stage', id: 'sibling' })).toMatchObject({
      ok: false,
      code: 'CASCADE_REQUIRED',
    });
  });
  it('空 Stage 可不声明 cascade', () => {
    expect(planHierarchyDeletion(deletionProject(), { type: 'stage', id: 'sibling' }).ok).toBe(
      true,
    );
  });
  it.each(['stage', 'puzzle'] as const)('%s 删除拒绝范围外 FSM 所有者，并返回确切 ID', (type) => {
    const project = deletionProject();
    project.nodes.lock.stageId = project.stageTree.rootId;
    project.nodes.lock.stateMachineId = 'door-fsm';
    expect(
      planHierarchyDeletion(
        project,
        type === 'stage' ? { type, id: 'room', cascade: true } : { type, id: 'door' },
      ),
    ).toMatchObject({
      ok: false,
      code: 'FSM_SHARED_OUTSIDE_DELETION',
      details: { owners: [{ puzzleId: 'lock', fsmId: 'door-fsm' }] },
    });
  });
  it('同一删除子树内的共享 FSM 只移除一次，原有孤立 FSM 保留', () => {
    const project = deletionProject();
    project.nodes.lock.stateMachineId = 'door-fsm';
    const deletion = planHierarchyDeletion(project, { type: 'stage', id: 'room', cascade: true });
    if (!deletion.ok) throw new Error(deletion.message);
    expect(deletion.fsmIds).toEqual(['door-fsm']);
    expect(deletion.project.stateMachines['lock-fsm']).toEqual(project.stateMachines['lock-fsm']);
  });
  it('不通过删除暗中获得父级或移动进入的 Puzzle 范围', () => {
    const project = deletionProject();
    expect(() => executePlan(project, plan([removeRoom], { stages: [{ id: 'room' }] }))).toThrow(
      'outside the edit scope',
    );
    expect(() =>
      executePlan(
        project,
        plan([{ op: 'puzzle.delete', target: { id: 'lock' } }], { puzzles: [{ id: 'door' }] }),
      ),
    ).toThrow('outside the edit scope');
  });
  it('失败的后续命令不修改输入或留下部分子树', () => {
    const project = deletionProject(),
      before = structuredClone(project);
    expect(() =>
      executePlan(
        project,
        plan([
          removeRoom,
          { op: 'puzzle.update', target: { id: 'lock' }, changes: { name: 'Missing' } },
        ]),
      ),
    ).toThrow();
    expect(project).toEqual(before);
  });
  it('坏树/重复链接有界拒绝，不递归挂死或扩大删除范围', () => {
    const project = deletionProject();
    project.stageTree.stages.deep.childrenIds = ['room'];
    expect(
      planHierarchyDeletion(project, { type: 'stage', id: 'room', cascade: true }),
    ).toMatchObject({ ok: false, code: 'STAGE_STRUCTURE_INVALID' });
  });
});

describe('C6 生命周期、引用和权限', () => {
  it.each(['Implemented', 'MarkedForDelete'] as const)(
    '同 ID 的局部资源按 owner 识别 %s 删除',
    (state) => {
      const before = deletionProject(state),
        after = executePlan(before, plan([removeRoom])).project;
      const requirements = analyzePermissions(before, after);
      expect(requirements.requiredCapabilities).toEqual(['permanent_resource_delete']);
      expect(requirements.permanentDeletions.map((item) => item.entity.ownerId).sort()).toEqual([
        'deep',
        'door',
        'room',
      ]);
      expect(() =>
        assertCapabilities(requirements.requiredCapabilities, { allowRawJsonWrite: true }),
      ).toThrow('permanent_resource_delete');
      expect(() =>
        assertCapabilities(requirements.requiredCapabilities, { allowPermanentDelete: true }),
      ).not.toThrow();
      expect(after.stageTree.stages[before.stageTree.rootId].localVariables.shared).toEqual(
        before.stageTree.stages[before.stageTree.rootId].localVariables.shared,
      );
    },
  );
  it('Draft 删除普通授权即可；三项最高能力组合独立核对', () => {
    const before = deletionProject(),
      after = executePlan(before, plan([removeRoom])).project;
    expect(analyzePermissions(before, after).requiredCapabilities).toEqual([]);
    const all = analyzePermissions(before, after, {
      rawJsonWrite: true,
      overwriteProject: true,
      explicitPermanentDelete: true,
    });
    expect(all.requiredCapabilities).toEqual([
      'raw_json_write',
      'overwrite_project',
      'permanent_resource_delete',
    ]);
    expect(() =>
      assertCapabilities(all.requiredCapabilities, {
        allowRawJsonWrite: true,
        allowPermanentDelete: true,
      }),
    ).toThrow('overwrite_project');
    expect(() =>
      assertCapabilities(all.requiredCapabilities, {
        allowRawJsonWrite: true,
        allowPermanentDelete: true,
        allowOverwrite: true,
      }),
    ).not.toThrow();
  });
  it('明确变量搬移保持身份，无歧义迁移不升永久删除权限', () => {
    const before = deletionProject('Implemented');
    const after = executePlan(
      before,
      plan([
        {
          op: 'variable.move',
          target: { id: 'shared' },
          owner: { type: 'puzzle', ref: { id: 'door' } },
          destination: { type: 'puzzle', ref: { id: 'lock' } },
        },
      ]),
    ).project;
    expect(compareProjectResources(before, after).permanent).toEqual([]);
  });
  it('多个同 ID 的未匹配变量不能假装成一次搬移', () => {
    const before = deletionProject('Implemented'),
      after = structuredClone(before);
    delete after.stageTree.stages.room.localVariables.shared;
    delete after.stageTree.stages.deep.localVariables.shared;
    after.nodes.lock.localVariables.shared = {
      ...before.stageTree.stages.room.localVariables.shared,
      scope: 'NodeLocal',
    };
    expect(
      compareProjectResources(before, after).permanent.map((item) => item.ref.ownerId),
    ).toEqual(['room', 'deep']);
  });
  it('删除不能使保留引用悄悄改绑同 ID 祖先变量', () => {
    const before = deletionProject();
    before.nodes.door.eventListeners = [
      {
        eventId: 'open',
        action: {
          type: 'ModifyParameter',
          modifiers: [
            {
              targetVariableId: 'shared',
              targetScope: 'StageLocal',
              operation: 'Set',
              source: { type: 'Constant', value: 1 },
            },
          ],
        },
      },
    ];
    const after = structuredClone(before);
    delete after.stageTree.stages.room.localVariables.shared;
    expect(validateProject(after).filter((item) => item.level === 'error')).toEqual([]);
    expect(findDeletionReferenceConflicts(before, after)).toMatchObject([
      { entity: { type: 'variable', id: 'shared', ownerId: 'room' } },
    ]);
    after.nodes.door.eventListeners = [];
    expect(findDeletionReferenceConflicts(before, after)).toEqual([]);
  });
});

describe('C6 同一 Store 历史与 GUI 内容等价', () => {
  const actions: Action[] = [
    { type: 'DELETE_STAGE', payload: { stageId: 'room' } },
    { type: 'DELETE_PUZZLE_NODE', payload: { nodeId: 'door' } },
  ];
  it.each(actions)('普通 $type 可 Undo/Redo，状态/导航失效引用得到清理', (action) => {
    const project = deletionProject();
    let state = editorReducer(INITIAL_STATE, { type: 'INIT_SUCCESS', payload: project });
    state = {
      ...state,
      ui: {
        ...state.ui,
        currentStageId: 'room',
        currentNodeId: 'door',
        selection: { type: 'STATE', id: 'idle', contextId: 'door' },
        multiSelectStateIds: ['idle'],
        navStack: [{ stageId: 'room', nodeId: 'door', graphId: null }],
      },
    };
    const deleted = editorReducer(state, action);
    expect(deleted.ui.selection.type).toBe('NONE');
    expect(deleted.ui.currentNodeId).toBeNull();
    expect(deleted.ui.multiSelectStateIds).toEqual([]);
    expect(deleted.ui.navStack).toEqual([]);
    expect(deleted.history.past).toHaveLength(1);
    const undone = editorReducer(deleted, { type: 'UNDO' });
    expect(undone.project).toEqual(state.project);
    expect(editorReducer(undone, { type: 'REDO' }).project).toEqual(deleted.project);
    const command: Plan['commands'][number] =
      action.type === 'DELETE_STAGE' ? removeRoom : { op: 'puzzle.delete', target: { id: 'door' } };
    const { isLoaded: _loaded, ...content } = deleted.project;
    expect(content).toEqual(executePlan(project, plan([command])).project);
  });
  it.each(['Implemented', 'MarkedForDelete'] as const)(
    '%s 级联永久删除清理 past/future，之后普通编辑仍可撤销',
    (resourceState) => {
      let state = editorReducer(INITIAL_STATE, {
        type: 'INIT_SUCCESS',
        payload: deletionProject(resourceState),
      });
      state = editorReducer(state, { type: 'UPDATE_PROJECT_META', payload: { name: 'First' } });
      state = editorReducer(state, { type: 'UPDATE_PROJECT_META', payload: { name: 'Second' } });
      state = editorReducer(state, { type: 'UNDO' });
      expect(state.history.past).toHaveLength(1);
      expect(state.history.future).toHaveLength(1);
      const deleted = editorReducer(state, actions[0]);
      expect(deleted.history).toEqual({ past: [], future: [] });
      expect(editorReducer(deleted, { type: 'UNDO' })).toBe(deleted);
      expect(editorReducer(deleted, { type: 'REDO' })).toBe(deleted);
      const edited = editorReducer(deleted, {
        type: 'UPDATE_PROJECT_META',
        payload: { name: 'After deletion' },
      });
      expect(editorReducer(edited, { type: 'UNDO' }).project).toEqual(deleted.project);
    },
  );
  it('整体 UPDATE_NODE 移除保护变量同样触发边界，不能仅检测删除 Action', () => {
    const state = editorReducer(INITIAL_STATE, {
      type: 'INIT_SUCCESS',
      payload: deletionProject('Implemented'),
    });
    const updated = editorReducer(state, {
      type: 'UPDATE_NODE',
      payload: { nodeId: 'door', data: { localVariables: {} } },
    });
    expect(updated.history).toEqual({ past: [], future: [] });
    expect(editorReducer(updated, { type: 'UNDO' })).toBe(updated);
  });
  it('readOnly 和外部共享 FSM 都拒绝 GUI 删除且不产生历史', () => {
    const project = deletionProject();
    project.nodes.lock.stageId = project.stageTree.rootId;
    project.nodes.lock.stateMachineId = 'door-fsm';
    const state = editorReducer(INITIAL_STATE, { type: 'INIT_SUCCESS', payload: project });
    expect(editorReducer(state, actions[0])).toBe(state);
    const readOnly = { ...state, ui: { ...state.ui, readOnly: true } };
    expect(editorReducer(readOnly, actions[1])).toBe(readOnly);
  });
});
