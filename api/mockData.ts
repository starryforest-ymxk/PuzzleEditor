
import { StageTreeData } from '../types/stage';
import { ScriptDefinition, TriggerDefinition } from '../types/manifest';
import { PuzzleNode } from '../types/puzzleNode';
import { StateMachine } from '../types/stateMachine';
import { PresentationGraph } from '../types/presentation';

export const MOCK_STAGES: StageTreeData = {
  'stage-root': {
    id: 'stage-root',
    name: 'Root',
    parentId: null,
    childrenIds: ['stage-01', 'stage-02'],
    entryScriptIds: [],
    exitScriptIds: [],
    isExpanded: true
  },
  'stage-01': {
    id: 'stage-01',
    name: 'Chapter 1: The Awakening',
    parentId: 'stage-root',
    childrenIds: [],
    entryScriptIds: [],
    exitScriptIds: [],
    description: 'Player wakes up in the lab.',
    isExpanded: false
  },
  'stage-02': {
    id: 'stage-02',
    name: 'Chapter 2: Escape',
    parentId: 'stage-root',
    childrenIds: [],
    entryScriptIds: [],
    exitScriptIds: [],
    description: 'Finding the way out.'
  }
};

export const MOCK_NODES: Record<string, PuzzleNode> = {
  'node-01': {
    id: 'node-01',
    name: 'Generator Puzzle',
    description: 'Fix the power generator to open the door.',
    stageId: 'stage-01',
    stateMachineId: 'fsm-01',
    presentationGraphIds: ['pres-01'],
    localBlackboard: {
        'power_level': { 
            id: 'power_level', 
            name: 'Current Power', 
            type: 'integer', 
            defaultValue: 0, 
            isGlobal: false 
        },
        'max_voltage': { 
            id: 'max_voltage', 
            name: 'Target Voltage', 
            type: 'float', 
            defaultValue: 220.5, 
            isGlobal: false 
        },
        'has_fuse': { 
            id: 'has_fuse', 
            name: 'Fuse Inserted', 
            type: 'boolean', 
            defaultValue: false, 
            isGlobal: false 
        }
    }
  },
  'node-02': {
    id: 'node-02',
    name: 'Keypad Lock',
    description: 'Enter code 0451.',
    stageId: 'stage-01',
    stateMachineId: 'fsm-02',
    presentationGraphIds: [],
    localBlackboard: {
        'passcode': { 
            id: 'passcode', 
            name: 'Secret Code', 
            type: 'string', 
            defaultValue: '0451', 
            isGlobal: false 
        },
        'attempts': {
            id: 'attempts',
            name: 'Failed Attempts',
            type: 'integer',
            defaultValue: 0,
            isGlobal: false
        }
    }
  },
  'node-03': {
    id: 'node-03',
    name: 'Guard Patrol',
    description: 'Avoid the guard.',
    stageId: 'stage-02',
    stateMachineId: 'fsm-03',
    presentationGraphIds: [],
    localBlackboard: {
        'alert_level': {
            id: 'alert_level',
            name: 'Alert Level',
            type: 'string',
            defaultValue: 'NORMAL',
            isGlobal: false
        }
    }
  }
};

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
        onEnterScriptIds: [],
        onExitScriptIds: [],
        onUpdateScriptIds: [],
        transitionIds: ['trans-01']
      },
      'state-active': {
        id: 'state-active',
        name: 'Active',
        description: 'Generator is running',
        position: { x: 400, y: 150 },
        onEnterScriptIds: ['script-play-anim'],
        onExitScriptIds: [],
        onUpdateScriptIds: [],
        transitionIds: ['trans-02']
      },
      'state-broken': {
        id: 'state-broken',
        name: 'Broken',
        description: 'Failed attempt',
        position: { x: 250, y: 300 },
        onEnterScriptIds: [],
        onExitScriptIds: [],
        onUpdateScriptIds: [],
        transitionIds: ['trans-03']
      }
    },
    transitions: {
      'trans-01': {
        id: 'trans-01',
        name: 'Switch On',
        fromStateId: 'state-idle',
        toStateId: 'state-active',
        priority: 1,
        // Complex Condition Example: (power_level >= 80) AND has_fuse
        condition: { 
            type: 'AND',
            left: {
                type: 'COMPARISON',
                operator: '>=',
                left: { type: 'VARIABLE_REF', variableId: 'power_level' },
                right: { type: 'LITERAL', value: 80 }
            },
            right: {
                type: 'VARIABLE_REF',
                variableId: 'has_fuse'
            }
        } 
      },
      'trans-02': {
        id: 'trans-02',
        name: 'Overheat',
        fromStateId: 'state-active',
        toStateId: 'state-broken',
        priority: 1,
        condition: { 
            type: 'COMPARISON',
            operator: '>',
            left: { type: 'VARIABLE_REF', variableId: 'temperature' },
            right: { type: 'LITERAL', value: 100 }
        }
      },
      'trans-03': {
        id: 'trans-03',
        name: 'Repair',
        fromStateId: 'state-broken',
        toStateId: 'state-idle',
        priority: 1,
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
        onEnterScriptIds: [],
        onExitScriptIds: [],
        onUpdateScriptIds: [],
        transitionIds: []
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
            onEnterScriptIds: [],
            onExitScriptIds: [],
            onUpdateScriptIds: [],
            transitionIds: []
        }
    },
    transitions: {}
  }
};

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
        parameters: { message: 'Starting sequence...' },
        nextIds: ['pnode-02']
      },
      'pnode-02': {
        id: 'pnode-02',
        name: 'Wait 2s',
        type: 'Wait',
        position: { x: 300, y: 100 },
        parameters: { duration: 2.0 },
        nextIds: ['pnode-03']
      },
      'pnode-03': {
        id: 'pnode-03',
        name: 'Sparks Effect',
        type: 'ScriptCall',
        position: { x: 500, y: 100 },
        scriptId: 'script-play-anim',
        parameters: { target: 'VFX_Sparks', animName: 'Play' },
        nextIds: []
      }
    }
  }
};

export const MOCK_SCRIPTS: ScriptDefinition[] = [
  {
    id: 'script-log',
    name: 'Debug Log',
    category: 'System',
    description: 'Print a message to the console',
    parameters: [
      { name: 'message', type: 'string', required: true }
    ]
  },
  {
    id: 'script-play-anim',
    name: 'Play Animation',
    category: 'Visuals',
    parameters: [
      { name: 'target', type: 'string', required: true },
      { name: 'animName', type: 'string', required: true },
      { name: 'speed', type: 'float', required: false, defaultValue: 1.0 },
      { name: 'loop', type: 'boolean', required: false, defaultValue: false }
    ]
  },
  {
    id: 'script-dialogue',
    name: 'Show Dialogue',
    category: 'Narrative',
    parameters: [
      { name: 'charId', type: 'string', required: true },
      { name: 'text', type: 'string', required: true },
      { name: 'duration', type: 'float', required: false, defaultValue: 3.0 },
      { 
          name: 'emotion', 
          type: 'string', 
          required: true, 
          defaultValue: 'Neutral', 
          options: ['Neutral', 'Happy', 'Angry', 'Sad'] 
      }
    ]
  }
];

export const MOCK_TRIGGERS: TriggerDefinition[] = [
    {
        id: 'ON_INTERACT',
        name: 'On Interact',
        description: 'Player interacts with the object',
        parameters: []
    },
    {
        id: 'ON_ENTER_REGION',
        name: 'On Enter Region',
        description: 'Player enters the trigger volume',
        parameters: [
            { name: 'tag', type: 'string', required: false, defaultValue: 'Player' }
        ]
    },
    {
        id: 'ON_VARIABLE_CHANGE',
        name: 'On Variable Change',
        description: 'A specific blackboard variable changed',
        parameters: [
            { name: 'variableName', type: 'string', required: true }
        ]
    }
];
