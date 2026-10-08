/** GUI 诊断转为机器定位；规则 code 来自产生处，不解析英文消息或展示 ID。 */
import type { CodedValidationResult } from '../../types/validation';
import type { Diagnostic, EntityType } from '../../contracts/automation/schemas';
import type { EntityRecord } from './entities';
import { pointer } from './entities';

const objectTypes: Record<CodedValidationResult['objectType'], EntityType> = {
  STAGE: 'stage',
  NODE: 'puzzle',
  STATE: 'state',
  TRANSITION: 'transition',
  PRESENTATION_GRAPH: 'presentation',
  PRESENTATION_NODE: 'presentation-node',
  SCRIPT: 'script',
  VARIABLE: 'variable',
  EVENT: 'event',
};

export function domainDiagnostics(
  results: CodedValidationResult[],
  entities: EntityRecord[],
): Diagnostic[] {
  return results.map((result) => {
    const type =
      result.fsmId && result.objectType === 'NODE' ? 'fsm' : objectTypes[result.objectType];
    const id = type === 'fsm' ? result.fsmId! : result.objectId;
    const matches = entities.filter(
      (item) =>
        item.ref.type === type &&
        item.ref.id === id &&
        (!result.ownerType ||
          (item.ref.ownerType === result.ownerType && item.ref.ownerId === result.ownerId)) &&
        (!result.fsmId || type === 'fsm' || item.ref.ownerId === result.fsmId),
    );
    const entity = matches.length === 1 ? matches[0] : undefined;
    return {
      code: result.code,
      level: result.level,
      message: result.message,
      entity: entity?.ref,
      path: entity ? entity.path + (result.field ? pointer(result.field) : '') : undefined,
      pathBasis: 'normalized-project',
      location: result.location,
      retryable: false,
    };
  });
}
