/** 可供子进程测试和浏览器回归复用的完整 FSM：正常、失败、重试与三种变量作用域。 */
import type { Plan } from '../../contracts/automation/planSchemas';
import { creationPlan } from './c2Fixtures';

export function fsmCreationPlan(): Plan {
  const base = creationPlan();
  const puzzle = base.commands.find((op) => op.op === 'puzzle.create' && op.alias === 'door');
  if (puzzle?.op === 'puzzle.create') puzzle.initialState.alias = 'locked';
  const fsm = { puzzle: { alias: 'door' } };
  return {
    ...base,
    commands: [
      // 连线在端点、FSM 及脚本之前声明，验收 alias 的完整前向解析。
      {
        op: 'transition.create',
        alias: 'unlock',
        fsm,
        from: { alias: 'locked' },
        to: { alias: 'unlocked' },
        data: {
          name: 'Unlock',
          description: 'Success path',
          priority: 10,
          fromSide: 'right',
          toSide: 'left',
          triggers: [
            { type: 'OnEvent', eventId: { alias: 'open' } },
            { type: 'CustomScript', scriptId: { alias: 'trigger' } },
            { type: 'HandledByScript' },
            { type: 'Always' },
          ],
          condition: {
            type: 'And',
            children: [
              {
                type: 'Comparison',
                operator: '==',
                left: { type: 'VariableRef', variableId: { alias: 'flag' }, scope: 'Global' },
                right: { type: 'Constant', value: false },
              },
              {
                type: 'Or',
                children: [
                  { type: 'ScriptRef', scriptId: { alias: 'condition' } },
                  { type: 'Not', operand: { type: 'Literal', value: false } },
                ],
              },
              {
                type: 'Comparison',
                operator: '>=',
                left: { type: 'VariableRef', variableId: { alias: 'key' }, scope: 'StageLocal' },
                right: { type: 'Constant', value: 0 },
              },
              {
                type: 'Comparison',
                operator: '==',
                left: { type: 'VariableRef', variableId: { alias: 'found' }, scope: 'NodeLocal' },
                right: { type: 'Constant', value: true },
              },
            ],
          },
          presentation: {
            type: 'Script',
            scriptId: { alias: 'effect' },
            parameters: [
              {
                paramName: 'KeyCount',
                source: { type: 'VariableRef', variableId: { alias: 'key' }, scope: 'StageLocal' },
              },
              {
                paramName: 'Duration',
                kind: 'Temporary',
                tempVariable: { name: 'Duration', type: 'float' },
                source: { type: 'Constant', value: 0 },
              },
              {
                paramName: 'Enabled',
                kind: 'Temporary',
                tempVariable: { name: 'Enabled', type: 'boolean' },
                source: { type: 'Constant', value: false },
              },
              {
                paramName: 'HasKey',
                kind: 'Temporary',
                tempVariable: { name: 'Has Key', type: 'boolean' },
                source: { type: 'VariableRef', variableId: { alias: 'found' }, scope: 'NodeLocal' },
              },
            ],
          },
          invokeEventIds: [{ alias: 'open' }],
          parameterModifiers: [
            {
              targetVariableId: { alias: 'found' },
              targetScope: 'NodeLocal',
              operation: 'Set',
              source: { type: 'Constant', value: false },
            },
            {
              targetVariableId: { alias: 'key' },
              targetScope: 'StageLocal',
              operation: 'Multiply',
              source: { type: 'Constant', value: 2 },
            },
            {
              targetVariableId: { alias: 'flag' },
              targetScope: 'Global',
              operation: 'Toggle',
              source: { type: 'Constant', value: 0 },
            },
          ],
        },
      },
      {
        op: 'state.create',
        alias: 'unlocked',
        fsm,
        data: {
          name: 'Unlocked',
          assetName: 'Unlocked',
          position: { x: 620, y: 100 },
          lifecycleScriptId: { alias: 'stateLife' },
          eventListeners: [{ eventId: { alias: 'open' }, action: { type: 'InvokeScript' } }],
        },
      },
      {
        op: 'state.create',
        alias: 'failed',
        fsm,
        data: { name: 'Failed', assetName: 'Failed', position: { x: 620, y: 440 } },
      },
      {
        op: 'transition.create',
        alias: 'failure',
        fsm,
        from: { alias: 'locked' },
        to: { alias: 'failed' },
        data: {
          name: 'Failure',
          priority: 0,
          triggers: [{ type: 'Always' }],
          condition: {
            type: 'Not',
            operand: { type: 'ScriptRef', scriptId: { alias: 'condition' } },
          },
        },
      },
      {
        op: 'transition.create',
        alias: 'retry',
        fsm,
        from: { alias: 'failed' },
        to: { alias: 'locked' },
        data: {
          name: 'Retry',
          priority: 2,
          triggers: [{ type: 'HandledByScript' }],
          parameterModifiers: [
            {
              targetVariableId: { alias: 'key' },
              targetScope: 'StageLocal',
              operation: 'Add',
              source: { type: 'Constant', value: 1 },
            },
          ],
        },
      },
      ...base.commands,
      {
        op: 'script.create',
        alias: 'stateLife',
        data: {
          name: 'State lifecycle',
          assetName: 'StateLifecycle',
          category: 'Lifecycle',
          lifecycleType: 'State',
        },
      },
      {
        op: 'state.update',
        fsm,
        target: { alias: 'locked' },
        changes: {
          position: { x: 160, y: 180 },
          eventListeners: [
            {
              eventId: { alias: 'open' },
              action: {
                type: 'ModifyParameter',
                modifiers: [
                  {
                    targetVariableId: { alias: 'found' },
                    targetScope: 'NodeLocal',
                    operation: 'Set',
                    source: { type: 'Constant', value: true },
                  },
                ],
              },
            },
          ],
        },
      },
      { op: 'fsm.setInitial', fsm, state: { alias: 'locked' } },
      { op: 'fsm.update', fsm, changes: { displayOrder: 2 } },
    ],
  };
}
