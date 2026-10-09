/** 领域计划与备用整文件共用错误基线，不让相同位置的新错误被旧错误掩盖。 */
import type { ProjectData } from '../../types/project';
import type { CodedValidationResult } from '../../types/validation';
import { validateProject } from '../../utils/validation/validator';
import { indexEntities } from './entities';
import { domainDiagnostics } from './diagnostics';
import { AutomationFailure } from './errors';
import { fullDiff } from './projectDiff';
import { findDeletionReferenceConflicts } from '../../utils/deletionReferences';

function baselineKey(item: CodedValidationResult) {
  // 同一位置的规则 ID 可能没有包含失效目标；连同诊断详情比较，禁止用另一错误替换旧错误。
  // message 仅作为完整字符串比较，不从英文文案解析实体或错误码。
  return JSON.stringify([
    item.code,
    item.objectType,
    item.objectId,
    item.contextId,
    item.fsmId,
    item.graphId,
    item.ownerType,
    item.ownerId,
    item.field,
    item.id,
    item.message,
  ]);
}
export function validateCandidate(
  source: ProjectData,
  finalProject: ProjectData,
  creating = false,
) {
  const before = creating ? [] : validateProject(source),
    after = validateProject(finalProject);
  const counts = new Map<string, number>();
  for (const item of before.filter((r) => r.level === 'error'))
    counts.set(baselineKey(item), (counts.get(baselineKey(item)) ?? 0) + 1);
  const sourceEntities = indexEntities(source),
    targetEntities = indexEntities(finalProject);
  const added = after.filter((item) => {
    if (item.level !== 'error') return false;
    const key = baselineKey(item),
      count = counts.get(key) ?? 0;
    counts.set(key, count - 1);
    if (count <= 0) return true;
    if (item.field === 'assetName') {
      const target = domainDiagnostics([item], targetEntities)[0].entity;
      if (target) {
        const same = (ref: typeof target) => JSON.stringify(ref) === JSON.stringify(target);
        return (
          sourceEntities.find((e) => same(e.ref))?.assetName !==
          targetEntities.find((e) => same(e.ref))?.assetName
        );
      }
    }
    return false;
  });
  const diagnostics = domainDiagnostics(after, targetEntities);
  if (added.length)
    throw new AutomationFailure(
      'CANDIDATE_VALIDATION_FAILED',
      'The candidate introduces errors. No project file was written.',
      3,
      diagnostics,
      {
        newErrors: domainDiagnostics(added, targetEntities),
        changes: fullDiff(source, finalProject),
      },
    );
  const deletionConflicts = findDeletionReferenceConflicts(source, finalProject);
  if (deletionConflicts.length)
    throw new AutomationFailure(
      'DELETION_REFERENCES_REMAIN',
      'Explicitly fix references to removed resources in the same plan; deletion cannot silently rebind a local variable.',
      3,
      diagnostics,
      { deletionConflicts },
    );
  return { diagnostics, remainingErrors: after.filter((item) => item.level === 'error').length };
}
