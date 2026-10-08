import type { Action, Selection } from '../types';
import type { ValidationResult } from '../../types/validation';
import type { ProjectData } from '../../types/project';

/** 校验器有的上下文使用 nodeId，有的使用 fsmId；先解析真实归属，再原子导航及选择。 */
export function validationNavigation(project: ProjectData, issue: ValidationResult): Action[] {
  const nodes = Object.values(project.nodes);
  const stages = Object.values(project.stageTree.stages);
  const toStage = (stageId: string, selection: Selection): Action[] =>
    project.stageTree.stages[stageId]
      ? [
          {
            type: 'NAVIGATE_TO',
            payload: { stageId, nodeId: null, graphId: null, selection },
          },
        ]
      : [];
  const toNode = (nodeId: string, selection: Selection): Action[] => {
    const node = project.nodes[nodeId];
    return node
      ? [
          {
            type: 'NAVIGATE_TO',
            payload: {
              stageId: project.stageTree.stages[node.stageId]
                ? node.stageId
                : project.stageTree.rootId,
              nodeId,
              graphId: null,
              selection,
            },
          },
        ]
      : [];
  };
  const toBlackboard = (
    activeTab: 'Variables' | 'Scripts' | 'Events' | 'Graphs',
    selection: Selection,
  ): Action[] => [
    {
      type: 'SET_BLACKBOARD_VIEW',
      payload: { activeTab, filter: '', stateFilter: 'ALL', varTypeFilter: 'ALL' },
    },
    { type: 'SWITCH_VIEW', payload: 'BLACKBOARD' },
    { type: 'SELECT_OBJECT', payload: selection },
  ];
  const id = issue.objectId;
  if (issue.objectType === 'STAGE') return toStage(id, { type: 'STAGE', id });
  if (issue.objectType === 'NODE') {
    if (project.nodes[id]) return toNode(id, { type: 'NODE', id });
    const fsmId = project.stateMachines[issue.contextId ?? id]?.id;
    const owner = nodes.find((node) => node.stateMachineId === fsmId);
    return owner
      ? toNode(owner.id, { type: 'NODE', id: owner.id })
      : fsmId
        ? toBlackboard('Graphs', { type: 'FSM', id: fsmId })
        : [];
  }
  if (issue.objectType === 'STATE' || issue.objectType === 'TRANSITION') {
    const collection = issue.objectType === 'STATE' ? 'states' : 'transitions';
    const preferredFsmId = project.nodes[issue.contextId ?? '']?.stateMachineId ?? issue.contextId;
    const preferred = project.stateMachines[preferredFsmId ?? ''];
    const fsm = preferred?.[collection][id]
      ? preferred
      : Object.values(project.stateMachines).find((item) => item[collection][id]);
    const owner = nodes.find((node) => node.stateMachineId === fsm?.id);
    return owner
      ? toNode(owner.id, { type: issue.objectType, id, contextId: owner.id })
      : fsm
        ? toBlackboard('Graphs', { type: 'FSM', id: fsm.id })
        : [];
  }
  if (issue.objectType === 'PRESENTATION_GRAPH' || issue.objectType === 'PRESENTATION_NODE') {
    const preferred = project.presentationGraphs[issue.contextId ?? ''];
    const graph =
      issue.objectType === 'PRESENTATION_GRAPH'
        ? project.presentationGraphs[id]
        : preferred?.nodes[id]
          ? preferred
          : Object.values(project.presentationGraphs).find((item) => item.nodes[id]);
    return graph
      ? [
          {
            type: 'NAVIGATE_TO',
            payload: {
              graphId: graph.id,
              selection: {
                type: issue.objectType,
                id,
                contextId: issue.objectType === 'PRESENTATION_NODE' ? graph.id : undefined,
              },
            },
          },
        ]
      : [];
  }
  if (issue.objectType === 'VARIABLE') {
    if (project.blackboard.globalVariables[id])
      return toBlackboard('Variables', { type: 'VARIABLE', id });
    // 局部变量在拥有者 Inspector 中可编辑，黑板只提供只读视图。
    const stage = stages.find((item) => item.localVariables[id]);
    if (stage) return toStage(stage.id, { type: 'STAGE', id: stage.id });
    const node = nodes.find((item) => item.localVariables[id]);
    return node ? toNode(node.id, { type: 'NODE', id: node.id }) : [];
  }
  if (issue.objectType === 'SCRIPT' && project.scripts.scripts[id])
    return toBlackboard('Scripts', { type: 'SCRIPT', id });
  if (issue.objectType === 'EVENT' && project.blackboard.events[id])
    return toBlackboard('Events', { type: 'EVENT', id });
  return [];
}
