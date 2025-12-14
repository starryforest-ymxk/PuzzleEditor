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
      childrenIds: ['stage-act1', 'stage-act2', 'stage-act3'],
      eventListeners: [],
      isExpanded: true
    },
    'stage-act1': {
      id: 'stage-act1',
      name: 'Act 1: Arrival',
      parentId: 'stage-root',
      childrenIds: ['stage-act1a', 'stage-act1b'],
      description: 'Reach the underground facility entrance and regain bearings.',
      eventListeners: [],
      isInitial: true,
      isExpanded: true
    },
    'stage-act1a': {
      id: 'stage-act1a',
      name: 'Lab Wing',
      parentId: 'stage-act1',
      childrenIds: [],
      description: 'Stabilize power and recover lab notes.',
      eventListeners: [],
      isInitial: true,
      isExpanded: false
    },
    'stage-act1b': {
      id: 'stage-act1b',
      name: 'Security Wing',
      parentId: 'stage-act1',
      childrenIds: [],
      description: 'Disable security grid to access deeper halls.',
      eventListeners: [],
      isExpanded: false
    },
    'stage-act2': {
      id: 'stage-act2',
      name: 'Act 2: Investigation',
      parentId: 'stage-root',
      childrenIds: ['stage-act2a', 'stage-act2b', 'stage-act2c'],
      description: 'Piece together the conspiracy from fragmented evidence.',
      eventListeners: [],
      isExpanded: true
    },
    'stage-act2a': {
      id: 'stage-act2a',
      name: 'Archive Stack',
      parentId: 'stage-act2',
      childrenIds: [],
      description: 'Unlock and parse stored case files.',
      eventListeners: [],
      isInitial: true,
      isExpanded: false
    },
    'stage-act2b': {
      id: 'stage-act2b',
      name: 'Server Corridor',
      parentId: 'stage-act2',
      childrenIds: [],
      description: 'Bypass digital defenses.',
      eventListeners: [],
      isExpanded: false
    },
    'stage-act2c': {
      id: 'stage-act2c',
      name: 'Interrogation Deck',
      parentId: 'stage-act2',
      childrenIds: [],
      description: 'Extract intel under pressure.',
      eventListeners: [],
      isExpanded: false
    },
    'stage-act3': {
      id: 'stage-act3',
      name: 'Act 3: Escape',
      parentId: 'stage-root',
      childrenIds: [],
      description: 'Sequence the final escape and seal the facility.',
      eventListeners: [],
      isExpanded: false
    }
  }
};

// ========== 解谜节点模拟数据 ==========
export const MOCK_NODES: Record<string, PuzzleNode> = {
  'node-act1-main1': {
    id: 'node-act1-main1',
    name: 'Wake Up Call',
    description: 'Restore consciousness and gather the first clues.',
    stageId: 'stage-act1',
    stateMachineId: 'fsm-act1-main1',
    localVariables: {
      'node-act1-main1-progress': {
        id: 'node-act1-main1-progress',
        key: 'node-act1-main1-progress',
        name: 'Progress',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act1-main1-solved': {
        id: 'node-act1-main1-solved',
        key: 'node-act1-main1-solved',
        name: 'Memory Stabilized',
        type: 'boolean',
        defaultValue: false,
        state: 'Draft',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act1-main2': {
    id: 'node-act1-main2',
    name: 'Broken Elevator',
    description: 'Power up the service lift to descend.',
    stageId: 'stage-act1',
    stateMachineId: 'fsm-act1-main2',
    localVariables: {
      'node-act1-main2-progress': {
        id: 'node-act1-main2-progress',
        key: 'node-act1-main2-progress',
        name: 'Progress',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act1-main2-solved': {
        id: 'node-act1-main2-solved',
        key: 'node-act1-main2-solved',
        name: 'Lift Online',
        type: 'boolean',
        defaultValue: false,
        state: 'Draft',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act1a-1': {
    id: 'node-act1a-1',
    name: 'Fuse Hunt',
    description: 'Collect fuses to stabilize the lab power rails.',
    stageId: 'stage-act1a',
    stateMachineId: 'fsm-act1a-1',
    localVariables: {
      'node-act1a-1-progress': {
        id: 'node-act1a-1-progress',
        key: 'node-act1a-1-progress',
        name: 'Fuses Inserted',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act1a-1-solved': {
        id: 'node-act1a-1-solved',
        key: 'node-act1a-1-solved',
        name: 'Power Stable',
        type: 'boolean',
        defaultValue: false,
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act1a-2': {
    id: 'node-act1a-2',
    name: 'Memory Console',
    description: 'Reconstruct the corrupted audio log.',
    stageId: 'stage-act1a',
    stateMachineId: 'fsm-act1a-2',
    localVariables: {
      'node-act1a-2-progress': {
        id: 'node-act1a-2-progress',
        key: 'node-act1a-2-progress',
        name: 'Fragments Restored',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act1a-2-solved': {
        id: 'node-act1a-2-solved',
        key: 'node-act1a-2-solved',
        name: 'Transcript Ready',
        type: 'boolean',
        defaultValue: false,
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act1a-3': {
    id: 'node-act1a-3',
    name: 'Specimen Containment',
    description: 'Balance pressure valves to unlock the containment rack.',
    stageId: 'stage-act1a',
    stateMachineId: 'fsm-act1a-3',
    localVariables: {
      'node-act1a-3-progress': {
        id: 'node-act1a-3-progress',
        key: 'node-act1a-3-progress',
        name: 'Valve Alignment',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act1a-3-solved': {
        id: 'node-act1a-3-solved',
        key: 'node-act1a-3-solved',
        name: 'Containment Released',
        type: 'boolean',
        defaultValue: false,
        state: 'Draft',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act1b-1': {
    id: 'node-act1b-1',
    name: 'Laser Grid',
    description: 'Sync mirror plates to disrupt the laser grid.',
    stageId: 'stage-act1b',
    stateMachineId: 'fsm-act1b-1',
    localVariables: {
      'node-act1b-1-progress': {
        id: 'node-act1b-1-progress',
        key: 'node-act1b-1-progress',
        name: 'Mirrors Set',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act1b-1-solved': {
        id: 'node-act1b-1-solved',
        key: 'node-act1b-1-solved',
        name: 'Grid Disabled',
        type: 'boolean',
        defaultValue: false,
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act1b-2': {
    id: 'node-act1b-2',
    name: 'Ventilation Riddle',
    description: 'Route smoke to reveal hidden vents.',
    stageId: 'stage-act1b',
    stateMachineId: 'fsm-act1b-2',
    localVariables: {
      'node-act1b-2-progress': {
        id: 'node-act1b-2-progress',
        key: 'node-act1b-2-progress',
        name: 'Vents Mapped',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act1b-2-solved': {
        id: 'node-act1b-2-solved',
        key: 'node-act1b-2-solved',
        name: 'Route Clear',
        type: 'boolean',
        defaultValue: false,
        state: 'Draft',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act1b-3': {
    id: 'node-act1b-3',
    name: 'Chemical Mixer',
    description: 'Mix compounds to create a solvent.',
    stageId: 'stage-act1b',
    stateMachineId: 'fsm-act1b-3',
    localVariables: {
      'node-act1b-3-progress': {
        id: 'node-act1b-3-progress',
        key: 'node-act1b-3-progress',
        name: 'Formula Progress',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act1b-3-solved': {
        id: 'node-act1b-3-solved',
        key: 'node-act1b-3-solved',
        name: 'Solvent Ready',
        type: 'boolean',
        defaultValue: false,
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act2-main1': {
    id: 'node-act2-main1',
    name: 'Crime Board',
    description: 'Link suspects and evidence.',
    stageId: 'stage-act2',
    stateMachineId: 'fsm-act2-main1',
    localVariables: {
      'node-act2-main1-progress': {
        id: 'node-act2-main1-progress',
        key: 'node-act2-main1-progress',
        name: 'Connections Made',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act2-main1-solved': {
        id: 'node-act2-main1-solved',
        key: 'node-act2-main1-solved',
        name: 'Board Solved',
        type: 'boolean',
        defaultValue: false,
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act2-main2': {
    id: 'node-act2-main2',
    name: 'Power Relay',
    description: 'Reroute energy between wings.',
    stageId: 'stage-act2',
    stateMachineId: 'fsm-act2-main2',
    localVariables: {
      'node-act2-main2-progress': {
        id: 'node-act2-main2-progress',
        key: 'node-act2-main2-progress',
        name: 'Relays Synced',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act2-main2-solved': {
        id: 'node-act2-main2-solved',
        key: 'node-act2-main2-solved',
        name: 'Grid Balanced',
        type: 'boolean',
        defaultValue: false,
        state: 'Draft',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act2a-1': {
    id: 'node-act2a-1',
    name: 'Archive Locks',
    description: 'Decode the archival door pins.',
    stageId: 'stage-act2a',
    stateMachineId: 'fsm-act2a-1',
    localVariables: {
      'node-act2a-1-progress': {
        id: 'node-act2a-1-progress',
        key: 'node-act2a-1-progress',
        name: 'Locks Opened',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act2a-1-solved': {
        id: 'node-act2a-1-solved',
        key: 'node-act2a-1-solved',
        name: 'Archives Ready',
        type: 'boolean',
        defaultValue: false,
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act2a-2': {
    id: 'node-act2a-2',
    name: 'Microfilm Scanner',
    description: 'Align lenses to read microfilm.',
    stageId: 'stage-act2a',
    stateMachineId: 'fsm-act2a-2',
    localVariables: {
      'node-act2a-2-progress': {
        id: 'node-act2a-2-progress',
        key: 'node-act2a-2-progress',
        name: 'Frames Parsed',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act2a-2-solved': {
        id: 'node-act2a-2-solved',
        key: 'node-act2a-2-solved',
        name: 'Film Decoded',
        type: 'boolean',
        defaultValue: false,
        state: 'Draft',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act2a-3': {
    id: 'node-act2a-3',
    name: 'Keyphrase Decipher',
    description: 'Match ciphers to reconstruct the keyword.',
    stageId: 'stage-act2a',
    stateMachineId: 'fsm-act2a-3',
    localVariables: {
      'node-act2a-3-progress': {
        id: 'node-act2a-3-progress',
        key: 'node-act2a-3-progress',
        name: 'Ciphers Solved',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act2a-3-solved': {
        id: 'node-act2a-3-solved',
        key: 'node-act2a-3-solved',
        name: 'Keyword Found',
        type: 'boolean',
        defaultValue: false,
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act2b-1': {
    id: 'node-act2b-1',
    name: 'Server Firewall',
    description: 'Trace packets to find the weak node.',
    stageId: 'stage-act2b',
    stateMachineId: 'fsm-act2b-1',
    localVariables: {
      'node-act2b-1-progress': {
        id: 'node-act2b-1-progress',
        key: 'node-act2b-1-progress',
        name: 'Ports Mapped',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act2b-1-solved': {
        id: 'node-act2b-1-solved',
        key: 'node-act2b-1-solved',
        name: 'Firewall Breached',
        type: 'boolean',
        defaultValue: false,
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act2b-2': {
    id: 'node-act2b-2',
    name: 'Admin Override',
    description: 'Spoof credentials before lockdown hits.',
    stageId: 'stage-act2b',
    stateMachineId: 'fsm-act2b-2',
    localVariables: {
      'node-act2b-2-progress': {
        id: 'node-act2b-2-progress',
        key: 'node-act2b-2-progress',
        name: 'Credentials Forged',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act2b-2-solved': {
        id: 'node-act2b-2-solved',
        key: 'node-act2b-2-solved',
        name: 'Override Granted',
        type: 'boolean',
        defaultValue: false,
        state: 'Draft',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act2b-3': {
    id: 'node-act2b-3',
    name: 'Data Shredder',
    description: 'Recover fragments before deletion completes.',
    stageId: 'stage-act2b',
    stateMachineId: 'fsm-act2b-3',
    localVariables: {
      'node-act2b-3-progress': {
        id: 'node-act2b-3-progress',
        key: 'node-act2b-3-progress',
        name: 'Fragments Saved',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act2b-3-solved': {
        id: 'node-act2b-3-solved',
        key: 'node-act2b-3-solved',
        name: 'Data Restored',
        type: 'boolean',
        defaultValue: false,
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act2c-1': {
    id: 'node-act2c-1',
    name: 'Interrogation Timing',
    description: 'Time responses to break the suspect rhythm.',
    stageId: 'stage-act2c',
    stateMachineId: 'fsm-act2c-1',
    localVariables: {
      'node-act2c-1-progress': {
        id: 'node-act2c-1-progress',
        key: 'node-act2c-1-progress',
        name: 'Beats Matched',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act2c-1-solved': {
        id: 'node-act2c-1-solved',
        key: 'node-act2c-1-solved',
        name: 'Timing Mastered',
        type: 'boolean',
        defaultValue: false,
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act2c-2': {
    id: 'node-act2c-2',
    name: 'Lie Detector',
    description: 'Correlate heartbeats to statements.',
    stageId: 'stage-act2c',
    stateMachineId: 'fsm-act2c-2',
    localVariables: {
      'node-act2c-2-progress': {
        id: 'node-act2c-2-progress',
        key: 'node-act2c-2-progress',
        name: 'Signals Synced',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act2c-2-solved': {
        id: 'node-act2c-2-solved',
        key: 'node-act2c-2-solved',
        name: 'Truth Locked',
        type: 'boolean',
        defaultValue: false,
        state: 'Draft',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act2c-3': {
    id: 'node-act2c-3',
    name: 'Guard Distraction',
    description: 'Orchestrate noises to move patrol routes.',
    stageId: 'stage-act2c',
    stateMachineId: 'fsm-act2c-3',
    localVariables: {
      'node-act2c-3-progress': {
        id: 'node-act2c-3-progress',
        key: 'node-act2c-3-progress',
        name: 'Noise Triggers',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act2c-3-solved': {
        id: 'node-act2c-3-solved',
        key: 'node-act2c-3-solved',
        name: 'Patrol Shifted',
        type: 'boolean',
        defaultValue: false,
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act3-main1': {
    id: 'node-act3-main1',
    name: 'Escape Route',
    description: 'Plot the safest route to the roof.',
    stageId: 'stage-act3',
    stateMachineId: 'fsm-act3-main1',
    localVariables: {
      'node-act3-main1-progress': {
        id: 'node-act3-main1-progress',
        key: 'node-act3-main1-progress',
        name: 'Paths Evaluated',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act3-main1-solved': {
        id: 'node-act3-main1-solved',
        key: 'node-act3-main1-solved',
        name: 'Route Locked',
        type: 'boolean',
        defaultValue: false,
        state: 'Implemented',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  },
  'node-act3-main2': {
    id: 'node-act3-main2',
    name: 'Final Door',
    description: 'Synchronize keys and timer to open the final blast door.',
    stageId: 'stage-act3',
    stateMachineId: 'fsm-act3-main2',
    localVariables: {
      'node-act3-main2-progress': {
        id: 'node-act3-main2-progress',
        key: 'node-act3-main2-progress',
        name: 'Locks Released',
        type: 'integer',
        defaultValue: 0,
        state: 'Implemented',
        scope: 'NodeLocal'
      },
      'node-act3-main2-solved': {
        id: 'node-act3-main2-solved',
        key: 'node-act3-main2-solved',
        name: 'Door Opened',
        type: 'boolean',
        defaultValue: false,
        state: 'Draft',
        scope: 'NodeLocal'
      }
    },
    eventListeners: []
  }
};

// ========== 状态机模拟数据 ==========
const buildTwoStepFsm = (fsmId: string, nodeId: string, idleName: string, solvingName: string, solvedName: string): StateMachine => ({
  id: fsmId,
  initialStateId: `${fsmId}-state-idle`,
  states: {
    [`${fsmId}-state-idle`]: {
      id: `${fsmId}-state-idle`,
      name: idleName,
      description: 'Waiting for the next clue.',
      position: { x: 120, y: 140 },
      eventListeners: []
    },
    [`${fsmId}-state-solving`]: {
      id: `${fsmId}-state-solving`,
      name: solvingName,
      description: 'Player is interacting with the puzzle.',
      position: { x: 360, y: 140 },
      lifecycleScriptId: 'script-lifecycle-state',
      eventListeners: []
    },
    [`${fsmId}-state-solved`]: {
      id: `${fsmId}-state-solved`,
      name: solvedName,
      description: 'Puzzle completed.',
      position: { x: 600, y: 140 },
      lifecycleScriptId: 'script-dialogue',
      eventListeners: []
    }
  },
  transitions: {
    [`${fsmId}-t-begin`]: {
      id: `${fsmId}-t-begin`,
      name: 'Begin',
      fromStateId: `${fsmId}-state-idle`,
      toStateId: `${fsmId}-state-solving`,
      priority: 1,
      triggers: [{ type: 'OnEvent', eventId: 'event-case-start' }],
      parameterModifiers: [],
      condition: { type: 'LITERAL', value: true }
    },
    [`${fsmId}-t-complete`]: {
      id: `${fsmId}-t-complete`,
      name: 'Complete',
      fromStateId: `${fsmId}-state-solving`,
      toStateId: `${fsmId}-state-solved`,
      priority: 1,
      triggers: [{ type: 'Always' }],
      parameterModifiers: [],
      condition: {
        type: 'COMPARISON',
        operator: '>=',
        left: { type: 'VARIABLE_REF', variableId: `${nodeId}-progress`, variableScope: 'NodeLocal' },
        right: { type: 'LITERAL', value: 1 }
      }
    }
  }
});

export const MOCK_STATE_MACHINES: Record<string, StateMachine> = {
  'fsm-act1-main1': buildTwoStepFsm('fsm-act1-main1', 'node-act1-main1', 'Unsteady', 'Searching', 'Centered'),
  'fsm-act1-main2': buildTwoStepFsm('fsm-act1-main2', 'node-act1-main2', 'Offline', 'Rewiring', 'Powered'),
  'fsm-act1a-1': buildTwoStepFsm('fsm-act1a-1', 'node-act1a-1', 'Dark', 'Slotting', 'Stabilized'),
  'fsm-act1a-2': buildTwoStepFsm('fsm-act1a-2', 'node-act1a-2', 'Static', 'Reordering', 'Clear Audio'),
  'fsm-act1a-3': buildTwoStepFsm('fsm-act1a-3', 'node-act1a-3', 'Sealed', 'Balancing', 'Unlocked'),
  'fsm-act1b-1': buildTwoStepFsm('fsm-act1b-1', 'node-act1b-1', 'Shielded', 'Aligning', 'Disabled'),
  'fsm-act1b-2': buildTwoStepFsm('fsm-act1b-2', 'node-act1b-2', 'Hidden', 'Tracing', 'Revealed'),
  'fsm-act1b-3': buildTwoStepFsm('fsm-act1b-3', 'node-act1b-3', 'Cold', 'Mixing', 'Reactive'),
  'fsm-act2-main1': buildTwoStepFsm('fsm-act2-main1', 'node-act2-main1', 'Blank', 'Linking', 'Mapped'),
  'fsm-act2-main2': buildTwoStepFsm('fsm-act2-main2', 'node-act2-main2', 'Unbalanced', 'Routing', 'Stable'),
  'fsm-act2a-1': buildTwoStepFsm('fsm-act2a-1', 'node-act2a-1', 'Locked', 'Decoding', 'Open'),
  'fsm-act2a-2': buildTwoStepFsm('fsm-act2a-2', 'node-act2a-2', 'Blurred', 'Focusing', 'Readable'),
  'fsm-act2a-3': buildTwoStepFsm('fsm-act2a-3', 'node-act2a-3', 'Obscured', 'Matching', 'Decoded'),
  'fsm-act2b-1': buildTwoStepFsm('fsm-act2b-1', 'node-act2b-1', 'Secured', 'Scanning', 'Bypassed'),
  'fsm-act2b-2': buildTwoStepFsm('fsm-act2b-2', 'node-act2b-2', 'Guarded', 'Spoofing', 'Granted'),
  'fsm-act2b-3': buildTwoStepFsm('fsm-act2b-3', 'node-act2b-3', 'Shredding', 'Reassembling', 'Recovered'),
  'fsm-act2c-1': buildTwoStepFsm('fsm-act2c-1', 'node-act2c-1', 'Tense', 'Pacing', 'Broken Rhythm'),
  'fsm-act2c-2': buildTwoStepFsm('fsm-act2c-2', 'node-act2c-2', 'Unclear', 'Calibrating', 'Verified'),
  'fsm-act2c-3': buildTwoStepFsm('fsm-act2c-3', 'node-act2c-3', 'Routine', 'Distracting', 'Shifted'),
  'fsm-act3-main1': buildTwoStepFsm('fsm-act3-main1', 'node-act3-main1', 'Scouting', 'Planning', 'Route Locked'),
  'fsm-act3-main2': buildTwoStepFsm('fsm-act3-main2', 'node-act3-main2', 'Sealed', 'Synchronizing', 'Opened')
};

// ========== 演出子图模拟数据 ==========
export const MOCK_PRESENTATION_GRAPHS: Record<string, PresentationGraph> = {
  'pres-escape': {
    id: 'pres-escape',
    name: 'Escape Countdown',
    description: 'Final countdown cinematic when the last door opens.',
    startNodeId: 'pnode-escape-01',
    nodes: {
      'pnode-escape-01': {
        id: 'pnode-escape-01',
        name: 'Alarm Wail',
        type: 'ScriptCall',
        position: { x: 80, y: 100 },
        scriptId: 'script-log',
        parameters: [
          { paramName: 'message', source: { type: 'Constant', value: 'Evacuation protocol triggered.' } }
        ],
        nextIds: ['pnode-escape-02']
      },
      'pnode-escape-02': {
        id: 'pnode-escape-02',
        name: 'Timer Overlay',
        type: 'ScriptCall',
        position: { x: 320, y: 100 },
        scriptId: 'script-play-anim',
        parameters: [
          { paramName: 'target', source: { type: 'Constant', value: 'UI_Timer' } },
          { paramName: 'animName', source: { type: 'Constant', value: 'Countdown' } }
        ],
        nextIds: ['pnode-escape-03']
      },
      'pnode-escape-03': {
        id: 'pnode-escape-03',
        name: 'Roof Door Open',
        type: 'ScriptCall',
        position: { x: 560, y: 100 },
        scriptId: 'script-dialogue',
        parameters: [
          { paramName: 'message', source: { type: 'Constant', value: 'Final door unlocked. Move!' } }
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
    lifecycleType: 'Node',
    state: 'Implemented'
  },
  {
    id: 'script-lifecycle-node-audit',
    key: 'script-lifecycle-node-audit',
    name: 'Node Audit Hook',
    category: 'Lifecycle',
    description: 'Logs node entry/exit for telemetry.',
    lifecycleType: 'Node',
    state: 'Draft'
  },
  {
    id: 'script-lifecycle-node-legacy',
    key: 'script-lifecycle-node-legacy',
    name: 'Node Legacy Cleanup',
    category: 'Lifecycle',
    description: 'Deprecated node cleanup flow kept for migration.',
    lifecycleType: 'Node',
    state: 'MarkedForDelete'
  },
  {
    id: 'script-lifecycle-state',
    key: 'script-lifecycle-state',
    name: 'State Lifecycle',
    category: 'Lifecycle',
    description: 'Handles state enter/exit lifecycle events',
    lifecycleType: 'State',
    state: 'Implemented'
  },
  {
    id: 'script-lifecycle-state-audit',
    key: 'script-lifecycle-state-audit',
    name: 'State Audit Hook',
    category: 'Lifecycle',
    description: 'Records state transitions for debugging.',
    lifecycleType: 'State',
    state: 'Draft'
  },
  {
    id: 'script-lifecycle-state-legacy',
    key: 'script-lifecycle-state-legacy',
    name: 'State Legacy Bridge',
    category: 'Lifecycle',
    description: 'Legacy state enter/exit behavior slated for removal.',
    lifecycleType: 'State',
    state: 'MarkedForDelete'
  },
  {
    id: 'script-lifecycle-stage',
    key: 'script-lifecycle-stage',
    name: 'Stage Lifecycle',
    category: 'Lifecycle',
    description: 'Handles stage-level enter/exit hooks',
    lifecycleType: 'Stage',
    state: 'Implemented'
  },
  {
    id: 'script-lifecycle-stage-audit',
    key: 'script-lifecycle-stage-audit',
    name: 'Stage Audit Hook',
    category: 'Lifecycle',
    description: 'Captures stage-level analytics on enter/exit.',
    lifecycleType: 'Stage',
    state: 'Draft'
  },
  {
    id: 'script-lifecycle-stage-legacy',
    key: 'script-lifecycle-stage-legacy',
    name: 'Stage Legacy Intro/Outro',
    category: 'Lifecycle',
    description: 'Deprecated stage intro/outro kept for compatibility.',
    lifecycleType: 'Stage',
    state: 'MarkedForDelete'
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
  },
  {
    id: 'script-old-broadcast',
    key: 'script-old-broadcast',
    name: 'Legacy Broadcast',
    category: 'Performance',
    description: 'Deprecated broadcast effect kept for migration tests',
    state: 'MarkedForDelete'
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
    },
    'var-retired-route': {
      id: 'var-retired-route',
      key: 'var-retired-route',
      name: 'Retired Route Flag',
      type: 'boolean',
      defaultValue: false,
      state: 'MarkedForDelete',
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
    },
    'event-case-start': {
      id: 'event-case-start',
      key: 'EVENT_CASE_START',
      name: 'Case Start',
      description: 'Signals the beginning of any puzzle interaction.',
      state: 'Implemented'
    },
    'event-retired-siren': {
      id: 'event-retired-siren',
      key: 'EVENT_RETIRED_SIREN',
      name: 'Retired Siren',
      description: 'Deprecated alert sound kept for compatibility testing.',
      state: 'MarkedForDelete'
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
