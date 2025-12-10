import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { StageTreeData, StageNode } from '../../types/stage';

interface BreadcrumbItem {
    id: string;
    name: string;
    type: 'ROOT' | 'STAGE' | 'NODE' | 'GRAPH';
}

const findStagePath = (stages: Record<string, StageNode>, currentId: string | null): StageNode[] => {
    if (!currentId || !stages[currentId]) return [];
    const path: StageNode[] = [];
    let curr: StageNode | undefined = stages[currentId];
    while (curr) {
        path.unshift(curr);
        if (!curr.parentId) break;
        curr = stages[curr.parentId];
    }
    return path;
};

export const Breadcrumb = () => {
    const { project, ui } = useEditorState();
    const dispatch = useEditorDispatch();
    const { currentStageId, currentNodeId, currentGraphId } = ui;
    const rootStageId = project.stageTree.rootId;

    // 构建路径：Root -> Ancestor Stages -> Current Stage -> Current Node -> Graph
    const items: BreadcrumbItem[] = [];

    // 1. Root Item
    items.push({ id: 'root', name: project.meta.name || 'Project Root', type: 'ROOT' });

    // 2. Stage Path
    if (currentStageId && project.stageTree.stages[currentStageId]) {
        const stagePath = findStagePath(project.stageTree.stages, currentStageId);
        stagePath.forEach(stage => {
            items.push({ id: stage.id, name: stage.name, type: 'STAGE' });
        });
    }

    // 3. Current Node
    if (currentNodeId && project.nodes[currentNodeId]) {
        items.push({
            id: currentNodeId,
            name: project.nodes[currentNodeId].name,
            type: 'NODE'
        });
    }

    // 4. Current Presentation Graph
    if (currentGraphId && project.presentationGraphs[currentGraphId]) {
        items.push({
            id: currentGraphId,
            name: project.presentationGraphs[currentGraphId].name,
            type: 'GRAPH'
        });
    }

    const handleNavigate = (index: number, item: BreadcrumbItem) => {
        if (index === items.length - 1) return; // 点击最后一项不跳转

        if (item.type === 'ROOT') {
            // 回到项目根 Stage，确保直接显示根内容而非空画布
            if (rootStageId) {
                dispatch({ type: 'NAVIGATE_TO', payload: { stageId: rootStageId, nodeId: null, graphId: null } });
            }
        } else if (item.type === 'STAGE') {
            dispatch({ type: 'NAVIGATE_TO', payload: { stageId: item.id, nodeId: null, graphId: null } });
        } else if (item.type === 'NODE') {
            const node = project.nodes[item.id];
            const stageId = node?.stageId ?? null;
            dispatch({ type: 'NAVIGATE_TO', payload: { stageId, nodeId: item.id, graphId: null } });
        } else if (item.type === 'GRAPH') {
            dispatch({ type: 'NAVIGATE_TO', payload: { graphId: item.id } });
        }
    };

    const handleBack = () => {
        dispatch({ type: 'NAVIGATE_BACK' });
    };

    return (
        <div style={{
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            background: 'var(--bg-color)',
            borderBottom: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            fontSize: '12px'
        }}>
            {/* Back Button */}
            <button
                onClick={handleBack}
                className="btn-ghost"
                style={{ padding: '2px 6px', marginRight: '8px', display: 'flex', alignItems: 'center', opacity: ui.navStack.length > 0 ? 1 : 0.5, cursor: ui.navStack.length > 0 ? 'pointer' : 'not-allowed' }}
                title="Go Back"
                disabled={ui.navStack.length === 0}
            >
                ←
            </button>

            {/* Path Items */}
            {items.map((item, index) => {
                const isLast = index === items.length - 1;
                return (
                    <React.Fragment key={item.id}>
                        <span
                            onClick={() => handleNavigate(index, item)}
                            className={!isLast ? 'breadcrumb-link' : undefined}
                            style={{
                                cursor: isLast ? 'default' : 'pointer',
                                fontWeight: isLast ? 600 : 400,
                                color: isLast ? 'var(--text-primary)' : 'inherit'
                            }}
                        >
                            {item.name}
                        </span>
                        {!isLast && <span style={{ margin: '0 6px', opacity: 0.5 }}>/</span>}
                    </React.Fragment>
                );
            })}
        </div>
    );
};
