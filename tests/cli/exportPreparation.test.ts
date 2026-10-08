import { describe, expect, it } from 'vitest';
import { prepareRuntimeExport } from '../../services/projectExportPreparation';
import { normalizeForExport } from '../../utils/exportNormalizer';
import { validateProject } from '../../utils/validation/validator';
import { cliProject, FIXED_TIME } from './fixtures';
import { collectVisibleVariables } from '../../utils/variableScope';
import { findStageVariableReferences } from '../../utils/validation/stageVariableReferences';

describe('GUI 和 CLI 共用的纯导出准备', () => {
  it('保留既有导出数据、文件名与诊断，固定时间可重现且不修改输入', () => {
    const project = cliProject();
    project.meta.exportFileName = 'runtime';
    const before = structuredClone(project);
    const result = prepareRuntimeExport(project, FIXED_TIME);
    expect(result.ok).toBe(true);
    expect(result.suggestedFileName).toBe('runtime.export.json');
    expect(result.bundle).toEqual({
      fileType: 'puzzle-export',
      manifestVersion: '1.0.0',
      exportedAt: FIXED_TIME,
      projectName: project.meta.name,
      projectVersion: project.meta.version,
      data: normalizeForExport(project),
    });
    expect(result.diagnostics).toEqual(validateProject(project));
    expect(JSON.parse(result.content!)).toEqual(result.bundle);
    expect(result.content).not.toContain('editorState');
    expect(project).toEqual(before);
  });
  it('error 阻断内容生成，修复后可导出；警告仍保留并允许导出', () => {
    const project = cliProject();
    const root = project.stageTree.stages[project.stageTree.rootId];
    delete root.assetName;
    const failed = prepareRuntimeExport(project, FIXED_TIME);
    expect(failed).toMatchObject({ ok: false, content: null, bundle: null });
    expect(failed.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ASSET_NAME_REQUIRED', field: 'assetName' }),
    );
    root.assetName = 'ExternalRoot';
    delete root.onEnterPresentation;
    const fixed = prepareRuntimeExport(project, FIXED_TIME);
    expect(fixed.ok).toBe(true);
    expect(fixed.diagnostics).toContainEqual(
      expect.objectContaining({ level: 'warning', code: 'WARN_GRAPH_UNUSED' }),
    );
  });
  it('共同领域函数直接收到父/子链环仍终止并报告，不只依赖文件导入门禁', () => {
    const project = cliProject();
    const root = project.stageTree.stages[project.stageTree.rootId];
    root.parentId = 'room';
    project.stageTree.stages.room.childrenIds = [root.id];
    project.stateMachines['door-fsm'].transitions.go.condition = {
      type: 'Comparison',
      operator: '==',
      left: { type: 'VariableRef', variableId: 'absent', scope: 'StageLocal' },
      right: { type: 'Constant', value: 0 },
    };
    expect(validateProject(project)).toContainEqual(
      expect.objectContaining({ code: 'STAGE_PARENT_CYCLE' }),
    );
    expect(collectVisibleVariables(project, 'room').all.length).toBeGreaterThan(0);
    expect(findStageVariableReferences(project, root.id, 'shared')).toEqual([]);
  });
});
