/** 整文件差异不能绕过命名和资源生命周期；局部身份始终带所属对象。 */
import type { ProjectData } from '../../types/project';
import type { ResourceState } from '../../types/common';
import { assetNameSchema } from '../../contracts/automation/primitives';
import { canTransitionResourceStateFromAutomation } from '../../utils/resourceLifecycle';
import { indexEntities, isNamedAsset, type EntityRecord } from './entities';
import { compareProjectResources } from '../../utils/projectResources';
import { AutomationFailure } from './errors';

const identity = (entry: EntityRecord) => JSON.stringify(entry.ref);
const resource = (entry: EntityRecord) => ['variable', 'event', 'script'].includes(entry.ref.type);
function reject(code: string, message: string, entry: EntityRecord, field?: string): never {
  const path = '/project' + entry.path + (field ? '/' + field : '');
  throw new AutomationFailure(code, message, 3, [
    {
      code,
      message,
      level: 'error',
      path,
      pathBasis: 'source',
      entity: entry.ref,
      retryable: false,
    },
  ]);
}

export function assertRawPolicy(before: ProjectData, after: ProjectData) {
  const old = new Map(indexEntities(before).map((entry) => [identity(entry), entry]));
  const next = indexEntities(after);
  const resourceMatches = new Map(
    compareProjectResources(before, after).retained.map((entry) => [
      JSON.stringify(entry.after.ref),
      entry.before.value,
    ]),
  );
  for (const entry of next) {
    const previous = resource(entry)
      ? resourceMatches.get(identity(entry))
      : old.get(identity(entry));
    if (isNamedAsset(entry) && (!previous || previous.assetName !== entry.assetName)) {
      if (!assetNameSchema.safeParse(entry.assetName).success)
        reject(
          'ASSET_NAME_REQUIRED_OR_INVALID',
          'New or changed assetName must be supplied explicitly and satisfy the naming contract.',
          entry,
          'assetName',
        );
    }
    if (!resource(entry)) continue;
    if (!previous && entry.state !== 'Draft')
      reject('INVALID_RESOURCE_TRANSITION', 'New resources must start in Draft.', entry, 'state');
    if (
      previous &&
      !canTransitionResourceStateFromAutomation(
        previous.state as ResourceState,
        entry.state as ResourceState,
      )
    )
      reject(
        'INVALID_RESOURCE_TRANSITION',
        'Automation cannot claim implementation or reset an implemented resource to Draft.',
        entry,
        'state',
      );
  }
}
