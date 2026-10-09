/** 对外教程的虚构工程与操作示例；ID 固定只为可复现，实际工程必须先查询。 */
import { createEmptyProject } from '../utils/projectFactory';
import { serializeProject } from '../services/projectFiles';
import type { ProjectData } from '../types/project';
import type { Operation } from '../contracts/automation/planSchemas';

export const exampleTime = '2026-01-01T00:00:00.000Z';
export function exampleProject(): ProjectData {
  const project = createEmptyProject(
    'Reference Demo',
    'Fictional CLI learning project',
    exampleTime,
  );
  const root = project.stageTree.stages[project.stageTree.rootId];
  root.assetName = 'DemoRoot';
  root.childrenIds = ['room', 'hall'];
  for (const [id, name, parentId, initial] of [
    ['room', 'Room', root.id, true],
    ['hall', 'Hall', root.id, false],
    ['child', 'Child', 'room', true],
  ] as const) {
    project.stageTree.stages[id] = {
      id,
      name,
      assetName: name,
      parentId,
      childrenIds: id === 'room' ? ['child'] : [],
      localVariables: {},
      eventListeners: [],
      isInitial: initial,
      unlockTriggers: [{ type: 'Always' }],
    };
  }
  for (const [id, assetName, state] of [
    ['draft', 'Draft', 'Draft'],
    ['implemented', 'Implemented', 'Implemented'],
    ['marked', 'Marked', 'MarkedForDelete'],
  ] as const) {
    project.blackboard.globalVariables[id] = {
      id,
      name: assetName + ' Counter',
      assetName: assetName + 'Counter',
      type: 'integer',
      value: 0,
      scope: 'Global',
      state,
    };
    project.blackboard.events[id] = {
      id,
      name: assetName + ' Event',
      assetName: assetName + 'Event',
      state,
    };
    project.scripts.scripts[id] = {
      id,
      name: assetName + ' Script',
      assetName: assetName + 'Script',
      category: 'Performance',
      state,
    };
  }
  for (const [id, assetName] of [
    ['door', 'Door'],
    ['lock', 'Lock'],
  ] as const) {
    const fsmId = id + '-fsm';
    project.nodes[id] = {
      id,
      name: assetName,
      assetName,
      stageId: 'room',
      stateMachineId: fsmId,
      eventListeners: [],
      localVariables: {},
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
        open: {
          id: 'open',
          name: 'Open',
          assetName: 'Open',
          position: { x: 250, y: 0 },
          eventListeners: [],
        },
        spare: {
          id: 'spare',
          name: 'Spare',
          assetName: 'Spare',
          position: { x: 250, y: 200 },
          eventListeners: [],
        },
      },
      transitions: {
        go: {
          id: 'go',
          name: 'Open Door',
          fromStateId: 'idle',
          toStateId: 'open',
          priority: 0,
          triggers: [{ type: 'Always' }],
          parameterModifiers: [],
        },
      },
    };
  }
  project.presentationGraphs.show = {
    id: 'show',
    name: 'Opening',
    startNodeId: 'first',
    nodes: {
      first: {
        id: 'first',
        name: 'First',
        type: 'Wait',
        duration: 1,
        position: { x: 0, y: 0 },
        nextIds: ['last'],
      },
      last: {
        id: 'last',
        name: 'Last',
        type: 'Wait',
        duration: 1,
        position: { x: 240, y: 0 },
        nextIds: [],
      },
      spare: {
        id: 'spare',
        name: 'Spare',
        type: 'Wait',
        duration: 1,
        position: { x: 240, y: 180 },
        nextIds: [],
      },
    },
  };
  return project;
}
export function exampleFile() {
  return serializeProject(exampleProject(), undefined, exampleTime);
}
const id = (id: string) => ({ id });
const globalOwner = { type: 'global' as const };
const fsm = id('door-fsm');
const graph = id('show');
export interface OperationExample {
  purpose: string;
  notes: string;
  commands: Operation[];
  expected: { pointer: string; value?: unknown; absent?: boolean };
}
const item = (
  purpose: string,
  notes: string,
  command: Operation,
  pointer: string,
  value?: unknown,
  absent = false,
): OperationExample => ({
  purpose,
  notes,
  commands: [command],
  expected: { pointer, value, absent },
});
export const operationExamples = {
  'project.update': item(
    '修改工程元数据。',
    '仅允许元数据白名单，不替换工程结构或编辑器状态。',
    { op: 'project.update', changes: { description: 'Updated demo' } },
    '/meta/description',
    'Updated demo',
  ),
  'stage.create': item(
    '在父 Stage 下创建子阶段。',
    'parent 可为现有 ID 或同计划 alias；新名称必须外部指定。',
    {
      op: 'stage.create',
      alias: 'newStage',
      parent: id('room'),
      data: { name: 'Office', assetName: 'Office' },
    },
    '/stageTree/stages/$newStage/assetName',
    'Office',
  ),
  'stage.update': item(
    '修改 Stage 属性和绑定。',
    '可修改解锁、生命周期、事件监听及出入演出；引用必须在可见作用域内。',
    { op: 'stage.update', target: id('room'), changes: { description: 'Updated room' } },
    '/stageTree/stages/room/description',
    'Updated room',
  ),
  'stage.move': item(
    '改变 Stage 的父级及位置。',
    '根不可移动，不能形成环；scope 要覆盖来源和目标父级。移动后局部变量引用仍须有效。',
    { op: 'stage.move', target: id('child'), parent: id('hall'), index: 0 },
    '/stageTree/stages/child/parentId',
    'hall',
  ),
  'stage.reorder': item(
    '改变 Stage 在父级中的顺序。',
    '首个子阶段为初始阶段；同时检查原、新初始兄弟的影响。',
    { op: 'stage.reorder', target: id('hall'), index: 0 },
    '/stageTree/stages/STAGE_1/childrenIds/0',
    'hall',
  ),
  'stage.delete': item(
    '删除 Stage 及明确指定的子内容。',
    '根不可删除；非空 Stage 须 cascade=true；包括所属 FSM，保留共享图和全局资源。间接删除受保护资源仍需授权。',
    { op: 'stage.delete', target: id('room'), cascade: true },
    '/stageTree/stages/room',
    undefined,
    true,
  ),
  'puzzle.create': item(
    '创建 Puzzle 及其初始状态机。',
    'Puzzle 和 initialState 均须明确 assetName；initialState.alias 可供同计划迁移引用。',
    {
      op: 'puzzle.create',
      alias: 'newPuzzle',
      stage: id('room'),
      data: { name: 'Chest', assetName: 'Chest' },
      initialState: { name: 'Closed', assetName: 'Closed', alias: 'closed' },
    },
    '/nodes/$newPuzzle/assetName',
    'Chest',
  ),
  'puzzle.update': item(
    '修改 Puzzle 元数据、生命周期及事件监听。',
    '定位 Puzzle ID，不能用 FSM ID 代替。',
    { op: 'puzzle.update', target: id('door'), changes: { description: 'Updated door' } },
    '/nodes/door/description',
    'Updated door',
  ),
  'puzzle.move': item(
    '将 Puzzle 移到另一 Stage。',
    '同时检查原 Stage、新 Stage 和局部变量可见性；不会重建 FSM。',
    { op: 'puzzle.move', target: id('door'), stage: id('hall'), index: 0 },
    '/nodes/door/stageId',
    'hall',
  ),
  'puzzle.reorder': item(
    '明确指定同一 Stage 的 Puzzle 完整顺序。',
    'order 必须恰好包含该 Stage 全部 Puzzle，不能遗漏或重复。',
    { op: 'puzzle.reorder', stage: id('room'), order: [id('lock'), id('door')] },
    '/nodes/lock/displayOrder',
    0,
  ),
  'puzzle.delete': item(
    '删除 Puzzle 及所属 FSM。',
    '其他 Puzzle 仍共享该 FSM 时拒绝；共享图不随之删除，剩余引用须明确修复。',
    { op: 'puzzle.delete', target: id('door') },
    '/nodes/door',
    undefined,
    true,
  ),
  'variable.create': item(
    '在明确归属中创建变量。',
    'owner 为 global、stage 或 puzzle；type 必须与 value 匹配。',
    {
      op: 'variable.create',
      alias: 'newVariable',
      owner: globalOwner,
      data: { name: 'Score', assetName: 'Score', type: 'integer', value: 0 },
    },
    '/blackboard/globalVariables/$newVariable/value',
    0,
  ),
  'variable.update': item(
    '修改变量的名称、类型或值。',
    'target 与 owner 一起定位；类型变化后须修复不兼容引用。',
    { op: 'variable.update', target: id('draft'), owner: globalOwner, changes: { value: 2 } },
    '/blackboard/globalVariables/draft/value',
    2,
  ),
  'variable.move': item(
    '把变量移到另一个归属。',
    '明确原 owner 和 destination；不会替调用者隐式改绑同名变量，须检查可见性及引用。',
    {
      op: 'variable.move',
      target: id('draft'),
      owner: globalOwner,
      destination: { type: 'stage', ref: id('room') },
    },
    '/stageTree/stages/room/localVariables/draft/scope',
    'StageLocal',
  ),
  'variable.delete': item(
    '按资源生命周期删除或标删变量。',
    'Draft 物理删除，Implemented 标记删除，MarkedForDelete 再次 delete 拒绝。',
    { op: 'variable.delete', target: id('draft'), owner: globalOwner },
    '/blackboard/globalVariables/draft',
    undefined,
    true,
  ),
  'variable.purge': item(
    '永久移除受保护变量。',
    '只用于 Implemented/MarkedForDelete，须已有聊天永久删除授权及提交声明，检查剩余引用。',
    { op: 'variable.purge', target: id('implemented'), owner: globalOwner },
    '/blackboard/globalVariables/implemented',
    undefined,
    true,
  ),
  'variable.restore': item(
    '恢复已标删变量。',
    'MarkedForDelete 恢复为 Implemented；不是恢复已永久删除对象。',
    { op: 'variable.restore', target: id('marked'), owner: globalOwner },
    '/blackboard/globalVariables/marked/state',
    'Implemented',
  ),
  'event.create': item(
    '创建全局事件定义。',
    '定义事件不等于触发事件；触发器和监听器通过引用使用它。',
    {
      op: 'event.create',
      alias: 'newEvent',
      data: { name: 'Door Opened', assetName: 'DoorOpened' },
    },
    '/blackboard/events/$newEvent/assetName',
    'DoorOpened',
  ),
  'event.update': item(
    '修改事件元数据。',
    '保留 ID；删除或改换引用须通过对应调用者操作。',
    { op: 'event.update', target: id('draft'), changes: { description: 'Updated event' } },
    '/blackboard/events/draft/description',
    'Updated event',
  ),
  'event.delete': item(
    '按生命周期删除或标删事件。',
    'Draft 删除，Implemented 标删；引用检查仍适用。',
    { op: 'event.delete', target: id('draft') },
    '/blackboard/events/draft',
    undefined,
    true,
  ),
  'event.purge': item(
    '永久移除受保护事件。',
    '须已有对应聊天永久删除授权；检查触发器、监听器和事件调用引用。',
    { op: 'event.purge', target: id('implemented') },
    '/blackboard/events/implemented',
    undefined,
    true,
  ),
  'event.restore': item(
    '恢复已标删事件。',
    '恢复为 Implemented，不恢复永久删除后的内容。',
    { op: 'event.restore', target: id('marked') },
    '/blackboard/events/marked/state',
    'Implemented',
  ),
  'script.create': item(
    '创建脚本定义。',
    '只维护元数据，不生成或执行脚本代码；Lifecycle 分类须有匹配 lifecycleType。',
    {
      op: 'script.create',
      alias: 'newScript',
      data: { name: 'Check Door', assetName: 'CheckDoor', category: 'Condition' },
    },
    '/scripts/scripts/$newScript/category',
    'Condition',
  ),
  'script.update': item(
    '修改脚本元数据或分类。',
    '修改分类后调用者绑定仍须匹配；不更改脚本实现。',
    { op: 'script.update', target: id('draft'), changes: { description: 'Updated script' } },
    '/scripts/scripts/draft/description',
    'Updated script',
  ),
  'script.delete': item(
    '按生命周期删除或标删脚本。',
    'Draft 删除，Implemented 标删；演出、条件、触发器和生命周期引用需检查。',
    { op: 'script.delete', target: id('draft') },
    '/scripts/scripts/draft',
    undefined,
    true,
  ),
  'script.purge': item(
    '永久移除受保护脚本。',
    '须已有对应聊天永久删除授权；有剩余调用者时须在同计划修复。',
    { op: 'script.purge', target: id('implemented') },
    '/scripts/scripts/implemented',
    undefined,
    true,
  ),
  'script.restore': item(
    '恢复已标删脚本。',
    '恢复为 Implemented，不恢复永久删除后的内容。',
    { op: 'script.restore', target: id('marked') },
    '/scripts/scripts/marked/state',
    'Implemented',
  ),
  'state.create': item(
    '在明确 FSM 中创建状态。',
    '必须给 position 和 assetName；不会自动成为初始状态。',
    {
      op: 'state.create',
      alias: 'newState',
      fsm,
      data: { name: 'Locked', assetName: 'Locked', position: { x: 400, y: 0 } },
    },
    '/stateMachines/door-fsm/states/$newState/assetName',
    'Locked',
  ),
  'state.update': item(
    '修改 FSM 状态属性和位置。',
    '必须同时指定 FSM 和状态，避免不同 FSM 中相同局部 ID 混淆。',
    { op: 'state.update', fsm, target: id('idle'), changes: { position: { x: 20, y: 30 } } },
    '/stateMachines/door-fsm/states/idle/position',
    { x: 20, y: 30 },
  ),
  'state.delete': item(
    '删除状态并明确处理初始状态及关联迁移。',
    '删除初始状态须指定 replacementInitialState；有关联迁移须明确 deleteTransitions=true。',
    { op: 'state.delete', fsm, target: id('spare') },
    '/stateMachines/door-fsm/states/spare',
    undefined,
    true,
  ),
  'fsm.setInitial': item(
    '设置 FSM 初始状态。',
    'state 必须属于该 FSM；不接受其他 FSM 的同名状态。',
    { op: 'fsm.setInitial', fsm, state: id('open') },
    '/stateMachines/door-fsm/initialStateId',
    'open',
  ),
  'fsm.update': item(
    '调整 FSM 显示排序元数据。',
    '只开放 displayOrder，不直接替换 states/transitions。',
    { op: 'fsm.update', fsm, changes: { displayOrder: 2 } },
    '/stateMachines/door-fsm/displayOrder',
    2,
  ),
  'transition.create': item(
    '创建 FSM 迁移。',
    'from/to 必须同 FSM，priority 为非负整数；通过 triggers/condition/参数修改/演出表达流程。',
    {
      op: 'transition.create',
      alias: 'newTransition',
      fsm,
      from: id('open'),
      to: id('idle'),
      data: { name: 'Close', priority: 1, triggers: [{ type: 'Always' }] },
    },
    '/stateMachines/door-fsm/transitions/$newTransition/toStateId',
    'idle',
  ),
  'transition.update': item(
    '修改迁移逻辑和演出。',
    'triggers/parameterModifiers/invokeEventIds 等数组是完整替换；改端点使用 redirect。',
    {
      op: 'transition.update',
      fsm,
      target: id('go'),
      changes: { condition: { type: 'Literal', value: true }, priority: 2 },
    },
    '/stateMachines/door-fsm/transitions/go/priority',
    2,
  ),
  'transition.delete': item(
    '删除指定迁移。',
    '不删除两端状态；FSM 与 target 必须准确。',
    { op: 'transition.delete', fsm, target: id('go') },
    '/stateMachines/door-fsm/transitions/go',
    undefined,
    true,
  ),
  'transition.redirect': item(
    '改变迁移两端状态和可选连接方向。',
    '必须同时提供 from/to；保留其触发器、条件和其他元数据。',
    { op: 'transition.redirect', fsm, target: id('go'), from: id('idle'), to: id('spare') },
    '/stateMachines/door-fsm/transitions/go/toStateId',
    'spare',
  ),
  'presentation.create': item(
    '创建共享演出图。',
    '图不是命名业务资产，没有 assetName 字段；节点与起点通过独立操作设置。',
    { op: 'presentation.create', alias: 'newGraph', data: { name: 'Victory' } },
    '/presentationGraphs/$newGraph/name',
    'Victory',
  ),
  'presentation.update': item(
    '修改演出图名称、说明和排序。',
    '不替换节点字典；共享调用者不会被隐式改写。',
    { op: 'presentation.update', graph, changes: { description: 'Updated graph' } },
    '/presentationGraphs/show/description',
    'Updated graph',
  ),
  'presentation.delete': item(
    '删除演出图。',
    '剩余 Stage/迁移/图调用引用必须在同计划修复。',
    { op: 'presentation.delete', graph },
    '/presentationGraphs/show',
    undefined,
    true,
  ),
  'presentation.setStart': item(
    '设置或清空图的起点。',
    'node 为本图节点或 null；清空可能产生业务诊断，导出仍受校验约束。',
    { op: 'presentation.setStart', graph, node: id('last') },
    '/presentationGraphs/show/startNodeId',
    'last',
  ),
  'presentationNode.create': item(
    '创建演出、等待、分支或并行节点。',
    'Wait 使用 duration；Branch 使用 condition；PresentationNode 使用 presentation 绑定。',
    {
      op: 'presentationNode.create',
      graph,
      alias: 'newGraphNode',
      data: { name: 'Pause', type: 'Wait', duration: 2, position: { x: 500, y: 0 } },
    },
    '/presentationGraphs/show/nodes/$newGraphNode/duration',
    2,
  ),
  'presentationNode.update': item(
    '修改演出节点属性。',
    '类型改变须让原有边和字段仍合法；连线使用 edge 操作。',
    { op: 'presentationNode.update', graph, target: id('last'), changes: { duration: 3 } },
    '/presentationGraphs/show/nodes/last/duration',
    3,
  ),
  'presentationNode.delete': item(
    '删除图节点并明确处理连线和起点。',
    '有关联边须 deleteEdges=true；删除起点须 replacementStart。',
    { op: 'presentationNode.delete', graph, target: id('spare') },
    '/presentationGraphs/show/nodes/spare',
    undefined,
    true,
  ),
  'presentationEdge.connect': item(
    '在指定语义槽位建立连线。',
    '普通/Wait 为 next；Branch 为 true/false；Parallel 为从 0 开始的有序索引；目标属于同图。',
    { op: 'presentationEdge.connect', graph, from: id('last'), slot: 'next', to: id('spare') },
    '/presentationGraphs/show/nodes/last/nextIds/0',
    'spare',
  ),
  'presentationEdge.disconnect': item(
    '移除指定槽位连线。',
    '定位使用 graph+from+slot，不直接编辑 nextIds；节点保留。',
    { op: 'presentationEdge.disconnect', graph, from: id('first'), slot: 'next' },
    '/presentationGraphs/show/nodes/first/nextIds',
    [],
  ),
  'presentationEdge.redirect': item(
    '重定向指定槽位的目标。',
    '保留其他槽位，必要时显式指定样式；不允许跨图连线。',
    { op: 'presentationEdge.redirect', graph, from: id('first'), slot: 'next', to: id('spare') },
    '/presentationGraphs/show/nodes/first/nextIds/0',
    'spare',
  ),
  'presentationEdge.update': item(
    '修改连线两端连接方向。',
    '只改 style；方向为 top/right/bottom/left 或 null，改目标使用 redirect。',
    {
      op: 'presentationEdge.update',
      graph,
      from: id('first'),
      slot: 'next',
      style: { fromSide: 'right', toSide: 'left' },
    },
    '/presentationGraphs/show/edgeProperties/first->last/fromSide',
    'right',
  ),
} satisfies Record<Operation['op'], OperationExample>;
