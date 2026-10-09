/** C7 虚构转换夹具：共享图、状态机、所有命名域、受保护状态和 0/false。 */
import { presentationProject } from './c4Fixtures';
import { cliFile, FIXED_TIME } from './fixtures';
import { normalizeForExport } from '../../utils/exportNormalizer';
import type { ProjectData } from '../../types/project';
import type { ProjectSourceFormat } from '../../utils/projectImport';

export function conversionProject() {
  const project = presentationProject();
  project.meta.name = 'C7 Conversion Regression';
  project.scripts.scripts.effect.state = 'Implemented';
  project.blackboard.events.open.state = 'Implemented';
  project.nodes.door.localVariables.shared = {
    id: 'shared',
    name: 'Node Key',
    assetName: 'NodeKey',
    type: 'integer',
    value: 0,
    scope: 'NodeLocal',
    state: 'MarkedForDelete',
  };
  return project;
}
export function conversionInput(
  format: ProjectSourceFormat,
  project: ProjectData = conversionProject(),
): string {
  if (format === 'project') return cliFile(project);
  if (format === 'raw') return JSON.stringify(project);
  if (format === 'legacy-manifest')
    return JSON.stringify({ manifestVersion: '1.0.0', exportedAt: FIXED_TIME, project });
  return JSON.stringify({
    fileType: 'puzzle-export',
    manifestVersion: '1.0.0',
    exportedAt: FIXED_TIME,
    projectName: project.meta.name,
    projectVersion: project.meta.version,
    data: normalizeForExport(project),
  });
}
