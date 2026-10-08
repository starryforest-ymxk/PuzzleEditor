import React from 'react';
import type { BlackboardTabProps } from './BlackboardTabProps';
import { useResourceReorder } from '../../hooks/useResourceReorder';
import { DraggableCard } from './DraggableCard';
import { SectionHeader } from './SectionHeader';
import { ScriptCard } from './ScriptCard';
import type { ScriptDefinition } from '../../types/manifest';
import type { ScriptCategory } from '../../types/common';

/** Scripts 页签负责分组展示；资源更新通过意图回调提交。 */
export function ScriptsTab({
  data,
  actions,
  selection,
  expandedSections,
  toggleSection,
}: BlackboardTabProps) {
  const { lifecycleGroups, scriptGroups, scriptRefCounts } = data;
  const { handleSelectScript } = actions;
  const reorder = useResourceReorder();
  const createScriptDragHandlers = (
    category: string,
    lifecycleType: string | undefined,
    scripts: ScriptDefinition[],
  ) =>
    reorder(`script-${category}-${lifecycleType}`, scripts, (ids) =>
      actions.reorderScripts(category, lifecycleType, ids),
    );
  return (
    <>
      {/* Lifecycle first, with nested groups */}
      <SectionHeader
        title="Lifecycle Scripts"
        count={
          lifecycleGroups.Stage.length + lifecycleGroups.Node.length + lifecycleGroups.State.length
        }
        expanded={expandedSections['Lifecycle'] ?? true}
        onToggle={() => toggleSection('Lifecycle')}
      />
      {(expandedSections['Lifecycle'] ?? true) && (
        <>
          {[
            ['Stage', 'Lifecycle · Stage'] as const,
            ['Node', 'Lifecycle · Node'] as const,
            ['State', 'Lifecycle · State'] as const,
          ].map(([key, title]) => {
            const scripts = lifecycleGroups[key as 'Stage' | 'Node' | 'State'];
            const handlers = createScriptDragHandlers('Lifecycle', key, scripts);
            return (
              <React.Fragment key={key}>
                <SectionHeader
                  title={title}
                  count={scripts.length}
                  expanded={expandedSections[`Lifecycle:${key}`] ?? true}
                  onToggle={() => toggleSection(`Lifecycle:${key}`)}
                  level={2}
                />
                {(expandedSections[`Lifecycle:${key}`] ?? true) && (
                  <div className="card-grid card-grid--with-margin">
                    {scripts.length === 0 ? (
                      <div className="empty-state empty-state--inline">No lifecycle scripts</div>
                    ) : (
                      scripts.map((s, idx) => (
                        <DraggableCard
                          key={s.id}
                          id={s.id}
                          dragType={`script-lifecycle-${key}`}
                          index={idx}
                          onDragStart={handlers.onDragStart}
                          onDragOver={handlers.onDragOver}
                          onDragEnd={handlers.onDragEnd}
                        >
                          <ScriptCard
                            script={s}
                            isSelected={selection.type === 'SCRIPT' && selection.id === s.id}
                            onClick={() => handleSelectScript(s.id)}
                            referenceCount={scriptRefCounts[s.id]}
                          />
                        </DraggableCard>
                      ))
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </>
      )}

      {/* Then Performance, Condition, Trigger in order */}
      {(['Performance', 'Condition', 'Trigger'] as Exclude<ScriptCategory, 'Lifecycle'>[]).map(
        (category) => {
          const scripts = scriptGroups[category];
          const handlers = createScriptDragHandlers(category, undefined, scripts);
          return (
            <React.Fragment key={category}>
              <SectionHeader
                title={`${category} Scripts`}
                count={scripts.length}
                expanded={expandedSections[category] ?? true}
                onToggle={() => toggleSection(category)}
              />
              {(expandedSections[category] ?? true) && (
                <div className="card-grid card-grid--with-margin">
                  {scripts.length === 0 ? (
                    <div className="empty-state empty-state--inline">
                      No {category.toLowerCase()} scripts
                    </div>
                  ) : (
                    scripts.map((s, idx) => (
                      <DraggableCard
                        key={s.id}
                        id={s.id}
                        dragType={`script-${category}`}
                        index={idx}
                        onDragStart={handlers.onDragStart}
                        onDragOver={handlers.onDragOver}
                        onDragEnd={handlers.onDragEnd}
                      >
                        <ScriptCard
                          script={s}
                          isSelected={selection.type === 'SCRIPT' && selection.id === s.id}
                          onClick={() => handleSelectScript(s.id)}
                          referenceCount={scriptRefCounts[s.id]}
                        />
                      </DraggableCard>
                    ))
                  )}
                </div>
              )}
            </React.Fragment>
          );
        },
      )}
    </>
  );
}
