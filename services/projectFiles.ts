import type { ValidationResult } from '../types/validation';
import type { EditorUIState, ProjectData, ProjectFile } from '../types/project';
import { importProject, type ImportNotice } from '../utils/projectImport';
import { validateProject } from '../utils/validation/validator';

export const EDITOR_VERSION = '1.0.0';
export interface ProjectCandidate {
  project: ProjectData;
  editorState?: EditorUIState;
  path: string | null;
  saved: boolean;
  create?: boolean;
  importNotices?: ImportNotice[];
  validationResults?: ValidationResult[];
}

export function projectUI(ui: EditorUIState): EditorUIState {
  const { panelSizes, stageExpanded, currentStageId, currentNodeId, currentGraphId, view } = ui;
  return { panelSizes, stageExpanded, currentStageId, currentNodeId, currentGraphId, view };
}

/** 明确选择业务字段，内部会话版本和运行时操作状态不进入项目文件。 */
export function serializeProject(
  project: ProjectData,
  editorState: EditorUIState | undefined,
  savedAt: string,
): string {
  const { meta, blackboard, scripts, stageTree, nodes, stateMachines, presentationGraphs } =
    project;
  const file: ProjectFile = {
    fileType: 'puzzle-project',
    editorVersion: EDITOR_VERSION,
    savedAt,
    project: {
      meta: { ...meta, updatedAt: savedAt },
      blackboard,
      scripts,
      stageTree,
      nodes,
      stateMachines,
      presentationGraphs,
    },
    editorState,
  };
  return JSON.stringify(file, null, 2);
}

export function prepareProject(content: string, sourcePath: string | null): ProjectCandidate {
  const imported = importProject(content);
  // 仅完整工程文件可绑定保存路径；所有其他格式都作为副本另存，避免覆盖运行时/历史源文件。
  const editableFile = imported.format === 'project';
  const writableSource = !sourcePath || sourcePath.toLowerCase().endsWith('.puzzle.json');
  return {
    project: imported.project,
    editorState: imported.editorState,
    path: editableFile && writableSource ? sourcePath : null,
    saved: editableFile && writableSource && !imported.migrated,
    importNotices: imported.notices,
    validationResults: validateProject(imported.project),
  };
}
