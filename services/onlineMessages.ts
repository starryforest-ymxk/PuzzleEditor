/** 只读分页快照，不派发 Action、不提交字段草稿，不从消息原文猜工程归属。 */
import type { UiMessage } from '../types/messages';
import type { MessageQuery } from '../contracts/automation/sessionSchemas';
import { messageCounts, sortMessages } from '../utils/messageStack';
import { AutomationFailure } from './automation/errors';

export const MESSAGE_SNAPSHOT_TTL_MS = 120_000;
export const MESSAGE_SNAPSHOT_CAPACITY = 8;
export const MESSAGE_PAGE_MAX_BYTES = 1024 * 1024;
interface Snapshot {
  id: string;
  sessionId: number;
  generation: number;
  expires: number;
  capturedAt: string;
  level: MessageQuery['level'];
  counts: ReturnType<typeof messageCounts>;
  total: number;
  messages: UiMessage[];
}

export class MessageStackReader {
  private snapshots = new Map<string, Snapshot>();
  constructor(private now = Date.now) {}

  read(messages: readonly UiMessage[], generation: number, sessionId: number, query: MessageQuery) {
    const now = this.now();
    for (const [id, snapshot] of this.snapshots)
      if (
        snapshot.expires <= now ||
        snapshot.generation !== generation ||
        snapshot.sessionId !== sessionId
      )
        this.snapshots.delete(id);
    let snapshot: Snapshot;
    let offset = 0;
    if (query.cursor) {
      const match = /^msg:([0-9a-f-]{36}):(\d+)$/u.exec(query.cursor);
      const found = match ? this.snapshots.get(match[1]) : undefined;
      if (!found)
        throw new AutomationFailure(
          'MESSAGE_CURSOR_EXPIRED',
          'Message cursor is invalid, expired or belongs to another window/session. Query again without --cursor.',
          4,
        );
      offset = Number(match![2]);
      if (!Number.isSafeInteger(offset) || offset >= found.messages.length)
        throw new AutomationFailure(
          'INVALID_MESSAGE_CURSOR',
          'Message cursor offset is outside its snapshot.',
          2,
        );
      if (found.level !== query.level)
        throw new AutomationFailure(
          'MESSAGE_QUERY_CHANGED',
          'Reuse the same --level when paging, or start a new query without --cursor.',
          4,
        );
      snapshot = found;
    } else {
      snapshot = {
        id: crypto.randomUUID(),
        sessionId,
        generation,
        expires: now + MESSAGE_SNAPSHOT_TTL_MS,
        capturedAt: new Date(now).toISOString(),
        level: query.level,
        counts: messageCounts(messages),
        total: messages.length,
        messages: sortMessages(
          messages.filter((message) => query.level === 'all' || message.level === query.level),
        ),
      };
      while (this.snapshots.size >= MESSAGE_SNAPSHOT_CAPACITY)
        this.snapshots.delete(this.snapshots.keys().next().value!);
      this.snapshots.set(snapshot.id, snapshot);
    }
    const page: UiMessage[] = [];
    let size = 2;
    while (offset + page.length < snapshot.messages.length && page.length < query.limit) {
      const message = snapshot.messages[offset + page.length];
      const bytes = new TextEncoder().encode(JSON.stringify(message)).byteLength + 1;
      if (size + bytes > MESSAGE_PAGE_MAX_BYTES) {
        if (!page.length)
          throw new AutomationFailure(
            'MESSAGE_TOO_LARGE',
            'A message exceeds the 1 MiB page budget. Its text was not truncated.',
            4,
            [],
            { messageId: message.id },
          );
        break;
      }
      // 响应脱离 Store 对象，调用方不能通过返回值修改消息。
      page.push({ ...message });
      size += bytes;
    }
    const end = offset + page.length;
    return {
      scope: 'editor-instance' as const,
      projectAssociation: 'not-recorded' as const,
      order: 'timestamp-desc' as const,
      snapshotId: snapshot.id,
      capturedAt: snapshot.capturedAt,
      expiresAt: new Date(snapshot.expires).toISOString(),
      counts: { ...snapshot.counts },
      total: snapshot.total,
      totalMatches: snapshot.messages.length,
      level: snapshot.level,
      messages: page,
      hasMore: end < snapshot.messages.length,
      nextCursor: end < snapshot.messages.length ? `msg:${snapshot.id}:${end}` : null,
    };
  }
}
