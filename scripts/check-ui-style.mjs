import { readFileSync } from 'node:fs';
import { sourceFiles } from './source-files.mjs';
import { inspectUiProject } from './ui-style-rules.mjs';

const files = sourceFiles().filter(
  (file) => file.replaceAll('\\', '/').startsWith('components/') || file === 'styles.css',
);
const errors = inspectUiProject(files.map((file) => [file, readFileSync(file, 'utf8')]));
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(`UI ownership check passed (${files.length} files, no copied decorative profiles).`);
