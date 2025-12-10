/**
 * components/Blackboard/BlackboardPanel.tsx
 * 黑板管理视图 - 显示变量/脚本/事件的三页签只读视图
 *
 * 布局要求：
 * - 左上角紧凑页签
 * - 卡片式条目展示 (内容集中)
 * - 右侧 Inspector (由 MainLayout 提供)
 */

import React, { useMemo, useState } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ResourceState, ScriptCategory } from '../../types/common';
import { VariableDefinition, EventDefinition } from '../../types/blackboard';
import { ScriptDefinition } from '../../types/manifest';
import { PresentationGraph } from '../../types/presentation';
import { StateMachine } from '../../types/stateMachine';
import { Database, Code, Zap, Search, ChevronDown, ChevronRight, Info, Layers } from 'lucide-react';

// ========== 工具函数 ==========
const getStateColor = (state: ResourceState) => {
  switch (state) {
    case 'Draft': return { bg: 'rgba(249,115,22,0.15)', color: 'var(--accent-warning)' };
    case 'Implemented': return { bg: 'rgba(34,197,94,0.15)', color: 'var(--accent-success)' };
    case 'MarkedForDelete': return { bg: 'rgba(239,68,68,0.15)', color: 'var(--accent-error)' };
    default: return { bg: 'var(--panel-bg)', color: 'var(--text-secondary)' };
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'boolean': return '#60a5fa';
    case 'integer': return '#a3e635';
    case 'float': return '#2dd4bf';
    case 'string': return '#fbbf24';
    case 'enum': return '#c084fc';
    default: return 'var(--text-secondary)';
  }
};

// ========== 辅助组件 ==========
const StateBadge: React.FC<{ state: ResourceState }> = ({ state }) => {
  const styles = getStateColor(state);
  return (
    <span style={{
      fontSize: '9px',
      padding: '2px 6px',
      borderRadius: 'var(--radius-sm)',
      textTransform: 'uppercase',
      fontWeight: 600,
      background: styles.bg,
      color: styles.color,
      border: `1px solid ${styles.color}`,
      letterSpacing: '0.5px'
    }}>
      {state === 'MarkedForDelete' ? 'DELETED' : state.toUpperCase()}
    </span>
  );
};

// ========== Tab Definitions ==========
type TabType = 'Variables' | 'Scripts' | 'Events' | 'Graphs';

const TabIcons: Record<TabType, React.ReactNode> = {
  Variables: <Database size={14} />,
  Scripts: <Code size={14} />,
  Events: <Zap size={14} />,
  Graphs: <Layers size={14} />
};

// ========== Main Component ==========
export const BlackboardPanel: React.FC = () => {
  const { project, ui } = useEditorState();
  const dispatch = useEditorDispatch();
  // 跨视图记忆：默认使用全局 UI 状态，若缺失则退回初始值
  const [activeTab, setActiveTab] = useState<TabType>((ui.blackboardView.activeTab as TabType) || 'Variables');
  const [filter, setFilter] = useState(ui.blackboardView.filter || '');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(ui.blackboardView.expandedSections || {
    global: true, local: true,
    Performance: true, Lifecycle: true, Condition: true, Trigger: true,
    fsm: true, presentation: true
  });
  const [stateFilter, setStateFilter] = useState<'ALL' | 'Draft' | 'Implemented' | 'MarkedForDelete'>(ui.blackboardView.stateFilter || 'ALL');
  const [varTypeFilter, setVarTypeFilter] = useState<'ALL' | 'boolean' | 'integer' | 'float' | 'string' | 'enum'>(ui.blackboardView.varTypeFilter || 'ALL');

  // Data Sources
  const { globalVariables, events } = project.blackboard || { globalVariables: {}, events: {} };
  const scriptsRecord = project.scripts?.scripts || {};

  const variableList = useMemo(() => Object.values(globalVariables || {}) as VariableDefinition[], [globalVariables]);
  const eventList = useMemo(() => Object.values(events || {}) as EventDefinition[], [events]);
  const scriptList = useMemo(() => Object.values(scriptsRecord) as ScriptDefinition[], [scriptsRecord]);
  const graphList = useMemo(() => Object.values(project.presentationGraphs || {}) as PresentationGraph[], [project.presentationGraphs]);
  const fsmList = useMemo(() => Object.values(project.stateMachines || {}) as StateMachine[], [project.stateMachines]);

  // Collect local variables from Stages and Nodes with scope info
  interface LocalVarWithScope extends VariableDefinition {
    scopeType: 'Stage' | 'Node';
    scopeName: string;
    scopeId: string;
  }
  const localVariableList = useMemo<LocalVarWithScope[]>(() => {
    const result: LocalVarWithScope[] = [];
    // Stage local variables
    Object.values(project.stageTree.stages || {}).forEach(stage => {
      if (stage.localVariables) {
        Object.values(stage.localVariables).forEach(v => {
          result.push({ ...v, scopeType: 'Stage', scopeName: stage.name, scopeId: stage.id });
        });
      }
    });
    // Node local variables
    Object.values(project.nodes || {}).forEach(node => {
      if (node.localVariables) {
        Object.values(node.localVariables).forEach(v => {
          result.push({ ...v, scopeType: 'Node', scopeName: node.name, scopeId: node.id });
        });
      }
    });
    return result;
  }, [project.stageTree.stages, project.nodes]);

  // Filtered Data
  const filterFn = <T extends { name: string; key: string }>(list: T[]) => {
    if (!filter.trim()) return list;
    const lowerFilter = filter.toLowerCase();
    return list.filter(item => item.name.toLowerCase().includes(lowerFilter) || item.key.toLowerCase().includes(lowerFilter));
  };
  const matchState = (s?: ResourceState) => stateFilter === 'ALL' || s === stateFilter;
  const matchVarType = (type?: string) => varTypeFilter === 'ALL' || type === varTypeFilter;

  const filteredVariables = filterFn(variableList).filter(v => matchState(v.state) && matchVarType((v as any).type));
  const filteredEvents = filterFn(eventList).filter(e => matchState(e.state));
  const filteredScripts = filterFn(scriptList).filter(s => matchState(s.state));
  const filteredLocalVariables = useMemo(() => {
    const lowerFilter = filter.toLowerCase();
    return localVariableList.filter(v => {
      const textMatch = !filter.trim()
        || v.name.toLowerCase().includes(lowerFilter)
        || v.key.toLowerCase().includes(lowerFilter)
        || v.scopeName.toLowerCase().includes(lowerFilter);
      return textMatch && matchState(v.state) && matchVarType(v.type);
    });
  }, [localVariableList, filter, stateFilter, varTypeFilter]);

  // Group Scripts by Category
  const scriptGroups = useMemo(() => {
    const groups: Record<ScriptCategory, ScriptDefinition[]> = {
      Performance: [], Lifecycle: [], Condition: [], Trigger: []
    };
    filteredScripts.forEach(s => {
      if (groups[s.category]) groups[s.category].push(s);
    });
    return groups;
  }, [filteredScripts]);

  const persistState = (next: Partial<{ activeTab: TabType; filter: string; expandedSections: Record<string, boolean>; stateFilter: typeof stateFilter; varTypeFilter: typeof varTypeFilter }>) => {
    dispatch({ type: 'SET_BLACKBOARD_VIEW', payload: next });
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = { ...prev, [key]: !prev[key] };
      persistState({ expandedSections: next });
      return next;
    });
  };

  // Selection Helpers
  const handleSelectVariable = (id: string) => {
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'VARIABLE', id } });
  };

  const handleSelectScript = (id: string) => {
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'SCRIPT', id } });
  };

  const handleSelectEvent = (id: string) => {
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'EVENT', id } });
  };

  const handleSelectGraph = (id: string) => {
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_GRAPH', id } });
  };

  const handleOpenGraph = (id: string) => {
    // Double-click to open presentation graph editor
    dispatch({ type: 'NAVIGATE_TO', payload: { graphId: id, stageId: null, nodeId: null } });
  };

  const handleSelectFsm = (id: string) => {
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'FSM', id } });
  };

  const handleOpenFsm = (fsmId: string) => {
    // Find the node that owns this FSM and navigate to it
    const ownerNode = Object.values(project.nodes).find(n => n.stateMachineId === fsmId);
    if (ownerNode) {
      dispatch({ type: 'NAVIGATE_TO', payload: { nodeId: ownerNode.id, stageId: ownerNode.stageId, graphId: null } });
    }
  };

  // ========== Render Helpers ==========
  const renderSectionHeader = (title: string, count: number, key: string) => (
    <div
      onClick={() => toggleSection(key)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', cursor: 'pointer',
        background: 'var(--panel-header-bg)', borderBottom: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)', marginBottom: '8px',
        userSelect: 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {expandedSections[key] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
      </div>
      <span style={{ fontSize: '10px', color: 'var(--text-dim)', background: 'var(--bg-color)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>{count}</span>
    </div>
  );

  // Card-style Variable Item
  const renderVariableCard = (v: VariableDefinition) => {
    const isDeleted = v.state === 'MarkedForDelete';
    const isSelected = ui.selection.type === 'VARIABLE' && ui.selection.id === v.id;
    return (
      <div
        key={v.id}
        onClick={() => handleSelectVariable(v.id)}
        className={`overview-card ${isSelected ? 'selected' : ''}`}
        style={{
          opacity: isDeleted ? 0.5 : 1,
          cursor: 'pointer',
          marginBottom: '8px',
          height: 'auto',
          padding: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{v.name}</span>
          <StateBadge state={v.state} />
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace', marginBottom: '6px' }}>{v.key}</div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Type: </span>
            <span style={{ color: getTypeColor(v.type), fontFamily: 'monospace' }}>{v.type}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Default: </span>
            <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{v.defaultValue !== undefined ? String(v.defaultValue) : '-'}</span>
          </div>
        </div>
        {v.description && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{v.description}</div>
        )}
      </div>
    );
  };

  // Card-style Local Variable Item (with scope info)
  const renderLocalVariableCard = (v: LocalVarWithScope) => {
    const isDeleted = v.state === 'MarkedForDelete';
    const isSelected = ui.selection.type === 'VARIABLE' && ui.selection.id === v.id;
    const scopeColor = v.scopeType === 'Stage' ? '#4fc1ff' : '#ce9178';
    return (
      <div
        key={v.id}
        onClick={() => handleSelectVariable(v.id)}
        className={`overview-card ${isSelected ? 'selected' : ''}`}
        style={{
          opacity: isDeleted ? 0.5 : 1,
          cursor: 'pointer',
          marginBottom: '8px',
          height: 'auto',
          padding: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{v.name}</span>
          <StateBadge state={v.state} />
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace', marginBottom: '6px' }}>{v.key}</div>
        {/* Scope Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', padding: '4px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: '3px' }}>
          <span style={{ fontSize: '10px', color: '#888' }}>Scope:</span>
          <span style={{ fontSize: '10px', color: scopeColor, fontWeight: 500 }}>{v.scopeType}</span>
          <span style={{ fontSize: '10px', color: '#666' }}>→</span>
          <span style={{ fontSize: '10px', color: 'var(--text-primary)' }}>{v.scopeName}</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Type: </span>
            <span style={{ color: getTypeColor(v.type), fontFamily: 'monospace' }}>{v.type}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Default: </span>
            <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{v.defaultValue !== undefined ? String(v.defaultValue) : '-'}</span>
          </div>
        </div>
        {v.description && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{v.description}</div>
        )}
      </div>
    );
  };

  // Card-style Script Item
  const renderScriptCard = (s: ScriptDefinition) => {
    const isDeleted = s.state === 'MarkedForDelete';
    const isSelected = ui.selection.type === 'SCRIPT' && ui.selection.id === s.id;
    return (
      <div
        key={s.id}
        onClick={() => handleSelectScript(s.id)}
        className={`overview-card ${isSelected ? 'selected' : ''}`}
        style={{
          opacity: isDeleted ? 0.5 : 1,
          cursor: 'pointer',
          marginBottom: '8px',
          height: 'auto',
          padding: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{s.name}</span>
          <StateBadge state={s.state} />
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace', marginBottom: '6px' }}>{s.key}</div>
        <div style={{ fontSize: '11px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Category: </span>
          <span style={{ color: 'var(--accent-color)' }}>{s.category}</span>
        </div>
        {s.description && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{s.description}</div>
        )}
      </div>
    );
  };

  // Card-style Event Item
  const renderEventCard = (e: EventDefinition) => {
    const isDeleted = e.state === 'MarkedForDelete';
    const isSelected = ui.selection.type === 'EVENT' && ui.selection.id === e.id;
    return (
      <div
        key={e.id}
        onClick={() => handleSelectEvent(e.id)}
        className={`overview-card ${isSelected ? 'selected' : ''}`}
        style={{
          opacity: isDeleted ? 0.5 : 1,
          cursor: 'pointer',
          marginBottom: '8px',
          height: 'auto',
          padding: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={14} style={{ color: 'var(--accent-warning)' }} />
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{e.name}</span>
          </div>
          <StateBadge state={e.state} />
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>{e.key}</div>
        {e.description && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{e.description}</div>
        )}
      </div>
    );
  };

  // ========== Tab Content ==========
  const renderVariablesTab = () => (
    <>
      {renderSectionHeader('Global Variables', filteredVariables.length, 'global')}
      {expandedSections['global'] && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          {filteredVariables.length === 0
            ? <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '20px', fontSize: '12px' }}>No global variables defined</div>
            : filteredVariables.map(renderVariableCard)
          }
        </div>
      )}
      {renderSectionHeader('Local Variables', filteredLocalVariables.length, 'local')}
      {expandedSections['local'] && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {filteredLocalVariables.length === 0
            ? <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '20px', fontSize: '12px' }}>No local variables defined in Stages or Nodes</div>
            : filteredLocalVariables.map(renderLocalVariableCard)
          }
        </div>
      )}
    </>
  );

  const renderScriptsTab = () => (
    <>
      {(['Performance', 'Lifecycle', 'Condition', 'Trigger'] as ScriptCategory[]).map(category => (
        <React.Fragment key={category}>
          {renderSectionHeader(`${category} Scripts`, scriptGroups[category].length, category)}
          {expandedSections[category] && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              {scriptGroups[category].length === 0
                ? <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '16px', fontSize: '11px' }}>No {category.toLowerCase()} scripts</div>
                : scriptGroups[category].map(renderScriptCard)
              }
            </div>
          )}
        </React.Fragment>
      ))}
    </>
  );

  const renderEventsTab = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
      {filteredEvents.length === 0
        ? <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '40px', fontSize: '13px' }}>No events defined</div>
        : filteredEvents.map(renderEventCard)
      }
    </div>
  );

  // Card-style Graph Item
  const renderGraphCard = (g: PresentationGraph) => {
    const isSelected = ui.selection.type === 'PRESENTATION_GRAPH' && ui.selection.id === g.id;
    const nodeCount = Object.keys(g.nodes || {}).length;
    return (
      <div
        key={g.id}
        onClick={() => handleSelectGraph(g.id)}
        onDoubleClick={() => handleOpenGraph(g.id)}
        className={`overview-card ${isSelected ? 'selected' : ''}`}
        style={{
          cursor: 'pointer',
          marginBottom: '8px',
          height: 'auto',
          padding: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} style={{ color: '#c586c0' }} />
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{g.name}</span>
          </div>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace', marginBottom: '6px' }}>{g.id}</div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Nodes: </span>
            <span style={{ color: 'var(--accent-color)', fontFamily: 'monospace' }}>{nodeCount}</span>
          </div>
          {g.startNodeId && (
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Start: </span>
              <span style={{ color: '#4fc1ff', fontFamily: 'monospace' }}>{g.nodes[g.startNodeId]?.name || g.startNodeId}</span>
            </div>
          )}
        </div>
        <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-dim)' }}>
          Double-click to open
        </div>
      </div>
    );
  };

  const filteredGraphs = useMemo(() => {
    if (!filter.trim()) return graphList;
    const lowerFilter = filter.toLowerCase();
    return graphList.filter(g => g.name.toLowerCase().includes(lowerFilter) || g.id.toLowerCase().includes(lowerFilter));
  }, [graphList, filter]);

  const filteredFsms = useMemo(() => {
    if (!filter.trim()) return fsmList;
    const lowerFilter = filter.toLowerCase();
    return fsmList.filter(fsm => fsm.name.toLowerCase().includes(lowerFilter) || fsm.id.toLowerCase().includes(lowerFilter));
  }, [fsmList, filter]);

  // Card-style FSM Item
  const renderFsmCard = (fsm: StateMachine) => {
    const stateCount = Object.keys(fsm.states || {}).length;
    const transitionCount = Object.keys(fsm.transitions || {}).length;
    const initialState = fsm.initialStateId ? fsm.states[fsm.initialStateId] : null;
    const isSelected = ui.selection.type === 'FSM' && ui.selection.id === fsm.id;
    return (
      <div
        key={fsm.id}
        onClick={() => handleSelectFsm(fsm.id)}
        onDoubleClick={() => handleOpenFsm(fsm.id)}
        className={`overview-card ${isSelected ? 'selected' : ''}`}
        style={{
          cursor: 'pointer',
          marginBottom: '8px',
          height: 'auto',
          padding: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#4fc1ff', fontSize: '14px' }}>▶</span>
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{fsm.name}</span>
          </div>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace', marginBottom: '6px' }}>{fsm.id}</div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>States: </span>
            <span style={{ color: 'var(--accent-color)', fontFamily: 'monospace' }}>{stateCount}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Transitions: </span>
            <span style={{ color: 'var(--accent-warning)', fontFamily: 'monospace' }}>{transitionCount}</span>
          </div>
        </div>
        {initialState && (
          <div style={{ marginTop: '6px', fontSize: '11px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Initial: </span>
            <span style={{ color: '#4fc1ff', fontFamily: 'monospace' }}>{initialState.name}</span>
          </div>
        )}
      </div>
    );
  };

  const renderGraphsTab = () => (
    <>
      {/* State Machines Section */}
      {renderSectionHeader('State Machines', filteredFsms.length, 'fsm')}
      {expandedSections['fsm'] && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {filteredFsms.length === 0
            ? <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '20px', fontSize: '12px' }}>No state machines defined</div>
            : filteredFsms.map(renderFsmCard)
          }
        </div>
      )}

      {/* Presentation Graphs Section */}
      {renderSectionHeader('Presentation Graphs', filteredGraphs.length, 'presentation')}
      {expandedSections['presentation'] && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {filteredGraphs.length === 0
            ? <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '20px', fontSize: '12px' }}>No presentation graphs defined</div>
            : filteredGraphs.map(renderGraphCard)
          }
        </div>
      )}
    </>
  );

  // ========== Main Render ==========
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-color)' }}>
      {/* Header with Compact Tabs */}
      <div style={{ padding: '16px 20px', borderBottom: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {/* Compact Tab Buttons */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['Variables', 'Scripts', 'Events', 'Graphs'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); persistState({ activeTab: tab }); }}
              className={activeTab === tab ? 'btn-primary' : 'btn-ghost'}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', fontSize: '11px'
              }}
            >
              {TabIcons[tab]}
              {tab}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px', maxWidth: '320px' }}>
          <Search size={14} style={{ color: 'var(--text-dim)' }} />
          <input
            type="text"
            placeholder="Search..."
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              persistState({ filter: e.target.value });
            }}
            style={{
              flex: 1, padding: '6px 10px', fontSize: '12px',
              background: 'var(--panel-bg)', border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', outline: 'none'
            }}
          />
        </div>

        {/* 状态 / 类型筛选器 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={stateFilter}
            onChange={(e) => { const next = e.target.value as typeof stateFilter; setStateFilter(next); persistState({ stateFilter: next }); }}
            style={{ background: 'var(--panel-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontSize: '12px' }}
          >
            <option value="ALL">状态: All</option>
            <option value="Draft">状态: Draft</option>
            <option value="Implemented">状态: Implemented</option>
            <option value="MarkedForDelete">状态: Deleted</option>
          </select>
          {activeTab === 'Variables' && (
            <select
              value={varTypeFilter}
              onChange={(e) => { const next = e.target.value as typeof varTypeFilter; setVarTypeFilter(next); persistState({ varTypeFilter: next }); }}
              style={{ background: 'var(--panel-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontSize: '12px' }}
            >
              <option value="ALL">类型: All</option>
              <option value="boolean">boolean</option>
              <option value="integer">integer</option>
              <option value="float">float</option>
              <option value="string">string</option>
              <option value="enum">enum</option>
            </select>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {activeTab === 'Variables' && renderVariablesTab()}
        {activeTab === 'Scripts' && renderScriptsTab()}
        {activeTab === 'Events' && renderEventsTab()}
        {activeTab === 'Graphs' && renderGraphsTab()}
      </div>
    </div>
  );
};
