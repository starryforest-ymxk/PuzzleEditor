import type { EventListener, ParameterBinding, ParameterModifier, PresentationBinding, ValueSource, Vector2 } from '../../types/common';
import type { ConditionExpression, State, StateMachine, Transition, TriggerConfig } from '../../types/stateMachine';
import type { StageNode, StageTreeData } from '../../types/stage';
import type { PuzzleNode } from '../../types/puzzleNode';
import type { PresentationGraph, PresentationNode } from '../../types/presentation';
import type { BlackboardData, EventDefinition, VariableDefinition } from '../../types/blackboard';
import type { ScriptDefinition, ScriptsManifest } from '../../types/manifest';
import type { ProjectData, ProjectMeta } from '../../types/project';
import type { JsonValue } from '../../types/json';
import { array, asObject, boolean, defaulted, dictionary, entityId, fail, id, knownFields, nullable, number, object, oneOf, optional, string, variants, type ImportContext, type Reader } from './readers';
import { checkLegacyTriggers, indexLegacyBooleanVariables, migrateLegacyCondition, migrateLegacyOperand } from './legacy';

const resourceState = oneOf('Draft', 'Implemented', 'MarkedForDelete');
const scope = oneOf('Global', 'StageLocal', 'NodeLocal', 'Temporary');
const variableType = oneOf('boolean', 'integer', 'float', 'string');
const side = oneOf('top', 'right', 'bottom', 'left');
const entity = { id: entityId, name: string, description: optional(string) };
const asset = { assetName: optional(string) };
const order = { displayOrder: optional(number) };
const list = <T>(read: Reader<T>): Reader<T[]> => defaulted(array(read), []);
const map = <T>(read: Reader<T>): Reader<Record<string, T>> => defaulted(dictionary(read, true), {});
const value: Reader<JsonValue> = (input, path, context) => {
    if (input === null || typeof input === 'string' || typeof input === 'boolean') return input;
    if (typeof input === 'number') return number(input, path, context);
    if (Array.isArray(input)) return array(value)(input, path, context);
    if (typeof input !== 'object') fail(path, 'Expected a JSON value.');
    // 常量对象不套用实体 ID/字段白名单，保留全部键及嵌套值。
    return Object.fromEntries(Object.entries(asObject(input, path)).map(([key, item]) => [key, value(item, `${path}[${JSON.stringify(key)}]`, context)]));
};

const valueVariants = variants<ValueSource>({
    Constant: object({ type: oneOf('Constant'), value }),
    VariableRef: object({ type: oneOf('VariableRef'), variableId: id, scope })
});
const valueSource: Reader<ValueSource> = (input, path, context) => valueVariants(migrateLegacyOperand(input, path, context), path, context);

// 条件容许编辑中的缺省操作数；已经存在的字段必须满足结构，不能把错误数组当作空条件。
const condition: Reader<ConditionExpression> = (input, path, context) =>
    conditionVariants(migrateLegacyCondition(input, path, context), path, context);
const conditionVariants = variants<ConditionExpression>({
    And: object({ type: oneOf('And'), children: list(condition) }),
    Or: object({ type: oneOf('Or'), children: list(condition) }),
    Not: object({ type: oneOf('Not'), operand: optional(condition) }),
    Comparison: object({ type: oneOf('Comparison'), operator: optional(oneOf('==', '!=', '>', '<', '>=', '<=')), left: optional(valueSource), right: optional(valueSource) }),
    Literal: object({ type: oneOf('Literal'), value: optional(boolean) }),
    ScriptRef: object({ type: oneOf('ScriptRef'), scriptId: optional(id) })
});

const modifier: Reader<ParameterModifier> = object({
    targetVariableId: id, targetScope: scope,
    operation: oneOf('Set', 'Add', 'Subtract', 'Multiply', 'Divide', 'Toggle'), source: valueSource
});
const parameter: Reader<ParameterBinding> = object({
    paramName: string, source: valueSource, id: optional(entityId), kind: optional(oneOf('Variable', 'Temporary')),
    description: optional(string),
    tempVariable: optional(object({ ...entity, type: variableType }))
});
const binding: Reader<PresentationBinding> = variants<PresentationBinding>({
    Script: object({ type: oneOf('Script'), scriptId: id, parameters: list(parameter) }),
    Graph: object({ type: oneOf('Graph'), graphId: id })
});
const listener: Reader<EventListener> = object({
    eventId: id,
    action: variants<EventListener['action']>({
        InvokeScript: object({ type: oneOf('InvokeScript') }),
        ModifyParameter: object({ type: oneOf('ModifyParameter'), modifiers: list(modifier) })
    })
});
// 当前样例/旧样例都保留切换类型前的引用字段；校验其类型并保留，不静默清除。
const inactiveTriggerRefs = { eventId: optional(id), scriptId: optional(id) };
const trigger: Reader<TriggerConfig> = variants<TriggerConfig>({
    Always: object({ ...inactiveTriggerRefs, type: oneOf('Always') }),
    OnEvent: object({ ...inactiveTriggerRefs, type: oneOf('OnEvent'), eventId: id }),
    CustomScript: object({ ...inactiveTriggerRefs, type: oneOf('CustomScript'), scriptId: id }),
    HandledByScript: object({ ...inactiveTriggerRefs, type: oneOf('HandledByScript') })
});

const variable: Reader<VariableDefinition> = object({
    ...entity, ...asset, ...order, type: variableType, value, state: resourceState, scope
});
const event: Reader<EventDefinition> = object({ ...entity, ...asset, ...order, state: resourceState });
const script: Reader<ScriptDefinition> = object({
    ...entity, ...asset, ...order, category: oneOf('Performance', 'Lifecycle', 'Condition', 'Trigger'),
    lifecycleType: optional(oneOf('Stage', 'Node', 'State')), state: resourceState
});
const blackboard: Reader<BlackboardData> = object({ globalVariables: map(variable), events: map(event) });
const scripts: Reader<ScriptsManifest> = object({ version: defaulted(string, '1.0.0'), scripts: map(script) });
const lifecycle = { lifecycleScriptId: optional(id), eventListeners: list(listener) };

const stage: Reader<StageNode> = object({
    ...entity, ...asset, ...lifecycle, parentId: defaulted(nullable(id), null), childrenIds: list(id),
    localVariables: map(variable), isInitial: optional(boolean), isExpanded: optional(boolean),
    unlockTriggers: optional(array(trigger)), unlockCondition: optional(condition),
    onEnterPresentation: optional(binding), onExitPresentation: optional(binding)
});
const stageTree: Reader<StageTreeData> = object({ rootId: entityId, stages: dictionary(stage, true) });
const node: Reader<PuzzleNode> = object({
    ...entity, ...asset, ...order, ...lifecycle, stageId: id, stateMachineId: id, localVariables: map(variable)
});
const position: Reader<Vector2> = object({ x: number, y: number });

/** 运行时格式没有坐标；按原始 map 顺序排成网格，不移动已有坐标，不让节点叠在原点。 */
function withPosition<T>(read: Reader<T>): Reader<T> {
    return (input, path, context, index = 0) => {
        const fields = asObject(input, path);
        if (fields.position !== undefined) return read(fields, path, context);
        context.note(`${path}.position`, 'Restored missing canvas position using a grid layout.');
        return read({ ...fields, position: { x: 100 + (index % 4) * 240, y: 100 + Math.floor(index / 4) * 160 } }, path, context);
    };
}
const state: Reader<State> = withPosition(object({ ...entity, ...asset, ...lifecycle, position }));
const transition: Reader<Transition> = object({
    ...entity, fromStateId: id, toStateId: id, fromSide: optional(side), toSide: optional(side),
    priority: defaulted(number, 0), triggers: list(trigger), condition: optional(condition),
    presentation: optional(binding), invokeEventIds: optional(array(id)), parameterModifiers: list(modifier)
});
const fsm: Reader<StateMachine> = object({
    id: entityId, ...order, initialStateId: defaulted(nullable(id), null), states: map(state), transitions: map(transition)
});
const presentationBase = { ...entity, position, nextIds: list(id), condition: optional(condition) };
const presentationNode: Reader<PresentationNode> = withPosition(variants<PresentationNode>({
    PresentationNode: object({ ...presentationBase, type: oneOf('PresentationNode'), presentation: optional(binding) }),
    Wait: object({ ...presentationBase, type: oneOf('Wait'), duration: defaulted(number, 1) }),
    Branch: object({ ...presentationBase, type: oneOf('Branch') }),
    Parallel: object({ ...presentationBase, type: oneOf('Parallel') })
}));
const graph: Reader<PresentationGraph> = object({
    ...entity, ...order, startNodeId: defaulted(nullable(id), null), nodes: map(presentationNode),
    edgeProperties: optional(dictionary(object({ fromSide: optional(side), toSide: optional(side) })))
});

export const projectMeta: Reader<ProjectMeta> = (input, path, context) => {
    const now = new Date().toISOString();
    return object({
        ...entity, version: defaulted(string, '0.0.1'), createdAt: defaulted(string, now), updatedAt: defaulted(string, now),
        exportPath: optional(string), exportFileName: optional(string)
    })(input, path, context);
};

const projectFields = ['meta', 'blackboard', 'scripts', 'stageTree', 'nodes', 'stateMachines', 'presentationGraphs', 'triggers'];
export const projectData: Reader<ProjectData> = (input, path, context) => {
    const fields = knownFields(input, path, projectFields);
    checkLegacyTriggers(fields.triggers, `${path}.triggers`, context);
    indexLegacyBooleanVariables(fields, context);
    const { triggers: _legacyTriggers, ...current } = fields;
    const project = object({
        meta: projectMeta, blackboard: defaulted(blackboard, { globalVariables: {}, events: {} }),
        scripts: defaulted(scripts, { version: '1.0.0', scripts: {} }), stageTree,
        nodes: map(node), stateMachines: map(fsm), presentationGraphs: map(graph)
    })(current, path, context);
    checkStageTree(project.stageTree, `${path}.stageTree`);
    return project;
};

/** 根/层级环属于不能安全导航的结构错误；普通悬空业务引用留给业务校验，不擅自修补关系。 */
function checkStageTree(tree: StageTreeData, path: string): void {
    const root = tree.stages[tree.rootId];
    if (!root) fail(`${path}.rootId`, `Root stage ${JSON.stringify(tree.rootId)} does not exist.`);
    if (root.parentId !== null) fail(`${path}.stages[${JSON.stringify(root.id)}].parentId`, 'Root stage must not have a parent.');
    for (const relation of ['childrenIds', 'parentId'] as const) {
        const completed = new Map<string, number>();
        const active = new Set<string>();
        const visit = (stageId: string, depth: number): number => {
            const location = `${path}.stages[${JSON.stringify(stageId)}].${relation}`;
            if (active.has(stageId)) fail(location, 'Stage hierarchy contains a cycle.');
            // 缓存保留剩余链深度，避免从中间节点先遍历时把超长链误判为多段短链。
            const remainingDepth = completed.get(stageId);
            if (depth + (remainingDepth ?? 0) > 128) fail(location, 'Stage hierarchy exceeds the supported depth of 128.');
            if (remainingDepth !== undefined) return remainingDepth;
            if (!tree.stages[stageId]) return 0;
            active.add(stageId);
            const item = tree.stages[stageId];
            const neighbors = relation === 'childrenIds' ? item.childrenIds : item.parentId ? [item.parentId] : [];
            let height = 0;
            for (const neighbor of neighbors) height = Math.max(height, 1 + visit(neighbor, depth + 1));
            active.delete(stageId); completed.set(stageId, height);
            return height;
        };
        for (const stageId of Object.keys(tree.stages)) visit(stageId, 0);
    }
}

export function readRuntimeData(input: unknown, path: string, meta: ProjectMeta, context: ImportContext): ProjectData {
    const fields = knownFields(input, path, projectFields.filter(key => key !== 'meta'));
    return projectData({ ...fields, meta }, path, context);
}
