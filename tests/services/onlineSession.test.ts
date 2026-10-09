import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setup, id } from './onlineSessionHarness';

describe('C9 在线原子编辑与幂等', () => {
  it('读取未保存 Store、完整 JSON 和 pendingEdits，不读磁盘', async () => {
    const s = setup();
    s.store.dispatch({ type: 'UPDATE_PROJECT_META', payload: { name: 'Human unsaved' } });
    s.edit.pendingEdits = true;
    const result = await s.online.handle({
      operation: 'inspect',
      sessionId: 0,
      query: { view: 'project' },
    });
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      dirty: true,
      pendingEdits: true,
      result: { file: { project: { meta: { name: 'Human unsaved' } } } },
    });
    expect(s.platform.read).not.toHaveBeenCalled();
    expect(s.barrier.flush).not.toHaveBeenCalled();
  });
  it('多命令只有一次通知/历史，GUI Undo/Redo 恢复整个批次并推进 epoch', async () => {
    const s = setup(),
      before = await s.token();
    const request = await s.prepare([
      { op: 'project.update', changes: { name: 'New' } },
      { op: 'stage.update', target: { alias: 'root' }, changes: { name: 'Changed Root' } },
    ]);
    const notices: string[] = [];
    const stop = s.store.subscribe(() => notices.push(s.store.getState().project.meta.name));
    expect((await s.online.handle({ ...request, allowOverwrite: true })).ok).toBe(true);
    stop();
    expect(notices).toEqual(['New']);
    expect(s.store.getState().history.past).toHaveLength(1);
    s.store.dispatch({ type: 'UNDO' });
    const undone = await s.token();
    expect(undone.contentHash).toBe(before.contentHash);
    expect(undone.contentEpoch).toBeGreaterThan(before.contentEpoch);
    s.store.dispatch({ type: 'REDO' });
    expect(s.store.getState().project.meta.name).toBe('New');
  });
  it('no-op 保留 redo、版本、dirty 和权限状态', async () => {
    const s = setup();
    s.store.dispatch({ type: 'UPDATE_PROJECT_META', payload: { name: 'Human' } });
    s.store.dispatch({ type: 'UNDO' });
    const before = s.store.getState(),
      token = await s.token();
    expect((await s.online.handle(await s.prepare([]))).data).toMatchObject({ changed: false });
    expect(s.store.getState().history).toBe(before.history);
    expect(await s.token()).toEqual(token);
    expect(s.session.savePolicy().autoSaveBlocked).toBe(false);
  });
  it('同 ID 并发与迟到重试只提交一次，同 ID 不同内容拒绝', async () => {
    const s = setup(),
      request = await s.prepare();
    const [a, b] = await Promise.all([s.online.handle(request), s.online.handle(request)]);
    expect(a.ok).toBe(true);
    expect(b).toEqual(a);
    expect(s.store.getState().history.past).toHaveLength(1);
    s.store.dispatch({ type: 'UPDATE_PROJECT_META', payload: { description: 'Human later' } });
    expect(await s.online.handle(request)).toEqual(a);
    expect((await s.online.handle({ ...request, allowOverwrite: true })).error?.code).toBe(
      'REQUEST_ID_CONFLICT',
    );
  });
  it('两个不同请求竞争同一个预览，只提交一个', async () => {
    const s = setup(),
      request = await s.prepare();
    const results = await Promise.all([
      s.online.handle(request),
      s.online.handle({ ...request, requestId: id() }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)?.error?.code).toBe('SESSION_CONFLICT');
  });
  it('过期/未来请求、不同会话和伪造操作均拒绝', async () => {
    const s = setup(),
      request = await s.prepare();
    expect(
      (await s.online.handle({ ...request, requestId: `1000000000000:${randomUUID()}` })).error
        ?.code,
    ).toBe('REQUEST_EXPIRED');
    expect(
      (await s.online.handle({ ...request, requestId: `${Date.now() + 60000}:${randomUUID()}` }))
        .error?.code,
    ).toBe('REQUEST_EXPIRED');
    expect((await s.online.handle({ ...request, sessionId: 3 })).error?.code).toBe(
      'SESSION_EXPIRED',
    );
    expect(
      (await s.online.handle({ operation: 'dispatch', action: { type: 'RESET_PROJECT' } })).error
        ?.code,
    ).toBe('INVALID_SESSION_REQUEST');
  });
  it('人工编辑、Undo 回到同内容也不能重用原 token', async () => {
    const s = setup(),
      request = await s.prepare();
    s.store.dispatch({ type: 'UPDATE_PROJECT_META', payload: { description: 'Temp' } });
    s.store.dispatch({ type: 'UNDO' });
    expect((await s.online.handle(request)).error?.code).toBe('SESSION_CONFLICT');
  });
  it('字段先提交，再拒绝旧 token，保留人工内容', async () => {
    const s = setup(),
      request = await s.prepare();
    s.edit.pendingEdits = true;
    s.barrier.flush.mockImplementation(() => {
      s.edit.pendingEdits = false;
      s.store.dispatch({ type: 'UPDATE_PROJECT_META', payload: { name: 'Pending human' } });
    });
    expect((await s.online.handle(request)).error?.code).toBe('SESSION_CONFLICT');
    expect(s.store.getState().project.meta.name).toBe('Pending human');
  });
  it.each(['busy', 'invalid'] as const)('%s 时拒绝且不强制提交草稿', async (field) => {
    const s = setup(),
      request = await s.prepare();
    s.barrier.flush.mockClear();
    s.edit[field] = true;
    expect((await s.online.handle(request)).ok).toBe(false);
    expect(s.barrier.flush).not.toHaveBeenCalled();
  });
  it('只读与项目切换冻结期间拒绝', async () => {
    const s = setup(),
      request = await s.prepare();
    s.store.dispatch({ type: 'SET_READ_ONLY', payload: true });
    expect((await s.online.handle(request)).error?.code).toBe('SESSION_READ_ONLY');
    s.store.dispatch({ type: 'SET_READ_ONLY', payload: false });
    s.store.dispatch({ type: 'SET_PROJECT_OPERATION', payload: { phase: 'preparing' } });
    expect((await s.online.handle({ ...request, requestId: id() })).error?.code).toBe(
      'SESSION_BUSY',
    );
  });
  it('永久删除需要独立授权，通过后清空历史', async () => {
    const s = setup();
    s.store.dispatch({ type: 'UPDATE_PROJECT_META', payload: { description: 'Previous' } });
    const request = await s.prepare([{ op: 'event.purge', target: { id: 'event' } }]);
    expect((await s.online.handle(request)).error?.code).toBe(
      'PERMANENT_DELETE_AUTHORIZATION_REQUIRED',
    );
    expect(
      (await s.online.handle({ ...request, requestId: id(), allowPermanentDelete: true })).ok,
    ).toBe(true);
    expect(s.store.getState().history.past).toHaveLength(0);
    expect(s.store.getState().project.blackboard.events.event).toBeUndefined();
  });
  it('错误候选不会泄漏半个修改', async () => {
    const s = setup(),
      request = await s.prepare();
    request.plan.commands.push({
      op: 'stage.update',
      target: { id: 'missing' },
      changes: { name: 'Broken' },
    });
    expect((await s.online.handle(request)).ok).toBe(false);
    expect(s.store.getState().project.meta.name).toBe('Test Project');
  });
});

describe('C9 保存权限与版本确认', () => {
  it('已排队 silent 保存也检查新的 Agent 限制，不覆盖较新的内存', async () => {
    const s = setup();
    s.store.dispatch({ type: 'UPDATE_PROJECT_META', payload: { description: 'Before queue' } });
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
    await s.online.handle(await s.prepare());
    finish();
    await first;
    expect((await queued).status).toBe('failed');
    expect(s.platform.write).toHaveBeenCalledTimes(1);
    expect(s.store.getState().ui.isDirty).toBe(true);
  });
  it('资源状态外部同步推进 token，保留人工字段并拒绝旧回执', async () => {
    const s = setup(),
      request = await s.prepare();
    const project = structuredClone(s.store.getState().project);
    project.blackboard.events.event.state = 'MarkedForDelete';
    s.store.dispatch({ type: 'SYNC_RESOURCE_STATES', payload: project, sessionId: 0 });
    expect((await s.token()).contentEpoch).toBeGreaterThan(request.receipt.token.contentEpoch);
    expect((await s.online.handle(request)).error?.code).toBe('SESSION_CONFLICT');
    expect(s.store.getState().project.meta.name).toBe('Test Project');
  });
  it('未授权 apply 后自动保存和直接 silent 保存均零写入', async () => {
    const s = setup();
    expect((await s.online.handle(await s.prepare())).ok).toBe(true);
    await s.session.autoSave();
    await s.session.saveProject({ silent: true });
    expect(s.platform.write).not.toHaveBeenCalled();
    expect(s.store.getState().settings.autoSave.enabled).toBe(true);
    expect(s.store.getState().ui.isDirty).toBe(true);
  });
  it('无覆盖声明拒绝保存，不唤起选择器', async () => {
    const s = setup();
    await s.online.handle(await s.prepare());
    const result = await s.online.handle({
      operation: 'save',
      sessionId: 0,
      token: await s.token(),
      requestId: id(),
    });
    expect(result.error?.code).toBe('OVERWRITE_AUTHORIZATION_REQUIRED');
    expect(s.platform.write).not.toHaveBeenCalled();
    expect(s.platform.chooseSave).not.toHaveBeenCalled();
  });
  it('授权覆盖传递磁盘 hash，重复保存复用结果', async () => {
    const s = setup();
    await s.online.handle(await s.prepare());
    const request = {
      operation: 'save',
      sessionId: 0,
      token: await s.token(),
      requestId: id(),
      allowOverwrite: true,
      expectedDiskHash: 'a'.repeat(64),
    };
    const first = await s.online.handle(request);
    expect(first.ok, JSON.stringify(first)).toBe(true);
    expect(await s.online.handle(request)).toEqual(first);
    expect(s.platform.write).toHaveBeenCalledTimes(1);
    expect(s.platform.write.mock.calls[0][2]).toMatchObject({ expectedHash: 'a'.repeat(64) });
    expect(s.store.getState().ui.isDirty).toBe(false);
    expect(s.session.savePolicy().autoSaveBlocked).toBe(false);
    await s.online.handle(
      await s.prepare([{ op: 'project.update', changes: { name: 'Next task' } }]),
    );
    expect(s.session.savePolicy().autoSaveBlocked).toBe(true);
  });
  it('另存使用 exclusive、建立新路径且不需要覆盖声明', async () => {
    const s = setup();
    await s.online.handle(await s.prepare());
    const result = await s.online.handle({
      operation: 'save',
      sessionId: 0,
      token: await s.token(),
      requestId: id(),
      out: 'C:/test/new.puzzle.json',
    });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(s.platform.claim).toHaveBeenCalledWith('C:/test/new.puzzle.json', undefined, true);
    expect(s.platform.write.mock.calls[0][2]).toMatchObject({ exclusive: true });
    expect(s.store.getState().runtime.currentProjectPath).toBe('C:/test/new.puzzle.json');
  });
  it('保存失败仍 dirty，保留内存与限制', async () => {
    const s = setup();
    await s.online.handle(await s.prepare());
    s.platform.write.mockResolvedValue({ success: false, error: 'Disk conflict' });
    const result = await s.online.handle({
      operation: 'save',
      sessionId: 0,
      token: await s.token(),
      requestId: id(),
      allowOverwrite: true,
      expectedDiskHash: 'b'.repeat(64),
    });
    expect(result.error?.code).toBe('SESSION_SAVE_FAILED');
    expect(result.data).toMatchObject({ dirty: true, save: { status: 'failed' } });
    expect(s.store.getState().project.meta.name).toBe('Agent Edited');
    expect(s.session.savePolicy().autoSaveBlocked).toBe(true);
  });
  it('人类保存认可当前内容，撤销后保存不会许可未来 redo 的受限修改', async () => {
    const s = setup();
    await s.online.handle(await s.prepare());
    s.store.dispatch({ type: 'UNDO' });
    await s.session.saveProject();
    s.store.dispatch({ type: 'REDO' });
    expect(s.session.savePolicy().autoSaveBlocked).toBe(true);
    await s.session.saveProject();
    expect(s.session.savePolicy().autoSaveBlocked).toBe(false);
  });
  it('保存过程中出现下一批 Agent 内容，确认旧版本但保留新 dirty 和限制', async () => {
    const s = setup();
    await s.online.handle(await s.prepare());
    let finish!: () => void;
    s.platform.write.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ success: true });
        }),
    );
    const saving = s.session.saveProject();
    await vi.waitFor(() => expect(s.platform.write).toHaveBeenCalled());
    await s.online.handle(await s.prepare([{ op: 'project.update', changes: { name: 'Later' } }]));
    finish();
    await saving;
    expect(s.store.getState().ui.isDirty).toBe(true);
    expect(s.session.savePolicy().autoSaveBlocked).toBe(true);
  });
});
