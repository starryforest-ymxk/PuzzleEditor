# Project Rules 

### Scope & Sources

- This project implements the **web-based puzzle editor frontend only**.
- CRITICAL: All UI displays should use **English**.

### Project Structure

- `components/`: React UI components — overall layout (Layout), stage explorer (Explorer), canvas editors (FSM canvas, presentation canvas), inspector panels, and shared UI elements.
- `store/`: Global state management — context provider, reducers (with undo/redo and selection history), feature slices, and shared action/state types.
- `api/`: Service layer — typed interfaces, real/mock service implementations, and seeded data (stages, nodes, FSMs, presentation graphs, scripts/triggers).
- `types/`: Domain models — stage tree, puzzle nodes, FSM (states/transitions/conditions), presentation graphs, script/trigger manifests, blackboard variables, and common primitives.
- `hooks/` & `utils/`: Custom hooks (canvas navigation, graph interaction) and utility functions (geometry, paths, hit testing, etc.).
- `overview/`: Design docs — `Project_Overview`, `Task_Breakdown`, `UX_Flow` (**read-only**); Dev docs — in `overview/dev/` (read & write)
- Root: App entry and tooling — main entry file, global styles, Vite/TypeScript config, and package management files.

### General Guidelines

- CRITICAL: All code files should be opened and saved using ** UTF-8 ** format.
- Before doing any task: 
  - read `overview/Project_Overview.md` to understand core goals, domain model, and preferred tech stack.
  - read necessary docs in `overview/dev/` to understand current project code architecture and task progress.
- For the code that has already been implemented, you can evaluate its quality and completeness, compare it with the current requirements, and choose whether to refactor based on the existing code or continue using it according to the actual situation.
- If any necessary documents need to be produced, please put them in the `overview/dev` directory.
- After completing any task, update docs in  `overview/dev` to reflect code changes and task completion status.

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