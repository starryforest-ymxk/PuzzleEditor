/** 能力、权限、示例与帮助共用此表；未实现命令不注册执行器。 */
import {
  API_VERSION,
  inputSchemas,
  jsonSchema,
  namingSchemas,
  resultSchema,
  type Permission,
} from './schemas';
import { planSchema, receiptSchema } from './planSchemas';
import { rawReceiptSchema } from './rawSchemas';
import { POLICY_VERSION, capabilityDefinitions } from './permissions';
import { IMPORT_CONVERTER_VERSION, importNamesSchema, importReceiptSchema } from './importSchemas';
import { sessionTokenSchema, sessionReceiptSchema } from './sessionSchemas';
import { toolingCapabilities } from './toolingSchemas';

export const CLI_PHASE = 'C16';

export const capabilities = [
  ...toolingCapabilities,
  {
    operation: 'history list',
    implemented: true,
    permission: 'read',
    summary:
      'Read the shared GUI history, stable entry IDs, sources, summaries and required capabilities. Top entries are first.',
  },
  {
    operation: 'history undo',
    implemented: true,
    permission: 'semantic_write',
    summary:
      'Undo exactly the expected top entry using --token, --entry-id and --request-id; no implicit disk write.',
  },
  {
    operation: 'history redo',
    implemented: true,
    permission: 'semantic_write',
    summary:
      'Redo exactly the expected top entry with the original semantic permissions; no implicit disk write.',
  },
  {
    operation: 'session list',
    implemented: true,
    permission: 'read',
    summary: 'Discover current-user Windows desktop sessions; unavailable entries remain explicit.',
  },
  {
    operation: 'session status',
    implemented: true,
    permission: 'read',
    summary:
      'Read session identity, token, dirty state, pending edits, history counts and save policy.',
  },
  {
    operation: 'session inspect',
    implemented: true,
    permission: 'read',
    summary:
      'Query committed in-memory content; --view project reads the complete project JSON snapshot.',
  },
  {
    operation: 'session validate',
    implemented: true,
    permission: 'read',
    summary: 'Validate the current unsaved desktop snapshot.',
  },
  {
    operation: 'session preview',
    implemented: true,
    permission: 'read',
    summary:
      'Flush valid field drafts, check --token, preview --plan and optionally write --receipt-out.',
  },
  {
    operation: 'session apply',
    implemented: true,
    permission: 'semantic_write',
    summary:
      'Apply a previewed domain plan as one in-memory undo transaction; requires --request-id. No overwrite declaration pauses auto-save of these changes.',
  },
  {
    operation: 'session save',
    implemented: true,
    permission: 'semantic_write',
    summary:
      'Save the expected token through the desktop queue: --out creates a new file; current-file save requires --allow-overwrite and --expected-disk-hash.',
  },
  {
    operation: 'import preview',
    implemented: true,
    permission: 'read',
    summary:
      'Preview conversion of a supported source to a new complete project with optional external asset names.',
    example:
      'puzzle import preview "Demo.export.json" --out "Demo.puzzle.json" --receipt-out "import-receipt.json"',
  },
  {
    operation: 'import apply',
    implemented: true,
    permission: 'semantic_write',
    summary:
      'Rebuild a previewed conversion and publish a new project file; source files remain unchanged.',
  },
  {
    operation: 'describe',
    implemented: true,
    permission: 'read',
    summary: 'Describe capabilities and JSON Schemas.',
    example: 'puzzle describe --json',
  },
  {
    operation: 'inspect',
    implemented: true,
    permission: 'read',
    summary: 'Query normalized project context without saving.',
    example: 'puzzle inspect "Demo.puzzle.json" --view tree --json',
  },
  {
    operation: 'validate',
    implemented: true,
    permission: 'read',
    summary: 'Validate structure and domain rules without saving.',
    example: 'puzzle validate "Demo.puzzle.json" --json',
  },
  {
    operation: 'json read',
    implemented: true,
    permission: 'read',
    summary: 'Read the complete file or its original UTF-8 text.',
    example: 'puzzle json read "Demo.puzzle.json" --raw',
  },
  {
    operation: 'create',
    implemented: true,
    permission: 'semantic_write',
    summary: 'Create a project with external asset names and an optional domain plan.',
  },
  {
    operation: 'preview',
    implemented: true,
    permission: 'read',
    summary:
      'Preview domain edits and permissions; --in-place freezes the overwrite source and identity.',
  },
  {
    operation: 'apply',
    implemented: true,
    permission: 'semantic_write',
    summary:
      'Apply a domain plan to --out or use --in-place --allow-overwrite; protected deletion also requires --allow-permanent-delete.',
  },
  {
    operation: 'export',
    implemented: true,
    permission: 'semantic_write',
    summary: 'Write a runtime export.',
  },
  {
    operation: 'json preview',
    implemented: true,
    permission: 'read',
    summary: 'Preview a full JSON candidate for --out or --in-place and all required capabilities.',
  },
  {
    operation: 'json apply',
    implemented: true,
    permission: 'raw_json_write',
    summary:
      'Apply a JSON candidate with --allow-raw-json-write; --in-place also requires --allow-overwrite, protected deletion requires --allow-permanent-delete.',
  },
] satisfies Array<{
  operation: string;
  implemented: boolean;
  permission: Permission;
  summary: string;
  example?: string;
}>;

export function describeCapabilities(operation?: string) {
  return {
    apiVersion: API_VERSION,
    phase: CLI_PHASE,
    importConverterVersion: IMPORT_CONVERTER_VERSION,
    policyVersion: POLICY_VERSION,
    authorizationCapabilities: capabilityDefinitions,
    capabilities: capabilities
      .filter((item) => !operation || item.operation === operation)
      .map((item) => ({
        ...item,
        requiresDirectUserConfirmation: item.permission === 'raw_json_write',
        requiredCapabilities: item.permission === 'raw_json_write' ? ['raw_json_write'] : [],
        conditionalCapabilities: ['history undo', 'history redo'].includes(item.operation)
          ? ['raw_json_write', 'overwrite_project', 'permanent_resource_delete']
          : ['apply', 'json apply', 'session apply'].includes(item.operation)
            ? ['overwrite_project', 'permanent_resource_delete']
            : item.operation === 'session save'
              ? ['overwrite_project']
              : [],
        ...([
          'apply',
          'json apply',
          'session apply',
          'session save',
          'history undo',
          'history redo',
        ].includes(item.operation)
          ? { authorizationMode: 'agent-chat', cliVerifiesChatAuthorization: false }
          : {}),
        inputSchema: Object.hasOwn(inputSchemas, item.operation)
          ? jsonSchema(inputSchemas[item.operation as keyof typeof inputSchemas])
          : null,
      })),
    resultSchema: jsonSchema(resultSchema),
    planSchema: jsonSchema(planSchema),
    receiptSchema: jsonSchema(receiptSchema),
    rawReceiptSchema: jsonSchema(rawReceiptSchema),
    importReceiptSchema: jsonSchema(importReceiptSchema),
    importNamesSchema: jsonSchema(importNamesSchema),
    sessionTokenSchema: jsonSchema(sessionTokenSchema),
    sessionReceiptSchema: jsonSchema(sessionReceiptSchema),
    sessionRules: [
      'Windows only; desktop and CLI must support protocol 2. Explicit --instance and --session are mandatory outside session list. No offline fallback or recent-window guessing.',
      'Use session inspect --view project for the full unsaved snapshot. Read-only operations show committed content and pendingEdits, not unfinished field drafts.',
      'Token and receipt arguments are JSON files. Plans bind sourceHash to token.contentHash. Preview and apply flush valid drafts first, then reject stale tokens, invalid fields and active gestures.',
      'Apply is one atomic content/history commit. Protected permanent deletion creates the existing history barrier and needs --allow-permanent-delete independently.',
      'Save to --out is exclusive. Existing-file save needs explicit chat overwrite authorization, --allow-overwrite and the expected disk SHA-256 from json read. No native file picker is opened.',
      'Agent edits without --allow-overwrite block automatic saving of their content. Human GUI save, authorized explicit save, or a new-path save acknowledges only captured restrictions. Future tasks are not authorized.',
      'Mutation request IDs are <13-digit Unix milliseconds>:<UUID>. Persist the ID before the first call. Identical requests replay cached results for 10 minutes, including failures; changed bodies conflict. Cache capacity is 256, never evicting unexpired results.',
      'SESSION_RESULT_UNKNOWN means the request may have committed. Retry the exact ID/body within retention. After expiry, restart, reload or project switch, inspect first and never automatically reapply with a new ID.',
      'Current-user ACL and authenticated local transport do not verify chat authorization. No raw online replacement, navigation or preferences commands are exposed.',
    ],
    historyRules: [
      'history list returns the shared GUI past/future, next entry first, limited to 50 content edits. Metadata is session-local and not serialized into project files.',
      'history undo/redo require --instance, --session, --token (JSON file), --entry-id and --request-id. One top entry per call; no skipping human edits or searching old Agent entries.',
      'History uses the same draft/busy/read-only barrier, monotonic contentEpoch and 10-minute/256-result retry cache as apply. Empty or stale stacks do not change content or history.',
      'Capabilities are recalculated from actual effects; redo also retains the original semantic requirements. Permanent deletion clears both stacks. Original overwrite permission never authorizes future persistence.',
      'Agent history without --allow-overwrite allocates a fresh auto-save restriction, including when restoring previously saved content. Only an explicit authorized/human/new-path save acknowledges captured restrictions.',
      'Undo changes memory, not the disk. Saved content undone to a different revision becomes dirty; explicit session save is required for controlled persistence.',
    ],
    importRules: [
      'Only puzzle-project, puzzle-export (manifest 1.0.0), raw ProjectData, and legacy ExportManifest are supported. Unknown or lossy structures are rejected.',
      'Conversion uses the shared importer and serializer. Preview freezes metadata time and runtime project ID; apply rebuilds the same candidate.',
      'Name maps contain apiVersion, sourceHash, and entries of exact entity identity plus assetName. No arbitrary fields, ID changes, state changes or project merging are accepted.',
      'State IDs require FSM owner; local variables require Stage/Puzzle owner. Global variable identities use ownerType project without a generated project ID.',
      'Existing unmapped missing names remain diagnostics; no asset names are generated. Existing resource states, IDs, values and references are preserved.',
      'Preview lists notices, missing names, remaining errors, full candidate and hash. Errors already in the source may remain, but conversion or name maps must not introduce new errors. Export still requires zero errors.',
      'Receipts bind source, mapping, target, conversion version and fixed context. Changed inputs or conversion versions require a new preview; receipts do not grant high permissions.',
      'Only new outputs are allowed; no live GUI changes, overwrite, or merging. Import permission does not authorize first editing the source JSON directly.',
    ],
    overwriteRules: [
      'Preview with --in-place; apply with --in-place --allow-overwrite only after explicit user authorization in the agent chat. It is independent from raw and permanent-delete permission.',
      'Only the previewed source is overwritten; --out and --in-place are mutually exclusive. Import and export cannot overwrite through this mode.',
      'Windows only. Compatible desktop sessions and CLI transactions share OS-backed path and file-identity ownership. A held or unknown owner blocks offline overwrite; no PID-based stale-lock removal.',
      'Receipts bind source hash and file identity. A verified original backup and durable transaction record are created beside the project before atomic replacement. Backups are never automatically removed.',
      'Same-receipt retries reconstruct from the verified backup and check permissions/inputs again. A known after-state returns already-applied; third-party changes conflict. Post-publication verification failures report COMMIT_RESULT_UNCERTAIN with recovery paths.',
      'This coordinates compatible clients only. Older desktop versions and unrelated file tools do not honor ownership. Use explicit session commands for live GUI editing and history commands for the shared undo stack.',
    ],
    rawJsonRules: [
      'Use fallback JSON editing only after explicit user authorization in the agent chat. Respect its project, task, and edit scope; do not repeatedly ask within existing authorization.',
      'Missing, denied, revoked, or out-of-scope authorization must be handled by the agent before direct JSON editing. The CLI does not read or authenticate chat messages.',
      'json apply requires --allow-raw-json-write as an explicit caller declaration. No desktop approval window, stdin confirmation, or approval token is used.',
      'Only complete, unambiguous puzzle-project source and candidate files are accepted. Candidates requiring normalization must be corrected and previewed again.',
      'Preview receipts bind source, candidate, and target paths and hashes. Receipts do not grant authorization. Changed inputs require another preview, not another user question within the same authorized scope.',
      'New or changed assetName values are external and validated. Lifecycle and domain error-baseline rules still apply.',
      'New outputs are the default. In-place mode requires independent overwrite authorization. Both modes preserve candidate UTF-8 bytes, formatting and timestamps.',
      'Physical removal of Implemented or MarkedForDelete resources, including parent deletion, also requires agent-chat authorization for permanent_resource_delete and --allow-permanent-delete. Raw permission alone is insufficient.',
    ],
    planRules: [
      'Plans require an explicit edit scope. Existing project plans also require sourceHash.',
      'References are {id} or {alias}; root is a reserved stage alias.',
      'FSM operations require fsm: {id} or {puzzle: {id|alias}}. State/transition IDs are local to that FSM; aliases are checked against their allocated FSM.',
      'puzzle.create.initialState may declare an alias for later state/transition commands. No assetName is generated.',
      'FSM edit scope comes from its unique puzzle owner. Missing or multiple owners are rejected.',
      'Deleting an initial state requires replacementInitialState; deleting incident transitions requires deleteTransitions: true. The last state is protected.',
      'transition.redirect requires from and to, preserves effects, and permits self-loops. Separate transitions with the same endpoints keep distinct IDs and priorities.',
      'Presentation edits require scope.project or an explicit scope.presentations entry. New graphs can be scoped by their creation alias. Stage/puzzle scope does not grant access to shared graphs.',
      'presentationNode operations require graph and check local ID/alias ownership. Graphs and presentation nodes have no assetName field in this project format.',
      'presentationEdge slots are true/false for Branch, next for ordinary nodes, and ordered integer indices for Parallel. Disconnect never shifts Branch slots. Parallel connect inserts at its index.',
      'Graph deletion is restricted to unbound graphs. Node deletion with incident edges requires deleteEdges; deleting a start node requires replacementStart unless the graph becomes empty.',
      'Preview/apply include before/after resource references and shared graph caller impacts. No caller is rewritten implicitly.',
      'All creation declarations are allocated first and created in owner dependency order; non-creation commands then run in their original order.',
      'Resource creation always starts in Draft. Ordinary delete marks Implemented and refuses MarkedForDelete; variable/event/script.purge handles protected resources with explicit agent-chat authorization and --allow-permanent-delete.',
      'stage.delete requires cascade: true for a non-empty stage and cannot delete the root. Its scope must cover the subtree, modified parent, and normalized initial siblings. puzzle.delete also removes its exclusive FSM.',
      'An FSM owned outside the deletion set blocks deletion. Shared presentation graphs and global resources are retained. Explicitly fix remaining references in the same plan.',
      'Preview returns all deleted entity identities and requiredCapabilities. Apply recomputes capabilities from actual changes; a receipt or raw editing permission cannot grant permanent-delete permission.',
      'Receipts bind the current policyVersion and output mode. Re-preview older receipts. Offline --allow-overwrite requires --in-place; online declarations are described in sessionRules.',
      'Omitted fields remain unchanged; null clears optional bindings, [] clears lists.',
      'Preview receipts are consistency checks, not raw JSON write approval.',
      'New output paths are the default. --in-place is mutually exclusive with --out and can only replace this source project after backup and ownership verification.',
    ],
    namingContracts: {
      status: 'enforced-by-domain-plan-contracts',
      schemas: Object.fromEntries(
        Object.entries(namingSchemas).map(([key, schema]) => [key, jsonSchema(schema)]),
      ),
      appliesTo: [
        'stage (including root)',
        'puzzle',
        'state (including initial)',
        'variable (global/stage/node)',
        'event',
        'script',
      ],
      rules: [
        'All new assetName values come from the caller.',
        'Omitted assetName on an existing entity is preserved.',
        'No translation, generation, trimming, or suffix fallback.',
      ],
    },
    permissions: {
      environment_write:
        'Explicit tooling installation, recovery or removal. Does not authorize project edits or any highest-level capability.',
      read: 'Read and preview only.',
      semantic_write: 'Scoped domain operations; does not grant raw JSON write.',
      raw_json_write:
        'Fallback only. The agent must obtain explicit authorization in the user chat and stay within that scope. The CLI requires an enabling declaration but cannot authenticate user messages; receipts and flags are not proof of consent.',
    },
    authorizationRules: [
      'raw_json_write, overwrite_project, and permanent_resource_delete share the highest permission level but are independently scoped. One user chat message may grant several capabilities.',
      'Do not ask again within valid existing project/task/action scope. Normal editing permission, receipts, and client auto-approval do not grant these capabilities.',
      'The CLI only checks explicit declarations and data rules; it does not authenticate chat. No desktop approval host, token, or chat upload is used.',
    ],
    queryRules: [
      'Structured views use the existing importer; import notices disclose normalization. json read preserves the disk file.',
      'Use ownerType and ownerId for scoped IDs; ambiguous matches return candidates.',
      'Reuse source.sha256 with --expected-hash for additional pages.',
      'Bindings lists eligible resource metadata only; final binding parameters and caller scope still require validation.',
    ],
    exitCodes: {
      success: 0,
      internal: 1,
      input: 2,
      validation: 3,
      conflict: 4,
      io: 5,
      approval: 6,
      interrupted: 130,
    },
  };
}
