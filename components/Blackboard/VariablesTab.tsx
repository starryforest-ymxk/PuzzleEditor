import React from 'react';
import type { BlackboardTabProps } from './BlackboardTabProps';
import { useResourceReorder } from '../../hooks/useResourceReorder';
import { DraggableCard } from './DraggableCard';
import { SectionHeader } from './SectionHeader';
import { VariableCard } from './VariableCard';
import { LocalVariableCard } from './LocalVariableCard';
import type { LocalVarWithScope } from '../../types/blackboard';
import { localVariableKey } from '../../utils/blackboard';

/** Variables 页签负责分组展示；资源更新通过意图回调提交。 */
export function VariablesTab({
  data,
  actions,
  selection,
  expandedSections,
  toggleSection,
}: BlackboardTabProps) {
  const {
    filteredVariables,
    filteredLocalVariables,
    stageLocalVariables,
    nodeLocalVariables,
    localVariablesByScope,
    globalVariableRefCounts,
    localVariableRefCounts,
  } = data;
  const { handleSelectVariable, handleDoubleClickLocalVariable } = actions;
  const reorder = useResourceReorder();
  const variablesDrag = reorder('global-variable', filteredVariables, actions.reorderVariables);
  const createLocalVarDragHandlers = (
    scopeType: 'Stage' | 'Node',
    scopeId: string,
    variables: LocalVarWithScope[],
  ) =>
    reorder(`local-var-${scopeType}-${scopeId}`, variables, (ids) =>
      actions.reorderLocalVariables(scopeType, scopeId, ids),
    );
  return (
    <>
      <SectionHeader
        title="Global Variables"
        count={filteredVariables.length}
        expanded={expandedSections['global'] ?? true}
        onToggle={() => toggleSection('global')}
      />
      {(expandedSections['global'] ?? true) && (
        <div className="card-grid card-grid--with-margin">
          {filteredVariables.length === 0 ? (
            <div className="empty-state empty-state--inline">No global variables defined</div>
          ) : (
            filteredVariables.map((v, idx) => (
              <DraggableCard
                key={v.id}
                id={v.id}
                dragType="global-variable"
                index={idx}
                {...variablesDrag}
              >
                <VariableCard
                  variable={v}
                  isSelected={selection.type === 'VARIABLE' && selection.id === v.id}
                  onClick={() => handleSelectVariable(v.id)}
                  referenceCount={globalVariableRefCounts[v.id]}
                />
              </DraggableCard>
            ))
          )}
        </div>
      )}
      <SectionHeader
        title="Local Variables"
        count={filteredLocalVariables.length}
        expanded={expandedSections['local'] ?? true}
        onToggle={() => toggleSection('local')}
      />
      {(expandedSections['local'] ?? true) && (
        <>
          {/* Stage Local Variables */}
          <SectionHeader
            title="Stage Local"
            count={stageLocalVariables.length}
            expanded={expandedSections['local:Stage'] ?? true}
            onToggle={() => toggleSection('local:Stage')}
            level={2}
          />
          {(expandedSections['local:Stage'] ?? true) && (
            <div className="card-grid card-grid--with-margin">
              {stageLocalVariables.length === 0 ? (
                <div className="empty-state empty-state--inline">No Stage local variables</div>
              ) : (
                (Object.entries(localVariablesByScope) as [string, LocalVarWithScope[]][])
                  .filter(([key]) => key.startsWith('Stage-'))
                  .map(([scopeKey, scopeVars]) => {
                    const { scopeType, scopeId } = scopeVars[0];
                    const handlers = createLocalVarDragHandlers(scopeType, scopeId, scopeVars);
                    return scopeVars.map((v, idx) => (
                      <DraggableCard
                        key={`${v.scopeType}-${v.scopeId}-${v.id}`}
                        id={v.id}
                        dragType={`local-var-${scopeKey}`}
                        index={idx}
                        onDragStart={handlers.onDragStart}
                        onDragOver={handlers.onDragOver}
                        onDragEnd={handlers.onDragEnd}
                      >
                        <LocalVariableCard
                          variable={v}
                          isSelected={selection.type === 'VARIABLE' && selection.id === v.id}
                          onClick={() => handleSelectVariable(v.id)}
                          onDoubleClick={() => handleDoubleClickLocalVariable(v)}
                          referenceCount={localVariableRefCounts[localVariableKey(v)]}
                        />
                      </DraggableCard>
                    ));
                  })
              )}
            </div>
          )}

          {/* Node Local Variables */}
          <SectionHeader
            title="Node Local"
            count={nodeLocalVariables.length}
            expanded={expandedSections['local:Node'] ?? true}
            onToggle={() => toggleSection('local:Node')}
            level={2}
          />
          {(expandedSections['local:Node'] ?? true) && (
            <div className="card-grid card-grid--with-margin">
              {nodeLocalVariables.length === 0 ? (
                <div className="empty-state empty-state--inline">No Node local variables</div>
              ) : (
                (Object.entries(localVariablesByScope) as [string, LocalVarWithScope[]][])
                  .filter(([key]) => key.startsWith('Node-'))
                  .map(([scopeKey, scopeVars]) => {
                    const { scopeType, scopeId } = scopeVars[0];
                    const handlers = createLocalVarDragHandlers(scopeType, scopeId, scopeVars);
                    return scopeVars.map((v, idx) => (
                      <DraggableCard
                        key={`${v.scopeType}-${v.scopeId}-${v.id}`}
                        id={v.id}
                        dragType={`local-var-${scopeKey}`}
                        index={idx}
                        onDragStart={handlers.onDragStart}
                        onDragOver={handlers.onDragOver}
                        onDragEnd={handlers.onDragEnd}
                      >
                        <LocalVariableCard
                          variable={v}
                          isSelected={selection.type === 'VARIABLE' && selection.id === v.id}
                          onClick={() => handleSelectVariable(v.id)}
                          onDoubleClick={() => handleDoubleClickLocalVariable(v)}
                          referenceCount={localVariableRefCounts[localVariableKey(v)]}
                        />
                      </DraggableCard>
                    ));
                  })
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
