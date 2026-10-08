import { INITIAL_STATE, type EditorState, type SaveAcknowledgement } from '../../store/types';
import { createEmptyProject } from '../../utils/projectFactory';
import type { ProjectData } from '../../types/project';

/** 独立内存夹具，固定时间和资源，禁止测试依赖用户工程。 */
export function createProjectFixture(): ProjectData {
    const project = createEmptyProject('Test Project');
    project.meta.createdAt = project.meta.updatedAt = '2026-10-07T00:00:00.000Z';
    project.presentationGraphs.graph = {
        id: 'graph', name: 'Graph', startNodeId: 'first', nodes: {
            first: { id: 'first', name: 'First', type: 'Wait', duration: 1, position: { x: 0, y: 0 }, nextIds: ['second'] },
            second: { id: 'second', name: 'Second', type: 'Wait', duration: 1, position: { x: 100, y: 0 }, nextIds: [] }
        }
    };
    project.blackboard.events.event = { id: 'event', name: 'Event', state: 'Implemented' };
    return project;
}

export function createEditorFixture(): EditorState {
    return { ...structuredClone(INITIAL_STATE), project: { ...createProjectFixture(), isLoaded: true } };
}

export function saveAcknowledgement(state: EditorState): SaveAcknowledgement {
    return {
        sessionId: state.document.sessionId, revision: state.document.revision,
        path: state.runtime.currentProjectPath, savedAt: '2026-10-07T01:00:00.000Z'
    };
}
