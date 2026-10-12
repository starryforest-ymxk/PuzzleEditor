/** 窗口消息契约独立于 Store 和工程格式，供 GUI 与只读查询共用。 */
export type MessageLevel = 'info' | 'warning' | 'error';
export interface UiMessage {
  id: string;
  level: MessageLevel;
  text: string;
  timestamp: string;
}
