/**
 * Store Slices 统一导出
 * 提供所有 reducer 切片的集中导出点
 */

// FSM 切片 - 状态机、状态、转移
export { fsmReducer, isFsmAction, type FsmAction } from './fsmSlice';

// Presentation 切片 - 演出图、节点、连线
export { presentationReducer, isPresentationAction, type PresentationAction } from './presentationSlice';

// Node Params 切片 - 节点参数
export { nodeParamsReducer, isNodeParamsAction, type NodeParamsAction } from './nodeParamsSlice';

// Blackboard 切片 - 变量、事件、脚本
export { blackboardReducer, isBlackboardAction, type BlackboardAction } from './blackboardSlice';

// Navigation 切片 - 导航、视图切换
export { navigationReducer, isNavigationAction, type NavigationAction } from './navigationSlice';

// UI 切片 - 选择、面板、消息
export { uiReducer, isUiAction, type UiAction } from './uiSlice';

// Project 切片 - Stage 树、Node 更新
export { projectReducer, isProjectAction, type ProjectAction } from './projectSlice';

// Project Meta 切片 - 项目元信息 (P4-T06)
export { projectMetaReducer, isProjectMetaAction, type ProjectMetaAction } from './projectMetaSlice';

// Runtime 切片 - Electron 运行时状态 (P4-T06)
export { runtimeReducer, isRuntimeAction, type RuntimeAction } from './runtimeSlice';

