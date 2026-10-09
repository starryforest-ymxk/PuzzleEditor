/**
 * utils/validation/rules/validateVariables.ts
 * 校验变量引用的完整性 (Global, StageLocal, NodeLocal)
 *
 * 检查以下位置的 VariableRef:
 * 1. Conditions
 * 2. Parameter Modifiers
 * 3. Parameter Bindings
 *
 * [Updated] Context-Aware Presentation Graph Validation
 * Presentation Graphs are validated based on their usage context (where they are bound).
 * - Global Variables: Always valid if they exist.
 * - Local Variables: Must be valid in ALL contexts where the graph is used.
 * - Unused Graphs: Usage of Local Variables is an ERROR (no context to resolve them).
 */

import type { CodedValidationResult as ValidationResult } from '../../../types/validation';
import { ProjectData } from '../../../types/project';
import { ConditionExpression } from '../../../types/stateMachine';
import {
  ParameterBinding,
  ValueSource,
  ParameterModifier,
  EventListener,
  PresentationBinding,
  VariableScope,
} from '../../../types/common';
import { StageNode } from '../../../types/stage';
import { PuzzleNode } from '../../../types/puzzleNode';
import { VariableDefinition } from '../../../types/blackboard';

import { ASSET_NAME_REGEX } from '../../assetNameValidation';
import { ownEntry } from '../../recordLookup';
import { buildPresentationUsage, resolveLocalVariableOwner } from '../../presentationUsage';
import {
  constantVariableType,
  modifierOperations,
  modifierSourceTypes,
} from '../../parameterCompatibility';

interface VariableContext {
  stage?: StageNode;
  node?: PuzzleNode;
}

/**
 * 校验变量 ID (Internal Helper)
 * @param strictMode If true, reports error even if variable is missing in one of valid contexts (for Intersection Check)
 */
function checkVariableId(
  variableId: string | undefined,
  scope: VariableScope | undefined,
  project: ProjectData,
  context: VariableContext,
): { valid: boolean; variable?: VariableDefinition; errorType?: 'missing' | 'markedForDelete' } {
  if (!variableId || !scope) return { valid: true };
  if (scope === 'Temporary') return { valid: true };

  let variable: VariableDefinition | undefined;

  if (scope === 'Global') {
    variable = ownEntry(project.blackboard.globalVariables, variableId);
  } else if (scope === 'StageLocal' || scope === 'NodeLocal') {
    const owner = resolveLocalVariableOwner(project, scope, variableId, {
      stageId: context.stage?.id,
      nodeId: context.node?.id,
    });
    variable =
      owner?.ownerType === 'stage'
        ? ownEntry(project.stageTree.stages[owner.ownerId]?.localVariables, variableId)
        : owner
          ? ownEntry(project.nodes[owner.ownerId]?.localVariables, variableId)
          : undefined;
  }

  if (!variable) return { valid: false, errorType: 'missing' };
  if (variable.state === 'MarkedForDelete')
    return { valid: false, variable, errorType: 'markedForDelete' };

  return { valid: true, variable };
}

/**
 * 通用变量校验入口
 */
function validateVariableId(
  results: ValidationResult[],
  variableId: string | undefined,
  scope: VariableScope | undefined,
  project: ProjectData,
  context: VariableContext,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
  contextDescription: string = 'Variable reference',
) {
  const check = checkVariableId(variableId, scope, project, context);
  if (!check.valid) {
    if (check.errorType === 'missing') {
      results.push({
        code: 'ERR_VAR_MISSING',
        id: `err-${locationContext.objectType.toLowerCase()}-var-missing-${locationContext.objectId}-${variableId}`,
        level: 'error',
        message: `${contextDescription} references missing ${scope} variable: ${variableId}`,
        ...locationContext,
      });
    } else if (check.errorType === 'markedForDelete') {
      results.push({
        code: 'ERR_VAR_DEL',
        id: `err-${locationContext.objectType.toLowerCase()}-var-del-${locationContext.objectId}-${variableId}`,
        level: 'error',
        message: `${contextDescription} uses ${scope} variable marked for delete: ${check.variable!.name}`,
        ...locationContext,
      });
    }
  }
}

function validateValueSource(
  results: ValidationResult[],
  source: ValueSource | undefined,
  project: ProjectData,
  context: VariableContext,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
  contextDescription: string,
) {
  if (source && source.type === 'VariableRef') {
    validateVariableId(
      results,
      source.variableId,
      source.scope,
      project,
      context,
      locationContext,
      contextDescription,
    );
  }
}

function validateParameterBindings(
  results: ValidationResult[],
  bindings: ParameterBinding[] | undefined,
  project: ProjectData,
  context: VariableContext,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
  contextDescription: string,
) {
  if (!bindings) return;
  const names = new Set<string>();
  bindings.forEach((binding, idx) => {
    if (names.has(binding.paramName))
      results.push({
        code: 'ERR_PARAM_DUPLICATE',
        id: `err-param-duplicate-${locationContext.objectId}-${idx}`,
        level: 'error',
        message: `${contextDescription} repeats parameter name "${binding.paramName}".`,
        ...locationContext,
      });
    names.add(binding.paramName);
    // Validate Param Name Format (Strict)
    if (!binding.paramName || !ASSET_NAME_REGEX.test(binding.paramName)) {
      results.push({
        code: 'ERR_PARAM_FMT',
        id: `err-${locationContext.objectType.toLowerCase()}-param-fmt-${locationContext.objectId}-${idx}`,
        level: 'error',
        message: `${contextDescription} has invalid parameter name "${binding.paramName}". Must match /^[a-zA-Z_][a-zA-Z0-9_]*$/.`,
        ...locationContext,
      });
    }

    validateValueSource(
      results,
      binding.source,
      project,
      context,
      locationContext,
      `${contextDescription} (Param: ${binding.paramName || 'Unnamed'})`,
    );
    // 与 Temporary 编辑器的 allowedTypes 一致：变量引用必须与临时声明类型相同。
    if (
      binding.kind === 'Temporary' &&
      binding.tempVariable &&
      binding.source?.type === 'VariableRef'
    ) {
      const source = checkVariableId(
        binding.source.variableId,
        binding.source.scope,
        project,
        context,
      );
      if (source.valid && source.variable && source.variable.type !== binding.tempVariable.type)
        results.push({
          code: 'ERR_TEMP_SOURCE_TYPE',
          id: `err-temp-source-type-${locationContext.objectId}-${idx}`,
          level: 'error',
          message: `Temporary parameter "${binding.paramName}" requires a ${binding.tempVariable.type} variable, received ${source.variable.type}.`,
          ...locationContext,
        });
    }
  });
}

function validateParameterModifiers(
  results: ValidationResult[],
  modifiers: ParameterModifier[] | undefined,
  project: ProjectData,
  context: VariableContext,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
  contextDescription: string,
) {
  if (!modifiers) return;
  modifiers.forEach((mod, idx) => {
    validateVariableId(
      results,
      mod.targetVariableId,
      mod.targetScope,
      project,
      context,
      locationContext,
      `${contextDescription} (Modifier #${idx + 1} Target)`,
    );
    // Toggle 不消费来源值，保存的占位来源不影响运行时或校验。
    if (mod.operation !== 'Toggle')
      validateValueSource(
        results,
        mod.source,
        project,
        context,
        locationContext,
        `${contextDescription} (Modifier #${idx + 1} Source)`,
      );
    const target = checkVariableId(mod.targetVariableId, mod.targetScope, project, context);
    if (!target.valid || !target.variable) return;
    if (!modifierOperations(target.variable.type).includes(mod.operation)) {
      results.push({
        code: 'ERR_MODIFIER_OPERATION',
        id: `err-modifier-operation-${locationContext.objectId}-${contextDescription}-${idx}`,
        level: 'error',
        message: `${contextDescription} (Modifier #${idx + 1}) cannot use ${mod.operation} with ${target.variable.type}.`,
        ...locationContext,
      });
    }
    if (mod.operation === 'Toggle' || !mod.source) return;
    const sourceType =
      mod.source.type === 'Constant'
        ? constantVariableType(mod.source.value)
        : checkVariableId(mod.source.variableId, mod.source.scope, project, context).variable?.type;
    // 缺失引用由上面的引用校验报告；常量类型不合法必须独立报告。
    if (
      (sourceType && !modifierSourceTypes(target.variable.type).includes(sourceType)) ||
      (!sourceType && mod.source.type === 'Constant')
    ) {
      results.push({
        code: 'ERR_MODIFIER_SOURCE_TYPE',
        id: `err-modifier-source-type-${locationContext.objectId}-${contextDescription}-${idx}`,
        level: 'error',
        message: `${contextDescription} (Modifier #${idx + 1}) has an incompatible source for ${target.variable.type}.`,
        ...locationContext,
      });
    }
  });
}

function validateCondition(
  results: ValidationResult[],
  condition: ConditionExpression | undefined,
  project: ProjectData,
  context: VariableContext,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
  contextDescription: string,
) {
  if (!condition) return;

  if (condition.type === 'Comparison') {
    validateValueSource(
      results,
      condition.left,
      project,
      context,
      locationContext,
      `${contextDescription} > Left`,
    );
    validateValueSource(
      results,
      condition.right,
      project,
      context,
      locationContext,
      `${contextDescription} > Right`,
    );
  }

  if (condition.children) {
    condition.children.forEach((child, idx) => {
      validateCondition(
        results,
        child,
        project,
        context,
        locationContext,
        `${contextDescription} > Sub #${idx + 1}`,
      );
    });
  }
  if (condition.operand) {
    validateCondition(
      results,
      condition.operand,
      project,
      context,
      locationContext,
      `${contextDescription} > NOT`,
    );
  }
}

function validateEventListeners(
  results: ValidationResult[],
  listeners: EventListener[] | undefined,
  project: ProjectData,
  context: VariableContext,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
) {
  if (!listeners) return;
  listeners.forEach((listener, idx) => {
    if (listener.action.type === 'ModifyParameter') {
      validateParameterModifiers(
        results,
        listener.action.modifiers,
        project,
        context,
        locationContext,
        `Listener #${idx + 1}`,
      );
    }
  });
}

/**
 * 校验 Presentation Binding (Collection Phase)
 * 如果绑定了 Graph，则将其上下文记录下来
 */
function validatePresentationBinding(
  results: ValidationResult[],
  binding: PresentationBinding | undefined,
  project: ProjectData,
  context: VariableContext,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
  contextDescription: string,
) {
  if (!binding) return;

  // Script Bindings use immediate context validation
  if (binding.type === 'Script') {
    validateParameterBindings(
      results,
      binding.parameters,
      project,
      context,
      locationContext,
      contextDescription,
    );
  }
}

export const validateVariables = (project: ProjectData): ValidationResult[] => {
  const results: ValidationResult[] = [];

  // --- 1. Stage Tree (Collection Phase) ---
  Object.values(project.stageTree.stages).forEach((stage) => {
    const stageContext = {
      objectType: 'STAGE' as const,
      objectId: stage.id,
      location: `Stage: ${stage.name}`,
    };
    const varContext: VariableContext = { stage };

    validateCondition(
      results,
      stage.unlockCondition,
      project,
      varContext,
      stageContext,
      'Unlock Condition',
    );
    validatePresentationBinding(
      results,
      stage.onEnterPresentation,
      project,
      varContext,
      stageContext,
      'OnEnter Presentation',
    );
    validatePresentationBinding(
      results,
      stage.onExitPresentation,
      project,
      varContext,
      stageContext,
      'OnExit Presentation',
    );
    validateEventListeners(results, stage.eventListeners, project, varContext, stageContext);
  });

  // --- 2. Nodes (Collection Phase) ---
  Object.values(project.nodes).forEach((node) => {
    const nodeContext = {
      objectType: 'NODE' as const,
      objectId: node.id,
      location: `Node: ${node.name}`,
    };
    const parentStage = node.stageId ? ownEntry(project.stageTree.stages, node.stageId) : undefined;
    const varContext: VariableContext = { node, stage: parentStage };

    validateEventListeners(results, node.eventListeners, project, varContext, nodeContext);

    const fsm = ownEntry(project.stateMachines, node.stateMachineId);
    if (fsm) {
      Object.values(fsm.states || {}).forEach((state) => {
        const stateContext = {
          objectType: 'STATE' as const,
          objectId: state.id,
          contextId: node.id,
          fsmId: fsm.id,
          location: `Node: ${node.name} > State: ${state.name}`,
        };

        validateEventListeners(results, state.eventListeners, project, varContext, stateContext);

        const outgoingTransitions = Object.values(fsm.transitions || {}).filter(
          (t) => t.fromStateId === state.id,
        );
        outgoingTransitions.forEach((trans, idx) => {
          const transContext = {
            objectType: 'TRANSITION' as const,
            objectId: trans.id,
            contextId: node.id,
            fsmId: fsm.id,
            location: `Node: ${node.name} > State: ${state.name} > Transition #${idx + 1}`,
          };

          validateCondition(
            results,
            trans.condition,
            project,
            varContext,
            transContext,
            'Condition',
          );
          validatePresentationBinding(
            results,
            trans.presentation,
            project,
            varContext,
            transContext,
            'Presentation',
          );
          validateParameterModifiers(
            results,
            trans.parameterModifiers,
            project,
            varContext,
            transContext,
            'Parameter Modifiers',
          );
        });
      });
    }
  });

  // 共享图的每个真实调用上下文分别校验；递归条件与参数复用普通绑定规则。
  const usage = buildPresentationUsage(project);
  for (const graphId of usage.recursiveGraphs)
    results.push({
      code: 'WARN_SUBGRAPH_RECURSION',
      id: `warn-subgraph-recursion-${graphId}`,
      level: 'warning',
      message: 'Recursive subgraph calls detected. Verify runtime termination explicitly.',
      objectType: 'PRESENTATION_GRAPH',
      objectId: graphId,
      location: `Graph: ${graphId}`,
    });
  for (const graph of Object.values(project.presentationGraphs)) {
    const contexts = usage.contexts.get(graph.id) ?? [];
    if (!contexts.length)
      results.push({
        code: 'WARN_GRAPH_UNUSED',
        id: 'warn-graph-unused-' + graph.id,
        level: 'warning',
        message: 'Presentation Graph "' + graph.name + '" is not used anywhere (Orphaned).',
        objectType: 'PRESENTATION_GRAPH',
        objectId: graph.id,
        location: 'Graph: ' + graph.name,
      });
    for (const pNode of Object.values(graph.nodes)) {
      const calls = contexts.length ? contexts : [undefined];
      for (const call of calls) {
        const context: VariableContext = {
          stage: call?.caller.stageId
            ? ownEntry(project.stageTree.stages, call.caller.stageId)
            : undefined,
          node: call?.caller.nodeId ? ownEntry(project.nodes, call.caller.nodeId) : undefined,
        };
        const location =
          'Graph: ' +
          graph.name +
          ' > Node: ' +
          pNode.name +
          (call ? ' > Caller: ' + call.caller.path : ' > No calling context');
        const locationContext = {
          objectType: 'PRESENTATION_NODE' as const,
          objectId: pNode.id,
          graphId: graph.id,
          contextId: graph.id,
          location,
        };
        const before = results.length;
        if (pNode.presentation?.type === 'Script')
          validateParameterBindings(
            results,
            pNode.presentation.parameters,
            project,
            context,
            locationContext,
            'Presentation',
          );
        validateCondition(results, pNode.condition, project, context, locationContext, 'Condition');
        // 错误基线须区分调用者，新增第二个无效调用不能被同 ID 的旧错误吞掉。
        for (const item of results.slice(before)) {
          item.id +=
            '-' +
            graph.id +
            '-' +
            (call?.caller.nodeId ?? call?.caller.stageId ?? 'orphan') +
            '-' +
            (call?.caller.path ?? '');
          item.message += call
            ? ' Usage context: ' + call.caller.path + '.'
            : ' Graph has no calling context.';
        }
      }
    }
  }

  return results;
};
