# P1-T02 ID & Reference Rules

Design outcome for identifier/key conventions and how references are expressed in the manifest.

## ID Naming (stable, internal references)
- `proj-*` project id  
- `stage-*` stage tree nodes  
- `node-*` puzzle nodes  
- `fsm-*` state machines, `state-*` states, `trans-*` transitions  
- `pres-*` presentation graphs, `pnode-*` presentation graph nodes  
- `script-*` scripts (blackboard manifest)  
- Triggers/Events/Variables use project-unique strings; recommended prefixes: `trigger-*` or uppercase tokens, `event-*`/`EVENT_*`, `var-*`.

## Key Naming (human rename-proof)
- Definitions carry a `key` that is stable even if `name` changes.  
- Scripts/Triggers/Variables/Events expose `key` for cross-project or external references and for backward compatibility during rename.

## Reference Rules
- In-project references always use `id` (e.g., `scriptId`, `eventId`, `graphId`, `variableId`).  
- Variable references must also include `scope` (`Global | StageLocal | NodeLocal | Temporary`) to keep resolution explicit.  
- Presentation and FSM bindings reference scripts/graphs via `id`; parameters use `VariableRef` + scope or `Constant`.  
- If future migrations need to tolerate renamed items, use `StableRef` (`{ id } | { key }`) at the API boundary, then resolve to `id` inside the store.

## Typed Enforcement (code updates)
- Added `types/identity.ts` with typed ID/key aliases and `StableRef`.  
- Applied typed IDs to core domain models: StageTree, PuzzleNode, StateMachine (State/Transition/Condition), PresentationGraph/Node, Manifest definitions, Blackboard definitions, Project data, and store state.  
- API surface now carries typed ID records for `nodes/stateMachines/presentationGraphs` to align with the manifest shape.
