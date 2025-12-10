/**
 * components/Blackboard/BlackboardPanel.tsx
 * 黑板管理视图 - 显示变量/脚本/事件/图形的四页签只读视图
 *
 * 布局要求：
 * - 左上角紧凑页签
 * - 卡片式条目展示 (内容集中)
 * - 右侧 Inspector (由 MainLayout 提供)
 * 
 * 重构说明：
 * - 卡片渲染逻辑已拆分到独立组件
 * - 本文件仅负责状态管理、筛选逻辑和页签切换
 * - 内联样式已替换为 CSS 类 (styles.css)
 */

import React, { useMemo, useState } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import { ResourceState, ScriptCategory } from '../../types/common';
import { VariableDefinition, EventDefinition } from '../../types/blackboard';
import { ScriptDefinition } from '../../types/manifest';
import { PresentationGraph } from '../../types/presentation';
import { StateMachine } from '../../types/stateMachine';
import { Database, Code, Zap, Search, Layers } from 'lucide-react';

// ========== 子组件导入 ==========
import { SectionHeader } from './SectionHeader';
import { VariableCard } from './VariableCard';
import { LocalVariableCard } from './LocalVariableCard';
import { LocalVarWithScope } from '../../types/blackboard';
import { ScriptCard } from './ScriptCard';
import { EventCard } from './EventCard';
import { GraphCard } from './GraphCard';
import { FsmCard } from './FsmCard';

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

  // ========== Data Sources ==========
  const { globalVariables, events } = project.blackboard || { globalVariables: {}, events: {} };
  const scriptsRecord = project.scripts?.scripts || {};

  const variableList = useMemo(() => Object.values(globalVariables || {}) as VariableDefinition[], [globalVariables]);
  const eventList = useMemo(() => Object.values(events || {}) as EventDefinition[], [events]);
  const scriptList = useMemo(() => Object.values(scriptsRecord) as ScriptDefinition[], [scriptsRecord]);
  const graphList = useMemo(() => Object.values(project.presentationGraphs || {}) as PresentationGraph[], [project.presentationGraphs]);
  const fsmList = useMemo(() => Object.values(project.stateMachines || {}) as StateMachine[], [project.stateMachines]);

  // 收集 Stage 和 Node 的局部变量（带作用域信息）
  const localVariableList = useMemo<LocalVarWithScope[]>(() => {
    const result: LocalVarWithScope[] = [];
    // Stage 局部变量
    Object.values(project.stageTree.stages || {}).forEach(stage => {
      if (stage.localVariables) {
        Object.values(stage.localVariables).forEach(v => {
          result.push({ ...v, scopeType: 'Stage', scopeName: stage.name, scopeId: stage.id });
        });
      }
    });
    // Node 局部变量
    Object.values(project.nodes || {}).forEach(node => {
      if (node.localVariables) {
        Object.values(node.localVariables).forEach(v => {
          result.push({ ...v, scopeType: 'Node', scopeName: node.name, scopeId: node.id });
        });
      }
    });
    return result;
  }, [project.stageTree.stages, project.nodes]);

  // ========== Filtering Logic ==========
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

  // 按分类分组脚本
  const scriptGroups = useMemo(() => {
    const groups: Record<ScriptCategory, ScriptDefinition[]> = {
      Performance: [], Lifecycle: [], Condition: [], Trigger: []
    };
    filteredScripts.forEach(s => {
      if (groups[s.category]) groups[s.category].push(s);
    });
    return groups;
  }, [filteredScripts]);

  // 筛选图形
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

  // ========== State Persistence ==========
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

  // ========== Selection Handlers ==========
  const handleSelectVariable = (id: string) => dispatch({ type: 'SELECT_OBJECT', payload: { type: 'VARIABLE', id } });
  const handleSelectScript = (id: string) => dispatch({ type: 'SELECT_OBJECT', payload: { type: 'SCRIPT', id } });
  const handleSelectEvent = (id: string) => dispatch({ type: 'SELECT_OBJECT', payload: { type: 'EVENT', id } });
  const handleSelectGraph = (id: string) => dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_GRAPH', id } });
  const handleOpenGraph = (id: string) => dispatch({ type: 'NAVIGATE_TO', payload: { graphId: id, stageId: null, nodeId: null } });
  const handleSelectFsm = (id: string) => dispatch({ type: 'SELECT_OBJECT', payload: { type: 'FSM', id } });
  const handleOpenFsm = (fsmId: string) => {
    // 查找拥有此 FSM 的节点并导航
    const ownerNode = Object.values(project.nodes).find(n => n.stateMachineId === fsmId);
    if (ownerNode) {
      dispatch({ type: 'NAVIGATE_TO', payload: { nodeId: ownerNode.id, stageId: ownerNode.stageId, graphId: null } });
    }
  };

  // ========== Tab Content Renderers ==========
  const renderVariablesTab = () => (
    <>
      <SectionHeader title="Global Variables" count={filteredVariables.length} expanded={expandedSections['global']} onToggle={() => toggleSection('global')} />
      {expandedSections['global'] && (
        <div className="card-grid card-grid--with-margin">
          {filteredVariables.length === 0
            ? <div className="empty-state empty-state--inline">No global variables defined</div>
            : filteredVariables.map(v => (
              <VariableCard key={v.id} variable={v} isSelected={ui.selection.type === 'VARIABLE' && ui.selection.id === v.id} onClick={() => handleSelectVariable(v.id)} />
            ))
          }
        </div>
      )}
      <SectionHeader title="Local Variables" count={filteredLocalVariables.length} expanded={expandedSections['local']} onToggle={() => toggleSection('local')} />
      {expandedSections['local'] && (
        <div className="card-grid">
          {filteredLocalVariables.length === 0
            ? <div className="empty-state empty-state--inline">No local variables in Stages or Nodes</div>
            : filteredLocalVariables.map(v => (
              <LocalVariableCard key={v.id} variable={v} isSelected={ui.selection.type === 'VARIABLE' && ui.selection.id === v.id} onClick={() => handleSelectVariable(v.id)} />
            ))
          }
        </div>
      )}
    </>
  );

  const renderScriptsTab = () => (
    <>
      {(['Performance', 'Lifecycle', 'Condition', 'Trigger'] as ScriptCategory[]).map(category => (
        <React.Fragment key={category}>
          <SectionHeader title={`${category} Scripts`} count={scriptGroups[category].length} expanded={expandedSections[category]} onToggle={() => toggleSection(category)} />
          {expandedSections[category] && (
            <div className="card-grid card-grid--with-margin">
              {scriptGroups[category].length === 0
                ? <div className="empty-state empty-state--inline">No {category.toLowerCase()} scripts</div>
                : scriptGroups[category].map(s => (
                  <ScriptCard key={s.id} script={s} isSelected={ui.selection.type === 'SCRIPT' && ui.selection.id === s.id} onClick={() => handleSelectScript(s.id)} />
                ))
              }
            </div>
          )}
        </React.Fragment>
      ))}
    </>
  );

  const renderEventsTab = () => (
    <div className="card-grid">
      {filteredEvents.length === 0
        ? <div className="empty-state empty-state--inline" style={{ padding: '40px', fontSize: '13px' }}>No events defined</div>
        : filteredEvents.map(e => (
          <EventCard key={e.id} event={e} isSelected={ui.selection.type === 'EVENT' && ui.selection.id === e.id} onClick={() => handleSelectEvent(e.id)} />
        ))
      }
    </div>
  );

  const renderGraphsTab = () => (
    <>
      {/* State Machines Section */}
      <SectionHeader title="State Machines" count={filteredFsms.length} expanded={expandedSections['fsm']} onToggle={() => toggleSection('fsm')} />
      {expandedSections['fsm'] && (
        <div className="card-grid" style={{ marginBottom: '20px' }}>
          {filteredFsms.length === 0
            ? <div className="empty-state empty-state--inline">No state machines defined</div>
            : filteredFsms.map(fsm => (
              <FsmCard key={fsm.id} fsm={fsm} isSelected={ui.selection.type === 'FSM' && ui.selection.id === fsm.id} onClick={() => handleSelectFsm(fsm.id)} onDoubleClick={() => handleOpenFsm(fsm.id)} />
            ))
          }
        </div>
      )}
      {/* Presentation Graphs Section */}
      <SectionHeader title="Presentation Graphs" count={filteredGraphs.length} expanded={expandedSections['presentation']} onToggle={() => toggleSection('presentation')} />
      {expandedSections['presentation'] && (
        <div className="card-grid">
          {filteredGraphs.length === 0
            ? <div className="empty-state empty-state--inline">No presentation graphs defined</div>
            : filteredGraphs.map(g => (
              <GraphCard key={g.id} graph={g} isSelected={ui.selection.type === 'PRESENTATION_GRAPH' && ui.selection.id === g.id} onClick={() => handleSelectGraph(g.id)} onDoubleClick={() => handleOpenGraph(g.id)} />
            ))
          }
        </div>
      )}
    </>
  );

  // ========== Main Render ==========
  return (
    <div className="blackboard-container">
      {/* Header with Compact Tabs */}
      <div className="blackboard-header">
        {/* Compact Tab Buttons */}
        <div className="blackboard-tabs">
          {(['Variables', 'Scripts', 'Events', 'Graphs'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); persistState({ activeTab: tab }); }}
              className={`tab-button ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
            >
              {TabIcons[tab]}
              {tab}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="blackboard-search">
          <Search size={14} style={{ color: 'var(--text-dim)' }} />
          <input
            type="text"
            className="search-input"
            placeholder="Search..."
            value={filter}
            onChange={(e) => { setFilter(e.target.value); persistState({ filter: e.target.value }); }}
          />
        </div>

        {/* State / Type Filters */}
        <div className="blackboard-filters">
          <select
            className="filter-select"
            value={stateFilter}
            onChange={(e) => { const next = e.target.value as typeof stateFilter; setStateFilter(next); persistState({ stateFilter: next }); }}
          >
            <option value="ALL">State: All</option>
            <option value="Draft">State: Draft</option>
            <option value="Implemented">State: Implemented</option>
            <option value="MarkedForDelete">State: Deleted</option>
          </select>
          {activeTab === 'Variables' && (
            <select
              className="filter-select"
              value={varTypeFilter}
              onChange={(e) => { const next = e.target.value as typeof varTypeFilter; setVarTypeFilter(next); persistState({ varTypeFilter: next }); }}
            >
              <option value="ALL">Type: All</option>
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
      <div className="blackboard-content">
        {activeTab === 'Variables' && renderVariablesTab()}
        {activeTab === 'Scripts' && renderScriptsTab()}
        {activeTab === 'Events' && renderEventsTab()}
        {activeTab === 'Graphs' && renderGraphsTab()}
      </div>
    </div>
  );
};
