import { readFileSync, writeFileSync } from 'node:fs';
import * as prettier from 'prettier';
import { formatFiles } from './source-files.mjs';

const write = process.argv.includes('--write');
const files = formatFiles();
let failures = 0;
for (const path of files) {
  const source = readFileSync(path, 'utf8');
  const options = { ...(await prettier.resolveConfig(path)), filepath: path };
  if (await prettier.check(source, options)) continue;
  if (write) writeFileSync(path, await prettier.format(source, options), 'utf8');
  else {
    console.error(`Formatting required: ${path}`);
    failures++;
  }
}
if (failures) process.exitCode = 1;
else
  console.log(
    `Format ${write ? 'write' : 'check'} passed (${files.length} files in the documented scope).`,
  );
