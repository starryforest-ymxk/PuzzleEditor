/** doctor 聚合独立只读检查；单项异常不提前结束，不泄露会话密钥或项目正文。 */
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import {
  commandCandidates,
  installationRoot,
  userPath,
  pathContains,
  pathEquals,
} from '../../dist-node/cliEnvironment.js';
import { verifySessionDirectory } from '../../dist-node/sessionSecurity.js';
import { requestSession } from '../../dist-node/sessionTransport.js';
import { inspectProjectOwnership } from '../../dist-node/projectOwnership.js';
import { readProjectContext } from '../automation/readService';
import { configuration, type ConfigOptions } from './configuration';
import { setupStatus, packageSource } from './installation';
import { skillStatus, skillContents } from './skills';
import { versionInfo } from './metadata';
export interface DoctorOptions extends ConfigOptions {
  offline: boolean;
  online: boolean;
  instance?: string;
  session?: number;
  project?: string;
}
interface Check {
  code: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  message: string;
  evidence?: unknown;
  suggestion?: string;
}
export async function doctor(input: DoctorOptions, phase: string) {
  const checks: Check[] = [];
  const inspect = async (
    code: string,
    task: () => Promise<Omit<Check, 'code'>>,
    suggestion: string,
  ) => {
    try {
      checks.push({ code, ...(await task()) });
    } catch (error) {
      checks.push({
        code,
        status: 'fail',
        message: error instanceof Error ? error.message : String(error),
        suggestion,
      });
    }
  };
  await inspect(
    'RUNTIME',
    async () => {
      const version = await versionInfo(phase),
        [major, minor] = process.versions.node.split('.').map(Number);
      const supported =
        (major === 20 && minor >= 19) || (major === 22 && minor >= 13) || major >= 24;
      return {
        status: supported ? 'pass' : 'fail',
        message: supported ? 'CLI runtime is supported.' : 'CLI runtime is unsupported.',
        evidence: version,
      };
    },
    'Use the bundled Windows x64 Node runtime.',
  );
  await inspect(
    'CONFIG',
    async () => {
      const config = await configuration(input, phase);
      return {
        status: 'pass',
        message: config.config.exists
          ? 'Configuration is valid.'
          : 'Configuration is absent; derived defaults apply.',
        evidence: {
          config: config.config,
          sources: config.sources,
          installation: config.installation,
        },
      };
    },
    'Correct the reported optional config; never put authorization flags in it.',
  );
  await inspect(
    'DESKTOP_PATH',
    async () => {
      const desktop = (await configuration(input, phase)).effective.desktopExecutable;
      if (!desktop) return { status: 'skip', message: 'No desktop executable was configured.' };
      const stat = await fs.stat(desktop);
      return {
        status: stat.isFile() ? 'pass' : 'fail',
        message: stat.isFile()
          ? 'Configured desktop file exists; it was not executed.'
          : 'Configured desktop path is not a file.',
        evidence: { path: desktop },
      };
    },
    'Set desktopExecutable to the actual desktop EXE path.',
  );
  await inspect(
    'PACKAGE',
    async () => {
      const root = path.dirname(path.dirname(path.resolve(process.argv[1])));
      if (
        !(await fs.stat(path.join(root, 'manifest.json')).then(
          () => true,
          () => false,
        ))
      ) {
        if (path.basename(path.dirname(process.argv[1])) === 'dist-cli')
          return { status: 'skip', message: 'Development build has no distribution manifest.' };
        return {
          status: 'fail',
          message: 'Distribution manifest is missing.',
          suggestion: 'Re-extract a verified release ZIP.',
        };
      }
      const bundle = await packageSource(root);
      if (!bundle.version.files.some((file) => file.path.startsWith('licenses/')))
        return { status: 'fail', message: 'Distribution licenses are missing.' };
      return {
        status: 'pass',
        message: 'Package runtime and all file fingerprints match.',
        evidence: {
          phase: bundle.manifest.phase,
          version: bundle.manifest.version,
          manifestSha256: bundle.version.manifestSha256,
        },
      };
    },
    'Re-extract a verified release ZIP; do not overwrite altered managed files.',
  );
  await inspect(
    'INSTALLATION',
    async () => {
      const status = await setupStatus(input.installRoot);
      return {
        status: status.recoveryRequired ? 'fail' : status.installed ? 'pass' : 'skip',
        message: status.recoveryRequired
          ? 'Installation recovery is required.'
          : status.installed
            ? 'Managed installation is intact.'
            : 'Portable mode does not require global installation.',
        evidence: {
          root: status.root,
          activeVersion: status.activeVersion,
          recoveryRequired: status.recoveryRequired,
        },
      };
    },
    'Run setup recover for a recorded interruption; preserve external changes.',
  );
  await inspect(
    'COMMAND_PATH',
    async () => {
      const bin = path.join(installationRoot(input.installRoot), 'bin'),
        candidates = await commandCandidates();
      const foreign = candidates.filter((file) => !pathEquals(file, path.join(bin, 'puzzle.cmd')));
      const registryContains = pathContains(userPath().value, bin),
        processContains = pathContains(process.env.PATH ?? null, bin);
      return {
        status: foreign.length || (registryContains && !processContains) ? 'warn' : 'pass',
        message: foreign.length
          ? 'Another puzzle command is visible on PATH.'
          : registryContains && !processContains
            ? 'The current process PATH has not refreshed.'
            : 'No command shadowing was observed.',
        evidence: { registryContains, processContains, candidates },
        suggestion: foreign.length
          ? 'Resolve command precedence explicitly before installation.'
          : 'Open a new terminal after installing.',
      };
    },
    'Inspect user PATH without replacing unrelated entries.',
  );
  await inspect(
    'SKILL',
    async () => {
      const status = await skillStatus(
        { agent: 'codex', scope: 'user', installRoot: input.installRoot },
        phase,
      );
      if (status.recoveryRequired)
        return {
          status: 'fail',
          message: 'Skill transaction recovery is required.',
          evidence: status,
        };
      if (!status.installed)
        return {
          status: 'warn',
          message: 'Optional user Skill is not installed.',
          evidence: status,
          suggestion: 'Preview skills install --agent codex --scope user.',
        };
      if (!status.managed)
        return {
          status: 'warn',
          message: 'An external same-name Skill is present; it will not be overwritten.',
          evidence: status,
        };
      const files = await skillContents(phase);
      const compatibility = JSON.parse(
        await fs.readFile(path.join(status.target, 'compatibility.json'), 'utf8'),
      );
      const expected = JSON.parse(files['compatibility.json']);
      return {
        status:
          compatibility.apiVersion !== expected.apiVersion ||
          compatibility.policyVersion !== expected.policyVersion
            ? 'fail'
            : status.updateAvailable
              ? 'warn'
              : 'pass',
        message: status.updateAvailable
          ? 'Managed Skill can be updated; host discovery is not verified.'
          : 'Managed Skill fingerprints match; host discovery is not verified.',
        evidence: status,
      };
    },
    'Preserve user edits; use skills status/recover or preview an update.',
  );
  await inspect(
    'SESSION_DIRECTORY',
    async () => {
      const directory = await verifySessionDirectory(false);
      return {
        status: directory ? 'pass' : 'skip',
        message: directory
          ? 'Current-user discovery directory access is verified.'
          : 'No discovery directory exists; offline commands remain available.',
        evidence: { directory },
      };
    },
    'Inspect the current-user session directory ACL; doctor does not repair it.',
  );
  if (input.online)
    await inspect(
      'ONLINE_SESSION',
      async () => {
        const result = await requestSession(input.instance!, {
          operation: 'status',
          sessionId: input.session!,
        });
        if (!result.ok)
          throw new Error(
            result.error?.message ?? 'The explicit session rejected its status request.',
          );
        return {
          status: 'pass',
          message: 'Explicit desktop session authenticated and responded; no edits were sent.',
          evidence: { instance: input.instance, session: input.session },
        };
      },
      'Use a compatible desktop instance/session; do not fall back to disk editing.',
    );
  else
    checks.push({
      code: 'ONLINE_SESSION',
      status: 'skip',
      message: 'Online handshake was not requested.',
    });
  if (input.project) {
    await inspect(
      'PROJECT',
      async () => {
        const context = await readProjectContext(input.project!);
        const errors = context.diagnostics.filter((item) => item.level === 'error').length;
        return {
          status: errors ? 'fail' : context.diagnostics.length ? 'warn' : 'pass',
          message: errors
            ? 'Project has domain validation errors.'
            : 'Project structure and domain validation completed.',
          evidence: {
            source: context.source,
            errors,
            warnings: context.diagnostics.length - errors,
            diagnostics: context.diagnostics,
          },
        };
      },
      'Use inspect/validate to resolve the reported project diagnostics.',
    );
    await inspect(
      'PROJECT_OWNERSHIP',
      async () => {
        const state = await inspectProjectOwnership(input.project!);
        return {
          status: state.status === 'held' || state.status === 'unknown' ? 'warn' : 'pass',
          message: 'Ownership is a read-only observation; it never authorizes a later write.',
          evidence: state,
          suggestion: 'Use explicit online commands for a held editor project.',
        };
      },
      'Inspect the file identity and owner before planning any write.',
    );
  }
  return { healthy: !checks.some((check) => check.status === 'fail'), checks };
}
