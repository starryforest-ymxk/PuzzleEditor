import type { EditorUIState, ProjectData } from '../../types/project';
import { normalizePanelSizes } from '../panelSizes';
import { normalizeProjectForStore } from '../projectNormalizer';
import { projectData, readRuntimeData } from './domain';
import { asObject, boolean, checkJsonDepth, defaulted, dictionary, fail, id, ImportContext, knownFields, nullable, number, object, oneOf, optional, ProjectImportError, string, type ImportNotice, type Reader } from './readers';

export { ProjectImportError } from './readers';
export type { ImportNotice, ProjectImportOptions } from './readers';
import type { ProjectImportOptions } from './readers';
export type ProjectSourceFormat = 'project' | 'export' | 'raw' | 'legacy-manifest';
export interface ImportedProject {
    project: ProjectData;
    editorState?: EditorUIState;
    format: ProjectSourceFormat;
    notices: ImportNotice[];
    migrated: boolean;
}

const ui: Reader<EditorUIState> = (input, path, context) => {
    const result = object({
        panelSizes: optional(object({ explorerWidth: optional(number), inspectorWidth: optional(number), stagesHeight: optional(number) })),
        stageExpanded: defaulted(dictionary(boolean), {}),
        currentStageId: defaulted(nullable(id), null), currentNodeId: defaulted(nullable(id), null), currentGraphId: defaulted(nullable(id), null),
        view: defaulted(oneOf('EDITOR', 'BLACKBOARD'), 'EDITOR')
    })(input, path, context);
    const panelSizes = normalizePanelSizes(result.panelSizes);
    if (JSON.stringify(result.panelSizes) !== JSON.stringify(panelSizes)) {
        context.note(`${path}.panelSizes`, 'Restored missing panel sizes or constrained sizes to the supported range.');
    }
    return { ...result, panelSizes };
};

function runtimeVersion(value: unknown, path: string, context: ImportContext): void {
    const version = string(value, path, context);
    if (version !== '1.0.0') fail(path, `Unsupported manifest version ${JSON.stringify(version)}. Supported version: 1.0.0.`);
}

/** 文件类型只依据明确封装或 meta + stageTree 识别；未知标识绝不进入原始数据兜底。 */
export function importProject(content: string, options: ProjectImportOptions = {}): ImportedProject {
    let parsed: unknown;
    try { parsed = JSON.parse(content.replace(/^\uFEFF/, '')); }
    catch (error) { throw new ProjectImportError('$', `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`); }
    checkJsonDepth(parsed);
    const envelope = asObject(parsed, '$');
    const context = new ImportContext(options);
    let project: ProjectData;
    let editorState: EditorUIState | undefined;
    let format: ProjectSourceFormat;

    if (Object.hasOwn(envelope, 'fileType')) {
        if (envelope.fileType === 'puzzle-project') {
            knownFields(envelope, '$', ['fileType', 'editorVersion', 'savedAt', 'project', 'editorState']);
            const editorVersion = string(envelope.editorVersion, '$.editorVersion', context);
            if (!editorVersion.trim()) fail('$.editorVersion', 'Expected a non-empty editor version.');
            string(envelope.savedAt, '$.savedAt', context);
            // editorVersion 描述生产软件，不是 Schema；真正的可读性由下面的结构校验保证。
            if (editorVersion !== '1.0.0') context.note('$.editorVersion', `File was produced by editor ${editorVersion}; compatibility was checked by structure.`);
            project = projectData(envelope.project, '$.project', context);
            editorState = optional(ui)(envelope.editorState, '$.editorState', context);
            format = 'project';
        } else if (envelope.fileType === 'puzzle-export') {
            knownFields(envelope, '$', ['fileType', 'manifestVersion', 'exportedAt', 'projectName', 'projectVersion', 'data']);
            runtimeVersion(envelope.manifestVersion, '$.manifestVersion', context);
            const exportedAt = string(envelope.exportedAt, '$.exportedAt', context);
            project = readRuntimeData(envelope.data, '$.data', {
                id: context.runtimeProjectId ?? `proj-imported-${crypto.randomUUID()}`, name: string(envelope.projectName, '$.projectName', context),
                version: string(envelope.projectVersion, '$.projectVersion', context),
                createdAt: context.now, updatedAt: exportedAt
            }, context);
            format = 'export';
        } else {
            fail('$.fileType', `Unsupported file type ${JSON.stringify(envelope.fileType)}.`);
        }
    } else if (Object.hasOwn(envelope, 'manifestVersion') || Object.hasOwn(envelope, 'project')) {
        knownFields(envelope, '$', ['manifestVersion', 'exportedAt', 'project']);
        runtimeVersion(envelope.manifestVersion, '$.manifestVersion', context);
        string(envelope.exportedAt, '$.exportedAt', context);
        project = projectData(envelope.project, '$.project', context);
        format = 'legacy-manifest';
        context.note('$', 'Imported a legacy ExportManifest as an editable copy.', true);
    } else {
        if (!Object.hasOwn(envelope, 'meta') || !Object.hasOwn(envelope, 'stageTree')) {
            fail('$', 'Unrecognized project format. Expected puzzle-project, puzzle-export, a legacy ExportManifest, or ProjectData with meta and stageTree.');
        }
        project = projectData(envelope, '$', context);
        format = 'raw';
        context.note('$', 'Imported raw ProjectData as an editable copy.');
    }

    if (format !== 'project') context.note('$', 'Save this imported copy as a .puzzle.json project. The source file will not be overwritten.');
    return { project: normalizeProjectForStore(project, context), editorState, format, notices: context.notices, migrated: context.migrated };
}
