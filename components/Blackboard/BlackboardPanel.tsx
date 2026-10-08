import React from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import type { BlackboardViewState } from '../../store/types';
import { useBlackboardData } from '../../hooks/useBlackboardData';
import { useBlackboardActions } from '../../hooks/useBlackboardActions';
import { BlackboardToolbar } from './BlackboardToolbar';
import { VariablesTab } from './VariablesTab';
import { ScriptsTab } from './ScriptsTab';
import { EventsTab } from './EventsTab';
import { GraphsTab } from './GraphsTab';
import './blackboard.css';

/** Store 是视图状态的唯一来源，切换工程时不会残留另一份局部筛选状态。 */
export const BlackboardPanel: React.FC = () => {
  const { project, ui } = useEditorState();
  const dispatch = useEditorDispatch();
  const view = ui.blackboardView;
  const data = useBlackboardData(project, view);
  const actions = useBlackboardActions(project);
  const persistState = (next: Partial<BlackboardViewState>) =>
    dispatch({ type: 'SET_BLACKBOARD_VIEW', payload: next });
  const toggleSection = (key: string) =>
    persistState({
      expandedSections: { ...view.expandedSections, [key]: !(view.expandedSections[key] ?? true) },
    });
  const props = {
    data,
    actions,
    selection: ui.selection,
    expandedSections: view.expandedSections,
    toggleSection,
  };
  return (
    <div className="blackboard-container">
      <BlackboardToolbar view={view} actions={actions} persistState={persistState} />
      <div className="blackboard-content">
        {view.activeTab === 'Variables' && <VariablesTab {...props} />}
        {view.activeTab === 'Scripts' && <ScriptsTab {...props} />}
        {view.activeTab === 'Events' && <EventsTab {...props} />}
        {view.activeTab === 'Graphs' && <GraphsTab {...props} />}
      </div>
    </div>
  );
};
