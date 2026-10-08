import type { ProjectData, ExportBundle } from '../types/project';
import type { Action, MessageLevel } from '../store/types';
import type { ProjectPlatform } from './projectPlatform';
import { validateProject } from '../utils/validation/validator';
import { normalizeForExport } from '../utils/exportNormalizer';

/** 运行时导出独立于 React；校验与后缀保护保留，实际 IO 统一经过平台适配。 */
export async function exportRuntimeProject(
  project: ProjectData,
  platform: ProjectPlatform,
  dispatch: (action: Action) => void,
  pushMessage: (level: MessageLevel, text: string) => void,
): Promise<void> {
  // 1. Run Validation
  const validationResults = validateProject(project);
  // 修复后的导出也刷新问题列表，避免继续展示导入时已经解决的旧诊断。
  dispatch({ type: 'SET_VALIDATION_RESULTS', payload: validationResults });
  const errors = validationResults.filter((r) => r.level === 'error');

  if (errors.length > 0) {
    dispatch({ type: 'SET_SHOW_VALIDATION_PANEL', payload: true });
    pushMessage('error', `Export failed: Found ${errors.length} critical errors.`);
    // Push individual errors to stack
    errors.forEach((err) => {
      pushMessage('error', `[${err.location}] ${err.message}`);
    });
    return; // Block export
  }

  // 2. Warn about warnings if any (optional, just logging count)
  const warnings = validationResults.filter((r) => r.level === 'warning');
  if (warnings.length > 0) {
    pushMessage(
      'warning',
      `Exporting with ${warnings.length} warnings. Check message stack for details.`,
    );
    warnings.forEach((warn) => {
      pushMessage('warning', `[${warn.location}] ${warn.message}`);
    });
  }

  // 精简导出：仅包含游戏引擎需要的运行时数据
  // 通过 normalizeForExport 进行深拷贝 + 清洗：修正值类型、剥离 UI 字段
  const exportBundle: ExportBundle = {
    fileType: 'puzzle-export',
    manifestVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    projectName: project.meta.name,
    projectVersion: project.meta.version,
    data: normalizeForExport(project),
  };

  const jsonStr = JSON.stringify(exportBundle, null, 2);
  // 使用项目设置的导出文件名，或默认生成
  let defaultFileName = project.meta.exportFileName;
  if (!defaultFileName) {
    defaultFileName = `${project.meta.name || 'project'}.export.json`;
  } else if (!defaultFileName.toLowerCase().endsWith('.json')) {
    // 如果用户自定义了文件名但没有后缀，自动补充 .export.json
    if (!defaultFileName.toLowerCase().endsWith('.export')) {
      defaultFileName += '.export';
    }
    defaultFileName += '.json';
  }

  // Electron 环境：使用保存对话框
  if (platform.isDesktop()) {
    const defaultPath = project.meta.exportPath || '';
    const file = await platform.chooseExport(defaultPath, defaultFileName);
    if (file) {
      let filePath = file;

      // 校验文件后缀：导出文件必须以 .export.json 结尾
      if (!filePath.toLowerCase().endsWith('.export.json')) {
        // 如果用户选择了 .puzzle.json 文件，阻止覆盖并报错
        if (filePath.toLowerCase().endsWith('.puzzle.json')) {
          pushMessage(
            'error',
            `Export blocked: "${filePath}" is a project file (.puzzle.json). Please use .export.json extension for exports.`,
          );
          return;
        }
        // 其他后缀：自动修正为 .export.json
        if (filePath.toLowerCase().endsWith('.json')) {
          // 移除 .json 后缀，用 .export.json 替代
          filePath = filePath.slice(0, -5) + '.export.json';
        } else {
          filePath += '.export.json';
        }
        pushMessage('warning', `File extension corrected to .export.json: ${filePath}`);
      }

      const exportResult = await platform.exportFile(filePath, jsonStr);
      if (exportResult.success) {
        pushMessage('info', `Project exported to ${filePath}`);
      } else {
        pushMessage('error', `Export failed: ${exportResult.error}`);
      }
    }
    return;
  }

  // 浏览器环境：下载文件
  platform.download(jsonStr, defaultFileName);

  pushMessage('info', 'Project exported for runtime');
}
