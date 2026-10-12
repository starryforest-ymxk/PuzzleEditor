import type { UiMessage } from '../types/messages';

/** 同时间保持原追加顺序，与消息面板的稳定排序一致；不修改源数组。 */
export function sortMessages(messages: readonly UiMessage[]): UiMessage[] {
  return [...messages].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}

export function messageCounts(messages: readonly UiMessage[]) {
  const counts = { info: 0, warning: 0, error: 0 };
  for (const message of messages) counts[message.level]++;
  return counts;
}
