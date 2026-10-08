/** 外部 ID 只能命中字典自身条目，不能把 toString 等原型成员当成资源。 */
export function ownEntry<T>(record: Record<string, T> | undefined, id: string): T | undefined {
  return record && Object.hasOwn(record, id) ? record[id] : undefined;
}
