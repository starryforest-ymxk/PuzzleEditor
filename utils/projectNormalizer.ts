/**
 * 项目数据归一化工具（P2-T01）
 * - 接收 API 返回的 ProjectData 或 ExportManifest，填充默认值并兼容旧字段
 * - 输出可直接写入 Store 的数据与脚本/触发器清单
 * 
 * 支持的文件格式：
 * - ProjectFile (.puzzle.json): 完整项目文件，包含编辑器状态
 * - ExportBundle (.json): 精简运行时数据
 * - ExportManifest (旧版): 兼容旧版导出格式
 */
import { ManifestData } from '../api/types';
import { ExportManifest, ProjectData, ProjectFile, ExportBundle, EditorUIState } from '../types/project';
import { StageNode, StageTreeData } from '../types/stage';
import { PuzzleNode } from '../types/puzzleNode';
import { StateMachine, State, Transition } from '../types/stateMachine';
import { PresentationGraph, PresentationNode } from '../types/presentation';
import { BlackboardData } from '../types/blackboard';
import { ScriptsManifest } from '../types/manifest';
import { normalizePresentationNode } from './presentation';

export interface NormalizedProjectResult {
  project: ProjectData;
  scripts: ScriptsManifest['scripts'];
  /** 编辑器 UI 状态（仅 ProjectFile 格式包含） */
  editorState?: EditorUIState;
}

// ========= 顶层兼容解析 =========
/**
 * 从不同文件格式中提取 ProjectData
 * 支持：ProjectFile, ExportBundle, ExportManifest（旧版）, 原始 ProjectData
 */
const extractProject = (payload: any): { project: ProjectData; editorState?: EditorUIState } => {
  // ProjectFile 格式 (.puzzle.json)
  if (payload.fileType === 'puzzle-project') {
    const pf = payload as ProjectFile;
    return {
      project: pf.project,
      editorState: pf.editorState
    };
  }

  // ExportBundle 格式 (精简运行时数据)
  if (payload.fileType === 'puzzle-export') {
    const eb = payload as ExportBundle;
    // 从 ExportBundle 重建 ProjectData（缺少 meta，需要构建）
    return {
      project: {
        meta: {
          id: `proj-imported-${Date.now()}`,
          name: eb.projectName || 'Imported Project',
          version: eb.projectVersion || '1.0.0',
          createdAt: new Date().toISOString(),
          updatedAt: eb.exportedAt
        },
        ...eb.data
      }
    };
  }

  // ExportManifest 旧版格式
  if ((payload as ExportManifest).project) {
    return {
      project: (payload as ExportManifest).project
    };
  }

  // 原始 ProjectData
  return {
    project: payload as ProjectData
  };
};

// ========= 基础默认值 =========
const normalizeMeta = (meta: ProjectData['meta']) => ({
  id: meta?.id ?? `proj-${Date.now()}`,
  name: meta?.name ?? 'Untitled Project',
  description: meta?.description ?? '',
  version: meta?.version ?? '0.0.1',
  createdAt: meta?.createdAt ?? new Date().toISOString(),
  updatedAt: meta?.updatedAt ?? new Date().toISOString(),
  exportPath: meta?.exportPath,
  exportFileName: meta?.exportFileName
});

const normalizeBlackboard = (bb?: BlackboardData): BlackboardData => ({
  globalVariables: bb?.globalVariables ?? {},
  events: bb?.events ?? {}
});

const normalizeStageTree = (tree?: StageTreeData): StageTreeData => {
  const stages: Record<string, StageNode> = {};
  const rawStages = tree?.stages ?? {};
  Object.values(rawStages).forEach(stage => {
    stages[stage.id] = {
      ...stage,
      parentId: stage.parentId ?? null,
      childrenIds: stage.childrenIds ?? [],
      localVariables: stage.localVariables ?? {},
      eventListeners: stage.eventListeners ?? [],
      isExpanded: stage.isExpanded ?? false
    };
  });
  return {
    rootId: tree?.rootId ?? '',
    stages
  };
};

const normalizeNodes = (nodes?: Record<string, PuzzleNode>): Record<string, PuzzleNode> => {
  const result: Record<string, PuzzleNode> = {};
  Object.values(nodes ?? {}).forEach(node => {
    result[node.id] = {
      ...node,
      localVariables: node.localVariables ?? {},
      eventListeners: node.eventListeners ?? []
    };
  });
  return result;
};

const normalizeStates = (states?: Record<string, State>): Record<string, State> => {
  const result: Record<string, State> = {};
  Object.values(states ?? {}).forEach(s => {
    result[s.id] = {
      ...s,
      eventListeners: s.eventListeners ?? []
    };
  });
  return result;
};

const normalizeTransitions = (transitions?: Record<string, Transition>): Record<string, Transition> => {
  const result: Record<string, Transition> = {};
  Object.values(transitions ?? {}).forEach(t => {
    result[t.id] = {
      ...t,
      triggers: t.triggers ?? [],
      parameterModifiers: t.parameterModifiers ?? [],
      presentation: t.presentation,
      condition: t.condition
    };
  });
  return result;
};

const normalizeStateMachines = (fsms?: Record<string, StateMachine>): Record<string, StateMachine> => {
  const result: Record<string, StateMachine> = {};
  Object.values(fsms ?? {}).forEach(fsm => {
    result[fsm.id] = {
      ...fsm,
      initialStateId: fsm.initialStateId ?? null,
      states: normalizeStates(fsm.states),
      transitions: normalizeTransitions(fsm.transitions)
    };
  });
  return result;
};

const normalizePresentationNodes = (nodes?: Record<string, PresentationNode>): Record<string, PresentationNode> => {
  const result: Record<string, PresentationNode> = {};
  Object.values(nodes ?? {}).forEach(n => {
    // 复用统一归一化逻辑：
    // 1) 保证 nextIds/duration
    // 2) 严格模式：仅保留 node.presentation（不再迁移/兼容旧字段）
    result[n.id] = normalizePresentationNode(n);
  });
  return result;
};

const normalizePresentationGraphs = (graphs?: Record<string, PresentationGraph>): Record<string, PresentationGraph> => {
  const result: Record<string, PresentationGraph> = {};
  Object.values(graphs ?? {}).forEach(g => {
    result[g.id] = {
      ...g,
      startNodeId: g.startNodeId ?? null,
      nodes: normalizePresentationNodes(g.nodes)
    };
  });
  return result;
};

// ========= 主归一化入口 =========
export const normalizeProjectForStore = (
  raw: any,  // 支持 ProjectFile, ExportBundle, ExportManifest, ProjectData
  manifest?: ManifestData
): NormalizedProjectResult => {
  // 提取项目数据和可能的编辑器状态
  const { project, editorState } = extractProject(raw);

  const normalized: ProjectData = {
    meta: normalizeMeta(project.meta),
    blackboard: normalizeBlackboard(project.blackboard),
    scripts: project.scripts ?? { version: '1.0.0', scripts: {} },
    stageTree: normalizeStageTree(project.stageTree),
    nodes: normalizeNodes(project.nodes),
    stateMachines: normalizeStateMachines(project.stateMachines),
    presentationGraphs: normalizePresentationGraphs(project.presentationGraphs)
  };

  // 兼容独立 manifest 响应：若 project 未附带 scripts，则使用额外 manifest 覆盖
  const scripts = manifest?.scripts
    ? manifest.scripts.scripts
    : normalized.scripts.scripts;

  return {
    project: {
      ...normalized,
      // Store 中暂不需要 scripts 的清单结构，但保留数据以便后续导出
      scripts: { version: normalized.scripts.version, scripts }
    },
    scripts,
    // 返回编辑器状态（仅 ProjectFile 格式包含）
    editorState
  };
};
