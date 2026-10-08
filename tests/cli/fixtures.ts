/** CLI 测试工程显式命名所有资产，包含嵌套 Stage 和不同 FSM 中相同的局部 ID。 */
import { createEmptyProject } from '../../utils/projectFactory';
import { serializeProject } from '../../services/projectFiles';
import type { ProjectData } from '../../types/project';

export const FIXED_TIME = '2026-10-08T00:00:00.000Z';
export function cliProject(): ProjectData {
  const project = createEmptyProject('CLI 中文 Test');
  project.meta.createdAt = project.meta.updatedAt = FIXED_TIME;
  const root = project.stageTree.stages[project.stageTree.rootId];
  root.assetName = 'RootStage';
  root.childrenIds = ['room'];
  root.onEnterPresentation = { type: 'Graph', graphId: 'intro' };
  root.localVariables.shared = {
    id: 'shared',
    name: 'Parent Key',
    assetName: 'ParentKey',
    scope: 'StageLocal',
    type: 'integer',
    value: 0,
    state: 'Draft',
  };
  project.stageTree.stages.room = {
    id: 'room',
    name: 'Room',
    assetName: 'Room',
    parentId: root.id,
    childrenIds: [],
    isInitial: true,
    eventListeners: [],
    localVariables: {
      shared: {
        id: 'shared',
        name: 'Room Key',
        assetName: 'RoomKey',
        scope: 'StageLocal',
        type: 'integer',
        value: 1,
        state: 'Draft',
      },
    },
  };
  project.blackboard.globalVariables.flag = {
    id: 'flag',
    name: 'Flag',
    assetName: 'Flag',
    scope: 'Global',
    type: 'boolean',
    value: false,
    state: 'Draft',
  };
  project.blackboard.events.open = {
    id: 'open',
    name: 'Open',
    assetName: 'OpenEvent',
    state: 'Draft',
  };
  project.scripts.scripts.effect = {
    id: 'effect',
    name: 'Effect',
    assetName: 'Effect',
    category: 'Performance',
    state: 'Draft',
  };
  project.scripts.scripts.deleted = {
    id: 'deleted',
    name: 'Deleted',
    assetName: 'Deleted',
    category: 'Performance',
    state: 'MarkedForDelete',
  };
  for (const id of ['door', 'lock']) {
    const fsmId = id + '-fsm';
    project.nodes[id] = {
      id,
      name: 'Shared Display Name',
      assetName: id === 'door' ? 'Door' : 'Lock',
      stageId: 'room',
      stateMachineId: fsmId,
      localVariables: {},
      eventListeners: [],
    };
    project.stateMachines[fsmId] = {
      id: fsmId,
      initialStateId: 'idle',
      states: {
        idle: {
          id: 'idle',
          name: 'Idle',
          assetName: 'Idle',
          position: { x: 0, y: 0 },
          eventListeners: [],
        },
        done: {
          id: 'done',
          name: 'Done',
          assetName: 'Done',
          position: { x: 200, y: 0 },
          eventListeners: [],
        },
      },
      transitions: {
        go: {
          id: 'go',
          name: 'Go',
          fromStateId: 'idle',
          toStateId: 'done',
          priority: 0,
          triggers: [{ type: 'OnEvent', eventId: 'open' }],
          condition: {
            type: 'Comparison',
            left: { type: 'VariableRef', variableId: 'flag', scope: 'Global' },
            operator: '==',
            right: { type: 'Constant', value: false },
          },
          parameterModifiers: [],
        },
      },
    };
  }
  project.presentationGraphs.intro = {
    id: 'intro',
    name: 'Intro',
    startNodeId: 'start',
    nodes: {
      start: {
        id: 'start',
        name: 'Intro Step',
        type: 'PresentationNode',
        presentation: { type: 'Script', scriptId: 'effect', parameters: [] },
        position: { x: 0, y: 0 },
        nextIds: [],
      },
    },
  };
  return project;
}

export function cliFile(project = cliProject()): string {
  return serializeProject(
    project,
    {
      panelSizes: { explorerWidth: 250, inspectorWidth: 300, stagesHeight: 250 },
      stageExpanded: { [project.stageTree.rootId]: true },
      currentStageId: 'room',
      currentNodeId: 'door',
      currentGraphId: null,
      view: 'EDITOR',
    },
    FIXED_TIME,
  );
}
