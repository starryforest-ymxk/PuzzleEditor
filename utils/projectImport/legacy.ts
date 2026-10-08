import { asObject, fail, knownFields, type ImportContext } from './readers';

/** 仅迁移仓库 88477b7 样例及同期类型明确描述的条件；不推测有损的表达式求值。 */
export function migrateLegacyCondition(value: unknown, path: string, context: ImportContext): unknown {
    const input = asObject(value, path);
    // 旧样例 TRANS_11 与当前样例对照：独立布尔变量条件等价于该变量 == true。
    if (input.type === 'VARIABLE_REF') {
        if (!context.legacyBooleanVariables.has(`${input.variableScope}:${input.variableId}`)) {
            fail(path, 'A standalone legacy variable condition can only be migrated when its variable is known to be boolean.');
        }
        context.note(path, 'Migrated standalone legacy boolean condition to a comparison with true.', true);
        return { type: 'Comparison', operator: '==', left: migrateLegacyOperand(input, path, context), right: { type: 'Constant', value: true } };
    }
    const names: Record<string, string> = { AND: 'And', OR: 'Or', NOT: 'Not', COMPARISON: 'Comparison', LITERAL: 'Literal', SCRIPT_REF: 'ScriptRef' };
    if (typeof input.type !== 'string' || !Object.hasOwn(names, input.type)) return value;
    context.note(path, `Migrated legacy condition ${input.type} to ${names[input.type]}.`, true);
    return { ...input, type: names[input.type] };
}

/** 只为旧布尔条件建立保守索引；所有源容器稍后仍须通过完整领域 Reader。 */
export function indexLegacyBooleanVariables(project: Record<string, unknown>, context: ImportContext): void {
    const plain = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const types = new Map<string, Set<unknown>>();
    const collect = (variables: unknown, scope: string) => {
        for (const variable of Object.values(plain(variables))) {
            const data = plain(variable);
            const key = `${scope}:${data.id}`;
            const seen = types.get(key) ?? new Set();
            seen.add(data.type); types.set(key, seen);
        }
    };
    collect(plain(project.blackboard).globalVariables, 'Global');
    for (const stage of Object.values(plain(plain(project.stageTree).stages))) collect(plain(stage).localVariables, 'StageLocal');
    for (const node of Object.values(plain(project.nodes))) collect(plain(node).localVariables, 'NodeLocal');
    context.legacyBooleanVariables = new Set([...types].filter(([, values]) => values.size === 1 && values.has('boolean')).map(([key]) => key));
}

export function migrateLegacyOperand(value: unknown, path: string, context: ImportContext): unknown {
    const input = asObject(value, path);
    if (input.type === 'VARIABLE_REF') {
        knownFields(input, path, ['type', 'variableId', 'variableScope']);
        context.note(path, 'Migrated legacy variable operand, retaining its identifier and scope.', true);
        return { type: 'VariableRef', variableId: input.variableId, scope: input.variableScope };
    }
    if (input.type === 'LITERAL') {
        knownFields(input, path, ['type', 'value']);
        context.note(path, 'Migrated legacy literal operand without changing its value.', true);
        return { type: 'Constant', value: input.value };
    }
    return value;
}

export function checkLegacyTriggers(value: unknown, path: string, context: ImportContext): void {
    if (value === undefined) return;
    const wrapper = knownFields(value, path, ['triggers']);
    if (Object.keys(asObject(wrapper.triggers, `${path}.triggers`)).length) {
        fail(`${path}.triggers`, 'Non-empty legacy trigger manifests cannot be converted safely. Migrate them to Trigger scripts first.');
    }
    context.note(path, 'Removed an empty legacy trigger manifest.', true);
}
