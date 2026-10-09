/** 共同权限检查根据实际资源差异计算；声明不验证聊天，预览也不授予能力。 */
import type { ProjectData } from '../../types/project';
import { compareProjectResources } from '../../utils/projectResources';
import {
  capabilityDefinitions,
  type CapabilityDeclarations,
  type RequiredCapability,
} from '../../contracts/automation/permissions';
import { AutomationFailure } from './errors';

export function analyzePermissions(
  before: ProjectData,
  after: ProjectData,
  intent: {
    rawJsonWrite?: boolean;
    overwriteProject?: boolean;
    explicitPermanentDelete?: boolean;
  } = {},
) {
  const permanentDeletions = compareProjectResources(before, after).permanent.map((entry) => ({
    entity: entry.ref,
    path: '/project' + entry.path,
    name: entry.value.name,
    state: entry.value.state,
  }));
  const requiredCapabilities: RequiredCapability[] = [];
  if (intent.rawJsonWrite) requiredCapabilities.push('raw_json_write');
  if (intent.overwriteProject) requiredCapabilities.push('overwrite_project');
  if (intent.explicitPermanentDelete || permanentDeletions.length)
    requiredCapabilities.push('permanent_resource_delete');
  return { requiredCapabilities, permanentDeletions };
}
export function assertCapabilities(
  requiredCapabilities: RequiredCapability[],
  declarations: CapabilityDeclarations,
  permanentDeletions: object[] = [],
) {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !declarations[capabilityDefinitions[capability].declaration],
  );
  if (!missingCapabilities.length) return;
  const first = capabilityDefinitions[missingCapabilities[0]];
  throw new AutomationFailure(
    first.errorCode,
    `Obtain explicit user authorization in the agent chat for ${missingCapabilities.join(', ')}, then supply ${missingCapabilities.map((c) => capabilityDefinitions[c].flag).join(' and ')} within that scope.`,
    6,
    [],
    {
      requiredCapabilities,
      missingCapabilities,
      permanentDeletions,
      authorizationMode: 'agent-chat',
      cliVerifiesChatAuthorization: false,
    },
  );
}
