import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import ts from 'typescript';
import * as prettier from 'prettier';
import { validateUtf8 } from './utf8.mjs';
import { inspectUiProject } from './ui-style-rules.mjs';

// 反向检查必须真的被拦截，防止配置看似齐全、实际没有覆盖源码。
const eslint = new ESLint();
const lintProbes = [
  [
    'services/automation/QualityProbe.ts',
    "export { INITIAL_STATE } from '../../store/types';",
    'no-restricted-imports',
  ],
  ['cli/QualityProbe.ts', "export { BrowserWindow } from 'electron';", 'no-restricted-imports'],
  [
    'contracts/automation/QualityProbe.ts',
    "export { useState } from 'react';",
    'no-restricted-imports',
  ],
  [
    'services/automation/QualityProbe.ts',
    'export const title = document.title;',
    'no-restricted-globals',
  ],
  [
    'platform/node/QualityProbe.ts',
    "export { projectPlatform } from '../../services/projectPlatform';",
    'no-restricted-imports',
  ],
  [
    'utils/QualityProbe.ts',
    "export const request = () => fetch('/test');",
    'no-restricted-globals',
  ],
  [
    'utils/QualityProbe.ts',
    "export { INITIAL_STATE } from '../store/types';",
    'no-restricted-imports',
  ],
  ['utils/QualityProbe.ts', "export { useState } from 'react';", 'no-restricted-imports'],
  [
    'platform/QualityProbe.ts',
    "export { INITIAL_STATE } from '../store/types';",
    'no-restricted-imports',
  ],
  [
    'hooks/QualityProbe.ts',
    "export { StageOverview } from '../components/Canvas/StageOverview';",
    'no-restricted-imports',
  ],
  [
    'components/QualityProbe.tsx',
    'export const value: any = 1;',
    '@typescript-eslint/no-explicit-any',
  ],
  [
    'components/QualityProbe.tsx',
    "import { useState } from 'react'; export function Probe({ enabled }: { enabled: boolean }) { if (enabled) useState(0); return null; }",
    'react-hooks/rules-of-hooks',
  ],
  [
    'components/QualityProbe.tsx',
    "import { useEffect } from 'react'; export function Probe({ value }: { value: string }) { useEffect(() => { console.log(value); }, []); return null; }",
    'react-hooks/exhaustive-deps',
  ],
  [
    'types/QualityProbe.ts',
    "export { INITIAL_STATE } from '../store/types';",
    'no-restricted-imports',
  ],
  [
    'store/QualityProbe.ts',
    "export { StageOverview } from '../components/Canvas/StageOverview';",
    'no-restricted-imports',
  ],
];
for (const [filePath, source, rule] of lintProbes) {
  const [result] = await eslint.lintText(source, { filePath });
  assert(
    result.messages.some((message) => message.ruleId === rule && message.severity === 2),
    `${rule} did not reject ${filePath}`,
  );
}

const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
assert.equal(config.error, undefined);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
assert.equal(parsed.options.strict, true, 'Frontend strict must remain enabled');
assert.equal(parsed.errors.length, 0);
// 虚拟源码走当前工程的真实类型和编译选项，不写入业务目录。
const probePath = resolve('tests/quality/invalid-contracts.ts');
const source = [
  "import type { Action, EditorState } from '../../store/types';",
  "import type { ActionPolicy } from '../../store/actionPolicy';",
  "import type { SaveResult } from '../../services/projectSession';",
  "import { useEditorState, useEditorDispatch } from '../../store/context';",
  'const nullState: EditorState = null;',
  "const typo: Action = { type: 'MISSPELLED_ACTION' };",
  "const payload: Action = { type: 'UPDATE_NODE', payload: { nodeId: 42, data: {} } };",
  "const policies: Record<Action['type'], ActionPolicy> = {};",
  'const hookState: ReturnType<typeof useEditorState> = true;',
  "const hookDispatch: Parameters<ReturnType<typeof useEditorDispatch>>[0] = { type: 'MISSPELLED_ACTION' };",
  "const save: SaveResult = { status: 'saved' };",
  'void [nullState, typo, payload, policies, hookState, hookDispatch, save];',
].join('\n');
const host = ts.createCompilerHost(parsed.options);
const originalGetSourceFile = host.getSourceFile.bind(host);
host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) =>
  resolve(path) === probePath
    ? ts.createSourceFile(path, source, languageVersion, true)
    : originalGetSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile);
const program = ts.createProgram([probePath], { ...parsed.options, noEmit: true }, host);
const diagnostics = ts
  .getPreEmitDiagnostics(program)
  .filter((diagnostic) => diagnostic.file && resolve(diagnostic.file.fileName) === probePath);
for (let line = 5; line <= 11; line++) {
  assert(
    diagnostics.some(
      (diagnostic) =>
        diagnostic.category === ts.DiagnosticCategory.Error &&
        diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1 === line,
    ),
    `Type contract on line ${line} was not rejected`,
  );
}

assert.equal(validateUtf8(Buffer.from('中文 UTF-8', 'utf8')), '中文 UTF-8');
assert.throws(() => validateUtf8(Buffer.from([0xc3, 0x28])));
assert.throws(() => validateUtf8(Buffer.from('\uFFFD', 'utf8')));
assert.throws(() => validateUtf8(Buffer.from('middle\uFEFFbom', 'utf8')));
assert.equal(
  await prettier.check('const bad={x:1}', {
    ...(await prettier.resolveConfig('prettier.config.mjs')),
    parser: 'typescript',
  }),
  false,
);
console.log(
  `Guard checks passed: ${lintProbes.length} lint probes, 7 type contracts, 3 encoding failures, 1 formatting failure.`,
);

// UI 所属规则也做反向验证，确认复制外观与绕回旧入口会实际失败。
const uiProbes = [
  ['components/Probe.tsx', '<input />'],
  ['components/Probe.tsx', '<input className="ui-control" style={{background:"red"}} />'],
  [
    'components/Probe.tsx',
    'const own={border:"1px solid red"}; <select className="ui-control" style={own} />',
  ],
  ['components/Probe.tsx', '<div className="ctx-item">Delete</div>'],
  ['components/Probe.tsx', '<div role="dialog">Form</div>'],
  [
    'components/Probe.tsx',
    'const getTypeColor=(t:string)=>{switch(t){case "boolean":return "#abc";case "integer":return "#def";case "float":return "#aaa";}}',
  ],
  ['components/Probe.css', ':root {--scope-Global:red;}'],
  ['components/Probe.css', '.ui-control {color:red;}'],
  ['components/Probe.css', '.inspector-input {background:red;}'],
];
for (const probe of uiProbes)
  assert(inspectUiProject([probe]).length > 0, `UI probe was not rejected: ${probe[1]}`);
const copied = '<div style={{color:"gray",fontSize:11,borderRadius:4,padding:8}} />';
assert(
  inspectUiProject([
    ['components/A.tsx', copied],
    ['components/B.tsx', copied],
  ]).some((error) => error.includes('跨文件重复外观')),
);
assert.deepEqual(
  inspectUiProject([
    ['components/Probe.tsx', '<input className="ui-control" style={{width:100,height:24}} />'],
  ]),
  [],
);
assert.deepEqual(
  inspectUiProject([
    ['components/Probe.tsx', '<input className="ui-control" style={{"--control-color":color}} />'],
  ]),
  [],
);
console.log(
  `UI guard checks passed: ${uiProbes.length + 1} negative probes, 2 allowed layout/token probes.`,
);
