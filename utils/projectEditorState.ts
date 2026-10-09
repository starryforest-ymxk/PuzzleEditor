/** 未保存编辑状态的导入文件只能使用默认值；GUI 可继承面板尺寸，CLI 使用共同默认。 */
import type { EditorUIState } from '../types/project';
import { normalizePanelSizes, type PanelSizes } from './panelSizes';

export function defaultProjectEditorState(
  rootId: string | null,
  panelSizes?: Partial<PanelSizes>,
): EditorUIState {
  return {
    panelSizes: normalizePanelSizes(panelSizes),
    stageExpanded: {},
    currentStageId: rootId,
    currentNodeId: null,
    currentGraphId: null,
    view: 'EDITOR',
  };
}
