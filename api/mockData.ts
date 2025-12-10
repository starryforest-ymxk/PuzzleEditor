/**
 * api/mockData.ts
 * 模拟数据 - 用于开发和测试
 */

import { StageTreeData } from '../types/stage';
import { ScriptDefinition, TriggerDefinition, ScriptsManifest, TriggersManifest } from '../types/manifest';
import { PuzzleNode } from '../types/puzzleNode';
import { StateMachine } from '../types/stateMachine';
import { PresentationGraph } from '../types/presentation';
import { BlackboardData } from '../types/blackboard';

// ========== Stage tree mock data ==========
export const MOCK_STAGES: StageTreeData = {
  rootId: 'stage-root',
  stages: {
    'stage-root': {
      id: 'stage-root',
      name: 'Root',
      parentId: null,
      childrenIds: ['stage-01', 'stage-02'],
      localVariables: {},
      eventListeners: [],
      isExpanded: true
    },
    'stage-01': {
      id: 'stage-01',
      name: 'Chapter 1: The Awakening',
      parentId: 'stage-root',
      childrenIds: [],
      description: 'Player wakes up in the lab.',
      localVariables: {},
      eventListeners: [],
      isInitial: true,
      isExpanded: false
    },
    'stage-02': {
      id: 'stage-02',
      name: 'Chapter 2: Escape',
      parentId: 'stage-root',
      childrenIds: [],
      description: 'Finding the way out.',
      localVariables: {},
      eventListeners: []
    }
  }
};

// ========== 解谜节点模拟数据 ==========
export const MOCK_NODES: Record<string, PuzzleNode> = {
  'node-01': {
    id: 'node-01',
    name: 'Generator Puzzle',
    description: 'Fix the power generator to open the door.',
    stageId: 'stage-01',
    stateMachineId: 'fsm-01',
    localVariables: {
      'power_level': {
        id: 'power_level',
        key: 'power_level',
        name: 'Current Power',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'max_voltage': {
        id: 'max_voltage',
        key: 'max_voltage',
        name: 'Target Voltage',
        type: 'float',
        defaultValue: 220.5,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'has_fuse': {
        id: 'has_fuse',
        key: 'has_fuse',
        name: 'Fuse Inserted',
        type: 'boolean',
        defaultValue: false,
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-02': {
    id: 'node-02',
    name: 'Keypad Lock',
    description: 'Enter code 0451.',
    stageId: 'stage-01',
    stateMachineId: 'fsm-02',
    localVariables: {
      'passcode': {
        id: 'passcode',
        key: 'passcode',
        name: 'Secret Code',
        type: 'string',
        defaultValue: '0451',
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'attempts': {
        id: 'attempts',
        key: 'attempts',
        name: 'Failed Attempts',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-03': {
    id: 'node-03',
    name: 'Guard Patrol',
    description: 'Avoid the guard.',
    stageId: 'stage-02',
    stateMachineId: 'fsm-03',
    localVariables: {
      'alert_level': {
        id: 'alert_level',
        key: 'alert_level',
        name: 'Alert Level',
        type: 'string',
        defaultValue: 'NORMAL',
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  }
};

// ========== 状态机模拟数据 ==========
export const MOCK_STATE_MACHINES: Record<string, StateMachine> = {
  'fsm-01': {
    id: 'fsm-01',
    initialStateId: 'state-idle',
    states: {
      'state-idle': {
        id: 'state-idle',
        name: 'Idle',
        description: 'Waiting for player interaction',
        position: { x: 100, y: 150 },
        eventListeners: []
      },
      'state-active': {
        id: 'state-active',
        name: 'Active',
        description: 'Generator is running',
        position: { x: 400, y: 150 },
        onEnterScriptId: 'script-play-anim',
        eventListeners: []
      },
      'state-broken': {
        id: 'state-broken',
        name: 'Broken',
        description: 'Failed attempt',
        position: { x: 250, y: 300 },
        eventListeners: []
      }
    },
    transitions: {
      'trans-01': {
        id: 'trans-01',
        name: 'Switch On',
        fromStateId: 'state-idle',
        toStateId: 'state-active',
        priority: 1,
        triggers: [{ type: 'Always' }],
        parameterModifiers: [],
        // 复杂条件示例: (power_level >= 80) AND has_fuse
        condition: {
          type: 'AND',
          children: [
            {
              type: 'COMPARISON',
              operator: '>=',
              left: { type: 'VARIABLE_REF', variableId: 'power_level', variableScope: 'NodeLocal' },
              right: { type: 'LITERAL', value: 80 }
            },
            {
              type: 'VARIABLE_REF',
              variableId: 'has_fuse',
              variableScope: 'NodeLocal'
            }
          ]
        }
      },
      'trans-02': {
        id: 'trans-02',
        name: 'Overheat',
        fromStateId: 'state-active',
        toStateId: 'state-broken',
        priority: 1,
        triggers: [{ type: 'Always' }],
        parameterModifiers: [],
        condition: {
          type: 'COMPARISON',
          operator: '>',
          left: { type: 'VARIABLE_REF', variableId: 'temperature', variableScope: 'NodeLocal' },
          right: { type: 'LITERAL', value: 100 }
        }
      },
      'trans-03': {
        id: 'trans-03',
        name: 'Repair',
        fromStateId: 'state-broken',
        toStateId: 'state-idle',
        priority: 1,
        triggers: [{ type: 'Always' }],
        parameterModifiers: [],
        condition: { type: 'LITERAL', value: true }
      }
    }
  },
  'fsm-02': {
    id: 'fsm-02',
    initialStateId: 'state-locked',
    states: {
      'state-locked': {
        id: 'state-locked',
        name: 'Locked',
        position: { x: 200, y: 200 },
        eventListeners: []
      }
    },
    transitions: {}
  },
  'fsm-03': {
    id: 'fsm-03',
    initialStateId: 'state-patrol',
    states: {
      'state-patrol': {
        id: 'state-patrol',
        name: 'Patrol',
        position: { x: 200, y: 200 },
        eventListeners: []
      }
    },
    transitions: {}
  }
};

// ========== 演出子图模拟数据 ==========
export const MOCK_PRESENTATION_GRAPHS: Record<string, PresentationGraph> = {
  'pres-01': {
    id: 'pres-01',
    name: 'Activation Cutscene',
    description: 'Plays when generator starts',
    startNodeId: 'pnode-01',
    nodes: {
      'pnode-01': {
        id: 'pnode-01',
        name: 'Log Start',
        type: 'ScriptCall',
        position: { x: 100, y: 100 },
        scriptId: 'script-log',
        parameters: [
          { paramName: 'message', source: { type: 'Constant', value: 'Starting sequence...' } }
        ],
        nextIds: ['pnode-02']
      },
      'pnode-02': {
        id: 'pnode-02',
        name: 'Wait 2s',
        type: 'Wait',
        position: { x: 300, y: 100 },
        duration: 2.0,
        nextIds: ['pnode-03']
      },
      'pnode-03': {
        id: 'pnode-03',
        name: 'Sparks Effect',
        type: 'ScriptCall',
        position: { x: 500, y: 100 },
        scriptId: 'script-play-anim',
        parameters: [
          { paramName: 'target', source: { type: 'Constant', value: 'VFX_Sparks' } },
          { paramName: 'animName', source: { type: 'Constant', value: 'Play' } }
        ],
        nextIds: []
      }
    }
  }
};

// ========== 脚本定义模拟数据 ==========
export const MOCK_SCRIPTS: ScriptDefinition[] = [
  {
    id: 'script-log',
    key: 'script-log',
    name: 'Debug Log',
    category: 'Performance',
    description: 'Print a message to the console',
    state: 'Implemented'
  },
  {
    id: 'script-play-anim',
    key: 'script-play-anim',
    name: 'Play Animation',
    category: 'Performance',
    description: 'Play an animation on a target object',
    state: 'Implemented'
  },
  {
    id: 'script-dialogue',
    key: 'script-dialogue',
    name: 'Show Dialogue',
    category: 'Performance',
    description: 'Display a dialogue message',
    state: 'Implemented'
  },
  {
    id: 'script-lifecycle-node',
    key: 'script-lifecycle-node',
    name: 'Node Lifecycle',
    category: 'Lifecycle',
    description: 'Handles node enter/exit lifecycle events',
    state: 'Implemented'
  },
  {
    id: 'script-lifecycle-state',
    key: 'script-lifecycle-state',
    name: 'State Lifecycle',
    category: 'Lifecycle',
    description: 'Handles state enter/exit lifecycle events',
    state: 'Implemented'
  },
  {
    id: 'script-condition-check',
    key: 'script-condition-check',
    name: 'Custom Condition',
    category: 'Condition',
    description: 'Custom condition check script',
    state: 'Draft'
  },
  {
    id: 'script-trigger-custom',
    key: 'script-trigger-custom',
    name: 'Custom Trigger',
    category: 'Trigger',
    description: 'Custom trigger script for transitions',
    state: 'Draft'
  }
];

// ========== Trigger definitions (mock) ==========
export const MOCK_TRIGGERS: TriggerDefinition[] = [
  {
    id: 'ON_INTERACT',
    key: 'ON_INTERACT',
    name: 'On Interact',
    description: 'Player interacts with the object',
    state: 'Implemented',
    parameters: []
  },
  {
    id: 'ON_ENTER_REGION',
    key: 'ON_ENTER_REGION',
    name: 'On Enter Region',
    description: 'Player enters the trigger volume',
    state: 'Implemented',
    parameters: [
      { name: 'tag', type: 'string', required: false, defaultValue: 'Player' }
    ]
  },
  {
    id: 'ON_VARIABLE_CHANGE',
    key: 'ON_VARIABLE_CHANGE',
    name: 'On Variable Change',
    description: 'A specific blackboard variable changed',
    state: 'Implemented',
    parameters: [
      { name: 'variableName', type: 'string', required: true }
    ]
  }
];

// ========== 黑板全局资源模拟数据 ==========
export const MOCK_BLACKBOARD: BlackboardData = {
  globalVariables: {
    'var-game-difficulty': {
      id: 'var-game-difficulty',
      key: 'var-game-difficulty',
      name: 'Game Difficulty',
      type: 'string',
      defaultValue: 'Normal',
      state: 'Implemented',
      scope: 'Global'
    },
    'var-player-health': {
      id: 'var-player-health',
      key: 'var-player-health',
      name: 'Player Health',
      type: 'integer',
      defaultValue: 100,
      state: 'Draft',
      scope: 'Global'
    }
  },
  events: {
    'event-alarm-triggered': {
      id: 'event-alarm-triggered',
      key: 'EVENT_ALARM_TRIGGERED',
      name: 'Alarm Triggered',
      description: 'Guard alarm raised',
      state: 'Implemented'
    },
    'event-power-restored': {
      id: 'event-power-restored',
      key: 'EVENT_POWER_RESTORED',
      name: 'Power Restored',
      description: 'Generator back online',
      state: 'Draft'
    }
  }
};

// ======= Manifest wrapping for ScriptsManifest/TriggersManifest =======
export const MOCK_SCRIPTS_MANIFEST: ScriptsManifest = {
  version: '1.0.0',
  scripts: Object.fromEntries(MOCK_SCRIPTS.map((s) => [s.id, s]))
};

export const MOCK_TRIGGERS_MANIFEST: TriggersManifest = {
  triggers: Object.fromEntries(MOCK_TRIGGERS.map((t) => [t.id, t]))
};
