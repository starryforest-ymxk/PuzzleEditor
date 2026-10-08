import React from 'react';
import type { BlackboardTabProps } from './BlackboardTabProps';
import { useResourceReorder } from '../../hooks/useResourceReorder';
import { DraggableCard } from './DraggableCard';
import { SectionHeader } from './SectionHeader';
import { GraphCard } from './GraphCard';
import { FsmCard } from './FsmCard';

/** Graphs 页签负责分组展示；资源更新通过意图回调提交。 */
export function GraphsTab({
  data,
  actions,
  selection,
  expandedSections,
  toggleSection,
}: BlackboardTabProps) {
  const { filteredFsms, filteredGraphs, fsmOwnerNames, graphRefCounts } = data;
  const { handleSelectFsm, handleOpenFsm, handleSelectGraph, handleOpenGraph } = actions;
  const reorder = useResourceReorder();
  const fsmsDrag = reorder('fsm', filteredFsms, actions.reorderFsms);
  const graphsDrag = reorder('presentation-graph', filteredGraphs, actions.reorderGraphs);
  return (
    <>
      {/* State Machines Section */}
      <SectionHeader
        title="State Machines"
        count={filteredFsms.length}
        expanded={expandedSections['fsm'] ?? true}
        onToggle={() => toggleSection('fsm')}
      />
      {(expandedSections['fsm'] ?? true) && (
        <div className="card-grid blackboard-fsm-grid">
          {filteredFsms.length === 0 ? (
            <div className="empty-state empty-state--inline">No state machines defined</div>
          ) : (
            filteredFsms.map((fsm, idx) => (
              <DraggableCard key={fsm.id} id={fsm.id} dragType="fsm" index={idx} {...fsmsDrag}>
                <FsmCard
                  fsm={fsm}
                  ownerName={fsmOwnerNames[fsm.id]}
                  isSelected={selection.type === 'FSM' && selection.id === fsm.id}
                  onClick={() => handleSelectFsm(fsm.id)}
                  onDoubleClick={() => handleOpenFsm(fsm.id)}
                />
              </DraggableCard>
            ))
          )}
        </div>
      )}
      {/* Presentation Graphs Section */}
      <SectionHeader
        title="Presentation Graphs"
        count={filteredGraphs.length}
        expanded={expandedSections['presentation'] ?? true}
        onToggle={() => toggleSection('presentation')}
      />
      {(expandedSections['presentation'] ?? true) && (
        <div className="card-grid">
          {filteredGraphs.length === 0 ? (
            <div className="empty-state empty-state--inline">No presentation graphs defined</div>
          ) : (
            filteredGraphs.map((g, idx) => (
              <DraggableCard
                key={g.id}
                id={g.id}
                dragType="presentation-graph"
                index={idx}
                {...graphsDrag}
              >
                <GraphCard
                  graph={g}
                  isSelected={selection.type === 'PRESENTATION_GRAPH' && selection.id === g.id}
                  onClick={() => handleSelectGraph(g.id)}
                  onDoubleClick={() => handleOpenGraph(g.id)}
                  referenceCount={graphRefCounts[g.id] || 0}
                />
              </DraggableCard>
            ))
          )}
        </div>
      )}
    </>
  );
}
