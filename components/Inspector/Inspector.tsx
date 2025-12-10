/**
 * components/Inspector/Inspector.tsx
 * 属性检查器路由组件
 * 
 * 该组件负责根据当前选中类型分发到对应的子检查器组件。
 * 遵循单一职责原则，不包含具体的渲染逻辑。
 */

import React from 'react';
import { useEditorState } from '../../store/context';
import { StageInspector } from './StageInspector';
import { NodeInspector } from './NodeInspector';
import { StateInspector } from './StateInspector';
import { TransitionInspector } from './TransitionInspector';
import { PresentationNodeInspector } from './PresentationNodeInspector';
import { GraphInspector } from './GraphInspector';
import { FsmInspector } from './FsmInspector';
import { VariableInspector } from './VariableInspector';
import { ScriptInspector } from './ScriptInspector';
import { EventInspector } from './EventInspector';

interface InspectorProps {
  readOnly?: boolean;
}

/**
 * 主检查器组件 - 路由分发
 * 根据 ui.selection.type 将渲染委托给对应的子检查器
 */
export const Inspector: React.FC<InspectorProps> = ({ readOnly = false }) => {
  const { ui, project } = useEditorState();

  // --- 空选中状态 ---
  if (ui.selection.type === 'NONE') {
    return (
      <div className="empty-state">
        <div style={{ marginBottom: '8px', fontSize: '24px', opacity: 0.2 }}>ⓘ</div>
        Select an object to view its properties
      </div>
    );
  }

  // --- STAGE 检查器 ---
  if (ui.selection.type === 'STAGE') {
    return <StageInspector stageId={ui.selection.id!} readOnly={readOnly} />;
  }

  // --- NODE 检查器 ---
  if (ui.selection.type === 'NODE') {
    return <NodeInspector nodeId={ui.selection.id!} readOnly={readOnly} />;
  }

  // --- STATE 检查器 ---
  if (ui.selection.type === 'STATE') {
    if (!ui.selection.contextId) {
      return <div className="empty-state">State context missing</div>;
    }
    const node = project.nodes[ui.selection.contextId];
    if (!node) {
      return <div className="empty-state">Context node not found</div>;
    }
    return <StateInspector fsmId={node.stateMachineId} stateId={ui.selection.id!} readOnly={readOnly} />;
  }

  // --- TRANSITION 检查器 ---
  if (ui.selection.type === 'TRANSITION') {
    if (!ui.selection.contextId) {
      return <div className="empty-state">Transition context missing</div>;
    }
    const node = project.nodes[ui.selection.contextId];
    if (!node) {
      return <div className="empty-state">Context node not found</div>;
    }
    return <TransitionInspector fsmId={node.stateMachineId} transitionId={ui.selection.id!} readOnly={readOnly} />;
  }

  // --- PRESENTATION_NODE 检查器 ---
  if (ui.selection.type === 'PRESENTATION_NODE') {
    if (!ui.selection.contextId) {
      return <div className="empty-state">Presentation graph context missing</div>;
    }
    return <PresentationNodeInspector graphId={ui.selection.contextId} nodeId={ui.selection.id!} />;
  }

  // --- PRESENTATION_GRAPH 检查器 ---
  if (ui.selection.type === 'PRESENTATION_GRAPH') {
    return <GraphInspector graphId={ui.selection.id!} readOnly={readOnly} />;
  }

  // --- FSM 检查器 ---
  if (ui.selection.type === 'FSM') {
    return <FsmInspector fsmId={ui.selection.id!} readOnly={readOnly} />;
  }

  // --- VARIABLE 检查器 ---
  if (ui.selection.type === 'VARIABLE') {
    return <VariableInspector variableId={ui.selection.id!} readOnly={readOnly} />;
  }

  // --- SCRIPT 检查器 ---
  if (ui.selection.type === 'SCRIPT') {
    return <ScriptInspector scriptId={ui.selection.id!} readOnly={readOnly} />;
  }

  // --- EVENT 检查器 ---
  if (ui.selection.type === 'EVENT') {
    return <EventInspector eventId={ui.selection.id!} readOnly={readOnly} />;
  }

  // --- 未知选中类型 ---
  return <div className="empty-state">Unknown selection type</div>;
};
