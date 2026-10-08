import type { ProjectData } from '../../types/project';
import type { PresentationBinding, EventListener } from '../../types/common';
import { createEmptyProject } from '../../utils/projectFactory';

/** 确定性压力工程：不同规模沿用相同分布，不依赖机器时间或用户数据。 */
export function createPerformanceProject(size: 'medium' | 'large'): ProjectData {
  const large = size === 'large';
  const stageCount = large ? 64 : 16;
  const resourceCount = large ? 128 : 32;
  const graphCount = large ? 16 : 4;
  const project = createEmptyProject(`Performance ${size}`);
  project.meta.createdAt = project.meta.updatedAt = '2026-10-08T00:00:00.000Z';
  const rootId = project.stageTree.rootId;
  const binding = (i: number): PresentationBinding => ({
    type: 'Script',
    scriptId: `performance_${i % resourceCount}`,
    parameters: [
      {
        paramName: 'amount',
        source: { type: 'VariableRef', scope: 'Global', variableId: `global_${i % resourceCount}` },
      },
    ],
  });
  const listeners = (i: number): EventListener[] => [
    {
      eventId: `event_${i % resourceCount}`,
      action: {
        type: 'ModifyParameter',
        modifiers: [
          {
            targetVariableId: `global_${i % resourceCount}`,
            targetScope: 'Global',
            operation: 'Add',
            source: { type: 'Constant', value: 1 },
          },
        ],
      },
    },
  ];
  for (let i = 0; i < resourceCount; i++) {
    project.blackboard.globalVariables[`global_${i}`] = {
      id: `global_${i}`,
      name: `Global ${i}`,
      type: 'integer',
      value: i,
      scope: 'Global',
      state: 'Implemented',
      displayOrder: i,
    };
    project.blackboard.events[`event_${i}`] = {
      id: `event_${i}`,
      name: `Event ${i}`,
      state: 'Implemented',
      displayOrder: i,
    };
    for (const [prefix, category, lifecycleType] of [
      ['performance', 'Performance', undefined],
      ['condition', 'Condition', undefined],
      ['trigger', 'Trigger', undefined],
      ['stageLife', 'Lifecycle', 'Stage'],
      ['nodeLife', 'Lifecycle', 'Node'],
      ['stateLife', 'Lifecycle', 'State'],
    ] as const) {
      const id = `${prefix}_${i}`;
      project.scripts.scripts[id] = {
        id,
        name: id,
        category,
        lifecycleType,
        state: 'Implemented',
        displayOrder: i,
      };
    }
  }
  for (let i = 0; i < stageCount; i++) {
    const id = `stage-${i}`;
    project.stageTree.stages[rootId].childrenIds.push(id);
    project.stageTree.stages[id] = {
      id,
      name: `Stage ${i}`,
      parentId: rootId,
      childrenIds: [],
      isInitial: i === 0,
      localVariables: {
        counter: {
          id: 'counter',
          name: 'Stage Counter',
          type: 'integer',
          value: 0,
          scope: 'StageLocal',
          state: 'Draft',
        },
      },
      lifecycleScriptId: `stageLife_${i}`,
      eventListeners: listeners(i),
      unlockTriggers: [{ type: 'OnEvent', eventId: `event_${i}` }],
      unlockCondition: {
        type: 'Comparison',
        operator: '>=',
        left: { type: 'VariableRef', scope: 'StageLocal', variableId: 'counter' },
        right: { type: 'Constant', value: 0 },
      },
      onEnterPresentation: { type: 'Graph', graphId: `graph_${i % graphCount}` },
      onExitPresentation: binding(i),
    };
    for (let j = 0; j < 2; j++) {
      const index = i * 2 + j,
        nodeId = `node_${index}`,
        fsmId = `fsm_${index}`;
      project.nodes[nodeId] = {
        id: nodeId,
        name: `Puzzle ${index}`,
        stageId: id,
        stateMachineId: fsmId,
        localVariables: {
          counter: {
            id: 'counter',
            name: 'Node Counter',
            type: 'integer',
            value: 0,
            scope: 'NodeLocal',
            state: 'Draft',
          },
        },
        lifecycleScriptId: `nodeLife_${index % resourceCount}`,
        eventListeners: listeners(index),
        displayOrder: j,
      };
      const fsm = (project.stateMachines[fsmId] = {
        id: fsmId,
        initialStateId: 'state_0',
        states: {},
        transitions: {},
      } as ProjectData['stateMachines'][string]);
      const count = index === 0 ? (large ? 300 : 100) : 12;
      for (let k = 0; k < count; k++) {
        const stateId = `state_${k}`;
        fsm.states[stateId] = {
          id: stateId,
          name: `State ${k}`,
          position: { x: 80 + (k % 10) * 240, y: 80 + Math.floor(k / 10) * 160 },
          lifecycleScriptId: k === 0 ? `stateLife_${index}` : undefined,
          eventListeners: listeners(index + k),
        };
        if (k === 0) continue;
        const transitionId = `transition_${k}`;
        fsm.transitions[transitionId] = {
          id: transitionId,
          name: `Go ${k}`,
          fromStateId: `state_${k - 1}`,
          toStateId: stateId,
          priority: 0,
          triggers: [{ type: 'OnEvent', eventId: `event_${(index + k) % resourceCount}` }],
          condition: {
            type: 'And',
            children: [
              { type: 'ScriptRef', scriptId: `condition_${(index + k) % resourceCount}` },
              {
                type: 'Comparison',
                operator: '>=',
                left: { type: 'VariableRef', scope: 'NodeLocal', variableId: 'counter' },
                right: {
                  type: 'VariableRef',
                  scope: 'Global',
                  variableId: `global_${(index + k) % resourceCount}`,
                },
              },
            ],
          },
          presentation: binding(index + k),
          parameterModifiers: [],
        };
      }
    }
  }
  for (let i = 0; i < graphCount; i++) {
    const id = `graph_${i}`;
    const graph = (project.presentationGraphs[id] = {
      id,
      name: `Graph ${i}`,
      startNodeId: 'p_0',
      nodes: {},
    } as ProjectData['presentationGraphs'][string]);
    const count = i === 0 ? (large ? 160 : 60) : 8;
    for (let j = 0; j < count; j++)
      graph.nodes[`p_${j}`] = {
        id: `p_${j}`,
        name: `Action ${j}`,
        type: 'PresentationNode',
        presentation: binding(i + j),
        position: { x: 80 + (j % 10) * 240, y: 80 + Math.floor(j / 10) * 160 },
        nextIds: j + 1 < count ? [`p_${j + 1}`] : [],
      };
  }
  // 完整合法工程作为性能基线，避免重复生命周期绑定和缺少资产名制造额外诊断成本。
  for (const entity of [
    ...Object.values(project.blackboard.globalVariables),
    ...Object.values(project.blackboard.events),
    ...Object.values(project.scripts.scripts),
    ...Object.values(project.stageTree.stages),
    ...Object.values(project.nodes),
  ])
    entity.assetName = entity.id.replaceAll('-', '_');
  for (const fsm of Object.values(project.stateMachines))
    for (const state of Object.values(fsm.states)) state.assetName = `${fsm.id}_${state.id}`;
  return project;
}

export function projectSize(project: ProjectData) {
  const fsms = Object.values(project.stateMachines),
    graphs = Object.values(project.presentationGraphs);
  return {
    stages: Object.keys(project.stageTree.stages).length,
    puzzles: Object.keys(project.nodes).length,
    states: fsms.reduce((n, fsm) => n + Object.keys(fsm.states).length, 0),
    transitions: fsms.reduce((n, fsm) => n + Object.keys(fsm.transitions).length, 0),
    largestFsm: Math.max(0, ...fsms.map((fsm) => Object.keys(fsm.states).length)),
    graphs: graphs.length,
    presentationNodes: graphs.reduce((n, graph) => n + Object.keys(graph.nodes).length, 0),
    largestGraph: Math.max(0, ...graphs.map((graph) => Object.keys(graph.nodes).length)),
    globals: Object.keys(project.blackboard.globalVariables).length,
    locals: [...Object.values(project.stageTree.stages), ...Object.values(project.nodes)].reduce(
      (n, owner) => n + Object.keys(owner.localVariables ?? {}).length,
      0,
    ),
    scripts: Object.keys(project.scripts.scripts).length,
    events: Object.keys(project.blackboard.events).length,
  };
}
