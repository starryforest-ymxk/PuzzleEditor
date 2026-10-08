import React from 'react';
import type { BlackboardTabProps } from './BlackboardTabProps';
import { useResourceReorder } from '../../hooks/useResourceReorder';
import { DraggableCard } from './DraggableCard';
import { EventCard } from './EventCard';

/** Events 页签负责分组展示；资源更新通过意图回调提交。 */
export function EventsTab({ data, actions, selection }: BlackboardTabProps) {
  const { filteredEvents, eventRefCounts } = data;
  const { handleSelectEvent } = actions;
  const reorder = useResourceReorder();
  const eventsDrag = reorder('event', filteredEvents, actions.reorderEvents);
  return (
    <div className="card-grid">
      {filteredEvents.length === 0 ? (
        <div className="empty-state empty-state--inline blackboard-empty-events">
          No events defined
        </div>
      ) : (
        filteredEvents.map((e, idx) => (
          <DraggableCard key={e.id} id={e.id} dragType="event" index={idx} {...eventsDrag}>
            <EventCard
              event={e}
              isSelected={selection.type === 'EVENT' && selection.id === e.id}
              onClick={() => handleSelectEvent(e.id)}
              referenceCount={eventRefCounts[e.id] || 0}
            />
          </DraggableCard>
        ))
      )}
    </div>
  );
}
