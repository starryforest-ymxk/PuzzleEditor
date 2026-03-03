/**
 * utils/exportNormalizer.ts
 * 导出数据规范化模块
 *
 * 在导出前对项目数据执行深拷贝 + 清洗，确保导出 JSON 中：
 * 1. 所有值类型正确（boolean/integer/float/string 与声明类型一致）
 * 2. UI 专用字段被剥离（isExpanded、position、fromSide/toSide 等）
 * 3. ParameterBinding 中前端辅助字段被移除（id、kind、description）
 * 4. ConditionExpression 递归规范化（Literal.value 确保为 boolean 等）
 * 5. 数值字段（priority、duration）确保为有效数字
 *
 * 不修改 Store 中的原始数据，仅操作深拷贝副本。
 */

import { ProjectData, ExportBundle } from '../types/project';
import { VariableDefinition } from '../types/blackboard';
import {
    VariableId,
    VariableType,
    ValueSource,
    ParameterModifier,
    ParameterBinding,
    PresentationBinding,
    EventListener
} from '../types/common';
import { ConditionExpression } from '../types/stateMachine';
import { normalizeValueByType } from './validation/variableValidation';

// ========== 变量查找索引类型 ==========
/** 变量 ID → 变量类型 的快速查找表 */
type VarTypeIndex = Record<VariableId, VariableType>;

// ========== 通用工具 ==========

/**
 * 从对象上删除指定的 UI 专用字段（就地修改）
 * @param obj 目标对象
 * @param fields 待删除的字段名列表
 */
function stripUIFields(obj: any, fields: string[]): void {
    for (const field of fields) {
        if (field in obj) {
            delete obj[field];
        }
    }
}

// ========== ValueSource 规范化 ==========

/**
 * 规范化 ValueSource 中的常量值
 * 若可推断目标类型，则按类型修正常量值；否则保持原值
 *
 * @param source 值来源
 * @param targetType 目标变量类型（可选，用于推断常量值类型）
 * @returns 规范化后的 ValueSource
 */
function normalizeValueSource(source: ValueSource, targetType?: VariableType): ValueSource {
    if (!source) return source;
    if (source.type === 'Constant' && targetType) {
        // 按目标类型修正常量值
        return { type: 'Constant', value: normalizeValueByType(targetType, source.value) };
    }
    return source;
}

// ========== ConditionExpression 递归规范化 ==========

/**
 * 递归规范化条件表达式
 * - Literal: 确保 value 为 boolean
 * - Comparison: 确保 operator 存在，left/right 规范化
 * - And/Or: 递归处理 children
 * - Not: 递归处理 operand
 * - ScriptRef: 不做特殊处理
 *
 * @param expr 条件表达式
 * @param varIndex 变量类型查找表
 * @returns 规范化后的条件表达式
 */
function normalizeConditionExpression(
    expr: ConditionExpression | undefined,
    varIndex: VarTypeIndex
): ConditionExpression | undefined {
    if (!expr) return expr;

    switch (expr.type) {
        case 'Literal': {
            // 确保 value 为 boolean，undefined/null/非布尔值 → false
            expr.value = expr.value === true;
            break;
        }
        case 'Comparison': {
            // 确保 operator 存在
            if (!expr.operator) {
                expr.operator = '==';
            }
            // 规范化左侧：若为 VariableRef，尝试推断类型用于规范化右侧
            let inferredType: VariableType | undefined;
            if (expr.left) {
                if (expr.left.type === 'VariableRef' && expr.left.variableId) {
                    inferredType = varIndex[expr.left.variableId];
                }
                expr.left = normalizeValueSource(expr.left, inferredType);
            }
            // 规范化右侧：若右侧为 VariableRef 也尝试推断（但主要依赖左侧类型）
            if (expr.right) {
                // 若左侧已推断出类型，用左侧类型规范化右侧常量
                // 若左侧是常量、右侧是 VariableRef，反向推断
                let rightType = inferredType;
                if (!rightType && expr.right.type === 'VariableRef' && expr.right.variableId) {
                    rightType = varIndex[expr.right.variableId];
                }
                expr.right = normalizeValueSource(expr.right, rightType);
            }
            break;
        }
        case 'And':
        case 'Or': {
            // 递归规范化子节点
            if (expr.children && Array.isArray(expr.children)) {
                expr.children = expr.children.map(child =>
                    normalizeConditionExpression(child, varIndex)!
                ).filter(Boolean);
            }
            break;
        }
        case 'Not': {
            // 递归规范化操作数
            if (expr.operand) {
                expr.operand = normalizeConditionExpression(expr.operand, varIndex);
            }
            break;
        }
        // ScriptRef: scriptId 保持原样，不做值规范化
    }

    return expr;
}

// ========== ParameterModifier 规范化 ==========

/**
 * 规范化参数修改器
 * 根据目标变量类型修正 source.value
 *
 * @param modifier 参数修改器
 * @param varIndex 变量类型查找表
 * @returns 规范化后的参数修改器
 */
function normalizeParameterModifier(
    modifier: ParameterModifier,
    varIndex: VarTypeIndex
): ParameterModifier {
    // 根据目标变量当前类型修正 source 值
    const targetType = modifier.targetVariableId
        ? varIndex[modifier.targetVariableId]
        : undefined;
    modifier.source = normalizeValueSource(modifier.source, targetType);
    return modifier;
}

// ========== ParameterBinding 规范化 ==========

/**
 * 规范化参数绑定
 * - 根据 tempVariable.type 推断目标类型修正 source.value
 * - 剥离前端辅助字段：id、kind、description
 *
 * @param binding 参数绑定
 * @returns 规范化后的参数绑定
 */
function normalizeParameterBinding(binding: ParameterBinding): ParameterBinding {
    // 推断目标类型：如果有 tempVariable，使用其 type
    const targetType = binding.tempVariable?.type;
    binding.source = normalizeValueSource(binding.source, targetType);

    // 剥离前端辅助字段
    stripUIFields(binding, ['id', 'kind']);

    return binding;
}

// ========== PresentationBinding 规范化 ==========

/**
 * 规范化演出绑定
 * 递归处理内部 parameters 数组
 *
 * @param binding 演出绑定
 * @returns 规范化后的演出绑定
 */
function normalizePresentationBinding(
    binding: PresentationBinding | undefined
): PresentationBinding | undefined {
    if (!binding) return binding;
    if (binding.type === 'Script' && binding.parameters) {
        binding.parameters = binding.parameters.map(p => normalizeParameterBinding(p));
    }
    return binding;
}

// ========== EventListener 规范化 ==========

/**
 * 规范化事件监听器
 * 若 action 为 ModifyParameter，递归规范化 modifiers
 *
 * @param listener 事件监听器
 * @param varIndex 变量类型查找表
 * @returns 规范化后的事件监听器
 */
function normalizeEventListener(
    listener: EventListener,
    varIndex: VarTypeIndex
): EventListener {
    if (listener.action.type === 'ModifyParameter' && listener.action.modifiers) {
        listener.action.modifiers = listener.action.modifiers.map(m =>
            normalizeParameterModifier(m, varIndex)
        );
    }
    return listener;
}

// ========== VariableDefinition 规范化 ==========

/**
 * 规范化变量定义的值
 *
 * @param variable 变量定义
 * @returns 规范化后的变量定义
 */
function normalizeVariable(variable: VariableDefinition): VariableDefinition {
    // 按声明类型修正值
    variable.value = normalizeValueByType(variable.type, variable.value);
    return variable;
}

// ========== 构建变量类型查找索引 ==========

/**
 * 从项目数据中构建变量 ID → 变量类型的快速查找表
 * 索引来源：全局变量 + 所有 Stage 局部变量 + 所有 Node 局部变量
 *
 * @param data 项目数据（深拷贝后的）
 * @returns 变量类型查找表
 */
function buildVarTypeIndex(data: ExportBundle['data']): VarTypeIndex {
    const index: VarTypeIndex = {};

    // 全局变量
    if (data.blackboard?.globalVariables) {
        for (const [id, v] of Object.entries(data.blackboard.globalVariables)) {
            index[id] = v.type;
        }
    }

    // Stage 局部变量
    if (data.stageTree?.stages) {
        for (const stage of Object.values(data.stageTree.stages)) {
            if (stage.localVariables) {
                for (const [id, v] of Object.entries(stage.localVariables)) {
                    index[id] = v.type;
                }
            }
        }
    }

    // Node 局部变量
    if (data.nodes) {
        for (const node of Object.values(data.nodes)) {
            if (node.localVariables) {
                for (const [id, v] of Object.entries(node.localVariables)) {
                    index[id] = v.type;
                }
            }
        }
    }

    return index;
}

// ========== 主入口 ==========

/**
 * 导出前数据规范化主入口
 * 对项目数据执行深拷贝后依次调用子规范化器，返回清洗后的导出数据
 *
 * 处理流程：
 * 1. 深拷贝项目数据
 * 2. 构建变量类型查找索引
 * 3. 规范化 blackboard（变量值）
 * 4. 规范化 scripts（保留原样）
 * 5. 规范化 stageTree（剥离 isExpanded、规范化条件/演出/监听器/局部变量）
 * 6. 规范化 nodes（规范化局部变量/监听器）
 * 7. 规范化 stateMachines（剥离 position/fromSide/toSide、规范化转移）
 * 8. 规范化 presentationGraphs（剥离 edgeProperties/position、规范化节点）
 *
 * @param project 原始项目数据（不会被修改）
 * @returns 清洗后的导出数据
 */
export function normalizeForExport(project: ProjectData): ExportBundle['data'] {
    // 深拷贝，避免修改 Store 中的原始数据
    const data: ExportBundle['data'] = JSON.parse(JSON.stringify({
        blackboard: project.blackboard,
        scripts: project.scripts,
        stageTree: project.stageTree,
        nodes: project.nodes,
        stateMachines: project.stateMachines,
        presentationGraphs: project.presentationGraphs
    }));

    // 构建变量类型查找索引（在规范化变量值之前，索引基于原始类型声明）
    const varIndex = buildVarTypeIndex(data);

    // ========== 1. 规范化 blackboard ==========
    if (data.blackboard?.globalVariables) {
        for (const id of Object.keys(data.blackboard.globalVariables)) {
            data.blackboard.globalVariables[id] = normalizeVariable(data.blackboard.globalVariables[id]);
        }
    }
    // ========== 2. 规范化 scripts ==========
    // scripts 无需值规范化，保留原样

    // ========== 3. 规范化 stageTree ==========
    if (data.stageTree?.stages) {
        for (const stage of Object.values(data.stageTree.stages)) {
            // 剥离 UI 字段
            stripUIFields(stage, ['isExpanded']);

            // 规范化局部变量
            if (stage.localVariables) {
                for (const id of Object.keys(stage.localVariables)) {
                    stage.localVariables[id] = normalizeVariable(stage.localVariables[id]);
                }
            }

            // 规范化解锁条件
            if (stage.unlockCondition) {
                stage.unlockCondition = normalizeConditionExpression(stage.unlockCondition, varIndex);
            }

            // 规范化演出绑定
            stage.onEnterPresentation = normalizePresentationBinding(stage.onEnterPresentation);
            stage.onExitPresentation = normalizePresentationBinding(stage.onExitPresentation);

            // 规范化事件监听器
            if (stage.eventListeners) {
                stage.eventListeners = stage.eventListeners.map(el =>
                    normalizeEventListener(el, varIndex)
                );
            }
        }
    }

    // ========== 4. 规范化 nodes ==========
    if (data.nodes) {
        for (const node of Object.values(data.nodes)) {
            // 规范化局部变量
            if (node.localVariables) {
                for (const id of Object.keys(node.localVariables)) {
                    node.localVariables[id] = normalizeVariable(node.localVariables[id]);
                }
            }

            // 规范化事件监听器
            if (node.eventListeners) {
                node.eventListeners = node.eventListeners.map(el =>
                    normalizeEventListener(el, varIndex)
                );
            }
        }
    }

    // ========== 5. 规范化 stateMachines ==========
    if (data.stateMachines) {
        for (const sm of Object.values(data.stateMachines)) {
            // 规范化状态节点
            if (sm.states) {
                for (const state of Object.values(sm.states)) {
                    // 剥离画布坐标
                    stripUIFields(state, ['position']);

                    // 规范化事件监听器
                    if (state.eventListeners) {
                        state.eventListeners = state.eventListeners.map(el =>
                            normalizeEventListener(el, varIndex)
                        );
                    }
                }
            }

            // 规范化转移
            if (sm.transitions) {
                for (const transition of Object.values(sm.transitions)) {
                    // 剥离连线端口方向（纯视觉属性）
                    stripUIFields(transition, ['fromSide', 'toSide']);

                    // 规范化 priority：确保为有效非负整数
                    const parsedPriority = parseInt(String(transition.priority), 10);
                    transition.priority = (!isNaN(parsedPriority) && parsedPriority >= 0)
                        ? parsedPriority
                        : 0;

                    // 规范化条件表达式
                    if (transition.condition) {
                        transition.condition = normalizeConditionExpression(
                            transition.condition, varIndex
                        );
                    }

                    // 规范化演出绑定
                    transition.presentation = normalizePresentationBinding(transition.presentation);

                    // 规范化参数修改器
                    if (transition.parameterModifiers) {
                        transition.parameterModifiers = transition.parameterModifiers.map(m =>
                            normalizeParameterModifier(m, varIndex)
                        );
                    }
                }
            }
        }
    }

    // ========== 6. 规范化 presentationGraphs ==========
    if (data.presentationGraphs) {
        for (const graph of Object.values(data.presentationGraphs)) {
            // 剥离 UI 字段
            stripUIFields(graph, ['edgeProperties']);

            // 规范化演出节点
            if (graph.nodes) {
                for (const pNode of Object.values(graph.nodes)) {
                    // 剥离画布坐标
                    stripUIFields(pNode, ['position']);

                    // 规范化演出绑定
                    pNode.presentation = normalizePresentationBinding(pNode.presentation);

                    // 规范化分支条件（Branch 类型）
                    if (pNode.condition) {
                        pNode.condition = normalizeConditionExpression(pNode.condition, varIndex);
                    }

                    // 规范化 Wait 类型的 duration
                    if (pNode.type === 'Wait') {
                        const parsedDuration = parseFloat(String(pNode.duration));
                        pNode.duration = (!isNaN(parsedDuration) && parsedDuration > 0)
                            ? parsedDuration
                            : 1;
                    }
                }
            }
        }
    }

    return data;
}
