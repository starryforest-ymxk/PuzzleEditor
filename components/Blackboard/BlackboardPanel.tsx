/**
 * components/Blackboard/BlackboardPanel.tsx
 * 黑板资源面板 - 显示全局变量和事件的只读列表视图
 * 
 * 根据 UX_Flow 第3节：
 * - 显示 Global Variables（只读列表）
 * - 显示 Events（只读列表）
 * - 支持状态标记：Draft/Implemented/MarkedForDelete
 * - 软删除：MarkedForDelete 条目变灰显示
 */

import React, { useMemo, useState } from 'react';
import { useEditorDispatch, useEditorState } from '../../store/context';
import { ResourceState } from '../../types/common';
import { VariableDefinition, EventDefinition } from '../../types/blackboard';

// ========== 辅助组件：状态标签 ==========
interface StateBadgeProps {
  state: ResourceState;
}

/**
 * 资源状态徽标
 * Draft: 蓝色 | Implemented: 绿色 | MarkedForDelete: 红色(变灰)
 */
const StateBadge: React.FC<StateBadgeProps> = ({ state }) => {
  const getStyle = (): React.CSSProperties => {
    switch (state) {
      case 'Draft':
        return { background: '#264f78', color: '#9cdcfe' };
      case 'Implemented':
        return { background: '#2e4d2e', color: '#6a9955' };
      case 'MarkedForDelete':
        return { background: '#4a2020', color: '#f44747' };
      default:
        return { background: '#333', color: '#aaa' };
    }
  };

  return (
    <span style={{
      fontSize: '9px',
      padding: '1px 4px',
      borderRadius: '2px',
      textTransform: 'uppercase',
      fontWeight: 500,
      ...getStyle()
    }}>
      {state === 'MarkedForDelete' ? 'Deleted' : state}
    </span>
  );
};

// ========== 辅助组件：变量条目 ==========
interface VariableRowProps {
  variable: VariableDefinition;
}

/**
 * 变量条目行 - 显示名称、类型、状态
 * MarkedForDelete 状态显示为灰色
 */
const VariableRow: React.FC<VariableRowProps> = ({ variable }) => {
  const isDeleted = variable.state === 'MarkedForDelete';

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'boolean': return '#569cd6';
      case 'integer': return '#b5cea8';
      case 'float': return '#4ec9b0';
      case 'string': return '#ce9178';
      default: return '#9cdcfe';
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 12px',
      borderBottom: '1px solid #2a2a2a',
      opacity: isDeleted ? 0.5 : 1,
      backgroundColor: isDeleted ? 'rgba(244, 71, 71, 0.05)' : 'transparent'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          color: getTypeColor(variable.type),
          fontSize: '9px',
          fontFamily: 'monospace',
          textTransform: 'uppercase'
        }}>
          {variable.type}
        </span>
        <span style={{ color: '#ddd', fontSize: '12px' }}>{variable.name}</span>
      </div>
      <StateBadge state={variable.state} />
    </div>
  );
};

// ========== 辅助组件：事件条目 ==========
interface EventRowProps {
  event: EventDefinition;
}

/**
 * 事件条目行 - 显示名称和状态
 */
const EventRow: React.FC<EventRowProps> = ({ event }) => {
  const isDeleted = event.state === 'MarkedForDelete';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 12px',
      borderBottom: '1px solid #2a2a2a',
      opacity: isDeleted ? 0.5 : 1,
      backgroundColor: isDeleted ? 'rgba(244, 71, 71, 0.05)' : 'transparent'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#dcdcaa', fontSize: '11px' }}>⚡</span>
        <span style={{ color: '#ddd', fontSize: '12px' }}>{event.name}</span>
      </div>
      <StateBadge state={event.state} />
    </div>
  );
};

// ========== 主面板组件 ==========
type TabType = 'Variables' | 'Events';

/**
 * 黑板面板 - 在左侧边栏显示全局资源列表
 * 阶段一功能：仅读模式，显示变量和事件
 */
export const BlackboardPanel: React.FC = () => {
  const { project } = useEditorState();
  const [activeTab, setActiveTab] = useState<TabType>('Variables');
  const [filter, setFilter] = useState('');

  // 从 Store 获取黑板数据
  const { globalVariables, events } = project.blackboard || { globalVariables: {}, events: {} };

  const variableList: VariableDefinition[] = useMemo(() => Object.values(globalVariables || {}) as VariableDefinition[], [globalVariables]);
  const eventList: EventDefinition[] = useMemo(() => Object.values(events || {}) as EventDefinition[], [events]);

  // 过滤后的变量列表
  const filteredVariables = useMemo(() => {
    const vars = variableList;
    if (!filter.trim()) return vars;
    return vars.filter(v =>
      v.name.toLowerCase().includes(filter.toLowerCase()) ||
      v.key.toLowerCase().includes(filter.toLowerCase())
    );
  }, [variableList, filter]);

  // 过滤后的事件列表
  const filteredEvents = useMemo(() => {
    const evts = eventList;
    if (!filter.trim()) return evts;
    return evts.filter(e =>
      e.name.toLowerCase().includes(filter.toLowerCase()) ||
      e.key.toLowerCase().includes(filter.toLowerCase())
    );
  }, [eventList, filter]);

  const tabs: TabType[] = ['Variables', 'Events'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab 切换 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '6px 8px',
              fontSize: '10px',
              fontWeight: activeTab === tab ? 600 : 400,
              background: activeTab === tab ? '#1e1e1e' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #4fc3f7' : '2px solid transparent',
              color: activeTab === tab ? '#4fc3f7' : '#888',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 搜索过滤 */}
      <div style={{ padding: '8px' }}>
        <input
          type="text"
          placeholder="Search..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: '11px',
            background: '#1e1e1e',
            border: '1px solid #333',
            borderRadius: '3px',
            color: '#ddd',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* 列表内容 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'Variables' && (
          <>
            {filteredVariables.length === 0 ? (
              <div style={{ color: '#666', fontSize: '11px', padding: '12px', textAlign: 'center' }}>
                No variables found
              </div>
            ) : (
              filteredVariables.map(v => <VariableRow key={v.id} variable={v} />)
            )}
          </>
        )}

        {activeTab === 'Events' && (
          <>
            {filteredEvents.length === 0 ? (
              <div style={{ color: '#666', fontSize: '11px', padding: '12px', textAlign: 'center' }}>
                No events found
              </div>
            ) : (
              filteredEvents.map(e => <EventRow key={e.id} event={e} />)
            )}
          </>
        )}
      </div>
    </div>
  );
};
