import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

// 排除依赖、生成物和只读设计材料；其余维护源码统一参与编码检查。
const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-electron',
  'release',
  'overview',
]);
const sourceExtensions = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.js',
  '.mjs',
  '.css',
  '.html',
  '.json',
  '.yaml',
  '.yml',
]);

export function listFiles(directory = '.', ignored = ignoredDirectories) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return ignored.has(entry.name) ? [] : listFiles(path, ignored);
    return entry.isFile() ? [path] : [];
  });
}

export function sourceFiles() {
  return listFiles().filter((path) => sourceExtensions.has(extname(path)));
}

// 格式检查渐进覆盖：第五批收纳实际拆分的子系统，不全仓重排无关文件。
export function formatFiles() {
  return [
    ...new Set([
      'eslint.config.mjs',
      'prettier.config.mjs',
      'package.json',
      'tsconfig.json',
      'types/json.ts',
      'store/context.ts',
      'store/StoreProvider.tsx',
      'tests/components/editorInteractions.test.tsx',
      'tests/services/variableScope.test.ts',
      'types/validation.ts',
      'types/graphUI.ts',
      'components/Canvas/PresentationCanvas.tsx',
      'hooks/useBlackboardData.ts',
      'hooks/useBlackboardActions.ts',
      'hooks/useResourceReorder.ts',
      'hooks/usePresentationCanvas.ts',
      'hooks/useProjectActions.ts',
      'utils/blackboard.ts',
      'utils/blackboardReferences.ts',
      'utils/conditionBuilder.ts',
      'utils/presentationGeometry.ts',
      'services/projectExport.ts',
      'services/projectFiles.ts',
      'services/projectPlatform.ts',
      'electron/windowCloseGuard.ts',
      'hooks/useWindowClose.ts',
      'tests/components/windowClose.test.tsx',
      'tests/components/dialogs.test.tsx',
      'tests/fixtures/dialogs-preview.tsx',
      'tests/fixtures/dialogs-preview.html',
      'components/Layout/ConfirmSaveDialog.tsx',
      'components/Inspector/ConfirmDialog.tsx',
      'components/Layout/NewProjectDialog.tsx',
      'components/Layout/ProjectSettingsDialog.tsx',
      'components/Layout/PreferencePanel.tsx',
      'components/Layout/OpenAIModelSelect.tsx',
      ...listFiles('components/shared'),
      'tests/electron/run-close-smoke.mjs',
      'tests/electron/run-packaged-smoke.mjs',
      'tests/electron/closeSmoke.main.mjs',
      ...listFiles('components/Blackboard'),
      ...listFiles('components/Canvas/presentation'),
      ...listFiles('components/Inspector/condition'),
      ...listFiles('store/navigation'),
      ...listFiles('store/commands'),
      ...listFiles('platform'),
      ...listFiles('services/translation'),
      ...listFiles('tests/batch5'),
      ...listFiles('tests/performance'),
      ...listFiles('scripts'),
      ...listFiles('components'),
      'styles.css',
      'tests/components/uiConsistency.test.tsx',
    ]),
  ];
}
