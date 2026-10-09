---
name: puzzle-editor
description: Create, inspect and edit PuzzleEditor puzzle projects through its CLI, including explicit desktop sessions and shared history. Use for PuzzleEditor project work, not general JSON editing.
---

# PuzzleEditor

Use the external PuzzleEditor CLI for project work. Start from [the guide](references/cli-guide.md) and load only the references needed for the task:

- First use: [quick start](references/quick-start.md). Setup/configuration/Skill/doctor: [tooling commands](references/commands-tooling.md).
- Existing files, import/export or raw candidates: [file commands](references/commands-files.md).
- Unsaved desktop content and shared undo/redo: [session commands](references/commands-session.md).
- Domain plans: [hierarchy](references/operations-hierarchy.md), [resources](references/operations-resources.md), [FSM](references/operations-fsm.md), or [presentation graphs](references/operations-presentation.md).
- Identity/scope/bindings: [data structures](references/data-structures.md). Complete examples: [workflows](references/workflows.md).
- Authorized operations and recovery: [permissions and errors](references/permissions-errors.md).

The bundled sample IDs and asset names belong to fictional tutorial projects. For real projects inspect actual identities and use the user's supplied names; do not copy sample identifiers or execute tutorials against an unrelated open session.

Find `puzzle` on PATH or use the user's explicit portable `puzzle.cmd` path. If unavailable, report the missing executable; do not install tooling implicitly. Read `version` and `describe --json` for the actual schemas and supported operations. Do not invent commands from this skill's version.

For existing projects, inspect identities, owners and source hashes first. Prefer scoped domain plans, preview the exact candidate and apply to a new path, then validate and export as requested. Nested Stage, FSM and presentation graphs use their explicit owner and IDs; inspect only the needed views. Every new assetName must come from the user or provided specification. Ask for missing names; never generate them.

For unsaved desktop content, select an explicit instance/session with the user, use session inspect and the shared session/history commands. Preserve request IDs for uncertain results; never fall back to disk editing after connection failure.

Fallback direct JSON editing, overwriting an existing project, and permanent removal of protected resources each need explicit user authorization in the Agent chat, limited to the project/task/action. Existing valid authorization persists within that scope. Ordinary editing permission, receipts, flags and automatic tool approval do not grant it. Without it, use domain operations and a new output. Do not edit JSON directly or simulate GUI save to bypass this boundary. Declare only authorized capabilities with the documented flags; the CLI cannot authenticate chat.

Report changed entities, validation results, output paths and remaining errors. Avoid claiming a clean export when validation failed.
