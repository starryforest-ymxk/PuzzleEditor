/** 命名映射只操作已经导入的命名资产，不通过 JSON Pointer/任意属性访问修改其他数据。 */
import type { ProjectData } from '../../types/project';
import type { ImportEntity, ImportNames } from '../../contracts/automation/importSchemas';
import { indexEntities, isNamedAsset, type EntityRecord } from './entities';
import { AutomationFailure } from './errors';

function namedEntities(project: ProjectData) {
  return indexEntities(project).filter(isNamedAsset);
}
const identity = (entity: EntityRecord['ref'] | ImportEntity) =>
  JSON.stringify([
    entity.type,
    entity.id,
    'ownerType' in entity ? (entity.ownerType ?? null) : null,
    'ownerType' in entity && entity.ownerType !== 'project' && 'ownerId' in entity
      ? (entity.ownerId ?? null)
      : null,
  ]);

export function applyImportNames(project: ProjectData, mapping?: ImportNames) {
  const candidate = structuredClone(project);
  const entries = new Map(namedEntities(candidate).map((entry) => [identity(entry.ref), entry]));
  const seen = new Set<string>();
  const nameChanges = (mapping?.entries ?? []).map(({ entity, assetName }) => {
    const key = identity(entity);
    if (seen.has(key))
      throw new AutomationFailure(
        'DUPLICATE_NAME_MAPPING',
        'Each asset identity may appear only once in a name mapping.',
        2,
        [],
        { entity },
      );
    seen.add(key);
    const entry = entries.get(key);
    if (!entry)
      throw new AutomationFailure(
        'NAME_TARGET_NOT_FOUND',
        'No named asset matches this exact identity and owner.',
        3,
        [],
        { entity },
      );
    const before = entry.assetName;
    // entry 已由 type/owner 白名单与真实实体索引确认；仅写已命名资产的 assetName。
    (entry.value as { assetName?: string }).assetName = assetName;
    return { entity, path: '/project' + entry.path + '/assetName', before, after: assetName };
  });
  const missingAssetNames = namedEntities(candidate)
    .filter((entry) => !entry.assetName?.trim())
    .map((entry) => ({
      entity:
        entry.ref.ownerType === 'project'
          ? { type: entry.ref.type, id: entry.ref.id, ownerType: 'project' as const }
          : entry.ref,
      path: '/project' + entry.path + '/assetName',
      name: entry.name,
      requiredForConversion: false,
    }));
  return { project: candidate, nameChanges, missingAssetNames };
}
