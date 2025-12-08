/**
 * types/identity.ts
 * Resource identity and reference conventions (P1-T02).
 * Defines typed IDs/Keys with lightweight template prefixes where practical
 * and helper reference shapes to keep definition vs. reference explicit.
 */

// Project-level
export type ProjectId = `proj-${string}`;

// Stage / Node hierarchy
export type StageId = `stage-${string}`;
export type PuzzleNodeId = `node-${string}`;

// FSM
export type StateMachineId = `fsm-${string}`;
export type StateId = `state-${string}`;
export type TransitionId = `trans-${string}`;

// Presentation graph
export type PresentationGraphId = `pres-${string}`;
export type PresentationNodeId = `pnode-${string}`;

// Blackboard resources
export type VariableId = string;    // Recommend: var-*; legacy data uses semantic ids
export type VariableKey = string;
export type EventId = string;       // Recommend: event-* or EVENT_*
export type EventKey = string;

// Script/Trigger resources (global manifest)
export type ScriptId = `script-${string}`;
export type ScriptKey = `script-${string}`;
export type TriggerId = string;     // Recommend: trigger-* or uppercase tokens
export type TriggerKey = string;

// Reference helpers
export type IdRef<TId extends string> = { id: TId };
export type KeyRef<TKey extends string> = { key: TKey };
export type StableRef<TId extends string, TKey extends string> = IdRef<TId> | KeyRef<TKey>;
