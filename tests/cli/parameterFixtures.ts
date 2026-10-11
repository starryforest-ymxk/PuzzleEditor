import type { Plan } from '../../contracts/automation/planSchemas';
import type { PresentationBinding } from '../../types/common';
import type { ProjectData } from '../../types/project';

/** 按公开契约填写的虚构计划：调用方没有 id/kind，覆盖所有演出绑定入口。 */
export function parameterCreationPlan(): Plan {
  const binding = {
    type: 'Script' as const,
    scriptId: { alias: 'effect' },
    parameters: [
      { paramName: 'SourceKey', source: { type: 'Constant' as const, value: 'sink' } },
      { paramName: 'Zero', source: { type: 'Constant' as const, value: 0 } },
      { paramName: 'Empty', source: { type: 'Constant' as const, value: '' } },
      {
        paramName: 'Flag',
        source: {
          type: 'VariableRef' as const,
          variableId: { alias: 'flag' },
          scope: 'Global' as const,
        },
      },
      {
        paramName: 'TemporaryFlag',
        kind: 'Temporary' as const,
        source: { type: 'Constant' as const, value: false },
        tempVariable: { name: 'Temporary Flag', type: 'boolean' as const },
      },
    ],
  };
  return {
    apiVersion: '1.0.0',
    scope: { project: true },
    commands: [
      {
        op: 'script.create',
        alias: 'effect',
        data: { name: 'Play Effect', assetName: 'PlayEffect', category: 'Performance' },
      },
      {
        op: 'variable.create',
        alias: 'flag',
        owner: { type: 'global' },
        data: { name: 'Flag', assetName: 'Flag', type: 'boolean', value: false },
      },
      {
        op: 'stage.update',
        target: { alias: 'root' },
        changes: { onEnterPresentation: binding, onExitPresentation: binding },
      },
      {
        op: 'puzzle.create',
        alias: 'door',
        stage: { alias: 'root' },
        data: { name: 'Door', assetName: 'Door' },
        initialState: { name: 'Idle', assetName: 'Idle', alias: 'idle' },
      },
      {
        op: 'transition.create',
        alias: 'call',
        fsm: { puzzle: { alias: 'door' } },
        from: { alias: 'idle' },
        to: { alias: 'idle' },
        data: {
          name: 'Replay',
          priority: 0,
          triggers: [{ type: 'Always' }],
          presentation: binding,
        },
      },
      { op: 'presentation.create', alias: 'graph', data: { name: 'Parameters' } },
      {
        op: 'presentationNode.create',
        alias: 'node',
        graph: { alias: 'graph' },
        data: {
          name: 'Call Effect',
          type: 'PresentationNode',
          position: { x: 100, y: 100 },
          presentation: binding,
        },
      },
      { op: 'presentation.setStart', graph: { alias: 'graph' }, node: { alias: 'node' } },
      {
        op: 'stage.create',
        alias: 'room',
        parent: { alias: 'root' },
        data: {
          name: 'Room',
          assetName: 'Room',
          onEnterPresentation: { type: 'Graph', graphId: { alias: 'graph' } },
        },
      },
    ],
  };
}

export function projectScriptBindings(project: ProjectData) {
  const bindings: (PresentationBinding | undefined)[] = [
    ...Object.values(project.stageTree.stages).flatMap((stage) => [
      stage.onEnterPresentation,
      stage.onExitPresentation,
    ]),
    ...Object.values(project.stateMachines).flatMap((fsm) =>
      Object.values(fsm.transitions).map((transition) => transition.presentation),
    ),
    ...Object.values(project.presentationGraphs).flatMap((graph) =>
      Object.values(graph.nodes).map((node) => node.presentation),
    ),
  ];
  return bindings.filter(
    (binding): binding is PresentationBinding & { type: 'Script' } => binding?.type === 'Script',
  );
}
