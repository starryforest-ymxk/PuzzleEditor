import type { EditorState, ProjectContent, Selection } from './types';

function selectionExists(selection: Selection, project: ProjectContent): boolean {
    const { type, id, contextId } = selection;
    if (type === 'NONE') return true;
    if (!id) return false;
    const owner = project.nodes[contextId ?? ''];
    switch (type) {
        case 'STAGE': return !!project.stageTree.stages[id];
        case 'NODE': return !!project.nodes[id];
        case 'FSM': return !!project.stateMachines[id];
        case 'STATE': return !!owner && !!project.stateMachines[owner.stateMachineId]?.states[id];
        case 'TRANSITION': return !!owner && !!project.stateMachines[owner.stateMachineId]?.transitions[id];
        case 'PRESENTATION_GRAPH': return !!project.presentationGraphs[id];
        case 'PRESENTATION_NODE': return !!project.presentationGraphs[contextId ?? '']?.nodes[id];
        case 'SCRIPT': return !!project.scripts.scripts[id];
        case 'EVENT': return !!project.blackboard.events[id];
        case 'VARIABLE':
            return !!project.blackboard.globalVariables[id]
                || Object.values(project.stageTree.stages).some(stage => !!stage.localVariables?.[id])
                || Object.values(project.nodes).some(node => !!node.localVariables?.[id]);
    }
}

/** 历史只恢复项目内容；保留有效的浏览上下文，清除已不存在对象的选择和导航。 */
export function reconcileHistoryUi(ui: EditorState['ui'], project: ProjectContent): EditorState['ui'] {
    const hasStage = (id: string | null) => id === null || !!project.stageTree.stages[id];
    const hasNode = (id: string | null) => id === null || !!project.nodes[id];
    const hasGraph = (id: string | null) => id === null || !!project.presentationGraphs[id];
    const currentNodeId = hasNode(ui.currentNodeId) ? ui.currentNodeId : null;
    const currentGraphId = hasGraph(ui.currentGraphId) ? ui.currentGraphId : null;
    const fsm = currentNodeId ? project.stateMachines[project.nodes[currentNodeId].stateMachineId] : undefined;
    return {
        ...ui,
        selection: selectionExists(ui.selection, project) ? ui.selection : { type: 'NONE', id: null },
        currentStageId: currentNodeId ? project.nodes[currentNodeId].stageId
            : hasStage(ui.currentStageId) ? ui.currentStageId : project.stageTree.rootId || null,
        currentNodeId,
        currentGraphId,
        lastEditorContext: {
            stageId: hasStage(ui.lastEditorContext.stageId) ? ui.lastEditorContext.stageId : null,
            nodeId: hasNode(ui.lastEditorContext.nodeId) ? ui.lastEditorContext.nodeId : null
        },
        navStack: ui.navStack.filter(context => hasStage(context.stageId) && hasNode(context.nodeId) && hasGraph(context.graphId)),
        multiSelectStateIds: ui.multiSelectStateIds.filter(id => !!fsm?.states[id]),
        multiSelectPresentationNodeIds: ui.multiSelectPresentationNodeIds.filter(id => !!project.presentationGraphs[currentGraphId ?? '']?.nodes[id])
    };
}
