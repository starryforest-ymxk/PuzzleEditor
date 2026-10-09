/** C6 虚构删除夹具：深层 Stage、同 ID 局部变量、独立 FSM 与保留的全局演出图。 */
import type { ResourceState } from '../../types/common';
import { cliProject } from './fixtures';

export function deletionProject(state: ResourceState = 'Draft') {
  const project = cliProject();
  const root = project.stageTree.stages[project.stageTree.rootId];
  const room = project.stageTree.stages.room;
  root.childrenIds.push('sibling');
  room.childrenIds = ['deep'];
  room.localVariables.shared.state = state;
  project.stageTree.stages.deep = {
    ...structuredClone(room),
    id: 'deep',
    name: 'Deep',
    assetName: 'Deep',
    parentId: 'room',
    childrenIds: [],
  };
  project.stageTree.stages.deep.localVariables.shared.assetName = 'DeepShared';
  project.stageTree.stages.sibling = {
    ...structuredClone(room),
    id: 'sibling',
    name: 'Sibling',
    assetName: 'Sibling',
    parentId: root.id,
    childrenIds: [],
    localVariables: {},
    isInitial: false,
    unlockTriggers: [{ type: 'Always' }],
    unlockCondition: { type: 'Literal', value: false },
  };
  project.nodes.lock.stageId = 'deep';
  project.nodes.door.localVariables.shared = {
    ...structuredClone(room.localVariables.shared),
    assetName: 'DoorShared',
    scope: 'NodeLocal',
  };
  return project;
}
