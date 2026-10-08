/** GUI 与无界面工具共用的纯导出准备；不访问平台、Store 或时钟。 */
import type { ExportBundle, ProjectData } from '../types/project';
import { validateProject } from '../utils/validation/validator';
import { normalizeForExport } from '../utils/exportNormalizer';

export function prepareRuntimeExport(project: ProjectData, exportedAt: string) {
  const diagnostics = validateProject(project);
  let suggestedFileName =
    project.meta.exportFileName || `${project.meta.name || 'project'}.export.json`;
  if (!suggestedFileName.toLowerCase().endsWith('.json')) {
    if (!suggestedFileName.toLowerCase().endsWith('.export')) suggestedFileName += '.export';
    suggestedFileName += '.json';
  }
  if (diagnostics.some((item) => item.level === 'error')) {
    return { ok: false as const, diagnostics, suggestedFileName, bundle: null, content: null };
  }
  const bundle: ExportBundle = {
    fileType: 'puzzle-export',
    manifestVersion: '1.0.0',
    exportedAt,
    projectName: project.meta.name,
    projectVersion: project.meta.version,
    data: normalizeForExport(project),
  };
  return {
    ok: true as const,
    diagnostics,
    suggestedFileName,
    bundle,
    content: JSON.stringify(bundle, null, 2),
  };
}
