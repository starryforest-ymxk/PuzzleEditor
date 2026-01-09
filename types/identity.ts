/**
 * types/identity.ts
 * Resource identity and reference conventions (P1-T02).
 * Defines typed IDs/Keys with lightweight template prefixes where practical
 * and helper reference shapes to keep definition vs. reference explicit.
 */

// Project-level
/** Recommend: proj-* */
export type ProjectId = string;

// Stage / Node hierarchy
/** Recommend: stage-* */
export type StageId = string;
/** Recommend: node-* */
export type PuzzleNodeId = string;

// FSM
/** Recommend: fsm-* */
export type StateMachineId = string;
/** Recommend: state-* (but often uses fsm prefix) */
export type StateId = string;
/** Recommend: trans-* */
export type TransitionId = string;

// Presentation graph
/** Recommend: pres-* */
export type PresentationGraphId = string;
/** Recommend: pnode-* */
export type PresentationNodeId = string;

// Blackboard resources
/** Recommend: VAR_* */
export type VariableId = string;
/** Recommend: EVENT_* */
export type EventId = string;

// Script resources (global manifest)
/** Recommend: SCRIPT_* */
export type ScriptId = string;

// Reference helpers
export type IdRef<TId extends string> = { id: TId };
