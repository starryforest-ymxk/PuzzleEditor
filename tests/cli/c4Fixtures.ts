/** C4 往返夹具：分支、并行、三级共享子图及显式外部资产名。 */
import type { Plan } from '../../contracts/automation/planSchemas';
import type { ProjectData } from '../../types/project';
import { cliProject } from './fixtures';

export function presentationProject(): ProjectData {
  const project = cliProject();
  project.scripts.scripts.check = {
    id: 'check',
    name: 'Check',
    assetName: 'CheckFlag',
    state: 'Draft',
    category: 'Condition',
  };
  const graph = project.presentationGraphs.intro;
  graph.name = 'Branch and Parallel';
  graph.startNodeId = 'branch';
  graph.nodes = {
    branch: {
      id: 'branch',
      name: 'Choose',
      type: 'Branch',
      position: { x: 0, y: 160 },
      nextIds: ['yes', 'no'],
      condition: { type: 'Literal', value: true },
    },
    yes: {
      id: 'yes',
      name: 'True Wait',
      type: 'Wait',
      duration: 0,
      position: { x: 240, y: 0 },
      nextIds: ['parallel'],
    },
    no: {
      id: 'no',
      name: 'False Wait',
      type: 'Wait',
      duration: 2,
      position: { x: 240, y: 320 },
      nextIds: ['parallel'],
    },
    parallel: {
      id: 'parallel',
      name: 'Both',
      type: 'Parallel',
      position: { x: 480, y: 160 },
      nextIds: ['call', 'finish'],
    },
    call: {
      id: 'call',
      name: 'Shared Child',
      type: 'PresentationNode',
      position: { x: 730, y: 0 },
      nextIds: [],
      presentation: { type: 'Graph', graphId: 'child' },
    },
    finish: {
      id: 'finish',
      name: 'Finish',
      type: 'PresentationNode',
      position: { x: 730, y: 320 },
      nextIds: [],
      presentation: {
        type: 'Script',
        scriptId: 'effect',
        parameters: [
          {
            paramName: 'Literal',
            source: { type: 'Constant', value: { alias: 'untouched', id: 'flag' } },
          },
        ],
      },
    },
  };
  graph.edgeProperties = {
    'branch->yes': { fromSide: 'right', toSide: 'left' },
    'branch->no': { fromSide: 'bottom', toSide: 'top' },
    'yes->parallel': { fromSide: 'right' },
  };
  project.presentationGraphs.child = {
    id: 'child',
    name: 'Child',
    startNodeId: 'call',
    nodes: {
      call: {
        id: 'call',
        name: 'Leaf Call',
        type: 'PresentationNode',
        position: { x: 10, y: 20 },
        nextIds: [],
        presentation: { type: 'Graph', graphId: 'leaf' },
      },
    },
  };
  project.presentationGraphs.leaf = {
    id: 'leaf',
    name: 'Leaf',
    startNodeId: 'call',
    nodes: {
      call: {
        id: 'call',
        name: 'Effect',
        type: 'PresentationNode',
        position: { x: 20, y: 40 },
        nextIds: [],
        presentation: { type: 'Script', scriptId: 'effect', parameters: [] },
      },
    },
  };
  project.stateMachines['door-fsm'].transitions.go.presentation = {
    type: 'Graph',
    graphId: 'intro',
  };
  return project;
}

export function presentationCreationPlan(): Plan {
  const ref = (alias: string) => ({ alias });
  const graph = ref('show');
  return {
    apiVersion: '1.0.0',
    scope: { project: true },
    commands: [
      // 节点故意先于所属图声明，验证依赖排序及后续同图 alias 检查。
      {
        op: 'presentationNode.create',
        alias: 'choose',
        graph,
        data: {
          name: 'Choose Path',
          type: 'Branch',
          position: { x: 0, y: 180 },
          condition: {
            type: 'And',
            children: [
              { type: 'ScriptRef', scriptId: ref('check') },
              {
                type: 'Not',
                operand: {
                  type: 'Comparison',
                  operator: '==',
                  left: { type: 'VariableRef', variableId: ref('flag'), scope: 'Global' },
                  right: { type: 'Constant', value: true },
                },
              },
            ],
          },
        },
      },
      {
        op: 'presentation.create',
        alias: 'show',
        data: {
          name: 'C4 Branch and Parallel',
          description: 'CLI presentation graph regression',
          displayOrder: 0,
        },
      },
      {
        op: 'presentation.create',
        alias: 'child',
        data: { name: 'Shared Child', displayOrder: 1 },
      },
      { op: 'presentation.create', alias: 'leaf', data: { name: 'Shared Leaf', displayOrder: 2 } },
      {
        op: 'script.create',
        alias: 'effect',
        data: { name: 'Play Effect', assetName: 'PlayEffect', category: 'Performance' },
      },
      {
        op: 'script.create',
        alias: 'check',
        data: { name: 'Check Flag', assetName: 'CheckFlag', category: 'Condition' },
      },
      {
        op: 'variable.create',
        alias: 'flag',
        owner: { type: 'global' },
        data: { name: 'Flag', assetName: 'Flag', type: 'boolean', value: false },
      },
      {
        op: 'variable.create',
        alias: 'count',
        owner: { type: 'stage', ref: ref('root') },
        data: { name: 'Count', assetName: 'Count', type: 'integer', value: 0 },
      },
      {
        op: 'puzzle.create',
        alias: 'door',
        stage: ref('root'),
        data: { name: 'Door', assetName: 'Door' },
        initialState: { name: 'Idle', assetName: 'Idle', alias: 'idle' },
      },
      {
        op: 'transition.create',
        alias: 'repeat',
        fsm: { puzzle: ref('door') },
        from: ref('idle'),
        to: ref('idle'),
        data: {
          name: 'Replay',
          priority: 0,
          triggers: [{ type: 'Always' }],
          presentation: { type: 'Graph', graphId: graph },
        },
      },
      {
        op: 'presentationNode.create',
        alias: 'yes',
        graph,
        data: { name: 'True Wait', type: 'Wait', duration: 0, position: { x: 250, y: 20 } },
      },
      {
        op: 'presentationNode.create',
        alias: 'no',
        graph,
        data: { name: 'False Wait', type: 'Wait', duration: 2, position: { x: 250, y: 340 } },
      },
      {
        op: 'presentationNode.create',
        alias: 'both',
        graph,
        data: { name: 'Parallel Paths', type: 'Parallel', position: { x: 500, y: 180 } },
      },
      {
        op: 'presentationNode.create',
        alias: 'effectCall',
        graph,
        data: {
          name: 'Play Effect',
          type: 'PresentationNode',
          position: { x: 750, y: 20 },
          presentation: {
            type: 'Script',
            scriptId: ref('effect'),
            parameters: [
              {
                paramName: 'Payload',
                source: { type: 'Constant', value: { alias: 'choose', value: false } },
              },
              {
                paramName: 'Iterations',
                kind: 'Temporary',
                tempVariable: { name: 'Iterations', type: 'integer' },
                source: { type: 'VariableRef', variableId: ref('count'), scope: 'StageLocal' },
              },
            ],
          },
        },
      },
      {
        op: 'presentationNode.create',
        alias: 'childCall',
        graph,
        data: {
          name: 'Shared Child',
          type: 'PresentationNode',
          position: { x: 750, y: 340 },
          presentation: { type: 'Graph', graphId: ref('child') },
        },
      },
      {
        op: 'presentationNode.create',
        alias: 'leafCall',
        graph: ref('child'),
        data: {
          name: 'Shared Leaf',
          type: 'PresentationNode',
          position: { x: 0, y: 0 },
          presentation: { type: 'Graph', graphId: ref('leaf') },
        },
      },
      {
        op: 'presentationNode.create',
        alias: 'leafWait',
        graph: ref('leaf'),
        data: { name: 'Leaf Wait', type: 'Wait', duration: 0.5, position: { x: 0, y: 0 } },
      },
      { op: 'presentation.setStart', graph, node: ref('choose') },
      {
        op: 'presentationEdge.connect',
        graph,
        from: ref('choose'),
        slot: 'true',
        to: ref('yes'),
        style: { fromSide: 'right', toSide: 'left' },
      },
      {
        op: 'presentationEdge.connect',
        graph,
        from: ref('choose'),
        slot: 'false',
        to: ref('no'),
        style: { fromSide: 'bottom', toSide: 'left' },
      },
      { op: 'presentationEdge.connect', graph, from: ref('yes'), slot: 'next', to: ref('both') },
      { op: 'presentationEdge.connect', graph, from: ref('no'), slot: 'next', to: ref('both') },
      { op: 'presentationEdge.connect', graph, from: ref('both'), slot: 0, to: ref('effectCall') },
      { op: 'presentationEdge.connect', graph, from: ref('both'), slot: 1, to: ref('childCall') },
      {
        op: 'stage.update',
        target: ref('root'),
        changes: { onEnterPresentation: { type: 'Graph', graphId: graph } },
      },
    ],
  };
}
