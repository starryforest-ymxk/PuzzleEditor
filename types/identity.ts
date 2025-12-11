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
/** Recommend: var-* */
export type VariableId = string;
export type VariableKey = string;
/** Recommend: event-* or EVENT_* */
export type EventId = string;
export type EventKey = string;

// Script/Trigger resources (global manifest)
/** Recommend: script-* */
export type ScriptId = string;
/** Recommend: script-* */
export type ScriptKey = string;
/** Recommend: trigger-* or uppercase tokens */
export type TriggerId = string;
export type TriggerKey = string;

// Reference helpers
export type IdRef<TId extends string> = { id: TId };
export type KeyRef<TKey extends string> = { key: TKey };
export type StableRef<TId extends string, TKey extends string> = IdRef<TId> | KeyRef<TKey>;
