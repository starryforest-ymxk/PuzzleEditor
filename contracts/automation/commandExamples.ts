/** 文档、能力查询和终端帮助共用的调用示例；动态输入在教程中实际取得。 */
export const commandExamples = {
  version: 'puzzle version --json',
  describe: 'puzzle describe --json',
  inspect: 'puzzle inspect "Demo.puzzle.json" --view tree --json',
  validate: 'puzzle validate "Demo.puzzle.json" --json',
  'json read': 'puzzle json read "Demo.puzzle.json" --raw',
  create: 'puzzle create --name "Demo" --root-asset-name DemoRoot --out "Demo.puzzle.json" --json',
  preview:
    'puzzle preview "Demo.puzzle.json" --plan "edit-plan.json" --receipt-out "preview.json" --json',
  apply:
    'puzzle apply "Demo.puzzle.json" --plan "edit-plan.json" --receipt "preview.json" --out "Demo-edited.puzzle.json" --json',
  export: 'puzzle export "Demo-edited.puzzle.json" --out "Demo.export.json" --json',
  'json preview':
    'puzzle json preview "Demo.puzzle.json" --candidate "candidate.puzzle.json" --out "Reviewed.puzzle.json" --receipt-out "raw-preview.json" --json',
  'json apply':
    'puzzle json apply "Demo.puzzle.json" --candidate "candidate.puzzle.json" --out "Reviewed.puzzle.json" --receipt "raw-preview.json" --allow-raw-json-write --json',
  'import preview':
    'puzzle import preview "Demo.export.json" --out "Converted.puzzle.json" --receipt-out "import-preview.json" --json',
  'import apply':
    'puzzle import apply "Demo.export.json" --out "Converted.puzzle.json" --receipt "import-preview.json" --json',
  'session list': 'puzzle session list --json',
  'session status': 'puzzle session status --instance $instance --session $session --json',
  'session inspect':
    'puzzle session inspect --instance $instance --session $session --view project --json',
  'session validate': 'puzzle session validate --instance $instance --session $session --json',
  'session preview':
    'puzzle session preview --instance $instance --session $session --token "token.json" --plan "edit-plan.json" --receipt-out "preview.json" --json',
  'session apply':
    'puzzle session apply --instance $instance --session $session --plan "edit-plan.json" --receipt "preview.json" --request-id $requestId --json',
  'session save':
    'puzzle session save --instance $instance --session $session --token "token.json" --request-id $requestId --out "Session-saved.puzzle.json" --json',
  'history list': 'puzzle history list --instance $instance --session $session --json',
  'history undo':
    'puzzle history undo --instance $instance --session $session --token "history-token.json" --entry-id $entryId --request-id $requestId --json',
  'history redo':
    'puzzle history redo --instance $instance --session $session --token "history-token.json" --entry-id $entryId --request-id $requestId --json',
  'setup install':
    'puzzle setup install --source "C:\\Downloads\\PuzzleEditor-CLI" --install-root "D:\\Tools\\PuzzleEditorCLI" --dry-run --json',
  'setup status': 'puzzle setup status --json',
  'setup uninstall': 'puzzle setup uninstall --dry-run --json',
  'setup recover': 'puzzle setup recover --install-root "D:\\Tools\\PuzzleEditorCLI" --json',
  'config path': 'puzzle config path --json',
  'config show': 'puzzle config show --json',
  'skills list': 'puzzle skills list --json',
  'skills read': 'puzzle skills read puzzle-editor --json',
  'skills status': 'puzzle skills status --agent codex --scope user --json',
  'skills install': 'puzzle skills install --agent codex --scope user --json',
  'skills uninstall': 'puzzle skills uninstall --agent codex --scope user --dry-run --json',
  'skills recover': 'puzzle skills recover --agent codex --scope user --json',
  doctor: 'puzzle doctor --offline --json',
} as const;
