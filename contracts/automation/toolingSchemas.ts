/** 工具配套接口与安装记录同源；环境写入不代表任何工程最高权限授权。 */
import * as z from 'zod';
import { nonEmptyString } from './primitives';

const target = { installRoot: nonEmptyString.optional() };
const skillTarget = z
  .strictObject({
    ...target,
    agent: z.literal('codex'),
    scope: z.enum(['user', 'project']),
    projectRoot: nonEmptyString.optional(),
    dryRun: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if ((value.scope === 'project') !== Boolean(value.projectRoot))
      ctx.addIssue({
        code: 'custom',
        message: 'Project scope requires --project-root; user scope forbids it.',
        path: ['projectRoot'],
      });
  });
export const toolingInputSchemas = {
  doctor: z
    .strictObject({
      ...target,
      config: nonEmptyString.optional(),
      offline: z.boolean().default(false),
      online: z.boolean().default(false),
      instance: z.uuid().optional(),
      session: z.number().int().nonnegative().optional(),
      project: nonEmptyString.optional(),
    })
    .superRefine((value, ctx) => {
      if (
        (value.offline && value.online) ||
        value.online !== (value.instance !== undefined && value.session !== undefined) ||
        (!value.online && (value.instance !== undefined || value.session !== undefined))
      )
        ctx.addIssue({
          code: 'custom',
          message:
            '--online requires explicit --instance/--session and cannot be combined with --offline.',
        });
    }),
  version: z.strictObject({}),
  'config path': z.strictObject({ ...target, config: nonEmptyString.optional() }),
  'config show': z.strictObject({ ...target, config: nonEmptyString.optional() }),
  'skills list': z.strictObject({}),
  'skills read': z.strictObject({ name: z.literal('puzzle-editor') }),
  'skills install': skillTarget,
  'skills status': skillTarget,
  'skills uninstall': skillTarget,
  'skills recover': skillTarget,
  'setup install': z.strictObject({
    ...target,
    source: nonEmptyString,
    dryRun: z.boolean().default(false),
  }),
  'setup status': z.strictObject(target),
  'setup uninstall': z.strictObject({ ...target, dryRun: z.boolean().default(false) }),
  'setup recover': z.strictObject({ ...target, dryRun: z.boolean().default(false) }),
};
export const toolingCapabilities = [
  {
    operation: 'doctor',
    implemented: true,
    permission: 'read' as const,
    summary:
      'Read-only offline diagnostics, optional explicit --project or --online --instance/--session; never repairs or starts the desktop.',
  },
  {
    operation: 'skills list',
    implemented: true,
    permission: 'read' as const,
    summary: 'List the offline Skill shipped with this CLI.',
  },
  {
    operation: 'skills read',
    implemented: true,
    permission: 'read' as const,
    summary: 'Read puzzle-editor Skill and generated references offline.',
  },
  {
    operation: 'skills status',
    implemented: true,
    permission: 'read' as const,
    summary: 'Inspect an explicit Codex user/project Skill target without creating files.',
  },
  {
    operation: 'skills install',
    implemented: true,
    permission: 'environment_write' as const,
    summary:
      'Install/update only an unmodified managed Skill; --dry-run previews files and target.',
    sideEffects: ['explicit Skill directory', 'ownership record'],
  },
  {
    operation: 'skills uninstall',
    implemented: true,
    permission: 'environment_write' as const,
    summary: 'Remove only an unmodified managed Skill at the explicit target.',
    sideEffects: ['explicit Skill directory', 'ownership record'],
  },
  {
    operation: 'skills recover',
    implemented: true,
    permission: 'environment_write' as const,
    summary: 'Recover an interrupted managed Skill transaction at the explicit target.',
    sideEffects: ['explicit Skill directory', 'ownership record'],
  },
  {
    operation: 'config path',
    implemented: true,
    permission: 'read' as const,
    summary: 'Read the expected CLI config location and existence without creating or parsing it.',
  },
  {
    operation: 'config show',
    implemented: true,
    permission: 'read' as const,
    summary:
      'Read strict optional configuration, effective values and their sources; never grants permissions.',
  },
  {
    operation: 'version',
    implemented: true,
    permission: 'read' as const,
    summary: 'Read product, CLI, runtime and protocol versions.',
  },
  {
    operation: 'setup install',
    implemented: true,
    permission: 'environment_write' as const,
    summary:
      'Install or upgrade a verified standalone package to a user-owned root; --dry-run previews without writing.',
    sideEffects: ['managed installation files', 'user PATH'],
  },
  {
    operation: 'setup status',
    implemented: true,
    permission: 'read' as const,
    summary: 'Read managed installation status and recovery requirements without creating files.',
  },
  {
    operation: 'setup uninstall',
    implemented: true,
    permission: 'environment_write' as const,
    summary:
      'Remove verified managed files and only the owned user PATH entry; use the packaged uninstall entry on Windows.',
    sideEffects: ['managed installation files', 'user PATH'],
  },
  {
    operation: 'setup recover',
    implemented: true,
    permission: 'environment_write' as const,
    summary: 'Recover a recorded installation transaction; unknown external changes are refused.',
    sideEffects: ['managed installation files', 'user PATH'],
  },
];
export const cliConfigSchema = z.strictObject({
  schemaVersion: z.literal(1),
  desktopExecutable: nonEmptyString.optional(),
});
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
export const packagePathSchema = z
  .string()
  .min(1)
  .max(400)
  .refine(
    (value) =>
      !value.includes('\\') &&
      !value.includes(':') &&
      !Array.from(value).some((char) => char.charCodeAt(0) < 32) &&
      value
        .split('/')
        .every(
          (part) =>
            part !== '' &&
            part !== '.' &&
            part !== '..' &&
            !/[. ]$/u.test(part) &&
            !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part),
        ),
    'A normalized package-relative path is required.',
  );
export const packageFileSchema = z.strictObject({
  path: packagePathSchema,
  size: z
    .number()
    .int()
    .nonnegative()
    .max(256 * 1024 * 1024),
  sha256: hashSchema,
});
export const bundleManifestSchema = z.strictObject({
  name: nonEmptyString,
  version: nonEmptyString,
  phase: z.string().regex(/^C\d+$/u),
  createdAt: nonEmptyString,
  runtime: z.strictObject({
    version: nonEmptyString,
    platform: z.literal('win-x64'),
    archive: nonEmptyString,
    url: nonEmptyString,
    sha256: hashSchema,
    checksums: nonEmptyString,
  }),
  files: z.array(packageFileSchema).min(5).max(1000),
});
export const installedVersionSchema = z.strictObject({
  id: z.string().regex(/^C\d+-[a-f0-9]{16}$/u),
  phase: z.string().regex(/^C\d+$/u),
  manifestSha256: hashSchema,
  files: z.array(packageFileSchema).min(5).max(1001),
});
export const installationSchema = z.strictObject({
  schemaVersion: z.literal(1),
  owner: z.literal('PuzzleEditorCLI'),
  activeVersion: installedVersionSchema.shape.id,
  versions: z.array(installedVersionSchema).min(1).max(100),
  pathAdded: z.boolean(),
  pathInitiallyAbsent: z.boolean(),
});
export const userPathSchema = z.strictObject({
  value: z.string().nullable(),
  kind: z.enum(['String', 'ExpandString']),
});
export const installationJournalSchema = z.strictObject({
  schemaVersion: z.literal(1),
  owner: z.literal('PuzzleEditorCLI'),
  kind: z.enum(['install', 'uninstall']),
  committed: z.boolean(),
  before: installationSchema.nullable(),
  after: installationSchema.nullable(),
  registryKey: nonEmptyString,
  beforePath: userPathSchema,
  afterPath: userPathSchema,
  newVersion: installedVersionSchema.nullable(),
  tombstone: z
    .string()
    .regex(/^\.uninstall-[a-f0-9-]{36}$/u)
    .nullable(),
});
export type InstallationRecord = z.infer<typeof installationSchema>;
export type InstalledVersion = z.infer<typeof installedVersionSchema>;
export type InstallationJournal = z.infer<typeof installationJournalSchema>;
export const skillRecordSchema = z.strictObject({
  schemaVersion: z.literal(1),
  owner: z.literal('PuzzleEditorCLI'),
  target: nonEmptyString,
  phase: nonEmptyString,
  files: z.array(packageFileSchema).min(1).max(100),
});
export const skillJournalSchema = z.strictObject({
  before: skillRecordSchema.nullable(),
  after: skillRecordSchema.nullable(),
  committed: z.boolean(),
  suffix: z.uuid(),
});
export type SkillRecord = z.infer<typeof skillRecordSchema>;
