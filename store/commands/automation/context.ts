/** 候选命令只使用隔离状态和已有领域 Slice，不进入 GUI 会话、历史或文件 IO。 */
import type { ProjectData } from '../../../types/project';
import type { VariableDefinition } from '../../../types/blackboard';
import type { VariableScope } from '../../../types/common';
import { ownEntry } from '../../../utils/recordLookup';
import type { Plan, Ref, Owner, FsmRef } from '../../../contracts/automation/planSchemas';
import { INITIAL_STATE, type Action, type EditorState } from '../../types';
import { projectReducer, isProjectAction } from '../../slices/projectSlice';
import { blackboardReducer, isBlackboardAction } from '../../slices/blackboardSlice';
import { nodeParamsReducer, isNodeParamsAction } from '../../slices/nodeParamsSlice';
import { projectMetaReducer, isProjectMetaAction } from '../../slices/projectMetaSlice';
import { fsmReducer, isFsmAction } from '../../slices/fsmSlice';
import { presentationReducer, isPresentationAction } from '../../slices/presentationSlice';
import {
  generateResourceId,
  generateTypedScriptId,
  type ResourceIdType,
} from '../../../utils/resourceIdGenerator';

export class CommandFailure extends Error {
  operationIndex?: number;
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: object,
  ) {
    super(message);
    this.name = 'CommandFailure';
  }
}
export const fail = (code: string, message: string): never => {
  throw new CommandFailure(code, message);
};
export type Kind =
  | 'stage'
  | 'puzzle'
  | 'variable'
  | 'event'
  | 'script'
  | 'presentation'
  | 'presentationNode'
  | 'state'
  | 'transition';
export type Allocation = {
  type: Kind;
  id: string;
  fsmId?: string;
  graphId?: string;
  initialStateId?: string;
};
export type ResolvedOwner = { type: 'global' | 'stage' | 'puzzle'; id?: string };

export class CommandContext {
  private state: EditorState;
  readonly allocations: Record<string, Allocation> = Object.create(null) as Record<
    string,
    Allocation
  >;
  private readonly reserved = new Set<string>();
  private readonly stages = new Set<string>();
  private readonly puzzles = new Set<string>();
  private readonly presentations = new Set<string>();
  constructor(
    source: ProjectData,
    readonly plan: Plan,
  ) {
    this.state = { ...INITIAL_STATE, project: { ...structuredClone(source), isLoaded: true } };
    // 所有类型的源 ID 均保留；本批删除不会使计数器或已分配 ID 回退。
    // 只扫描领域实体，任意 JSON 常量中的 id 字段不属于实体编号。
    const reserveCollection = (entries: Record<string, { id: string }>) => {
      for (const [key, value] of Object.entries(entries)) {
        this.reserved.add(key);
        this.reserved.add(value.id);
      }
    };
    [
      source.stageTree.stages,
      source.nodes,
      source.stateMachines,
      source.presentationGraphs,
      source.blackboard.globalVariables,
      source.blackboard.events,
      source.scripts.scripts,
    ].forEach(reserveCollection);
    for (const stage of Object.values(source.stageTree.stages))
      reserveCollection(stage.localVariables);
    for (const node of Object.values(source.nodes)) reserveCollection(node.localVariables);
    for (const fsm of Object.values(source.stateMachines)) {
      reserveCollection(fsm.states);
      reserveCollection(fsm.transitions);
    }
    for (const graph of Object.values(source.presentationGraphs)) reserveCollection(graph.nodes);
    this.allocations.root = { type: 'stage', id: source.stageTree.rootId };
    plan.commands.forEach((op, i) => {
      try {
        if (!('alias' in op)) return;
        if (Object.hasOwn(this.allocations, op.alias))
          fail('DUPLICATE_ALIAS', `Alias ${op.alias} is already declared.`);
        const type = op.op.split('.')[0] as Kind;
        let id: string;
        if (op.op === 'script.create') {
          id = generateTypedScriptId(op.data.category, [...this.reserved]);
          this.reserve(id);
        } else {
          const prefixes: Record<string, ResourceIdType> = {
            stage: 'STAGE',
            puzzle: 'NODE',
            event: 'EVENT',
            state: 'STATE',
            transition: 'TRANSITION',
            presentation: 'GRAPH',
            presentationNode: 'PNODE',
          };
          const prefix =
            op.op === 'variable.create'
              ? op.owner.type === 'global'
                ? 'VAR'
                : op.owner.type === 'stage'
                  ? 'STAGEVAR'
                  : 'NODEVAR'
              : prefixes[type];
          id = this.allocate(prefix);
        }
        this.allocations[op.alias] = {
          type,
          id,
          ...(type === 'puzzle'
            ? { fsmId: this.allocate('FSM'), initialStateId: this.allocate('STATE') }
            : {}),
        };
        if (op.op === 'puzzle.create' && op.initialState.alias) {
          const initialAlias = op.initialState.alias;
          if (Object.hasOwn(this.allocations, initialAlias))
            fail('DUPLICATE_ALIAS', `Alias ${initialAlias} is already declared.`);
          const puzzle = this.allocations[op.alias];
          this.allocations[initialAlias] = {
            type: 'state',
            id: puzzle.initialStateId!,
            fsmId: puzzle.fsmId!,
          };
        }
      } catch (error) {
        if (error instanceof CommandFailure) error.operationIndex = i;
        throw error;
      }
    });
    // 所有 alias 预留完成后再绑定所属 FSM，允许声明顺序与创建依赖顺序不同。
    plan.commands.forEach((op, i) => {
      if (op.op === 'presentationNode.create') {
        try {
          this.allocations[op.alias].graphId = this.resolve(op.graph, 'presentation');
        } catch (error) {
          if (error instanceof CommandFailure) error.operationIndex = i;
          throw error;
        }
        return;
      }
      if (op.op !== 'state.create' && op.op !== 'transition.create') return;
      try {
        this.allocations[op.alias].fsmId = this.fsmId(op.fsm);
      } catch (error) {
        if (error instanceof CommandFailure) error.operationIndex = i;
        throw error;
      }
    });
    for (const ref of plan.scope.stages ?? []) {
      const id = this.resolve(ref, 'stage');
      this.stage(id);
      const queue = [id];
      for (let i = 0; i < queue.length; i++)
        if (!this.stages.has(queue[i])) {
          this.stages.add(queue[i]);
          queue.push(...this.stage(queue[i]).childrenIds);
        }
    }
    for (const ref of plan.scope.puzzles ?? []) {
      const id = this.resolve(ref, 'puzzle');
      this.puzzle(id);
      this.puzzles.add(id);
    }
    for (const node of Object.values(source.nodes))
      if (this.stages.has(node.stageId)) this.puzzles.add(node.id);
    for (const ref of plan.scope.presentations ?? []) {
      const id = this.resolve(ref, 'presentation');
      if ('id' in ref) this.graph(id);
      this.presentations.add(id);
    }
  }
  get project(): ProjectData {
    const { isLoaded: _isLoaded, ...project } = this.state.project;
    return project;
  }
  private reserve(id: string) {
    const count = Number(id.slice(id.lastIndexOf('_') + 1));
    if (this.reserved.has(id) || !Number.isSafeInteger(count))
      fail('ID_SPACE_EXHAUSTED', 'Cannot safely allocate a new ID from this project.');
    this.reserved.add(id);
  }
  private allocate(type: ResourceIdType) {
    const id = generateResourceId(type, [...this.reserved]);
    this.reserve(id);
    return id;
  }
  resolve(ref: Ref, type: Kind): string {
    if ('id' in ref) return ref.id;
    const entry = this.allocations[ref.alias];
    if (!entry) return fail('UNKNOWN_ALIAS', `Alias ${ref.alias} is not declared.`);
    if (entry.type !== type)
      return fail('ALIAS_TYPE_MISMATCH', `Alias ${ref.alias} is ${entry.type}, expected ${type}.`);
    return entry.id;
  }
  stage(id: string) {
    return (
      ownEntry(this.project.stageTree.stages, id) ??
      fail('ENTITY_NOT_FOUND', `Stage ${id} does not exist.`)
    );
  }
  puzzle(id: string) {
    return (
      ownEntry(this.project.nodes, id) ?? fail('ENTITY_NOT_FOUND', `Puzzle ${id} does not exist.`)
    );
  }
  fsmId(ref: FsmRef): string {
    if ('id' in ref) return ref.id;
    const puzzleId = this.resolve(ref.puzzle, 'puzzle');
    if ('alias' in ref.puzzle) return this.allocations[ref.puzzle.alias].fsmId!;
    return this.puzzle(puzzleId).stateMachineId;
  }
  fsm(id: string) {
    return (
      ownEntry(this.project.stateMachines, id) ??
      fail('ENTITY_NOT_FOUND', `FSM ${id} does not exist.`)
    );
  }
  allowFsm(id: string) {
    this.fsm(id);
    const owners = Object.values(this.project.nodes).filter((node) => node.stateMachineId === id);
    if (owners.length !== 1)
      fail(
        'FSM_OWNER_INVALID',
        `FSM ${id} must belong to exactly one puzzle; found ${owners.length}.`,
      );
    this.allowPuzzle(owners[0].id);
  }
  resolveInFsm(ref: Ref, type: 'state' | 'transition', fsmId: string): string {
    const id = this.resolve(ref, type);
    if ('alias' in ref && this.allocations[ref.alias].fsmId !== fsmId)
      fail('FSM_REFERENCE_MISMATCH', `Alias ${ref.alias} does not belong to FSM ${fsmId}.`);
    return id;
  }
  allowStage(id: string) {
    if (!this.plan.scope.project && !this.stages.has(id))
      fail('SCOPE_VIOLATION', `Stage ${id} is outside the edit scope.`);
  }
  graph(id: string) {
    return (
      ownEntry(this.project.presentationGraphs, id) ??
      fail('ENTITY_NOT_FOUND', `Graph ${id} does not exist.`)
    );
  }
  allowGraph(id: string) {
    if (!this.plan.scope.project && !this.presentations.has(id))
      fail('SCOPE_VIOLATION', `Graph ${id} is outside the explicit graph edit scope.`);
  }
  resolveInGraph(ref: Ref, graphId: string) {
    const id = this.resolve(ref, 'presentationNode');
    if ('alias' in ref && this.allocations[ref.alias].graphId !== graphId)
      fail('GRAPH_REFERENCE_MISMATCH', `Alias ${ref.alias} does not belong to graph ${graphId}.`);
    return id;
  }
  allowPuzzle(id: string) {
    if (!this.plan.scope.project && !this.puzzles.has(id))
      fail('SCOPE_VIOLATION', `Puzzle ${id} is outside the edit scope.`);
  }
  inheritStage(id: string, parent: string) {
    this.allowStage(parent);
    this.stages.add(id);
  }
  inheritPuzzle(id: string, parent: string) {
    this.allowStage(parent);
    this.puzzles.add(id);
  }
  allowGlobal(type: 'variable' | 'event' | 'script') {
    if (!this.plan.scope.project && !this.plan.scope.globals?.includes(type))
      fail('SCOPE_VIOLATION', `Global ${type} changes are outside the edit scope.`);
  }
  owner(input: Owner): ResolvedOwner {
    if (input.type === 'global') return { type: 'global' };
    return { type: input.type, id: this.resolve(input.ref, input.type) };
  }
  variables(owner: ResolvedOwner): Record<string, VariableDefinition> {
    if (owner.type === 'global') return this.project.blackboard.globalVariables;
    return owner.type === 'stage'
      ? this.stage(owner.id!).localVariables
      : this.puzzle(owner.id!).localVariables;
  }
  allowOwner(owner: ResolvedOwner) {
    if (owner.type === 'global') this.allowGlobal('variable');
    else if (owner.type === 'stage') this.allowStage(owner.id!);
    else this.allowPuzzle(owner.id!);
  }
  variableScope(owner: ResolvedOwner): VariableScope {
    return owner.type === 'global' ? 'Global' : owner.type === 'stage' ? 'StageLocal' : 'NodeLocal';
  }
  addVariable(owner: ResolvedOwner, variable: VariableDefinition) {
    this.allowOwner(owner);
    if (owner.type === 'global')
      this.dispatch({ type: 'ADD_GLOBAL_VARIABLE', payload: { variable } });
    else if (owner.type === 'stage')
      this.dispatch({ type: 'ADD_STAGE_VARIABLE', payload: { stageId: owner.id!, variable } });
    else this.dispatch({ type: 'ADD_NODE_PARAM', payload: { nodeId: owner.id!, variable } });
  }
  updateVariable(owner: ResolvedOwner, id: string, data: Partial<VariableDefinition>) {
    this.allowOwner(owner);
    if (owner.type === 'global')
      this.dispatch({ type: 'UPDATE_GLOBAL_VARIABLE', payload: { id, data } });
    else if (owner.type === 'stage')
      this.dispatch({
        type: 'UPDATE_STAGE_VARIABLE',
        payload: { stageId: owner.id!, varId: id, data },
      });
    else
      this.dispatch({ type: 'UPDATE_NODE_PARAM', payload: { nodeId: owner.id!, varId: id, data } });
  }
  removeVariable(owner: ResolvedOwner, id: string) {
    this.allowOwner(owner);
    // 隔离候选中的 Draft 删除、搬移或显式 purge；文件发布统一核对实际永久删除能力。
    if (owner.type === 'global')
      this.dispatch({ type: 'APPLY_DELETE_GLOBAL_VARIABLE', payload: { id } });
    else if (owner.type === 'stage')
      this.dispatch({ type: 'DELETE_STAGE_VARIABLE', payload: { stageId: owner.id!, varId: id } });
    else {
      const localVariables = { ...this.puzzle(owner.id!).localVariables };
      delete localVariables[id];
      this.dispatch({
        type: 'UPDATE_NODE',
        payload: { nodeId: owner.id!, data: { localVariables } },
      });
    }
  }
  dispatch(action: Action) {
    if (isProjectAction(action)) this.state = projectReducer(this.state, action);
    else if (isBlackboardAction(action)) this.state = blackboardReducer(this.state, action);
    else if (isNodeParamsAction(action)) this.state = nodeParamsReducer(this.state, action);
    else if (isProjectMetaAction(action)) this.state = projectMetaReducer(this.state, action);
    else if (isFsmAction(action)) this.state = fsmReducer(this.state, action);
    else if (isPresentationAction(action)) this.state = presentationReducer(this.state, action);
    else
      fail('UNSUPPORTED_DOMAIN_ACTION', 'This action is not part of the domain command executor.');
  }
}
