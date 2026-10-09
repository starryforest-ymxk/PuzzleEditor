/** Node 与在线编辑共用隔离候选执行、导入复核、诊断与权限计算。 */
import type { ProjectData, EditorUIState } from '../../types/project';
import type { Plan } from '../../contracts/automation/planSchemas';
import { executePlan, CommandFailure } from '../../store/commands/automation/execute';
import { serializeProject } from '../projectFiles';
import { importProject } from '../../utils/projectImport';
import { validateCandidate } from './candidateValidation';
import { analyzePermissions } from './permissions';
import { summarizeImpacts } from './impacts';
import { AutomationFailure } from './errors';
export function buildCandidate(
  source: ProjectData,
  plan: Plan,
  savedAt: string,
  editorState: EditorUIState | undefined,
  creating = false,
  overwriting = false,
  mode: 'serialized' | 'memory' = 'serialized',
) {
  let execution: ReturnType<typeof executePlan>;
  try {
    execution = executePlan(source, plan);
  } catch (error) {
    if (!(error instanceof CommandFailure)) throw error;
    throw new AutomationFailure(
      error.code,
      error.message,
      3,
      [
        {
          code: error.code,
          level: 'error',
          message: error.message,
          retryable: false,
          operationIndex: error.operationIndex,
          path: error.operationIndex === undefined ? '/scope' : `/commands/${error.operationIndex}`,
          pathBasis: 'request',
        },
      ],
      error.details,
    );
  }
  const content = serializeProject(execution.project, editorState, savedAt);
  // 序列化后再次走实际导入边界，保证可被 GUI 打开，不把类型断言当成结构验证。
  const imported = importProject(content).project;
  // 在线提交保留 Store 的可选字段形态；文件导入默认值不能把无变化计划变成编辑。
  const finalProject = mode === 'memory' ? execution.project : imported;
  const validation = validateCandidate(source, finalProject, creating);
  return {
    ...execution,
    project: finalProject,
    content,
    ...validation,
    ...analyzePermissions(source, finalProject, {
      explicitPermanentDelete: plan.commands.some((op) => op.op.endsWith('.purge')),
      overwriteProject: overwriting,
    }),
    impacts: summarizeImpacts(source, finalProject),
  };
}
