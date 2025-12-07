# Project Rules 

### Scope & Sources

- This project implements the **web-based puzzle editor frontend only**.
- Before doing any work, read `overview/Project_Overview.md` to understand core goals, domain model, and preferred tech stack.

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