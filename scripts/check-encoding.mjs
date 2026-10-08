import { readFileSync } from 'node:fs';
import { sourceFiles } from './source-files.mjs';
import { validateUtf8 } from './utf8.mjs';

const files = sourceFiles();
let failures = 0;
for (const path of files) {
  try {
    validateUtf8(readFileSync(path));
  } catch (error) {
    console.error(`${path}: ${error.message}`);
    failures++;
  }
}
if (failures) process.exitCode = 1;
else console.log(`UTF-8 check passed (${files.length} source/configuration files).`);
