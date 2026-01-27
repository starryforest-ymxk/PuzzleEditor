/**
 * store/slices/projectMetaSlice.ts
 * 处理项目元信息相关 Actions：UPDATE_PROJECT_META, RESET_PROJECT, MARK_CLEAN, SYNC_UPDATED_AT
 * 
 * P4-T06: 项目级操作与多工程支持
 */

import { EditorState, Action, INITIAL_STATE } from '../types';
import { ProjectMeta } from '../../types/project';

// ========== Project Meta 相关 Actions 类型定义 ==========
export type ProjectMetaAction =
    | { type: 'UPDATE_PROJECT_META'; payload: Partial<ProjectMeta> }
    | { type: 'RESET_PROJECT' }
    | { type: 'MARK_CLEAN' }
    | { type: 'SYNC_UPDATED_AT'; payload: string };  // 同步时间戳（不触发 isDirty）

// ========== 类型守卫：判断是否为 Project Meta Action ==========
export const isProjectMetaAction = (action: Action): action is ProjectMetaAction => {
    const projectMetaActionTypes = ['UPDATE_PROJECT_META', 'RESET_PROJECT', 'MARK_CLEAN', 'SYNC_UPDATED_AT'];
    return projectMetaActionTypes.includes(action.type);
};

// ========== Project Meta Reducer ==========
export const projectMetaReducer = (state: EditorState, action: ProjectMetaAction): EditorState => {
    switch (action.type) {
        // 更新项目元信息（名称、描述、版本等）- 触发 isDirty
        case 'UPDATE_PROJECT_META': {
            // 如果 payload 中已提供 updatedAt，则使用它；否则自动生成
            const updatedAt = action.payload.updatedAt ?? new Date().toISOString();
            return {
                ...state,
                project: {
                    ...state.project,
                    meta: {
                        ...state.project.meta,
                        ...action.payload,
                        updatedAt
                    }
                },
                ui: {
                    ...state.ui,
                    isDirty: true  // 标记为有未保存更改
                }
            };
        }

        // 同步 updatedAt 时间戳（保存后调用，不触发 isDirty）
        case 'SYNC_UPDATED_AT': {
            return {
                ...state,
                project: {
                    ...state.project,
                    meta: {
                        ...state.project.meta,
                        updatedAt: action.payload
                    }
                }
                // 注意：不修改 isDirty
            };
        }

        // 重置为初始空项目（用于新建/切换工程）
        case 'RESET_PROJECT': {
            return {
                ...INITIAL_STATE,
                // 保留 UI 面板尺寸等偏好设置
                ui: {
                    ...INITIAL_STATE.ui,
                    panelSizes: state.ui.panelSizes,
                    isDirty: false
                }
            };
        }

        // 标记为已保存状态（导出后调用）
        case 'MARK_CLEAN': {
            return {
                ...state,
                ui: {
                    ...state.ui,
                    isDirty: false
                }
            };
        }

        default:
            return state;
    }
};
