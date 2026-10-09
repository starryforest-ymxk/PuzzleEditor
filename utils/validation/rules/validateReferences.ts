/**
 * utils/validation/rules/validateReferences.ts
 * 校验资源引用的完整性（是否丢失、是否已删除、字段是否缺失）
 *
 * 对应后端校验规则：
 * #6-#7: 黑板/脚本定义校验
 * #33-#56: 引用完整性校验（生命周期、事件、变量、触发器、条件、参数修改器、演出配置）
 */

import type { CodedValidationResult as ValidationResult } from '../../../types/validation';
import { ProjectData } from '../../../types/project';
import { ownEntry } from '../../recordLookup';
import { ConditionExpression, TriggerConfig } from '../../../types/stateMachine';
import {
  EventListener,
  PresentationBinding,
  ParameterModifier,
  ValueSource,
  ScriptCategory,
  LifecycleScriptTarget,
} from '../../../types/common';

// =========================================================================
// Helper: 校验脚本 ID 引用 — 后端 #33-#35, #43, #46, #52
// =========================================================================

function validateScriptId(
  results: ValidationResult[],
  scriptId: string | undefined,
  project: ProjectData,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
  contextDescription: string = 'Script reference',
  expectedCategory?: ScriptCategory,
  expectedTarget?: LifecycleScriptTarget,
) {
  if (!scriptId) return;

  const script = ownEntry(project.scripts?.scripts, scriptId);
  if (!script) {
    results.push({
      code: 'ERR_SCRIPT_MISSING',
      id: `err-${locationContext.objectType.toLowerCase()}-script-missing-${locationContext.objectId}-${scriptId}`,
      level: 'error',
      message: `${contextDescription} references missing script: ${scriptId}`,
      ...locationContext,
    });
  } else if (script.state === 'MarkedForDelete') {
    results.push({
      code: 'ERR_SCRIPT_DEL',
      id: `err-${locationContext.objectType.toLowerCase()}-script-del-${locationContext.objectId}-${scriptId}`,
      level: 'error',
      message: `${contextDescription} uses script marked for delete: ${script.name}`,
      ...locationContext,
    });
  }
  // 共享校验必须覆盖选择器原本提供的类别/生命周期目标约束，CLI 不能绕过。
  if (script && expectedCategory && script.category !== expectedCategory) {
    results.push({
      code: 'ERR_SCRIPT_CATEGORY',
      id: `err-script-category-${locationContext.objectId}-${scriptId}-${expectedCategory}`,
      level: 'error',
      message: `${contextDescription} requires a ${expectedCategory} script; ${scriptId} is ${script.category}.`,
      ...locationContext,
    });
  } else if (script && expectedTarget && script.lifecycleType !== expectedTarget) {
    results.push({
      code: 'ERR_SCRIPT_TARGET',
      id: `err-script-target-${locationContext.objectId}-${scriptId}-${expectedTarget}`,
      level: 'error',
      message: `${contextDescription} requires a ${expectedTarget} lifecycle script; ${scriptId} targets ${script.lifecycleType ?? 'nothing'}.`,
      ...locationContext,
    });
  }
}

// =========================================================================
// Helper: 校验触发器列表引用 — 后端 #39-#43
// =========================================================================

function validateTriggers(
  results: ValidationResult[],
  triggers: TriggerConfig[],
  project: ProjectData,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
) {
  triggers.forEach((trigger, idx) => {
    // #39: Trigger type is empty
    if (!trigger.type) {
      results.push({
        code: 'ERR_TRIGGER_NO_TYPE',
        id: `err-${locationContext.objectType.toLowerCase()}-trigger-no-type-${locationContext.objectId}-${idx}`,
        level: 'error',
        message: `Trigger #${idx + 1} type is empty.`,
        ...locationContext,
      });
      return;
    }

    if (trigger.type === 'OnEvent') {
      // #40: OnEvent 缺少 eventId
      if (!trigger.eventId) {
        results.push({
          code: 'ERR_TRIGGER_NO_EVT',
          id: `err-${locationContext.objectType.toLowerCase()}-trigger-no-evt-${locationContext.objectId}-${idx}`,
          level: 'error',
          message: `Trigger #${idx + 1} (OnEvent) missing eventId.`,
          ...locationContext,
        });
      } else {
        // #41: 事件不存在
        const evt = ownEntry(project.blackboard.events, trigger.eventId);
        if (!evt) {
          results.push({
            code: 'ERR_TRIGGER_EVT',
            id: `err-${locationContext.objectType.toLowerCase()}-trigger-evt-${locationContext.objectId}-${idx}`,
            level: 'error',
            message: `Trigger #${idx + 1} references missing event: ${trigger.eventId}`,
            ...locationContext,
          });
        } else if (evt.state === 'MarkedForDelete') {
          results.push({
            code: 'ERR_TRIGGER_EVT_DEL',
            id: `err-${locationContext.objectType.toLowerCase()}-trigger-evt-del-${locationContext.objectId}-${idx}`,
            level: 'error',
            message: `Trigger #${idx + 1} uses event marked for delete: ${evt.name}`,
            ...locationContext,
          });
        }
      }
    } else if (trigger.type === 'CustomScript') {
      // #42: CustomScript 缺少 scriptId
      if (!trigger.scriptId) {
        results.push({
          code: 'ERR_TRIGGER_NO_SCRIPT',
          id: `err-${locationContext.objectType.toLowerCase()}-trigger-no-script-${locationContext.objectId}-${idx}`,
          level: 'error',
          message: `Trigger #${idx + 1} (CustomScript) missing scriptId.`,
          ...locationContext,
        });
      } else {
        // #43: 脚本不存在
        validateScriptId(
          results,
          trigger.scriptId,
          project,
          locationContext,
          `Trigger #${idx + 1}`,
          'Trigger',
        );
      }
    }
  });
}

// =========================================================================
// Helper: 校验条件表达式引用 — 后端 #44-#46
// =========================================================================

function validateCondition(
  results: ValidationResult[],
  condition: ConditionExpression | undefined,
  project: ProjectData,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
  contextDescription: string = 'Condition',
) {
  if (!condition) return;

  // #44: Condition type is empty
  if (!condition.type) {
    results.push({
      code: 'ERR_COND_NO_TYPE',
      id: `err-${locationContext.objectType.toLowerCase()}-cond-no-type-${locationContext.objectId}`,
      level: 'error',
      message: `${contextDescription} type is empty.`,
      ...locationContext,
    });
    return;
  }

  // #45-#46: ScriptRef 的脚本引用
  if (condition.type === 'ScriptRef') {
    if (!condition.scriptId) {
      // #45: SCRIPT_REF 缺少 scriptId
      results.push({
        code: 'ERR_COND_NO_SCRIPTID',
        id: `err-${locationContext.objectType.toLowerCase()}-cond-no-scriptid-${locationContext.objectId}`,
        level: 'error',
        message: `${contextDescription} (ScriptRef) missing scriptId.`,
        ...locationContext,
      });
    } else {
      // #46: 脚本不存在
      validateScriptId(
        results,
        condition.scriptId,
        project,
        locationContext,
        `${contextDescription} (Script)`,
        'Condition',
      );
    }
  }

  // Recurse children
  if (condition.children) {
    condition.children.forEach((child, idx) => {
      validateCondition(
        results,
        child,
        project,
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
      locationContext,
      `${contextDescription} > NOT`,
    );
  }
}

// =========================================================================
// Helper: 校验演出绑定引用 — 后端 #50-#54
// =========================================================================

function validatePresentationBinding(
  results: ValidationResult[],
  binding: PresentationBinding | undefined,
  project: ProjectData,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
  contextDescription: string,
) {
  if (!binding) return;

  // #50: PresentationConfig type 为空（Warning）
  if (!binding.type) {
    results.push({
      code: 'WARN_PRES_NO_TYPE',
      id: `warn-${locationContext.objectType.toLowerCase()}-pres-no-type-${locationContext.objectId}`,
      level: 'warning',
      message: `${contextDescription} type is empty.`,
      ...locationContext,
    });
    return;
  }

  if (binding.type === 'Script') {
    // #51: Script 型缺少 scriptId
    if (!binding.scriptId) {
      results.push({
        code: 'ERR_PRES_NO_SCRIPTID',
        id: `err-${locationContext.objectType.toLowerCase()}-pres-no-scriptid-${locationContext.objectId}`,
        level: 'error',
        message: `${contextDescription} (Script) missing scriptId.`,
        ...locationContext,
      });
    } else {
      // #52: 脚本不存在
      validateScriptId(
        results,
        binding.scriptId,
        project,
        locationContext,
        contextDescription,
        'Performance',
      );
    }
  }

  if (binding.type === 'Graph') {
    // #53: Graph 型缺少 graphId
    if (!binding.graphId) {
      results.push({
        code: 'ERR_PRES_NO_GRAPHID',
        id: `err-${locationContext.objectType.toLowerCase()}-pres-no-graphid-${locationContext.objectId}`,
        level: 'error',
        message: `${contextDescription} (Graph) missing graphId.`,
        ...locationContext,
      });
    } else {
      // #54: 演出图不存在
      const graph = ownEntry(project.presentationGraphs, binding.graphId);
      if (!graph) {
        results.push({
          code: 'ERR_PRES_GRAPH',
          id: `err-${locationContext.objectType.toLowerCase()}-pres-graph-${locationContext.objectId}`,
          level: 'error',
          message: `${contextDescription} references missing Presentation Graph: ${binding.graphId}`,
          ...locationContext,
        });
      }
    }
  }
}

// =========================================================================
// Helper: 校验事件监听器引用
// =========================================================================

function validateEventListeners(
  results: ValidationResult[],
  listeners: EventListener[],
  project: ProjectData,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
  hostLifecycleScriptId?: string,
) {
  listeners.forEach((listener, idx) => {
    // Check Event Ref
    if (listener.eventId) {
      const evt = ownEntry(project.blackboard.events, listener.eventId);
      if (!evt) {
        results.push({
          code: 'ERR_LISTENER',
          id: `err-${locationContext.objectType.toLowerCase()}-listener-${locationContext.objectId}-${idx}`,
          level: 'error',
          message: `Event Listener #${idx + 1} references missing event: ${listener.eventId}`,
          ...locationContext,
        });
      } else if (evt.state === 'MarkedForDelete') {
        results.push({
          code: 'ERR_LISTENER_DEL',
          id: `err-${locationContext.objectType.toLowerCase()}-listener-del-${locationContext.objectId}-${idx}`,
          level: 'error',
          message: `Event Listener #${idx + 1} uses event marked for delete: ${evt.name}`,
          ...locationContext,
        });
      }
    }

    // Check Action logic
    if (listener.action.type === 'InvokeScript') {
      if (!hostLifecycleScriptId) {
        results.push({
          code: 'ERR_LISTENER_INVOKE_FAIL',
          id: `err-${locationContext.objectType.toLowerCase()}-listener-invoke-fail-${locationContext.objectId}-${idx}`,
          level: 'error',
          message: `Event Listener #${idx + 1} tries to Invoke Script, but host object has no Lifecycle Script assigned.`,
          ...locationContext,
        });
      }
    }
  });
}

// =========================================================================
// Helper: 校验事件 ID 列表引用 — 后端 #36
// =========================================================================

function validateEventIds(
  results: ValidationResult[],
  eventIds: string[] | undefined,
  project: ProjectData,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
  contextDescription: string,
) {
  if (!eventIds) return;
  eventIds.forEach((evtId, idx) => {
    const evt = ownEntry(project.blackboard.events, evtId);
    if (!evt) {
      results.push({
        code: 'ERR_INVOKE',
        id: `err-${locationContext.objectType.toLowerCase()}-invoke-${locationContext.objectId}-${idx}`,
        level: 'error',
        message: `${contextDescription} references missing event: ${evtId}`,
        ...locationContext,
      });
    } else if (evt.state === 'MarkedForDelete') {
      results.push({
        code: 'ERR_INVOKE_DEL',
        id: `err-${locationContext.objectType.toLowerCase()}-invoke-del-${locationContext.objectId}-${idx}`,
        level: 'error',
        message: `${contextDescription} uses event marked for delete: ${evt.name}`,
        ...locationContext,
      });
    }
  });
}

// =========================================================================
// Helper: 校验参数修改器结构 — 后端 #47-#49
// =========================================================================

function validateParameterModifierStructure(
  results: ValidationResult[],
  modifiers: ParameterModifier[] | undefined,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
  contextDescription: string,
) {
  if (!modifiers) return;
  modifiers.forEach((mod, idx) => {
    // #47: 缺少 targetVariableId
    if (!mod.targetVariableId) {
      results.push({
        code: 'ERR_MOD_NO_TARGET',
        id: `err-${locationContext.objectType.toLowerCase()}-mod-no-target-${locationContext.objectId}-${idx}`,
        level: 'error',
        message: `${contextDescription} ParameterModifier #${idx + 1} missing targetVariableId.`,
        ...locationContext,
      });
    }

    // #48: 缺少 operation
    if (!mod.operation) {
      results.push({
        code: 'ERR_MOD_NO_OP',
        id: `err-${locationContext.objectType.toLowerCase()}-mod-no-op-${locationContext.objectId}-${idx}`,
        level: 'error',
        message: `${contextDescription} ParameterModifier #${idx + 1} missing operation.`,
        ...locationContext,
      });
    }

    // #49: ValueSource VariableRef 缺少 variableId
    if (mod.source && mod.source.type === 'VariableRef' && !mod.source.variableId) {
      results.push({
        code: 'ERR_MOD_SRC_NO_VARID',
        id: `err-${locationContext.objectType.toLowerCase()}-mod-src-no-varid-${locationContext.objectId}-${idx}`,
        level: 'error',
        message: `${contextDescription} ParameterModifier #${idx + 1} source (VariableRef) missing variableId.`,
        ...locationContext,
      });
    }
  });
}

// =========================================================================
// Helper: 校验 ValueSource 结构 — 后端 #55-#56 (结构部分)
// =========================================================================

function validateValueSourceStructure(
  results: ValidationResult[],
  source: ValueSource | undefined,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
  contextDescription: string,
) {
  if (!source) return;
  // #56: VariableRef 缺少 variableId
  if (source.type === 'VariableRef' && !source.variableId) {
    results.push({
      code: 'ERR_VS_NO_VARID',
      id: `err-${locationContext.objectType.toLowerCase()}-vs-no-varid-${locationContext.objectId}`,
      level: 'error',
      message: `${contextDescription} ValueSource (VariableRef) missing variableId.`,
      ...locationContext,
    });
  }
}

// =========================================================================
// Helper: 校验条件中 ValueSource 结构
// =========================================================================

function validateConditionValueSourceStructure(
  results: ValidationResult[],
  condition: ConditionExpression | undefined,
  locationContext: {
    objectType: ValidationResult['objectType'];
    objectId: string;
    location: string;
  },
  contextDescription: string,
) {
  if (!condition) return;

  if (condition.type === 'Comparison') {
    validateValueSourceStructure(
      results,
      condition.left,
      locationContext,
      `${contextDescription} > Left`,
    );
    validateValueSourceStructure(
      results,
      condition.right,
      locationContext,
      `${contextDescription} > Right`,
    );
  }

  if (condition.children) {
    condition.children.forEach((child, idx) => {
      validateConditionValueSourceStructure(
        results,
        child,
        locationContext,
        `${contextDescription} > Sub #${idx + 1}`,
      );
    });
  }
  if (condition.operand) {
    validateConditionValueSourceStructure(
      results,
      condition.operand,
      locationContext,
      `${contextDescription} > NOT`,
    );
  }
}

// =========================================================================
// MAIN: validateReferences
// =========================================================================

export const validateReferences = (project: ProjectData): ValidationResult[] => {
  const results: ValidationResult[] = [];

  // =========================================================================
  // 0. Blackboard & Script 定义校验 — 后端 #5-#7
  // =========================================================================

  // #6: Script category is empty (Warning)
  Object.values(project.scripts?.scripts || {}).forEach((script) => {
    if (!script.category || script.category.trim() === '') {
      results.push({
        code: 'WARN_SCRIPT_NO_CATEGORY',
        id: `warn-script-no-category-${script.id}`,
        level: 'warning',
        message: `Script "${script.name}" has empty category.`,
        objectType: 'SCRIPT',
        objectId: script.id,
        location: `Script: ${script.name}`,
      });
    }

    // #7: Lifecycle 脚本必须有 lifecycleType
    if (script.category === 'Lifecycle' && !script.lifecycleType) {
      results.push({
        code: 'ERR_SCRIPT_NO_LIFECYCLE_TYPE',
        id: `err-script-no-lifecycle-type-${script.id}`,
        level: 'error',
        message: `Lifecycle script "${script.name}" missing lifecycleType.`,
        objectType: 'SCRIPT',
        objectId: script.id,
        location: `Script: ${script.name}`,
      });
    }
  });

  // =========================================================================
  // 1. Stage Tree References — 后端 #33, 触发器/条件/演出
  // =========================================================================
  Object.values(project.stageTree.stages).forEach((stage) => {
    const stageContext = {
      objectType: 'STAGE' as const,
      objectId: stage.id,
      location: `Stage: ${stage.name}`,
    };

    // #33: Lifecycle Script
    validateScriptId(
      results,
      stage.lifecycleScriptId,
      project,
      stageContext,
      'Lifecycle Script',
      'Lifecycle',
      'Stage',
    );

    // Unlock Triggers
    if (stage.unlockTriggers) {
      validateTriggers(results, stage.unlockTriggers, project, stageContext);
    }

    // Unlock Condition
    validateCondition(results, stage.unlockCondition, project, stageContext, 'Unlock Condition');
    validateConditionValueSourceStructure(
      results,
      stage.unlockCondition,
      stageContext,
      'Unlock Condition',
    );

    // OnEnter/OnExit Presentation
    validatePresentationBinding(
      results,
      stage.onEnterPresentation,
      project,
      stageContext,
      'OnEnter Presentation',
    );
    validatePresentationBinding(
      results,
      stage.onExitPresentation,
      project,
      stageContext,
      'OnExit Presentation',
    );

    // Event Listeners
    if (stage.eventListeners) {
      validateEventListeners(
        results,
        stage.eventListeners,
        project,
        stageContext,
        stage.lifecycleScriptId,
      );
    }
  });

  // =========================================================================
  // 2. Puzzle Nodes & FSM State References — 后端 #34-#36, #39-#56
  // =========================================================================
  Object.values(project.nodes).forEach((node) => {
    const nodeContext = {
      objectType: 'NODE' as const,
      objectId: node.id,
      location: `Node: ${node.name}`,
    };

    // #34: Lifecycle Script
    validateScriptId(
      results,
      node.lifecycleScriptId,
      project,
      nodeContext,
      'Lifecycle Script',
      'Lifecycle',
      'Node',
    );

    // Node Listeners
    if (node.eventListeners) {
      validateEventListeners(
        results,
        node.eventListeners,
        project,
        nodeContext,
        node.lifecycleScriptId,
      );
    }

    const fsm = ownEntry(project.stateMachines, node.stateMachineId);
    if (!fsm) return;

    // States
    Object.values(fsm.states || {}).forEach((state) => {
      const stateContext = {
        objectType: 'STATE' as const,
        objectId: state.id,
        contextId: node.id,
        fsmId: fsm.id,
        location: `Node: ${node.name} > State: ${state.name}`,
      };

      // #35: Lifecycle Script
      validateScriptId(
        results,
        state.lifecycleScriptId,
        project,
        stateContext,
        'Lifecycle Script',
        'Lifecycle',
        'State',
      );

      // State Listeners
      if (state.eventListeners) {
        validateEventListeners(
          results,
          state.eventListeners,
          project,
          stateContext,
          state.lifecycleScriptId,
        );
      }

      // Transitions
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

        // Target State（#25 对应）
        if (trans.toStateId && !fsm.states[trans.toStateId]) {
          results.push({
            code: 'ERR_TRANS_TARGET',
            id: `err-trans-target-${state.id}-${trans.id}`,
            level: 'error',
            message: `Transition points to missing state: ${trans.toStateId}`,
            ...transContext,
          });
        }

        // Transition Triggers (#39-#43)
        if (trans.triggers) {
          validateTriggers(results, trans.triggers, project, transContext);
        }

        // Condition (#44-#46)
        validateCondition(results, trans.condition, project, transContext, 'Condition');
        // Condition ValueSource 结构 (#55-#56)
        validateConditionValueSourceStructure(results, trans.condition, transContext, 'Condition');

        // Presentation (#50-#54)
        validatePresentationBinding(
          results,
          trans.presentation,
          project,
          transContext,
          'Presentation',
        );

        // Invoke Events (#36)
        if (trans.invokeEventIds) {
          validateEventIds(
            results,
            trans.invokeEventIds,
            project,
            transContext,
            'Transition Invoke',
          );
        }

        // Parameter Modifier 结构 (#47-#49)
        validateParameterModifierStructure(
          results,
          trans.parameterModifiers,
          transContext,
          'Transition',
        );
      });
    });
  });

  // =========================================================================
  // 3. Presentation Graphs (Script References) — 后端 #44-#46, #50-#54
  // =========================================================================
  if (project.presentationGraphs) {
    Object.values(project.presentationGraphs).forEach((graph) => {
      const graphContext = {
        objectType: 'PRESENTATION_GRAPH' as const,
        objectId: graph.id,
        location: `Presentation Graph: ${graph.name || graph.id}`,
      };

      Object.values(graph.nodes || {}).forEach((pNode) => {
        const nodeContext = {
          ...graphContext,
          objectType: 'PRESENTATION_NODE' as const,
          objectId: pNode.id,
          graphId: graph.id,
          contextId: graph.id,
          location: `${graphContext.location} > Node: ${pNode.name || pNode.id}`,
        };

        // Presentation Binding (#50-#54)
        validatePresentationBinding(
          results,
          pNode.presentation,
          project,
          nodeContext,
          'Presentation',
        );

        // Branch Condition (#44-#46)
        validateCondition(results, pNode.condition, project, nodeContext, 'Condition');
        validateConditionValueSourceStructure(results, pNode.condition, nodeContext, 'Condition');
      });
    });
  }

  return results;
};
