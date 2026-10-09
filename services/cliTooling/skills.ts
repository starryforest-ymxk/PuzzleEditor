/** Skill 内容离线生成，目标由明确作用域解析；双目录事务保护外部 Skill 和用户修改。 */
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ProjectLease } from '../../dist-node/projectOwnership.js';
import { installationRoot, userHome, pathEquals } from '../../dist-node/cliEnvironment.js';
import {
  skillRecordSchema,
  skillJournalSchema,
  type SkillRecord,
} from '../../contracts/automation/toolingSchemas';
import { API_VERSION } from '../../contracts/automation/readSchemas';
import { POLICY_VERSION } from '../../contracts/automation/permissions';
import {
  plainPath,
  readContract,
  digest,
  same,
  conflict,
  writeRecord,
  atomicBytes,
  pruneEmpty,
} from './files';
import { verifyFiles } from './installation';
import { AutomationFailure } from '../automation/errors';
import { publicSkillFiles } from './referenceFiles';
export interface SkillOptions {
  installRoot?: string;
  agent: 'codex';
  scope: 'user' | 'project';
  projectRoot?: string;
  dryRun?: boolean;
}
export async function skillContents(phase: string) {
  const packageRoot = path.dirname(path.dirname(path.resolve(process.argv[1])));
  const files = await publicSkillFiles(packageRoot);
  files['compatibility.json'] =
    JSON.stringify({ apiVersion: API_VERSION, policyVersion: POLICY_VERSION, phase }, null, 2) +
    '\n';
  const frontmatter = /^---\r?\nname: puzzle-editor\r?\ndescription: .+\r?\n---\r?\n/u;
  if (
    !frontmatter.test(files['SKILL.md']) ||
    !files['agents/openai.yaml'].includes('display_name: "PuzzleEditor"')
  )
    conflict('Skill metadata is invalid.');
  return files;
}
async function location(input: SkillOptions) {
  const base = input.scope === 'project' ? path.resolve(input.projectRoot ?? '') : userHome();
  if (input.scope === 'project' && !(await fs.stat(base)).isDirectory())
    conflict('An existing explicit project directory is required.');
  const target = await plainPath(path.join(base, '.agents/skills/puzzle-editor'));
  const root = await plainPath(installationRoot(input.installRoot));
  const recordFile = path.join(root, 'skills', digest(target.toLowerCase()) + '.json');
  const journalFile = recordFile + '.transaction.json';
  const record = await readContract(recordFile, skillRecordSchema);
  if (record && !pathEquals(record.target, target))
    conflict('Skill ownership record belongs to another target.');
  return { target, recordFile, journalFile, record };
}
async function exists(target: string) {
  return await fs.lstat(target).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    },
  );
}
async function clean(target: string, record: SkillRecord, allowMissing = false) {
  if (!(await exists(target))) return;
  await verifyFiles(target, record, allowMissing);
  for (const file of record.files) await atomicBytes(path.join(target, file.path), null);
  await pruneEmpty(target);
}
export async function skillStatus(input: SkillOptions, phase: string) {
  const state = await location(input);
  const present = await exists(state.target);
  const recoveryRequired = await exists(state.journalFile);
  if (state.record && !recoveryRequired) await verifyFiles(state.target, state.record);
  // 旧记录已有逐文件指纹，不需要迁移记录格式即可识别同批次的文档更新。
  const expected = state.record
    ? Object.entries(await skillContents(phase)).map(([file, text]) => ({
        path: file,
        size: Buffer.byteLength(text),
        sha256: digest(text),
      }))
    : [];
  const ordered = (files: SkillRecord['files']) =>
    [...files].sort((a, b) => a.path.localeCompare(b.path));
  return {
    target: state.target,
    installed: present,
    managed: !!state.record,
    phase: state.record?.phase ?? null,
    updateAvailable:
      !!state.record &&
      (state.record.phase !== phase || !same(ordered(state.record.files), ordered(expected))),
    recoveryRequired,
    hostDiscovery: 'not-verified',
    record: state.recordFile,
  };
}
async function recover(state: Awaited<ReturnType<typeof location>>) {
  const journal = await readContract(state.journalFile, skillJournalSchema);
  if (!journal) return { target: state.target, recovered: false };
  for (const record of [journal.before, journal.after])
    if (record && !pathEquals(record.target, state.target))
      conflict('Skill transaction belongs to another target.');
  if (!same(state.record, journal.before) && !same(state.record, journal.after))
    conflict('Skill record changed outside this transaction.');
  const staging = state.target + '.next-' + journal.suffix,
    backup = state.target + '.old-' + journal.suffix;
  if (journal.committed) {
    if (!same(state.record, journal.after)) conflict('Committed Skill record changed.');
    if (journal.after) await verifyFiles(state.target, journal.after);
    else if (await exists(state.target)) conflict('External Skill blocks completed removal.');
    if (journal.before) await clean(backup, journal.before, true);
  } else {
    if (await exists(backup)) {
      if (!journal.before) conflict('Unknown Skill backup.');
      await verifyFiles(backup, journal.before);
      if (await exists(state.target)) {
        if (!journal.after) conflict('External target blocks recovery.');
        await clean(state.target, journal.after);
      }
      await fs.rename(backup, state.target);
    } else if (!journal.before && (await exists(state.target))) {
      if (!journal.after) conflict('Unknown Skill target.');
      await clean(state.target, journal.after);
    }
    if (journal.before) await verifyFiles(state.target, journal.before);
    await writeRecord(state.recordFile, journal.before);
  }
  if (journal.after && (await exists(staging))) await clean(staging, journal.after);
  await atomicBytes(state.journalFile, null);
  return { target: state.target, recovered: true, committed: journal.committed };
}
export async function skills(operation: string, input: SkillOptions, phase: string) {
  if (operation === 'skills list')
    return {
      skills: [{ name: 'puzzle-editor', agent: 'codex', phase, scopes: ['user', 'project'] }],
    };
  if (operation === 'skills read')
    return { name: 'puzzle-editor', phase, files: await skillContents(phase) };
  if (operation === 'skills status') return skillStatus(input, phase);
  const state = await location(input);
  if (operation === 'skills recover' && input.dryRun)
    return { ...(await skillStatus(input, phase)), dryRun: true };
  if (input.dryRun && operation !== 'skills recover') {
    if (state.record) await verifyFiles(state.target, state.record);
    else if (await exists(state.target))
      conflict('An external Skill already occupies this target.');
    if (operation === 'skills install') await skillContents(phase);
    return { target: state.target, dryRun: true, action: operation };
  }
  await fs.mkdir(path.dirname(state.recordFile), { recursive: true });
  const lease = await ProjectLease.acquire(state.recordFile, 'cli-skill');
  try {
    // 获取锁后重读，不能把排队前的状态用于覆盖后来的安装。
    const locked = await location(input);
    if (operation === 'skills recover') return recover(locked);
    if (await exists(locked.journalFile))
      conflict('Skill recovery is required; run skills recover with the same target options.');
    if (locked.record) await verifyFiles(locked.target, locked.record);
    else if (await exists(locked.target))
      conflict('An external Skill already occupies this target.');
    const content = operation === 'skills install' ? await skillContents(phase) : null;
    const after: SkillRecord | null = content
      ? {
          schemaVersion: 1,
          owner: 'PuzzleEditorCLI',
          target: locked.target,
          phase,
          files: Object.entries(content).map(([file, text]) => ({
            path: file,
            size: Buffer.byteLength(text),
            sha256: digest(text),
          })),
        }
      : null;
    if (same(locked.record, after)) return { target: locked.target, changed: false };
    const journal = { before: locked.record, after, committed: false, suffix: randomUUID() };
    const staging = locked.target + '.next-' + journal.suffix,
      backup = locked.target + '.old-' + journal.suffix;
    await writeRecord(locked.journalFile, journal);
    try {
      if (content && after) {
        for (const [file, text] of Object.entries(content)) {
          await fs.mkdir(path.dirname(path.join(staging, file)), { recursive: true });
          await fs.writeFile(path.join(staging, file), text, { flag: 'wx' });
        }
        await verifyFiles(staging, after);
      }
      if (locked.record) await fs.rename(locked.target, backup);
      if (after) await fs.rename(staging, locked.target);
      await writeRecord(locked.recordFile, after);
      journal.committed = true;
      await writeRecord(locked.journalFile, journal);
      if (locked.record) await clean(backup, locked.record);
      await atomicBytes(locked.journalFile, null);
      return {
        target: locked.target,
        changed: true,
        installed: !!after,
        reloadHint:
          'Refresh/restart Codex if the Skill is not listed; filesystem installation does not prove host discovery.',
      };
    } catch (error) {
      try {
        await recover(await location(input));
      } catch (recovery) {
        throw new AutomationFailure('SKILL_RECOVERY_REQUIRED', String(recovery), 4, [], {
          target: locked.target,
          journal: locked.journalFile,
          originalError: String(error),
        });
      }
      throw error;
    }
  } finally {
    await lease.release();
  }
}
