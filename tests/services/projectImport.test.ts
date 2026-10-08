import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importProject, ProjectImportError } from '../../utils/projectImport';
import { prepareProject, serializeProject, projectUI } from '../../services/projectFiles';
import { normalizeForExport } from '../../utils/exportNormalizer';
import { createProjectFixture, createEditorFixture } from '../fixtures/editor';
import type { ProjectData, ProjectFile } from '../../types/project';
import { createEditorStore } from '../../store/editorStore';

const currentText = readFileSync(new URL('../../overview/example_project/BubbleHorror.puzzle.json', import.meta.url), 'utf8');
const legacyText = readFileSync(new URL('../fixtures/imports/legacy-88477b7.export.json', import.meta.url), 'utf8');
const file = (): ProjectFile => JSON.parse(serializeProject(createProjectFixture(), undefined, '2026-10-07T00:00:00Z'));
const read = (input: unknown) => importProject(JSON.stringify(input));

/** 含参数、引用与两个画布的独立夹具，避免只验证空项目能通过。 */
function richProject(): ProjectData {
    const project = createProjectFixture();
    project.blackboard.globalVariables.score = { id: 'score', name: 'Score', type: 'integer', value: 3, scope: 'Global', state: 'Draft', displayOrder: 5 };
    project.scripts.scripts.play = { id: 'play', name: 'Play', category: 'Performance', state: 'Draft' };
    project.nodes.node = { id: 'node', name: 'Node', stageId: project.stageTree.rootId, stateMachineId: 'fsm', localVariables: {}, eventListeners: [] };
    project.stateMachines.fsm = {
        id: 'fsm', initialStateId: 'state', states: { state: { id: 'state', name: 'State', position: { x: 500, y: 150 }, eventListeners: [] } },
        transitions: { transition: {
            id: 'transition', name: 'Transition', fromStateId: 'state', toStateId: 'state', priority: 1,
            triggers: [{ type: 'Always' }], parameterModifiers: [],
            condition: { type: 'Comparison', operator: '>=', left: { type: 'VariableRef', variableId: 'score', scope: 'Global' }, right: { type: 'Constant', value: 3 } },
            presentation: { type: 'Script', scriptId: 'play', parameters: [{
                id: 'param-original', kind: 'Temporary', paramName: 'Flag', source: { type: 'Constant', value: false },
                tempVariable: { id: 'temp-original', name: 'Flag', type: 'boolean' }, description: 'Keep me'
            }] }
        } }
    };
    project.presentationGraphs.graph.nodes.first = {
        id: 'first', name: 'First', type: 'PresentationNode', position: { x: 20, y: 40 }, nextIds: ['second'],
        presentation: project.stateMachines.fsm.transitions.transition.presentation
    };
    return project;
}
function runtime(project: ProjectData) {
    return { fileType: 'puzzle-export', manifestVersion: '1.0.0', projectName: project.meta.name, projectVersion: project.meta.version, exportedAt: project.meta.updatedAt, data: normalizeForExport(project) };
}

/** 故意破坏外部 JSON 的测试边界：不把非法值声明成合法领域类型。 */
function replaceJsonField(input: unknown, path: string, invalidValue: unknown): void {
    const keys = path.replace(/^\$\./, '').split('.');
    let parent: unknown = input;
    for (const key of keys.slice(0, -1)) {
        if (parent === null || typeof parent !== 'object') throw new Error('Invalid fixture path: ' + path);
        parent = Reflect.get(parent, key);
    }
    if (parent === null || typeof parent !== 'object') throw new Error('Invalid fixture path: ' + path);
    Reflect.set(parent, keys[keys.length - 1], invalidValue);
}

describe('识别与拒绝不安全的输入', () => {
    it.each([null, [], 7, 'hello', {}, { hello: 'world' }, { meta: {} }])('拒绝无关 JSON %j', input => {
        expect(() => read(input)).toThrow(ProjectImportError);
    });
    it.each(['{', 'null,', '{"project":', ''])('解析错误带根路径 %s', text => {
        expect(() => importProject(text)).toThrow(/^\$: Invalid JSON:/);
    });
    it('未知 fileType 不落入原始项目分支', () => {
        expect(() => read({ ...createProjectFixture(), fileType: 'future-project' })).toThrow('$.fileType: Unsupported file type');
    });
    it('版本按文件格式判断，用户项目版本和生产软件版本不冒充 Schema', () => {
        const input = file(); input.project.meta.version = 'release custom 9000'; input.editorVersion = '2.4.0';
        expect(read(input).project.meta.version).toBe('release custom 9000');
        const bundle = runtime(richProject()); bundle.manifestVersion = '2.0.0';
        expect(() => read(bundle)).toThrow('$.manifestVersion: Unsupported manifest version');
    });
    it.each<[string, unknown]>([
        ['$.project', []], ['$.project.meta', null], ['$.project.nodes', []],
        ['$.project.blackboard.events', 'wrong'], ['$.project.scripts.scripts.event', null],
        ['$.project.stageTree.rootId', 'absent'], ['$.project.presentationGraphs.graph.id', 'duplicate'],
        ['$.project.presentationGraphs.graph.nodes.first.nextIds', {}],
        ['$.project.presentationGraphs.graph.nodes.first.position.x', '3'],
        ['$.project.presentationGraphs.graph.nodes.first.type', 'ScriptCall'],
        ['$.editorState.view', 'UNKNOWN'], ['$.project.importantNewData', { keep: true }]
    ])('结构错误给出字段路径 %s', (path, invalidValue) => {
        const input = file();
        // 当前文件可省略 editorState；此用例显式构造它再破坏 view。
        if (path.startsWith('$.editorState.')) input.editorState = projectUI(createEditorFixture().ui);
        replaceJsonField(input, path, invalidValue);
        expect(() => read(input)).toThrow(path);
    });
    it('拒绝父链/子链循环，不进入会无限遍历的业务校验和界面', () => {
        for (const relation of ['parent', 'child']) {
            const input = file(); const tree = input.project.stageTree;
            tree.stages.loop = { ...tree.stages[tree.rootId], id: 'loop', parentId: relation === 'parent' ? 'loop' : null, childrenIds: relation === 'child' ? ['loop'] : [] };
            expect(() => read(input)).toThrow('Stage hierarchy contains a cycle');
        }
    });
    it('阶段深度检查不受映射插入顺序和已访问节点缓存影响', () => {
        const input = file(); const tree = input.project.stageTree;
        const template = tree.stages[tree.rootId];
        // 从链条中点开始遍历，防止两段合法深度通过缓存拼成超限长链。
        const order = [65, ...Array.from({ length: 131 }, (_, index) => index).filter(index => index !== 65)];
        tree.rootId = 'stage-0';
        tree.stages = Object.fromEntries(order.map(index => [`stage-${index}`, {
            ...template, id: `stage-${index}`, parentId: index ? `stage-${index - 1}` : null,
            childrenIds: index < 130 ? [`stage-${index + 1}`] : []
        }]));
        expect(() => read(input)).toThrow('Stage hierarchy exceeds the supported depth of 128');
    });
    it('拒绝保留 ID 和过深条件树；不会污染对象原型', () => {
        const input = file(); input.project.nodes.constructor = {} as never;
        expect(() => read(input)).toThrow('Reserved identifier');
        let nested: unknown = { type: 'Literal', value: true };
        for (let index = 0; index < 150; index++) nested = { type: 'Not', operand: nested };
        const raw = file(); raw.project.stageTree.stages[raw.project.stageTree.rootId].unlockCondition = nested as never;
        expect(() => read(raw)).toThrow('nesting exceeds');
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
});

describe('已知兼容与无损往返', () => {
    it('重开后画布提交相同坐标不产生虚假 dirty 或历史', () => {
        const project = richProject(); const candidate = prepareProject(serializeProject(project, undefined, project.meta.updatedAt), null);
        const store = createEditorStore(); store.dispatch({ type: 'INIT_SUCCESS', payload: candidate.project, saved: true });
        const before = store.getState();
        store.dispatch({ type: 'UPDATE_PRESENTATION_NODE', payload: { graphId: 'graph', nodeId: 'first', data: { position: { ...candidate.project.presentationGraphs.graph.nodes.first.position } } } });
        expect(store.getState()).toBe(before);
        expect(store.getState().ui.isDirty).toBe(false);
    });
    it('当前真实示例保存重开后业务字段、顺序、坐标和 UI 均保持', () => {
        const original = JSON.parse(currentText);
        const candidate = prepareProject(currentText, 'C:/example.puzzle.json');
        expect(candidate.project).toEqual(original.project);
        expect(candidate.editorState).toEqual(original.editorState);
        expect(candidate.saved).toBe(true);
        const reopened = importProject(serializeProject(candidate.project, candidate.editorState, candidate.project.meta.updatedAt));
        expect(reopened.project).toEqual(candidate.project);
        expect(reopened.editorState).toEqual(candidate.editorState);
    });
    it('运行时导入恢复画布与 Temporary 参数辅助信息，不改参数、引用、排序', () => {
        const project = richProject(); const original = runtime(project);
        const text = JSON.stringify(original);
        const candidate = prepareProject(text, 'C:/source.export.json');
        expect(candidate.path).toBeNull(); expect(candidate.saved).toBe(false);
        const imported = candidate.project;
        expect(imported.stateMachines.fsm.states.state.position).toEqual({ x: 100, y: 100 });
        expect(imported.presentationGraphs.graph.nodes.first.position).not.toEqual(imported.presentationGraphs.graph.nodes.second.position);
        const parameter = imported.stateMachines.fsm.transitions.transition.presentation;
        expect(parameter?.type).toBe('Script');
        if (parameter?.type === 'Script') expect(parameter.parameters[0]).toMatchObject({ kind: 'Temporary', source: { type: 'Constant', value: false }, tempVariable: { id: 'temp-original' } });
        expect(normalizeForExport(imported)).toEqual(original.data);
        expect(JSON.stringify(original)).toBe(text);
        const reopen = importProject(serializeProject(imported, undefined, imported.meta.updatedAt));
        expect(normalizeForExport(reopen.project)).toEqual(original.data);
    });
    it('真实 88477b7 旧导出迁移条件、保留全部 ID 与顺序，重新导出语义稳定', () => {
        const original = JSON.parse(legacyText); const result = importProject(legacyText);
        expect(result.migrated).toBe(true);
        expect(result.project.stageTree.stages.STAGE_5.unlockCondition).toEqual({
            type: 'Comparison', operator: '==', left: { type: 'VariableRef', variableId: 'VAR_1', scope: 'Global' }, right: { type: 'Constant', value: 3 }
        });
        expect(Object.keys(result.project.nodes)).toEqual(Object.keys(original.data.nodes));
        expect(result.project.stageTree.stages.STAGE_1.childrenIds).toEqual(original.data.stageTree.stages.STAGE_1.childrenIds);
        expect(result.project.nodes.NODE_1.displayOrder).toBe(original.data.nodes.NODE_1.displayOrder);
        const exported = runtime(result.project);
        expect(normalizeForExport(read(exported).project)).toEqual(exported.data);
    });
    it('原始 ProjectData 与有证据的旧 Manifest 封装作为副本导入', () => {
        const project = richProject();
        for (const input of [project, { manifestVersion: '1.0.0', exportedAt: project.meta.updatedAt, project }]) {
            const candidate = prepareProject(JSON.stringify(input), 'C:/original.json');
            expect(candidate.path).toBeNull(); expect(candidate.saved).toBe(false);
            expect(candidate.project).toEqual(project);
        }
    });
    it('缺省集合可补齐，但不补造必要根结构；UTF-8 BOM 可解析', () => {
        const input = file(); Reflect.deleteProperty(input.project, 'nodes'); Reflect.deleteProperty(input.project, 'blackboard'); delete input.editorState;
        const result = importProject('\uFEFF' + JSON.stringify(input));
        expect(result.project.nodes).toEqual({}); expect(result.project.blackboard.events).toEqual({});
        expect(result.notices.some(notice => notice.path === '$.project.nodes')).toBe(true);
        Reflect.deleteProperty(input.project, 'stageTree');
        expect(() => read(input)).toThrow('$.project.stageTree');
    });
    it('不丢弃非空旧触发器或无损迁移不成立的旧比较操作数', () => {
        const input = JSON.parse(legacyText); input.data.triggers.triggers.old = { id: 'old', name: 'Old' };
        expect(() => read(input)).toThrow('Non-empty legacy trigger');
        const second = JSON.parse(legacyText);
        second.data.stageTree.stages.STAGE_5.unlockCondition.left = { type: 'AND', children: [] };
        expect(() => read(second)).toThrow('$.data.stageTree.stages.STAGE_5.unlockCondition.left.type');
    });
    it('已知旧工程迁移后标记待保存，meta.version 不改变此规则', () => {
        const input = file(); input.project.stageTree.stages[input.project.stageTree.rootId].unlockCondition = { type: 'LITERAL', value: true } as never;
        const result = prepareProject(JSON.stringify(input), 'C:/legacy.puzzle.json');
        expect(result.saved).toBe(false); expect(result.path).toBe('C:/legacy.puzzle.json');
    });
    it('独立旧布尔条件迁移为 == true，不猜测非布尔变量的条件语义', () => {
        const project = richProject();
        project.blackboard.globalVariables.ready = { id: 'ready', name: 'Ready', type: 'boolean', value: false, state: 'Draft', scope: 'Global' };
        project.stateMachines.fsm.transitions.transition.condition = { type: 'VARIABLE_REF', variableId: 'ready', variableScope: 'Global' } as never;
        expect(read(project).project.stateMachines.fsm.transitions.transition.condition).toEqual({
            type: 'Comparison', operator: '==', left: { type: 'VariableRef', variableId: 'ready', scope: 'Global' }, right: { type: 'Constant', value: true }
        });
        project.blackboard.globalVariables.ready.type = 'integer';
        expect(() => read(project)).toThrow('known to be boolean');
    });
    it.each(['parameters', 'action', 'source'])('拒绝嵌套 %s 的错误类型，而不是悄悄丢失内容', field => {
        const input = runtime(richProject());
        if (field === 'parameters') replaceJsonField(input, '$.data.stateMachines.fsm.transitions.transition.presentation.parameters', {});
        if (field === 'action') input.data.nodes.node.eventListeners = [{ eventId: 'event', action: [] as never }];
        if (field === 'source') replaceJsonField(input, '$.data.stateMachines.fsm.transitions.transition.presentation.parameters.0.source', []);
        expect(() => read(input)).toThrow(new RegExp(field + '.*Expected an (array|object)'));
    });
    it('业务未完成的工程可载入并产生可定位诊断', () => {
        const project = richProject(); project.stateMachines.fsm.initialStateId = null;
        project.stateMachines.fsm.transitions.transition.triggers = [{ type: 'OnEvent', eventId: 'missing' }];
        const candidate = prepareProject(serializeProject(project, undefined, project.meta.updatedAt), null);
        expect(candidate.validationResults?.some(result => result.level === 'error' && /Initial State/.test(result.message))).toBe(true);
        expect(candidate.validationResults?.some(result => result.level === 'error' && result.message.includes('missing'))).toBe(true);
        expect(candidate.project.stateMachines.fsm.initialStateId).toBeNull();
    });
});
