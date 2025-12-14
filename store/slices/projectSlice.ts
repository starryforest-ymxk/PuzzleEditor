/**
 * Project Reducer 切片
 * 处理与项目数据相关的基础操作：Stage 树更新、Node 更新
 */

import { EditorState, Action } from '../types';
import { StageTreeData } from '../../types/stage';
import { PuzzleNode } from '../../types/puzzleNode';

// ========== Project 相关 Actions 类型定义 ==========
export type ProjectAction =
    | { type: 'UPDATE_STAGE_TREE'; payload: StageTreeData }
    | { type: 'UPDATE_NODE'; payload: { nodeId: string; data: Partial<PuzzleNode> } };

// ========== 类型守卫：判断是否为 Project Action ==========
export const isProjectAction = (action: Action): action is ProjectAction => {
    const projectActionTypes = ['UPDATE_STAGE_TREE', 'UPDATE_NODE'];
    return projectActionTypes.includes(action.type);
};

// ========== Project Reducer ==========
export const projectReducer = (state: EditorState, action: ProjectAction): EditorState => {
    switch (action.type) {
        case 'UPDATE_STAGE_TREE':
            return {
                ...state,
                project: { ...state.project, stageTree: action.payload }
            };

        case 'UPDATE_NODE': {
            const node = state.project.nodes[action.payload.nodeId];
            if (!node) return state;
            return {
                ...state,
                project: {
                    ...state.project,
                    nodes: {
                        ...state.project.nodes,
                        [action.payload.nodeId]: { ...node, ...action.payload.data }
                    }
                }
            };
        }

        default:
            return state;
    }
};
