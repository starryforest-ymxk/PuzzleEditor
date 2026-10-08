import React from 'react';
import type { ConditionExpression } from '../../../types/stateMachine';
import type { VariableDefinition } from '../../../types/blackboard';
import type { ScriptDefinition } from '../../../types/manifest';
import type { DragState } from './types';
import { isGroupType } from '../../../utils/conditionBuilder';
import { AddDropdown } from './AddDropdown';
import { LeafConditionEditor } from './LeafConditionEditor';
interface GroupChildrenProps {
  children: ConditionExpression[];
  childCount: number;
  groupType: 'And' | 'Or' | 'Not';
  canAdd: boolean;
  dragState: DragState;
  variables: VariableDefinition[];
  conditionScripts: ScriptDefinition[];
  onChange?: (condition: ConditionExpression | undefined) => void;
  onChildChange: (index: number, child: ConditionExpression) => void;
  onRemoveChild: (index: number) => void;
  onAddCondition: () => void;
  onAddGroup: () => void;
  onDragStart: (index: number) => (e: React.DragEvent) => void;
  onDragOver: (index: number) => (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (index: number) => (e: React.DragEvent) => void;
  renderGroup: (child: ConditionExpression, index: number) => React.ReactNode;
}
/** 通过渲染回调组合递归组，子列表无需反向导入父编辑器。 */
export function GroupChildren({
  children,
  childCount,
  groupType,
  canAdd,
  dragState,
  variables,
  conditionScripts,
  onChange,
  onChildChange,
  onRemoveChild,
  onAddCondition,
  onAddGroup,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  renderGroup,
}: GroupChildrenProps) {
  const add = () =>
    onChange && (
      <AddDropdown
        onAddCondition={onAddCondition}
        onAddGroup={onAddGroup}
        disabled={!canAdd}
        disabledReason={
          !canAdd && groupType === 'Not' ? 'Not group allows only one condition' : undefined
        }
      />
    );
  return (
    <div className={childCount ? 'condition-children' : 'condition-children-empty'}>
      {childCount === 0 && (
        <div className="condition-empty-row condition-empty-inner">
          <span className="condition-empty-text">Empty: No conditions (Always true)</span>
          {add()}
        </div>
      )}
      <div className="condition-child-list">
        {children.map((child, index) => (
          <div
            key={index}
            className={`condition-child ${dragState.dragIdx === index ? 'condition-child-dragging' : ''} ${dragState.dropIdx === index && dragState.dragIdx !== index ? 'condition-child-drop' : ''}`}
            onDragOver={onDragOver(index)}
            onDrop={onDrop(index)}
          >
            {isGroupType(child.type) ? (
              renderGroup(child, index)
            ) : (
              <LeafConditionEditor
                condition={child}
                onChange={onChange ? (next) => onChildChange(index, next) : undefined}
                onRemove={onChange ? () => onRemoveChild(index) : undefined}
                showDragHandle={true}
                onDragStart={onChange ? onDragStart(index) : undefined}
                onDragEnd={onDragEnd}
                variables={variables}
                conditionScripts={conditionScripts}
              />
            )}
          </div>
        ))}
      </div>
      {childCount > 0 && onChange && <div className="condition-add-row">{add()}</div>}
    </div>
  );
}
