import { describe, expect, it, vi } from 'vitest';
import { setup, id } from './onlineSessionHarness';
import { historyTop } from '../../store/documentHistory';
import { describeHistory } from '../../services/onlineHistory';
import { serializeProject, projectUI } from '../../services/projectFiles';
import type { SessionRequest } from '../../contracts/automation/sessionSchemas';

type Harness = ReturnType<typeof setup>;
const human = (s: Harness, name: string) =>
  s.store.dispatch({ type: 'UPDATE_PROJECT_META', payload: { name } });
async function request(s: Harness, direction: 'undo' | 'redo' = 'undo') {
  const token = await s.token();
  return {
    operation: `history.${direction}` as 'history.undo' | 'history.redo',
    token,
    sessionId: token.sessionId,
    requestId: id(),
    entryId:
      historyTop(s.store.getState(), direction === 'undo' ? 'UNDO' : 'REDO')?.operation.entryId ??
      '0:999',
  };
}
async function list(s: Harness) {
  const result = await s.online.handle({
    operation: 'history.list',
    sessionId: s.store.getState().document.sessionId,
  });
  expect(result.ok).toBe(true);
  return result.data as { history: ReturnType<typeof describeHistory>; pendingEdits: boolean };
}

describe('C10 共同历史与严格顶部前提', () => {
  it('人工与 Agent 摘要、稳定条目 ID 共用同一栈，读取不提交字段或写盘', async () => {
    const s = setup();
    human(s, 'Human');
    expect((await s.online.handle(await s.prepare())).ok).toBe(true);
    s.barrier.flush.mockClear();
    s.edit.pendingEdits = true;
    const state = s.store.getState(),
      result = await list(s);
    expect(result.pendingEdits).toBe(true);
    expect(result.history.past.map((e) => e.source)).toEqual(['agent', 'human']);
    expect(result.history.past[0].summary).toContain('project.update');
    expect(result.history.past[0].requiredCapabilities).toEqual([]);
    expect(result.history.limit).toBe(50);
    expect(result.history.past[0]).not.toHaveProperty('content');
    expect(s.store.getState()).toBe(state);
    expect(s.barrier.flush).not.toHaveBeenCalled();
    expect(s.platform.write).not.toHaveBeenCalled();
  });
  it('GUI Undo 后 CLI Redo 恢复同一条目，再 Undo/Redo 保持身份并递增 epoch', async () => {
    const s = setup(),
      initial = await s.token();
    await s.online.handle(await s.prepare());
    const entryId = (await list(s)).history.undoEntryId;
    s.store.dispatch({ type: 'UNDO' });
    expect((await list(s)).history.redoEntryId).toBe(entryId);
    expect((await s.online.handle(await request(s, 'redo'))).ok).toBe(true);
    expect((await list(s)).history.undoEntryId).toBe(entryId);
    expect((await s.online.handle(await request(s))).ok).toBe(true);
    expect((await s.token()).contentHash).toBe(initial.contentHash);
    expect((await s.token()).contentEpoch).toBeGreaterThan(initial.contentEpoch);
    expect((await list(s)).history.redoEntryId).toBe(entryId);
  });
  it('新 token 也不能跳过人工顶部撤销旧 Agent 条目', async () => {
    const s = setup();
    await s.online.handle(await s.prepare());
    const agentId = (await list(s)).history.undoEntryId;
    human(s, 'Human later');
    const before = s.store.getState();
    const result = await s.online.handle({ ...(await request(s)), entryId: agentId });
    expect(result.error?.code).toBe('HISTORY_CONFLICT');
    expect(s.store.getState()).toBe(before);
  });
  it('旧 token 与新人工提交冲突，失败不移动顶部', async () => {
    const s = setup();
    human(s, 'A');
    const r = await request(s);
    human(s, 'B');
    const state = s.store.getState();
    expect((await s.online.handle(r)).error?.code).toBe('SESSION_CONFLICT');
    expect(s.store.getState()).toBe(state);
  });
  it('同 ID 并发和迟到重试只 Undo 一次，同 ID 不同内容拒绝', async () => {
    const s = setup();
    human(s, 'A');
    human(s, 'B');
    const r = await request(s);
    const [a, b] = await Promise.all([s.online.handle(r), s.online.handle(r)]);
    expect(a.ok).toBe(true);
    expect(b).toEqual(a);
    expect(s.store.getState().project.meta.name).toBe('A');
    human(s, 'Later');
    expect(await s.online.handle(r)).toEqual(a);
    expect(s.store.getState().project.meta.name).toBe('Later');
    expect((await s.online.handle({ ...r, allowOverwrite: true })).error?.code).toBe(
      'REQUEST_ID_CONFLICT',
    );
  });
  it('两个 Agent 不同请求竞争同一个顶部，只执行一个', async () => {
    const s = setup();
    human(s, 'A');
    human(s, 'B');
    const r = await request(s);
    const results = await Promise.all([
      s.online.handle(r),
      s.online.handle({ ...r, requestId: id() }),
    ]);
    expect(results.filter((x) => x.ok)).toHaveLength(1);
    expect(s.store.getState().project.meta.name).toBe('A');
    expect(s.store.getState().history.future).toHaveLength(1);
  });
  it.each(['undo', 'redo'] as const)(
    '空 %s 不改变历史、版本、dirty 或保存限制',
    async (direction) => {
      const s = setup(),
        state = s.store.getState(),
        token = await s.token();
      expect((await s.online.handle(await request(s, direction))).error?.code).toBe(
        'HISTORY_EMPTY',
      );
      expect(s.store.getState()).toBe(state);
      expect(await s.token()).toEqual(token);
      expect(s.session.savePolicy().autoSaveBlocked).toBe(false);
    },
  );
  it('50 条截断、分支和 no-op 保持正确；元数据不进入工程 JSON', async () => {
    const s = setup();
    for (let i = 0; i < 60; i++) human(s, `N${i}`);
    const history = (await list(s)).history;
    expect(history.past).toHaveLength(50);
    expect(new Set(history.past.map((x) => x.entryId)).size).toBe(50);
    await s.online.handle(await request(s));
    const future = (await list(s)).history.future;
    human(s, s.store.getState().project.meta.name);
    expect((await list(s)).history.future).toEqual(future);
    human(s, 'New branch');
    expect((await list(s)).history.future).toHaveLength(0);
    const { project, ui } = s.store.getState();
    const serialized = serializeProject(project, projectUI(ui), project.meta.updatedAt);
    for (const key of ['entryId', 'restrictedRevisions', 'requiredCapabilities', 'history'])
      expect(serialized).not.toContain(`"${key}"`);
  });
  it.each(['busy', 'invalid'] as const)('%s 屏障拒绝且不 flush', async (key) => {
    const s = setup();
    human(s, 'A');
    const r = await request(s),
      before = s.store.getState();
    s.edit[key] = true;
    expect((await s.online.handle(r)).error?.code).toBe(
      key === 'busy' ? 'SESSION_BUSY' : 'PENDING_EDITS',
    );
    expect(s.barrier.flush).not.toHaveBeenCalled();
    expect(s.store.getState()).toBe(before);
  });
  it('有效人工草稿先提交，然后拒绝过期历史目标', async () => {
    const s = setup();
    human(s, 'A');
    const r = await request(s);
    s.edit.pendingEdits = true;
    s.barrier.flush.mockImplementation(() => {
      s.edit.pendingEdits = false;
      human(s, 'Draft');
    });
    expect((await s.online.handle(r)).error?.code).toBe('SESSION_CONFLICT');
    expect(s.store.getState().project.meta.name).toBe('Draft');
    expect(s.store.getState().history.future).toHaveLength(0);
  });
  it('只读、操作忙碌及切换会话拒绝旧请求', async () => {
    const s = setup();
    human(s, 'A');
    const r = await request(s);
    s.store.dispatch({ type: 'SET_READ_ONLY', payload: true });
    expect((await s.online.handle(r)).error?.code).toBe('SESSION_READ_ONLY');
    s.store.dispatch({ type: 'SET_READ_ONLY', payload: false });
    s.store.dispatch({ type: 'SET_PROJECT_OPERATION', payload: { phase: 'preparing' } });
    expect((await s.online.handle({ ...r, requestId: id() })).error?.code).toBe('SESSION_BUSY');
    s.store.dispatch({ type: 'SET_PROJECT_OPERATION', payload: { phase: 'idle' } });
    s.store.dispatch({ type: 'INIT_SUCCESS', payload: s.store.getState().project });
    expect((await s.online.handle({ ...r, requestId: id() })).error?.code).toBe('SESSION_EXPIRED');
  });
  it('外部资源同步清空历史并使旧 token 失效', async () => {
    const s = setup();
    human(s, 'A');
    const r = await request(s);
    const project = structuredClone(s.store.getState().project);
    project.blackboard.events.event.state = 'MarkedForDelete';
    s.store.dispatch({ type: 'SYNC_RESOURCE_STATES', payload: project, sessionId: 0 });
    expect((await list(s)).history.past).toEqual([]);
    expect((await s.online.handle(r)).error?.code).toBe('SESSION_CONFLICT');
  });
  it('撤销创建图通过同一协调器清除失效选中和导航', async () => {
    const s = setup();
    s.store.dispatch({
      type: 'ADD_PRESENTATION_GRAPH',
      payload: { graph: { id: 'temp', name: 'Temp', nodes: {}, startNodeId: null } },
    });
    s.store.dispatch({
      type: 'NAVIGATE_TO',
      payload: { graphId: 'temp', selection: { type: 'PRESENTATION_GRAPH', id: 'temp' } },
    });
    expect((await s.online.handle(await request(s))).ok).toBe(true);
    expect(s.store.getState().ui.currentGraphId).toBeNull();
    expect(s.store.getState().ui.selection.type).toBe('NONE');
  });
});

describe('C10 历史权限与自动保存', () => {
  it('保存后 Undo 变 dirty，旧认可不能放行新的历史修改', async () => {
    const s = setup();
    human(s, 'A');
    human(s, 'B');
    await s.session.saveProject();
    const writes = s.platform.write.mock.calls.length;
    expect((await s.online.handle(await request(s))).ok).toBe(true);
    expect(s.store.getState().ui.isDirty).toBe(true);
    expect(s.session.savePolicy().autoSaveBlocked).toBe(true);
    await s.session.autoSave();
    expect(s.platform.write).toHaveBeenCalledTimes(writes);
    await s.session.saveProject();
    const old = s.store.getState().document.restrictedRevisions;
    expect(s.session.savePolicy().autoSaveBlocked).toBe(false);
    expect((await s.online.handle(await request(s, 'redo'))).ok).toBe(true);
    expect(s.session.savePolicy().autoSaveBlocked).toBe(true);
    expect(s.store.getState().document.restrictedRevisions?.at(-1)).not.toBe(old?.at(-1));
  });
  it('本次覆盖声明不新增限制，但不能清除目标先前的受限内容', async () => {
    const s = setup();
    human(s, 'A');
    human(s, 'B');
    expect((await s.online.handle({ ...(await request(s)), allowOverwrite: true })).ok).toBe(true);
    expect(s.session.savePolicy().autoSaveBlocked).toBe(false);
    await s.online.handle(await s.prepare());
    s.store.dispatch({ type: 'UNDO' });
    await s.online.handle({ ...(await request(s, 'redo')), allowOverwrite: true });
    expect(s.session.savePolicy().autoSaveBlocked).toBe(true);
  });
  it('先前排队的 silent 保存遇到未授权 Undo 时停止写入', async () => {
    const s = setup();
    human(s, 'A');
    human(s, 'B');
    let finish!: () => void;
    s.platform.write.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ success: true });
        }),
    );
    const first = s.session.saveProject();
    await vi.waitFor(() => expect(s.platform.write).toHaveBeenCalledTimes(1));
    const queued = s.session.saveProject({ silent: true });
    expect((await s.online.handle(await request(s))).ok).toBe(true);
    finish();
    await first;
    expect((await queued).status).toBe('failed');
    expect(s.platform.write).toHaveBeenCalledTimes(1);
    expect(s.store.getState().ui.isDirty).toBe(true);
  });
  it('实际永久删除需独立声明，成功恢复也形成不可跨越边界', async () => {
    const s = setup();
    human(s, 'Before');
    // 可信内部入口构造已有 Implemented 声明；CLI 不提供任意提升资源状态指令。
    s.store.dispatch({
      type: 'ADD_EVENT',
      payload: {
        event: { id: 'existing', name: 'Existing', assetName: 'Existing', state: 'Implemented' },
      },
    });
    const r = await request(s),
      state = s.store.getState();
    expect((await list(s)).history.past[0].requiredCapabilities).toEqual([
      'permanent_resource_delete',
    ]);
    expect((await s.online.handle(r)).error?.code).toBe('PERMANENT_DELETE_AUTHORIZATION_REQUIRED');
    expect(s.store.getState()).toBe(state);
    expect((await s.online.handle({ ...r, requestId: id(), allowPermanentDelete: true })).ok).toBe(
      true,
    );
    expect(s.store.getState().history).toEqual({ past: [], future: [] });
    expect((await s.online.handle(await request(s, 'redo'))).error?.code).toBe('HISTORY_EMPTY');
  });
  it('Redo 保留原语义能力；普通 Undo 不一律要求最高权限', async () => {
    const s = setup();
    const project = structuredClone(s.store.getState().project);
    project.meta.name = 'Trusted internal';
    s.store.dispatch({
      type: 'COMMIT_AUTOMATION',
      payload: project,
      validationResults: [],
      restrictAutoSave: false,
      history: { summary: 'Trusted semantic record', requiredCapabilities: ['raw_json_write'] },
    });
    expect((await s.online.handle(await request(s))).ok).toBe(true);
    const r = await request(s, 'redo');
    expect((await list(s)).history.future[0].requiredCapabilities).toEqual(['raw_json_write']);
    expect((await s.online.handle(r)).error?.code).toBe('RAW_JSON_AUTHORIZATION_REQUIRED');
    expect(
      (
        await s.online.handle({
          ...r,
          requestId: id(),
          allowRawJsonWrite: true,
        } satisfies SessionRequest)
      ).ok,
    ).toBe(true);
    expect(s.platform.write).not.toHaveBeenCalled();
  });
  it('领域永久删除后不能由 history undo 恢复', async () => {
    const s = setup();
    human(s, 'A');
    const purge = await s.prepare([{ op: 'event.purge', target: { id: 'event' } }]);
    expect((await s.online.handle({ ...purge, allowPermanentDelete: true })).ok).toBe(true);
    expect((await s.online.handle(await request(s))).error?.code).toBe('HISTORY_EMPTY');
    expect(s.store.getState().project.blackboard.events.event).toBeUndefined();
  });
});
