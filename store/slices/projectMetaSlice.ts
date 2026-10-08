/** 项目元信息更新；历史与保存标记由顶层 Reducer 统一处理。 */
import { INITIAL_STATE, type EditorState, type Action } from '../types';
import { isActionForDomain, type ActionForDomain } from '../actionPolicy';

export type ProjectMetaAction = ActionForDomain<'meta'>;
export const isProjectMetaAction = (action: Action): action is ProjectMetaAction => isActionForDomain(action, 'meta');

export const projectMetaReducer = (state: EditorState, action: ProjectMetaAction): EditorState => {
    switch (action.type) {
        case 'UPDATE_PROJECT_META':
            // updatedAt 表示实际保存时间，编辑名称不能凭空修改它或绕开统一 dirty 计算。
            return { ...state, project: { ...state.project, meta: { ...state.project.meta, ...action.payload } } };
        case 'RESET_PROJECT':
            return {
                ...INITIAL_STATE,
                settings: state.settings,
                runtime: { ...INITIAL_STATE.runtime, preferencesLoaded: state.runtime.preferencesLoaded },
                ui: { ...INITIAL_STATE.ui, panelSizes: state.ui.panelSizes }
            };
    }
};
