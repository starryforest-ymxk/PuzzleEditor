---
trigger: always_on
---

# Project Rules 

### Scope & Sources

- This project implements the **web-based puzzle editor frontend only**.
- Before doing any work, read `overview/Project_Overview.md` to understand core goals, domain model, and preferred tech stack.

### Project Structure

- `components/`: React UI modules—Layout (Header/Sidebar/MainLayout wiring Explorer/Canvas/Inspector), Explorer (Stage tree + per-stage NodeList), Canvas (router plus StateMachineCanvas with FSM editing/selection, PresentationCanvas for linear action graphs, Elements for state cards/connection overlays), Inspector (BlackboardEditor, State/Transition inspectors with ConditionEditor, PresentationNodeInspector + ScriptParamEditor).
- `store/`: Global state via `store/context.tsx` (StoreProvider, thunk-style loader), `store/reducer.ts` (undo/redo, selection, history wrapper), slices `fsmSlice.ts`, `presentationSlice.ts`, `nodeParamsSlice.ts` combined in `slices/index.ts`, and action/state contracts in `store/types.ts`.
- `api/`: Typed service interface in `api/types.ts`, mock implementation `mockService.ts` exporting apiService through `api/service.ts`, and seeded domain fixtures in `api/mockData.ts` (stages, nodes, FSMs, presentation graphs, scripts/triggers).
- `types/`: Domain models for stage tree, puzzle nodes, FSM (states/transitions/conditions), presentation graphs, manifests (scripts/triggers/params), blackboard variables, and shared primitives in `types/common.ts`.
- `hooks/` & `utils/`: `useCanvasNavigation` for space/middle-button panning, `useGraphInteraction` for dragging, linking, multi-select, and snapping on canvases; geometry math/constants for anchors, Bézier paths, and hit-testing in `utils/geometry.ts`.
- Root & docs: App entry `index.tsx` with `StoreProvider` and `styles.css` theme; Vite/TypeScript scaffolding (`index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`, `metadata.json`); project briefs in `overview/Project_Overview.md`, `overview/Task_Breakdown.md`, `overview/UX_Flow.md`

### Per-Task Workflow

For each Task in `overview/Task_Breakdown.md`:

1. Read the Task item carefully and restate its **goal and constraints**.
2. Open `overview/UX_Flow.md` and locate all flows related to this Task; extract **specific interactions, states, and edge cases**.
3. Produce a **detailed technical design** (in text) before writing any code: data structures, component responsibilities, state management, routing, error handling, and how UI matches `overview/UX_Flow.md`.
4. Implement strictly according to this design, adjusting only if contradictions with `overview/UX_Flow.md`are found (and clearly explaining changes).

### Language & Code Style

- All explanations, design documents, and reports must use the **user’s language (Chinese)**.
- All important code sections must contain **UTF-8 encoded Chinese comments** explaining intent and key logic.

### Validation & Reporting

- After completing each Task, **manually test** the implemented features directly in the browser (if you can), using `overview/UX_Flow.md`as a checklist.
- In the final answer for that Task, output a **completion report in Chinese**, describing:
  - Which UX_Flow requirements are met.
  - Main technical decisions.
  - Test cases performed and results.
  - Known limitations or follow-up work.