import type { ProjectData } from '../types/project';
import type { Action, MessageLevel } from '../store/types';
import type { ProjectPlatform } from './projectPlatform';
import { prepareRuntimeExport } from './projectExportPreparation';

/** 运行时导出独立于 React；校验与后缀保护保留，实际 IO 统一经过平台适配。 */
export async function exportRuntimeProject(
  project: ProjectData,
  platform: ProjectPlatform,
  dispatch: (action: Action) => void,
  pushMessage: (level: MessageLevel, text: string) => void,
): Promise<void> {
  // 1. Run Validation
  const prepared = prepareRuntimeExport(project, new Date().toISOString());
  const validationResults = prepared.diagnostics;
  // 修复后的导出也刷新问题列表，避免继续展示导入时已经解决的旧诊断。
  dispatch({ type: 'SET_VALIDATION_RESULTS', payload: validationResults });
  const errors = validationResults.filter((r) => r.level === 'error');

  if (!prepared.ok) {
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

  const jsonStr = prepared.content;
  const defaultFileName = prepared.suggestedFileName;

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
