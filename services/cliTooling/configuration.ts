/** 唯一只读配置解析器：来源可追踪，相对配置路径不影响工程命令的 cwd。 */
import * as path from 'node:path';
import { installationRoot, userHome } from '../../dist-node/cliEnvironment.js';
import { sessionDirectory } from '../../dist-node/sessionSecurity.js';
import { cliConfigSchema } from '../../contracts/automation/toolingSchemas';
import { optionalBytes, readContract, plainPath } from './files';
import { installation } from './installation';
import { versionInfo } from './metadata';
export interface ConfigOptions {
  installRoot?: string;
  config?: string;
}
export async function configLocation(input: ConfigOptions) {
  const file = await plainPath(
    path.resolve(
      input.config ??
        process.env.PUZZLE_EDITOR_CLI_CONFIG ??
        path.join(installationRoot(input.installRoot), 'config.json'),
    ),
  );
  return {
    path: file,
    exists: (await optionalBytes(file)) !== null,
    source: input.config
      ? 'argument'
      : process.env.PUZZLE_EDITOR_CLI_CONFIG
        ? 'environment'
        : 'default',
  };
}
export async function configuration(input: ConfigOptions, phase: string) {
  const location = await configLocation(input);
  const raw = await readContract(location.path, cliConfigSchema);
  const desktop = process.env.PUZZLE_EDITOR_DESKTOP_EXECUTABLE ?? raw?.desktopExecutable;
  const desktopExecutable = desktop
    ? path.resolve(
        process.env.PUZZLE_EDITOR_DESKTOP_EXECUTABLE ? process.cwd() : path.dirname(location.path),
        desktop,
      )
    : null;
  const { root, record } = await installation(input.installRoot);
  const entry = path.resolve(process.argv[1]);
  const packageRoot = path.dirname(path.dirname(entry));
  const installed =
    record?.versions.some(
      (v) =>
        path.resolve(root, 'versions', v.id, 'app/cli.js').toLowerCase() === entry.toLowerCase(),
    ) ?? false;
  return {
    config: location,
    raw,
    effective: { desktopExecutable },
    sources: {
      desktopExecutable: process.env.PUZZLE_EDITOR_DESKTOP_EXECUTABLE
        ? 'environment'
        : raw?.desktopExecutable
          ? 'config-file'
          : 'default',
    },
    installation: {
      root,
      mode: installed ? 'installed' : 'portable',
      activeVersion: record?.activeVersion ?? null,
      packageRoot,
    },
    versions: await versionInfo(phase),
    skills: {
      user: path.join(userHome(), '.agents/skills/puzzle-editor'),
      projectPattern: '<explicit-project-root>/.agents/skills/puzzle-editor',
    },
    sessions: {
      directory: sessionDirectory(),
      source: process.env.PUZZLE_EDITOR_SESSION_DIR ? 'environment' : 'default',
    },
    platform: { current: process.platform + '-' + process.arch, supported: ['win32-x64', 'codex'] },
  };
}
