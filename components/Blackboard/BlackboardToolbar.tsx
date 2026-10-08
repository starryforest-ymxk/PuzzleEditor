import React from 'react';
import { Database, Code, Zap, Layers, Search, Plus } from 'lucide-react';
import type { BlackboardViewState } from '../../store/types';
import type { BlackboardTabProps } from './BlackboardTabProps';
import { ScriptCreationMenu } from './ScriptCreationMenu';
type TabType = 'Variables' | 'Scripts' | 'Events' | 'Graphs';

const TabIcons: Record<TabType, React.ReactNode> = {
  Variables: <Database size={14} />,
  Scripts: <Code size={14} />,
  Events: <Zap size={14} />,
  Graphs: <Layers size={14} />,
};

export function BlackboardToolbar({
  view,
  actions,
  persistState,
}: {
  view: BlackboardViewState;
  actions: BlackboardTabProps['actions'];
  persistState: (next: Partial<BlackboardViewState>) => void;
}) {
  const { activeTab, filter, stateFilter = 'ALL', varTypeFilter = 'ALL' } = view;
  const { handleAddVariable, handleAddEvent, handleAddPresentationGraph } = actions;
  return (
    <>
      {/* Header with Compact Tabs */}
      <div className="blackboard-header">
        {/* Compact Tab Buttons */}
        <div className="blackboard-tabs">
          {(['Variables', 'Scripts', 'Events', 'Graphs'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                persistState({ activeTab: tab });
              }}
              className={`tab-button ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
            >
              {TabIcons[tab]}
              {tab}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="blackboard-search">
          <Search size={14} className="blackboard-search-icon" />
          <input
            type="text"
            className="search-input ui-control"
            placeholder="Search..."
            value={filter}
            onChange={(e) => {
              persistState({ filter: e.target.value });
            }}
          />
        </div>

        {/* State / Type Filters */}
        <div className="blackboard-filters">
          {activeTab === 'Variables' && (
            <button className="btn-primary btn-sm blackboard-action" onClick={handleAddVariable}>
              <Plus size={14} /> New Variable
            </button>
          )}
          {activeTab === 'Events' && (
            <button className="btn-primary btn-sm blackboard-action" onClick={handleAddEvent}>
              <Plus size={14} /> New Event
            </button>
          )}
          {activeTab === 'Scripts' && <ScriptCreationMenu onCreate={actions.handleAddScript} />}
          {activeTab === 'Graphs' && (
            <button
              className="btn-primary btn-sm blackboard-action"
              onClick={handleAddPresentationGraph}
            >
              <Plus size={14} /> New Presentation
            </button>
          )}

          <select
            className="filter-select ui-control"
            value={stateFilter}
            onChange={(e) => {
              const next = e.target.value as typeof stateFilter;
              persistState({ stateFilter: next });
            }}
          >
            <option value="ALL">State: All</option>
            <option value="Draft">State: Draft</option>
            <option value="Implemented">State: Implemented</option>
            <option value="MarkedForDelete">State: Deleted</option>
          </select>
          {activeTab === 'Variables' && (
            <select
              className="filter-select ui-control"
              value={varTypeFilter}
              onChange={(e) => {
                const next = e.target.value as typeof varTypeFilter;
                persistState({ varTypeFilter: next });
              }}
            >
              <option value="ALL">Type: All</option>
              <option value="boolean">boolean</option>
              <option value="integer">integer</option>
              <option value="float">float</option>
              <option value="string">string</option>
            </select>
          )}
        </div>
      </div>
    </>
  );
}
