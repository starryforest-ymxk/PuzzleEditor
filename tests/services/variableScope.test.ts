import { describe, expect, it } from 'vitest';
import { collectVisibleVariables } from '../../utils/variableScope';
import { normalizeValueByType } from '../../utils/validation/variableValidation';
import { createProjectFixture } from '../fixtures/editor';
import type { VariableDefinition } from '../../types/blackboard';
import type { VariableType } from '../../types/common';
import type { VariableValue } from '../../types/json';

function variable(id: string, scope: VariableDefinition['scope']): VariableDefinition {
  return { id, scope, name: id, type: 'integer', value: 0, state: 'Draft' };
}

describe('纯项目变量边界', () => {
  it('由节点推断阶段，按全局、祖先阶段、当前阶段、节点顺序收集，不依赖伪造 Store', () => {
    const project = createProjectFixture();
    const root = project.stageTree.stages[project.stageTree.rootId];
    root.localVariables.parent = variable('parent', 'StageLocal');
    root.childrenIds = ['child'];
    project.stageTree.stages.child = {
      ...root,
      id: 'child',
      parentId: root.id,
      childrenIds: [],
      localVariables: { child: variable('child', 'StageLocal') },
    };
    project.blackboard.globalVariables.global = variable('global', 'Global');
    project.nodes.node = {
      id: 'node',
      name: 'Node',
      stageId: 'child',
      stateMachineId: 'fsm',
      localVariables: { local: variable('local', 'NodeLocal') },
      eventListeners: [],
    };
    const visible = collectVisibleVariables(project, undefined, 'node');
    expect(visible.all.map((item) => item.id)).toEqual(['global', 'parent', 'child', 'local']);
    expect(visible.temporary).toEqual([]);
    expect(
      collectVisibleVariables(project, 'missing', 'missing').all.map((item) => item.id),
    ).toEqual(['global']);
  });

  it.each<[VariableType, unknown, VariableValue]>([
    ['boolean', false, false],
    ['boolean', 'false', false],
    ['boolean', 'true', true],
    ['integer', '0', 0],
    ['integer', '-3', -3],
    ['float', '1.25', 1.25],
    ['string', '', ''],
  ])('显式编辑时将 %s 输入 %j 归一化为有效标量', (type, input, expected) => {
    expect(normalizeValueByType(type, input)).toBe(expected);
  });
});
