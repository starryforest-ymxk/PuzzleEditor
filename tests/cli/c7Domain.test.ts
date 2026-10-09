/** C7 共用导入器与真实 Store 对照；不依赖 CLI 自己宣称转换成功。 */
import { describe, expect, it } from 'vitest';
import { importProject, type ProjectSourceFormat } from '../../utils/projectImport';
import { normalizeForExport } from '../../utils/exportNormalizer';
import { defaultProjectEditorState } from '../../utils/projectEditorState';
import { createEditorStore } from '../../store/editorStore';
import { projectUI, prepareProject, serializeProject } from '../../services/projectFiles';
import { applyImportNames } from '../../services/automation/importNames';
import { conversionInput, conversionProject } from './c7Fixtures';

const fixed = {
  now: '2026-10-09T12:34:56.000Z',
  runtimeProjectId: 'proj-imported-11111111-1111-4111-8111-111111111111',
};
describe('C7 共同转换上下文', () => {
  it('合法的零秒等待在运行时导出、兼容导入和再次导出后仍为零', () => {
    const project = conversionProject(),
      before = structuredClone(project);
    const exported = normalizeForExport(project);
    expect(exported.presentationGraphs.intro.nodes.yes.duration).toBe(0);
    const imported = importProject(conversionInput('export', project), fixed);
    expect(imported.project.presentationGraphs.intro.nodes.yes.duration).toBe(0);
    expect(normalizeForExport(imported.project).presentationGraphs.intro.nodes.yes.duration).toBe(
      0,
    );
    expect(project).toEqual(before);
  });
  it.each<ProjectSourceFormat>(['project', 'export', 'raw', 'legacy-manifest'])(
    '固定上下文重建 %s，保留完整运行时语义与源对象',
    (format) => {
      const source = conversionInput(format);
      const first = importProject(source, fixed),
        second = importProject(source, fixed);
      expect(first).toEqual(second);
      expect(first.format).toBe(format);
      expect(
        importProject(serializeProject(first.project, first.editorState, fixed.now), fixed).project,
      ).toEqual({ ...first.project, meta: { ...first.project.meta, updatedAt: fixed.now } });
      const gui = prepareProject(source, 'test.json');
      expect(normalizeForExport(first.project)).toEqual(normalizeForExport(gui.project));
      if (format === 'export')
        expect(first.project.meta).toMatchObject({
          id: fixed.runtimeProjectId,
          createdAt: fixed.now,
        });
      else
        expect(first.project.meta.id).toBe(
          JSON.parse(source).project?.meta.id ?? JSON.parse(source).meta.id,
        );
    },
  );
  it.each(['project', 'raw', 'legacy-manifest'] as const)(
    '%s 缺省 meta 时间也从同一上下文补齐',
    (format) => {
      const project = conversionProject();
      Reflect.deleteProperty(project.meta, 'createdAt');
      Reflect.deleteProperty(project.meta, 'updatedAt');
      // cliFile 会填 updatedAt；直接构造受支持封装以覆盖缺省 Reader。
      const source = JSON.stringify(
        format === 'project'
          ? { fileType: 'puzzle-project', editorVersion: '1.0.0', savedAt: fixed.now, project }
          : format === 'raw'
            ? project
            : { manifestVersion: '1.0.0', exportedAt: fixed.now, project },
      );
      const a = importProject(source, fixed),
        b = importProject(source, { ...fixed, now: '2027-01-01T00:00:00.000Z' });
      expect(a.project.meta).toMatchObject({
        id: project.meta.id,
        createdAt: fixed.now,
        updatedAt: fixed.now,
      });
      expect(b.project.meta.createdAt).toBe('2027-01-01T00:00:00.000Z');
    },
  );
  it('GUI 未注入上下文继续生成独立 UUID，已有元数据不被固定值覆盖', () => {
    const source = conversionInput('export');
    expect(importProject(source).project.meta.id).not.toBe(importProject(source).project.meta.id);
    const project = conversionProject();
    expect(importProject(conversionInput('raw', project), fixed).project.meta).toEqual(
      project.meta,
    );
  });
  it('无 UI 的转换使用共用默认；真实 Store 可继续继承用户面板尺寸', () => {
    const project = conversionProject(),
      store = createEditorStore();
    store.dispatch({ type: 'INIT_SUCCESS', payload: project, saved: false });
    expect(projectUI(store.getState().ui)).toEqual(
      defaultProjectEditorState(project.stageTree.rootId),
    );
    store.dispatch({
      type: 'SET_PANEL_SIZES',
      payload: { explorerWidth: 350, inspectorWidth: 400, stagesHeight: 70 },
    });
    store.dispatch({ type: 'INIT_SUCCESS', payload: project, saved: false });
    expect(projectUI(store.getState().ui)).toEqual(
      defaultProjectEditorState(project.stageTree.rootId, {
        explorerWidth: 350,
        inspectorWidth: 400,
        stagesHeight: 70,
      }),
    );
  });
  it('精确 owner 命名不改同 ID 的祖先、另一 FSM、源对象或资源状态', () => {
    const project = conversionProject(),
      before = structuredClone(project);
    const result = applyImportNames(project, {
      apiVersion: '1.0.0',
      sourceHash: 'a'.repeat(64),
      entries: [
        {
          entity: { type: 'variable', id: 'shared', ownerType: 'puzzle', ownerId: 'door' },
          assetName: 'ExternalNodeKey',
        },
        {
          entity: { type: 'state', id: 'idle', ownerType: 'fsm', ownerId: 'door-fsm' },
          assetName: 'ExternalIdle',
        },
      ],
    });
    expect(project).toEqual(before);
    expect(result.project.nodes.door.localVariables.shared).toMatchObject({
      assetName: 'ExternalNodeKey',
      state: 'MarkedForDelete',
      value: 0,
    });
    expect(result.project.stageTree.stages.room.localVariables.shared).toEqual(
      before.stageTree.stages.room.localVariables.shared,
    );
    expect(result.project.stateMachines['lock-fsm']).toEqual(before.stateMachines['lock-fsm']);
    expect(result.project.stateMachines['door-fsm'].transitions).toEqual(
      before.stateMachines['door-fsm'].transitions,
    );
  });
});
