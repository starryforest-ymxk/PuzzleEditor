/** 公开资料只从显式清单装载；打包、读取、安装共用相同集合，拒绝越界和失效链接。 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as z from 'zod';
import { optionalBytes, conflict } from './files';
import { parseContract } from '../automation/transactionData';

const referenceName = z
  .string()
  .regex(/^[a-z0-9][a-z0-9/.-]*\.(?:md|json|ps1)$/)
  .refine((value) => !value.split('/').some((part) => part === '..' || part === '.' || !part));
const manifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  references: z.array(referenceName).min(1),
});
// 保留 PS1 的 UTF-8 BOM，Windows PowerShell 5.1 需要它正确识别中文源文件。
const decode = (bytes: Uint8Array) =>
  new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
export async function publicSkillFiles(packageRoot: string): Promise<Record<string, string>> {
  const source = path.join(packageRoot, 'agent-skills/puzzle-editor');
  const read = async (file: string) => {
    const bytes = await optionalBytes(file);
    if (!bytes) conflict('Public reference file is missing: ' + file);
    return decode(bytes);
  };
  const manifestText = await read(path.join(source, 'reference-files.json'));
  const manifest = parseContract(manifestSchema, manifestText, 'Public reference manifest');
  const names = manifest.references;
  if (
    new Set(names.map((name) => name.toLowerCase())).size !== names.length ||
    !names.includes('cli-guide.md')
  )
    conflict('Duplicate references or missing guide.');
  const files: Record<string, string> = { 'reference-files.json': manifestText };
  for (const file of ['SKILL.md', 'agents/openai.yaml'])
    files[file] = await read(path.join(source, file));
  // 源码运行没有复制出的 references；完整独立包则必须自足，不能从别处补缺失资料。
  const sourceCheckout = await fs
    .stat(path.join(packageRoot, 'overview/dev/CLI_Distribution_Guide.md'))
    .then(
      () => true,
      () => false,
    );
  for (const name of names) {
    const file = sourceCheckout
      ? path.join(
          packageRoot,
          name === 'cli-guide.md'
            ? 'overview/dev/CLI_Distribution_Guide.md'
            : 'overview/dev/cli-reference/' + name,
        )
      : path.join(source, 'references', name);
    const content = await read(file);
    files['references/' + name] =
      sourceCheckout && name === 'cli-guide.md'
        ? content.replaceAll('(cli-reference/', '(')
        : content;
  }
  validateReferenceLinks(files);
  return files;
}

export function validateReferenceLinks(files: Record<string, string>) {
  for (const [file, text] of Object.entries(files)) {
    if (!file.endsWith('.md')) continue;
    const prose = text.replace(/```[^\n]*\n[\s\S]*?```/gu, '');
    for (const match of prose.matchAll(/\]\(([^)]+)\)/gu)) {
      const link = match[1];
      if (/^https?:\/\//u.test(link)) continue;
      const [rawName, rawAnchor] = link.split('#');
      const name = rawName
        ? path.posix.normalize(
            path.posix.join(path.posix.dirname(file), decodeURIComponent(rawName)),
          )
        : file;
      if (name.startsWith('../') || path.posix.isAbsolute(rawName) || !Object.hasOwn(files, name))
        conflict('Skill reference does not resolve: ' + file + ' -> ' + link);
      if (rawAnchor) {
        const target = files[name];
        const headingIds = [...target.matchAll(/^#{1,6}\s+(.+)$/gmu)].map((heading) =>
          heading[1]
            .toLowerCase()
            .replace(/[^\p{L}\p{N}_ -]/gu, '')
            .replaceAll(' ', '-'),
        );
        const explicitIds = [...target.matchAll(/<a id="([^"]+)"><\/a>/gu)].map(
          (anchor) => anchor[1],
        );
        if (![...headingIds, ...explicitIds].includes(decodeURIComponent(rawAnchor)))
          conflict('Skill anchor does not resolve: ' + file + ' -> ' + link);
      }
    }
  }
}
