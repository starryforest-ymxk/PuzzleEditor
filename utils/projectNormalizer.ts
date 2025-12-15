/**
 * 项目数据归一化工具（P2-T01）
 * - 接收 API 返回的 ProjectData 或 ExportManifest，填充默认值并兼容旧字段
 * - 输出可直接写入 Store 的数据与脚本/触发器清单
 */
import { ManifestData } from '../api/types';
import { ExportManifest, ProjectData } from '../types/project';
import { StageNode, StageTreeData } from '../types/stage';
import { PuzzleNode } from '../types/puzzleNode';
import { StateMachine, State, Transition } from '../types/stateMachine';
import { PresentationGraph, PresentationNode } from '../types/presentation';
import { BlackboardData } from '../types/blackboard';
import { ScriptsManifest, TriggersManifest } from '../types/manifest';
import { normalizePresentationNode } from './presentation';

export interface NormalizedProjectResult {
  project: ProjectData;
  scripts: ScriptsManifest['scripts'];
  triggers: TriggersManifest['triggers'] | undefined;
}

// ========= 顶层兼容解析 =========
const extractProject = (payload: ProjectData | ExportManifest): ProjectData => {
  if ((payload as ExportManifest).project) {
    return (payload as ExportManifest).project;
  }
  return payload as ProjectData;
};

// ========= 基础默认值 =========
const normalizeMeta = (meta: ProjectData['meta']) => ({
  id: meta?.id ?? `proj-${Date.now()}`,
  name: meta?.name ?? 'Untitled Project',
  description: meta?.description ?? '',
  version: meta?.version ?? '0.0.1',
  createdAt: meta?.createdAt ?? new Date().toISOString(),
  updatedAt: meta?.updatedAt ?? new Date().toISOString()
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
    // 1) 保证 nextIds/parameters/duration
    // 2) 旧字段 scriptId/parameters -> 新字段 presentation 的迁移
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
  raw: ProjectData | ExportManifest,
  manifest?: ManifestData
): NormalizedProjectResult => {
  const project = extractProject(raw);
  const normalized: ProjectData = {
    meta: normalizeMeta(project.meta),
    blackboard: normalizeBlackboard(project.blackboard),
    scripts: project.scripts ?? { version: '1.0.0', scripts: {} },
    triggers: project.triggers ?? { triggers: {} },
    stageTree: normalizeStageTree(project.stageTree),
    nodes: normalizeNodes(project.nodes),
    stateMachines: normalizeStateMachines(project.stateMachines),
    presentationGraphs: normalizePresentationGraphs(project.presentationGraphs)
  };

  // 兼容独立 manifest 响应：若 project 未附带 scripts/triggers，则使用额外 manifest 覆盖
  const scripts = manifest?.scripts
    ? manifest.scripts.scripts
    : normalized.scripts.scripts;
  const triggers = manifest?.triggers
    ? manifest.triggers.triggers
    : normalized.triggers?.triggers;

  return {
    project: {
      ...normalized,
      // Store 中暂不需要 scripts/triggers 的清单结构，但保留数据以便后续导出
      scripts: { version: normalized.scripts.version, scripts },
      triggers: { triggers: triggers ?? {} }
    },
    scripts,
    triggers
  };
};
