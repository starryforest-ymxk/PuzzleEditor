import { expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createEditorStore } from '../../store/editorStore';
import { ProjectSession } from '../../services/projectSession';
import { OnlineSession } from '../../services/onlineSession';
import type { EditBarrierState } from '../../services/editBarrier';
import type { ProjectPlatform } from '../../services/projectPlatform';
import { createEditorFixture } from '../fixtures/editor';
import {
  sessionReceiptSchema,
  sessionTokenSchema,
} from '../../contracts/automation/sessionSchemas';
import type { Plan, Operation } from '../../contracts/automation/planSchemas';
import { API_VERSION } from '../../contracts/automation/primitives';

export const id = () => `${Date.now()}:${randomUUID()}`;
export function setup() {
  const initial = createEditorFixture();
  initial.runtime.currentProjectPath = 'C:/test/current.puzzle.json';
  initial.settings.autoSave.enabled = true;
  const store = createEditorStore(initial);
  const platform = {
    isDesktop: () => true,
    chooseOpen: vi.fn(async () => null),
    read: vi.fn(async () => ({ success: false })),
    chooseSave: vi.fn(async () => null),
    write: vi.fn<ProjectPlatform['write']>(async () => ({ success: true })),
    chooseExport: vi.fn(async () => null),
    exportFile: vi.fn(async () => ({ success: true })),
    activate: vi.fn(async () => ({ success: true })),
    download: vi.fn(),
    claim: vi.fn(async () => ({ success: true, data: 'claim' })),
    releaseClaim: vi.fn(async () => ({ success: true })),
  } satisfies ProjectPlatform;
  const session = new ProjectSession(store, platform);
  const edit: EditBarrierState = { pendingEdits: false, invalid: false, busy: false };
  const barrier = {
    status: () => edit,
    flush: vi.fn(() => {
      edit.pendingEdits = false;
    }),
  };
  const online = new OnlineSession(store, session, barrier, randomUUID());
  const token = async () => {
    const result = await online.handle({
      operation: 'status',
      sessionId: store.getState().document.sessionId,
    });
    return sessionTokenSchema.parse((result.data as { token: unknown }).token);
  };
  const prepare = async (
    commands: Operation[] = [{ op: 'project.update', changes: { name: 'Agent Edited' } }],
  ) => {
    const expected = await token();
    const plan: Plan = {
      apiVersion: API_VERSION,
      sourceHash: expected.contentHash,
      scope: { project: true },
      commands,
    };
    const preview = await online.handle({
      operation: 'preview',
      sessionId: expected.sessionId,
      token: expected,
      plan,
    });
    expect(preview.ok, JSON.stringify(preview)).toBe(true);
    const receipt = sessionReceiptSchema.parse((preview.data as { receipt: unknown }).receipt);
    return {
      operation: 'apply' as const,
      sessionId: expected.sessionId,
      requestId: id(),
      plan,
      receipt,
    };
  };
  return { store, session, platform, online, barrier, edit, token, prepare };
}
