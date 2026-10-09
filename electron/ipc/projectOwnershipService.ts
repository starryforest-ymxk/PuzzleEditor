/** 桌面会话先持有候选，再提交/转移；任何失败均保留原活动工程的所有权。 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import {
  ProjectLease,
  ProjectFileError,
  ownershipSupported,
  pathKey,
  projectPath,
  readProjectSnapshot,
  sameIdentity,
  digest,
} from '../../dist-node/projectOwnership.js';
import { readFileSnapshot, writeUtf8File } from '../../dist-node/files.js';

interface Claim {
  token: string;
  path: string | null;
  lease?: ProjectLease;
}
interface Owner {
  active?: Claim;
  pending?: Claim;
}
export class DesktopProjectOwnership {
  private owners = new Map<number, Owner>();
  private queue: Promise<unknown> = Promise.resolve();
  private run<T>(action: () => Promise<T>): Promise<T> {
    const result = this.queue.then(action);
    this.queue = result.catch(() => undefined);
    return result;
  }
  private state(owner: number): Owner {
    let state = this.owners.get(owner);
    if (!state) {
      state = {};
      this.owners.set(owner, state);
    }
    return state;
  }
  claim(
    owner: number,
    input: string | null,
    expectedContent?: string,
    create = false,
  ): Promise<string> {
    return this.run(async () => {
      const state = this.state(owner);
      if (state.pending)
        throw new ProjectFileError('PROJECT_BUSY', 'A project activation is already pending.');
      const canonical = input ? await projectPath(input) : null;
      let lease: ProjectLease | undefined;
      try {
        if (canonical && ownershipSupported) {
          lease =
            state.active?.lease && pathKey(state.active.lease.path) === pathKey(canonical)
              ? state.active.lease
              : await ProjectLease.acquire(input!, 'desktop');
          await lease.assertPath(input!);
        }
        if (canonical) {
          if (create) {
            const existing = await fs.lstat(canonical).catch((error) => {
              if (error.code === 'ENOENT') return null;
              throw error;
            });
            if (existing)
              throw Object.assign(new Error('The project already exists.'), { code: 'EEXIST' });
          } else if (expectedContent !== undefined) {
            const snapshot = await readFileSnapshot(input!);
            if (expectedContent !== undefined && snapshot.sha256 !== digest(expectedContent))
              throw new ProjectFileError(
                'REVISION_CONFLICT',
                'The project changed after it was read. Open it again.',
              );
          }
        }
        const token = randomUUID();
        state.pending = { token, path: input, lease };
        return token;
      } catch (error) {
        if (lease && lease !== state.active?.lease) await lease.release();
        throw error;
      }
    });
  }
  activate(owner: number, input: string | null, token: string): Promise<void> {
    return this.run(async () => {
      const state = this.state(owner),
        pending = state.pending;
      if (!pending || pending.token !== token || pending.path !== input)
        throw new ProjectFileError(
          'CLAIM_REQUIRED',
          'Activate the exact project candidate that was claimed.',
        );
      // claim 已完成所有可能失败的磁盘检查；转移不再次读取，避免 renderer 提交后才失败。
      const old = state.active;
      state.active = pending;
      state.pending = undefined;
      if (old?.lease && old.lease !== pending.lease) await old.lease.release();
    });
  }
  abandon(owner: number, token: string): Promise<void> {
    return this.run(async () => {
      const state = this.owners.get(owner),
        pending = state?.pending;
      if (!state || pending?.token !== token) return;
      state.pending = undefined;
      if (pending.lease && pending.lease !== state.active?.lease) await pending.lease.release();
    });
  }
  release(owner: number): Promise<void> {
    return this.run(async () => {
      const state = this.owners.get(owner);
      this.owners.delete(owner);
      for (const lease of new Set([state?.active?.lease, state?.pending?.lease]))
        await lease?.release();
    });
  }
  write(
    owner: number,
    input: string,
    content: string,
    options?: { exclusive?: boolean; expectedHash?: string },
    reuse = true,
  ): Promise<void> {
    return this.run(async () => {
      if (!ownershipSupported) {
        await writeUtf8File(input, content, options);
        return;
      }
      const canonical = await projectPath(input),
        state = this.state(owner);
      const held = reuse
        ? [state.active?.lease, state.pending?.lease].find(
            (lease) => lease && pathKey(lease.path) === pathKey(canonical),
          )
        : undefined;
      const lease =
        held ?? (await ProjectLease.acquire(input, reuse ? 'desktop-write' : 'desktop-export'));
      try {
        const before = await readProjectSnapshot(input).catch((error) => {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
            return undefined;
          throw error;
        });
        if (options?.expectedHash && before?.sha256 !== options.expectedHash)
          throw new ProjectFileError(
            'DISK_CONFLICT',
            'The disk project differs from expectedDiskHash. No write was performed.',
          );
        await writeUtf8File(canonical, content, {
          ...options,
          beforePublish: async (temporary) => {
            await lease.holdFile(temporary);
            await lease.assertPath(input);
            if (before) {
              const latest = await readProjectSnapshot(input);
              if (
                latest.sha256 !== before.sha256 ||
                !sameIdentity(latest.identity, before.identity)
              )
                throw new ProjectFileError(
                  'REVISION_CONFLICT',
                  'The project changed while saving. Retry after reviewing the current file.',
                );
            }
          },
        });
        await lease.replaced();
      } finally {
        if (!held) await lease.release();
      }
    });
  }
}
export const desktopProjectOwnership = new DesktopProjectOwnership();
