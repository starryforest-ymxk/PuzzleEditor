/** 安装事务与恢复共用所有权校验；旧版本保留，未知或被修改的内容绝不静默覆盖。 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { ProjectLease } from '../../dist-node/projectOwnership.js';
import {
  installationRoot,
  userPath,
  addPath,
  removePath,
  commandCandidates,
  pathEquals,
  registryLocation,
} from '../../dist-node/cliEnvironment.js';
import {
  bundleManifestSchema,
  installationSchema,
  installationJournalSchema,
  type InstalledVersion,
  type InstallationRecord,
  type InstallationJournal,
} from '../../contracts/automation/toolingSchemas';
import { API_VERSION } from '../../contracts/automation/readSchemas';
import { AutomationFailure } from '../automation/errors';
import {
  atomicBytes,
  conflict,
  digest,
  optionalBytes,
  plainPath,
  readContract,
  treeFiles,
  writeRecord,
  same,
  pruneEmpty,
} from './files';

const recordName = 'installation.json';
const journalName = 'installation-transaction.json';
export function launcher(record: InstallationRecord) {
  const base = '%~dp0..\\versions\\' + record.activeVersion;
  return (
    '@echo off\r\nsetlocal DisableDelayedExpansion\r\n"' +
    base +
    '\\runtime\\node.exe" "' +
    base +
    '\\app\\cli.js" %*\r\nexit /b %errorlevel%\r\n'
  );
}
export async function verifyFiles(
  root: string,
  version: Pick<InstalledVersion, 'files'>,
  allowMissing = false,
) {
  const expected = new Set(version.files.map((file) => file.path.toLowerCase()));
  if (expected.size !== version.files.length) conflict('Duplicate owned file paths.');
  for (const file of await treeFiles(root))
    if (
      !expected.has(file.toLowerCase()) &&
      !(file.endsWith('/') && [...expected].some((item) => item.startsWith(file.toLowerCase())))
    )
      conflict('Unowned file blocks removal: ' + path.join(root, file));
  for (const file of version.files) {
    const bytes = await optionalBytes(path.join(root, file.path));
    if (!bytes && allowMissing) continue;
    if (!bytes || bytes.length !== file.size || digest(bytes) !== file.sha256)
      conflict('Managed file differs from its manifest: ' + path.join(root, file.path));
  }
}
export async function packageSource(source: string) {
  source = await plainPath(source);
  const manifestFile = path.join(source, 'manifest.json');
  const manifest = await readContract(manifestFile, bundleManifestSchema);
  const manifestBytes = await optionalBytes(manifestFile);
  if (!manifest || !manifestBytes) conflict('A complete package manifest is required.');
  const hash = digest(manifestBytes);
  const files = [
    ...manifest.files,
    { path: 'manifest.json', size: manifestBytes.length, sha256: hash },
  ];
  const version: InstalledVersion = {
    id: manifest.phase + '-' + hash.slice(0, 16),
    phase: manifest.phase,
    manifestSha256: hash,
    files,
  };
  for (const required of [
    'runtime/node.exe',
    'app/cli.js',
    'app/package.json',
    'capabilities.json',
    'AGENTS.md',
    'install-cli.ps1',
    'uninstall-cli.ps1',
  ])
    if (!files.some((file) => file.path === required))
      conflict('Required package file is missing: ' + required);
  await verifyFiles(source, version);
  const runtime = spawnSync(path.join(source, 'runtime/node.exe'), ['--version'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
  });
  const describe = spawnSync(
    path.join(source, 'runtime/node.exe'),
    [path.join(source, 'app/cli.js'), 'describe'],
    { encoding: 'utf8', windowsHide: true, timeout: 15000 },
  );
  let capabilities;
  try {
    capabilities = JSON.parse(describe.stdout);
  } catch {
    conflict('Package CLI cannot describe its capabilities.');
  }
  if (
    runtime.status !== 0 ||
    runtime.stdout.trim() !== 'v' + manifest.runtime.version ||
    describe.status !== 0 ||
    !capabilities?.ok ||
    capabilities.apiVersion !== API_VERSION ||
    capabilities.data.phase !== manifest.phase
  )
    conflict('Package runtime or capabilities do not match the manifest.');
  return { source, version, manifest };
}
export async function installation(explicit?: string) {
  const root = await plainPath(installationRoot(explicit));
  if (root === path.parse(root).root) conflict('A filesystem root cannot be an installation root.');
  const record = await readContract(path.join(root, recordName), installationSchema);
  if (
    record &&
    (!record.versions.some((v) => v.id === record.activeVersion) ||
      new Set(record.versions.map((v) => v.id)).size !== record.versions.length)
  )
    conflict('Invalid installation version ownership.');
  return { root, record };
}
async function verifyInstallation(root: string, record: InstallationRecord | null) {
  const versionDirectories = await fs
    .readdir(path.join(root, 'versions'))
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
  if (versionDirectories.some((id) => !record?.versions.some((version) => version.id === id)))
    conflict('Unowned version directory.');
  const binFiles = await treeFiles(path.join(root, 'bin'));
  if (binFiles.some((file) => file !== 'puzzle.cmd')) conflict('Unowned launcher files.');
  const bytes = await optionalBytes(path.join(root, 'bin/puzzle.cmd'));
  if (record ? !bytes || !bytes.equals(Buffer.from(launcher(record))) : bytes !== null)
    conflict('Managed launcher changed or is unowned.');
  for (const version of record?.versions ?? [])
    await verifyFiles(path.join(root, 'versions', version.id), version);
}
export async function setupStatus(explicit?: string) {
  const { root, record } = await installation(explicit);
  const recoveryRequired = (await optionalBytes(path.join(root, journalName))) !== null;
  if (record && !recoveryRequired) await verifyInstallation(root, record);
  return {
    root,
    installed: record !== null,
    activeVersion: record?.activeVersion ?? null,
    uninstallEntry: record
      ? path.join(root, 'versions', record.activeVersion, 'uninstall-cli.ps1')
      : null,
    versions: record?.versions.map((v) => ({ id: v.id, phase: v.phase })) ?? [],
    path: userPath(),
    registry: registryLocation().scope,
    recoveryRequired,
  };
}
async function removeVersion(root: string, version: InstalledVersion) {
  await verifyFiles(root, version, true);
  for (const file of version.files) await atomicBytes(path.join(root, file.path), null);
  await pruneEmpty(root);
}
async function finishRemoval(root: string, journal: InstallationJournal) {
  if (!journal.tombstone || !journal.before) conflict('Removal journal is incomplete.');
  const tombstone = path.join(root, journal.tombstone);
  const expectedFiles = new Set([
    'bin/puzzle.cmd',
    ...journal.before.versions.flatMap((v) =>
      v.files.map((f) => 'versions/' + v.id + '/' + f.path),
    ),
  ]);
  for (const file of await treeFiles(tombstone))
    if (
      !expectedFiles.has(file) &&
      !(file.endsWith('/') && [...expectedFiles].some((item) => item.startsWith(file)))
    )
      conflict('Unowned tombstone content.');
  const cmd = await optionalBytes(path.join(tombstone, 'bin/puzzle.cmd'));
  if (cmd && !cmd.equals(Buffer.from(launcher(journal.before))))
    conflict('Tombstone launcher changed.');
  for (const version of journal.before.versions)
    await removeVersion(path.join(tombstone, 'versions', version.id), version);
  await atomicBytes(path.join(tombstone, 'bin/puzzle.cmd'), null);
  await pruneEmpty(tombstone);
}
async function recoverLocked(root: string) {
  const journal = await readContract(path.join(root, journalName), installationJournalSchema);
  if (!journal) return { root, recovered: false };
  if (journal.registryKey !== registryLocation().key)
    conflict('Recovery must use the original user PATH namespace.');
  const record = await readContract(path.join(root, recordName), installationSchema);
  const currentPath = userPath();
  if (!same(record, journal.before) && !same(record, journal.after))
    conflict('Installation record changed outside this transaction.');
  if (!same(currentPath, journal.beforePath) && !same(currentPath, journal.afterPath))
    conflict('User PATH changed outside this transaction; preserve it and resolve manually.');
  if (journal.committed) {
    if (!same(record, journal.after)) conflict('Committed installation record changed.');
    if (journal.kind === 'uninstall') await finishRemoval(root, journal);
    else if (journal.after) await verifyInstallation(root, journal.after);
  } else {
    const bytes = await optionalBytes(path.join(root, 'bin/puzzle.cmd'));
    if (
      bytes &&
      ![journal.before, journal.after].some(
        (candidate) => candidate && bytes.equals(Buffer.from(launcher(candidate))),
      )
    )
      conflict('Launcher changed outside this transaction.');
    if (journal.kind === 'uninstall' && journal.tombstone) {
      for (const name of ['versions', 'bin']) {
        const staged = path.join(root, journal.tombstone, name);
        if (
          await fs.lstat(staged).then(
            () => true,
            (error: NodeJS.ErrnoException) => {
              if (error.code === 'ENOENT') return false;
              throw error;
            },
          )
        ) {
          if (
            await fs.lstat(path.join(root, name)).then(
              () => true,
              () => false,
            )
          )
            conflict('External directory blocks rollback.');
          await fs.rename(staged, path.join(root, name));
        }
      }
      await pruneEmpty(path.join(root, journal.tombstone));
    }
    await atomicBytes(
      path.join(root, 'bin/puzzle.cmd'),
      journal.before ? launcher(journal.before) : null,
    );
    await writeRecord(path.join(root, recordName), journal.before);
    if (!same(currentPath, journal.beforePath)) userPath(currentPath, journal.beforePath);
    if (
      journal.newVersion &&
      !journal.before?.versions.some((v) => v.id === journal.newVersion?.id)
    )
      await removeVersion(path.join(root, 'versions', journal.newVersion.id), journal.newVersion);
    await verifyInstallation(root, journal.before);
  }
  await atomicBytes(path.join(root, journalName), null);
  return { root, recovered: true, committed: journal.committed };
}
export async function setup(
  operation: string,
  input: { installRoot?: string; source?: string; dryRun?: boolean },
) {
  if (operation === 'setup status') return setupStatus(input.installRoot);
  const { root } = await installation(input.installRoot);
  if (operation === 'setup recover' && input.dryRun)
    return { ...(await setupStatus(input.installRoot)), dryRun: true };
  const bundle =
    operation === 'setup install' ? await packageSource(path.resolve(input.source ?? '')) : null;
  if (
    bundle &&
    (root === bundle.source ||
      root.startsWith(bundle.source + path.sep) ||
      bundle.source.startsWith(root + path.sep))
  )
    conflict('Installation and source package must be separate.');
  if (!input.dryRun) await fs.mkdir(root, { recursive: true });
  const lease = input.dryRun
    ? null
    : await ProjectLease.acquire(path.join(root, recordName), 'cli-install');
  try {
    if (operation === 'setup recover') return recoverLocked(root);
    if (await optionalBytes(path.join(root, journalName)))
      conflict('Recovery is required: puzzle setup recover --install-root <root>.');
    const { record } = await installation(root);
    await verifyInstallation(root, record);
    const beforePath = userPath();
    const bin = path.join(root, 'bin');
    const conflicts = (await commandCandidates()).filter(
      (file) => !pathEquals(file, path.join(bin, 'puzzle.cmd')),
    );
    if (operation === 'setup install' && conflicts.length)
      conflict('Another puzzle command is visible on PATH: ' + conflicts.join(', '));
    if (operation === 'setup uninstall' && !record)
      return { root, installed: false, changed: false, dryRun: input.dryRun ?? false };
    if (
      operation === 'setup uninstall' &&
      !input.dryRun &&
      record?.versions.some((v) =>
        pathEquals(process.execPath, path.join(root, 'versions', v.id, 'runtime/node.exe')),
      )
    )
      throw new AutomationFailure(
        'EXTERNAL_UNINSTALLER_REQUIRED',
        'Run the packaged PowerShell uninstaller directly, outside puzzle.cmd and the installed runtime.',
        4,
        [],
        {
          entryPoint: path.join(root, 'versions', record.activeVersion, 'uninstall-cli.ps1'),
          executable: path.join(
            process.env.SystemRoot ?? 'C:\\Windows',
            'System32/WindowsPowerShell/v1.0/powershell.exe',
          ),
          args: [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            path.join(root, 'versions', record.activeVersion, 'uninstall-cli.ps1'),
            '--install-root',
            root,
          ],
        },
      );
    const afterPath = bundle
      ? addPath(beforePath, bin)
      : record?.pathAdded
        ? removePath(beforePath, bin)
        : beforePath;
    if (
      !bundle &&
      record?.pathAdded &&
      !record.pathInitiallyAbsent &&
      beforePath.value !== null &&
      afterPath.value === null
    ) {
      afterPath.value = '';
      afterPath.kind = beforePath.kind;
    }
    const after: InstallationRecord | null = bundle
      ? {
          schemaVersion: 1,
          owner: 'PuzzleEditorCLI',
          activeVersion: bundle.version.id,
          versions: record?.versions.some((v) => v.id === bundle.version.id)
            ? record.versions
            : [...(record?.versions ?? []), bundle.version],
          pathAdded: record?.pathAdded || !same(beforePath, afterPath),
          pathInitiallyAbsent: record?.pathInitiallyAbsent ?? beforePath.value === null,
        }
      : null;
    const preview = {
      root,
      dryRun: input.dryRun ?? false,
      activeVersion: after?.activeVersion ?? null,
      previousVersion: record?.activeVersion ?? null,
      pathChange: !same(beforePath, afterPath),
      registry: registryLocation().scope,
      retainedVersions: bundle ? after?.versions.length : 0,
    };
    if (input.dryRun) return preview;
    if (same(record, after) && same(beforePath, afterPath)) return { ...preview, changed: false };
    const journal: InstallationJournal = {
      schemaVersion: 1,
      owner: 'PuzzleEditorCLI',
      kind: bundle ? 'install' : 'uninstall',
      committed: false,
      before: record,
      after,
      beforePath,
      afterPath,
      registryKey: registryLocation().key,
      newVersion: bundle?.version ?? null,
      tombstone: bundle ? null : '.uninstall-' + randomUUID(),
    };
    await writeRecord(path.join(root, journalName), journal);
    try {
      if (bundle && !record?.versions.some((v) => v.id === bundle.version.id)) {
        const target = path.join(root, 'versions', bundle.version.id);
        for (const file of bundle.version.files) {
          const bytes = await optionalBytes(path.join(bundle.source, file.path));
          if (!bytes || digest(bytes) !== file.sha256)
            conflict('Source package changed during installation.');
          await fs.mkdir(path.dirname(path.join(target, file.path)), { recursive: true });
          await fs.writeFile(path.join(target, file.path), bytes, { flag: 'wx' });
        }
        await verifyFiles(target, bundle.version);
      }
      if (journal.tombstone) {
        await fs.mkdir(path.join(root, journal.tombstone));
        for (const name of ['versions', 'bin'])
          await fs.rename(path.join(root, name), path.join(root, journal.tombstone, name));
      } else if (after) await atomicBytes(path.join(bin, 'puzzle.cmd'), launcher(after));
      await writeRecord(path.join(root, recordName), after);
      if (!same(beforePath, afterPath)) userPath(beforePath, afterPath);
      journal.committed = true;
      await writeRecord(path.join(root, journalName), journal);
      if (journal.tombstone) await finishRemoval(root, journal);
      await atomicBytes(path.join(root, journalName), null);
      return { ...preview, changed: true };
    } catch (error) {
      try {
        await recoverLocked(root);
      } catch (recovery) {
        throw new AutomationFailure(
          'INSTALL_RECOVERY_REQUIRED',
          'Installation recovery requires attention: ' + String(recovery),
          4,
          [],
          { root, journal: path.join(root, journalName), originalError: String(error) },
        );
      }
      throw error;
    }
  } finally {
    await lease?.release();
  }
}
