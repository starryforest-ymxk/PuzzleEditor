import type { Action } from './types';

type Domain = 'fsm' | 'presentation' | 'nodeParams' | 'blackboard' | 'navigation' | 'project' | 'meta' | 'ui' | 'runtime' | 'core' | 'history' | 'document';
export interface ActionPolicy {
    domain: Domain;
    changesContent: boolean;
    history: 'record' | 'preserve' | 'barrier' | 'resource-delete';
    allowReadOnly: boolean;
}

// 操作类型、领域路由和全局约束在同一表中登记，新增 Action 漏登记会导致类型检查失败。
const edit = { changesContent: true, history: 'record', allowReadOnly: false } as const;
const view = { changesContent: false, history: 'preserve', allowReadOnly: true } as const;
const resourceDelete = { ...edit, history: 'resource-delete' } as const;

export const ACTION_POLICIES = {
    COMMIT_AUTOMATION: { ...edit, domain: 'document' },
    RESTORE_AUTOMATION_HISTORY: { ...edit, domain: 'history' },
    UNDO: { ...edit, domain: 'history' },
    REDO: { ...edit, domain: 'history' },
    INIT_START: { ...view, domain: 'core' },
    INIT_SUCCESS: { ...view, domain: 'core' },
    INIT_ERROR: { ...view, domain: 'core' },
    SELECT_OBJECT: { ...view, domain: 'ui' },
    UPDATE_STAGE_TREE: { ...edit, domain: 'project' },
    TOGGLE_STAGE_EXPAND: { ...view, domain: 'ui' },
    UPDATE_NODE: { ...edit, domain: 'project' },
    ADD_GLOBAL_VARIABLE: { ...edit, domain: 'blackboard' },
    UPDATE_GLOBAL_VARIABLE: { ...edit, domain: 'blackboard' },
    SOFT_DELETE_GLOBAL_VARIABLE: { ...resourceDelete, domain: 'blackboard' },
    APPLY_DELETE_GLOBAL_VARIABLE: { ...resourceDelete, domain: 'blackboard' },
    ADD_EVENT: { ...edit, domain: 'blackboard' },
    UPDATE_EVENT: { ...edit, domain: 'blackboard' },
    SOFT_DELETE_EVENT: { ...resourceDelete, domain: 'blackboard' },
    APPLY_DELETE_EVENT: { ...resourceDelete, domain: 'blackboard' },
    ADD_SCRIPT: { ...edit, domain: 'blackboard' },
    UPDATE_SCRIPT: { ...edit, domain: 'blackboard' },
    SOFT_DELETE_SCRIPT: { ...resourceDelete, domain: 'blackboard' },
    APPLY_DELETE_SCRIPT: { ...resourceDelete, domain: 'blackboard' },
    REORDER_GLOBAL_VARIABLES: { ...edit, domain: 'blackboard' },
    REORDER_EVENTS: { ...edit, domain: 'blackboard' },
    REORDER_SCRIPTS: { ...edit, domain: 'blackboard' },
    REORDER_LOCAL_VARIABLES: { ...edit, domain: 'blackboard' },
    REORDER_FSMS: { ...edit, domain: 'blackboard' },
    REORDER_PRESENTATION_GRAPHS: { ...edit, domain: 'blackboard' },
    SOFT_DELETE_STAGE_VARIABLE: { ...resourceDelete, domain: 'blackboard' },
    APPLY_DELETE_STAGE_VARIABLE: { ...resourceDelete, domain: 'blackboard' },
    ADD_STAGE: { ...edit, domain: 'project' },
    DELETE_STAGE: { ...edit, domain: 'project' },
    UPDATE_STAGE: { ...edit, domain: 'project' },
    REORDER_STAGE: { ...edit, domain: 'project' },
    MOVE_STAGE: { ...edit, domain: 'project' },
    ADD_STAGE_VARIABLE: { ...edit, domain: 'project' },
    UPDATE_STAGE_VARIABLE: { ...edit, domain: 'project' },
    DELETE_STAGE_VARIABLE: { ...resourceDelete, domain: 'project' },
    ADD_PUZZLE_NODE: { ...edit, domain: 'project' },
    DELETE_PUZZLE_NODE: { ...edit, domain: 'project' },
    REORDER_PUZZLE_NODES: { ...edit, domain: 'project' },
    ADD_STATE: { ...edit, domain: 'fsm' },
    DELETE_STATE: { ...edit, domain: 'fsm' },
    UPDATE_STATE: { ...edit, domain: 'fsm' },
    UPDATE_FSM: { ...edit, domain: 'fsm' },
    ADD_TRANSITION: { ...edit, domain: 'fsm' },
    DELETE_TRANSITION: { ...edit, domain: 'fsm' },
    UPDATE_TRANSITION: { ...edit, domain: 'fsm' },
    ADD_PRESENTATION_GRAPH: { ...edit, domain: 'presentation' },
    UPDATE_PRESENTATION_GRAPH: { ...edit, domain: 'presentation' },
    DELETE_PRESENTATION_GRAPH: { ...edit, domain: 'presentation' },
    ADD_PRESENTATION_NODE: { ...edit, domain: 'presentation' },
    DELETE_PRESENTATION_NODE: { ...edit, domain: 'presentation' },
    UPDATE_PRESENTATION_NODE: { ...edit, domain: 'presentation' },
    LINK_PRESENTATION_NODES: { ...edit, domain: 'presentation' },
    UNLINK_PRESENTATION_NODES: { ...edit, domain: 'presentation' },
    UPDATE_EDGE_PROPERTIES: { ...edit, domain: 'presentation' },
    ADD_NODE_PARAM: { ...edit, domain: 'nodeParams' },
    UPDATE_NODE_PARAM: { ...edit, domain: 'nodeParams' },
    DELETE_NODE_PARAM: { ...resourceDelete, domain: 'nodeParams' },
    SET_MULTI_SELECT_STATES: { ...view, domain: 'ui' },
    SET_MULTI_SELECT_PRESENTATION_NODES: { ...view, domain: 'ui' },
    SWITCH_VIEW: { ...view, domain: 'navigation' },
    NAVIGATE_TO: { ...view, domain: 'navigation' },
    NAVIGATE_BACK: { ...view, domain: 'navigation' },
    SET_READ_ONLY: { ...view, domain: 'ui' },
    SET_BLACKBOARD_VIEW: { ...view, domain: 'ui' },
    SET_STAGE_EXPANDED: { ...view, domain: 'ui' },
    ADD_MESSAGE: { ...view, domain: 'ui' },
    CLEAR_MESSAGES: { ...view, domain: 'ui' },
    SET_PANEL_SIZES: { ...view, domain: 'ui' },
    UPDATE_PROJECT_META: { ...edit, domain: 'meta' },
    SYNC_RESOURCE_STATES: { ...edit, domain: 'project', history: 'barrier', allowReadOnly: true },
    RESET_PROJECT: { ...view, domain: 'meta' },
    PROJECT_SAVE_SUCCEEDED: { ...view, domain: 'document' },
    SET_VALIDATION_RESULTS: { ...view, domain: 'ui' },
    SET_SHOW_VALIDATION_PANEL: { ...view, domain: 'ui' },
    SET_PROJECT_PATH: { ...view, domain: 'runtime' },
    SET_PROJECT_OPERATION: { ...view, domain: 'runtime' },
    SET_NEW_UNSAVED_PROJECT: { ...view, domain: 'runtime' },
    SET_PREFERENCES_LOADED: { ...view, domain: 'runtime' },
    UPDATE_TRANSLATION_SETTINGS: { ...view, domain: 'core' },
    UPDATE_AUTO_SAVE_SETTINGS: { ...view, domain: 'core' },
    UPDATE_MESSAGE_FILTERS: { ...view, domain: 'core' },
    SET_CONFIRM_DIALOG: { ...view, domain: 'ui' }
} as const satisfies Record<Action['type'], ActionPolicy>;

export type ActionForDomain<D extends Domain> = Extract<Action, {
    type: { [T in keyof typeof ACTION_POLICIES]: typeof ACTION_POLICIES[T]['domain'] extends D ? T : never }[keyof typeof ACTION_POLICIES]
}>;

/** 切片直接复用领域归属，避免维护第二套可能遗漏操作的类型守卫名单。 */
export function isActionForDomain<D extends Domain>(action: Action, domain: D): action is ActionForDomain<D> {
    return ACTION_POLICIES[action.type]?.domain === domain;
}
