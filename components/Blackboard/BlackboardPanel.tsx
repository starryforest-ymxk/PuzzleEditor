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

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useEditorState, useEditorDispatch } from '../../store/context';
import type { ResourceState, ScriptCategory } from '../../types/common';
import type { VariableDefinition, EventDefinition, LocalVarWithScope } from '../../types/blackboard';
import type { ScriptDefinition } from '../../types/manifest';
import type { PresentationGraph } from '../../types/presentation';
import type { StateMachine } from '../../types/stateMachine';
import type { StageNode } from '../../types/stage';
import type { PuzzleNode } from '../../types/puzzleNode';
import { Database, Code, Zap, Search, Layers, Plus } from 'lucide-react';
import { generateVariableId, generateEventId, generateScriptId } from '../../utils/resourceIdGenerator';
import { findGlobalVariableReferences } from '../../utils/validation/globalVariableReferences';
import { findNodeVariableReferences } from '../../utils/validation/variableReferences';
import { findScriptReferences } from '../../utils/validation/scriptReferences';
import { findEventReferences } from '../../utils/validation/eventReferences';
import { findPresentationGraphReferences } from '../../utils/validation/presentationGraphReferences';

// ========== 子组件导入 ===========
import { SectionHeader } from './SectionHeader';
import { VariableCard } from './VariableCard';
import { LocalVariableCard } from './LocalVariableCard';
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
    Lifecycle: true, 'Lifecycle:Stage': true, 'Lifecycle:Node': true, 'Lifecycle:State': true,
    Performance: true, Condition: true, Trigger: true,
    fsm: true, presentation: true
  });
  const [stateFilter, setStateFilter] = useState<'ALL' | 'Draft' | 'Implemented' | 'MarkedForDelete'>(ui.blackboardView.stateFilter || 'ALL');
  const [varTypeFilter, setVarTypeFilter] = useState<'ALL' | 'boolean' | 'integer' | 'float' | 'string'>(ui.blackboardView.varTypeFilter || 'ALL');
  const [showScriptMenu, setShowScriptMenu] = useState(false);
  const [showLifecycleSubmenu, setShowLifecycleSubmenu] = useState(false);
  const scriptMenuRef = useRef<HTMLDivElement>(null);

  // 点击菜单外部时关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (scriptMenuRef.current && !scriptMenuRef.current.contains(event.target as Node)) {
        setShowScriptMenu(false);
        setShowLifecycleSubmenu(false);
      }
    };

    if (showScriptMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showScriptMenu]);

  // ========== Data Sources ==========
  const { globalVariables, events } = project.blackboard || { globalVariables: {}, events: {} };
  const scriptsRecord = project.scripts?.scripts || {};

  const variableList = useMemo(() => Object.values<VariableDefinition>(globalVariables || {}), [globalVariables]);
  const eventList = useMemo(() => Object.values<EventDefinition>(events || {}), [events]);
  const scriptList = useMemo(() => Object.values<ScriptDefinition>(scriptsRecord || {}), [scriptsRecord]);
  const graphList = useMemo(() => Object.values<PresentationGraph>(project.presentationGraphs || {}), [project.presentationGraphs]);
  const fsmList = useMemo(() => Object.values<StateMachine>(project.stateMachines || {}), [project.stateMachines]);

  // 收集 Stage 和 Node 的局部变量（带作用域信息）
  const localVariableList = useMemo<LocalVarWithScope[]>(() => {
    const result: LocalVarWithScope[] = [];
    // Stage 局部变量
    Object.values<StageNode>(project.stageTree.stages || {}).forEach(stage => {
      if (stage.localVariables) {
        Object.values<VariableDefinition>(stage.localVariables).forEach(v => {
          result.push({ ...v, scopeType: 'Stage', scopeName: stage.name, scopeId: stage.id });
        });
      }
    });
    // Node 局部变量
    Object.values<PuzzleNode>(project.nodes || {}).forEach(node => {
      if (node.localVariables) {
        Object.values<VariableDefinition>(node.localVariables).forEach(v => {
          result.push({ ...v, scopeType: 'Node', scopeName: node.name, scopeId: node.id });
        });
      }
    });
    return result;
  }, [project.stageTree.stages, project.nodes]);

  // ========== Filtering Logic ==========
  const filterFn = <T extends { name: string; id: string; state?: ResourceState; type?: string }>(list: T[]): T[] => {
    if (!filter.trim()) return list;
    const lowerFilter = filter.toLowerCase();
    // 按名称或 ID 筛选
    return list.filter(item => item.name.toLowerCase().includes(lowerFilter) || item.id.toLowerCase().includes(lowerFilter));
  };
  const matchState = (s?: ResourceState) => stateFilter === 'ALL' || s === stateFilter;
  const matchVarType = (type?: string) => varTypeFilter === 'ALL' || type === varTypeFilter;

  const filteredVariables = filterFn<VariableDefinition>(variableList).filter(v => matchState(v.state) && matchVarType(v.type));
  const filteredEvents = filterFn<EventDefinition>(eventList).filter(e => matchState(e.state));
  const filteredScripts = filterFn<ScriptDefinition>(scriptList).filter(s => matchState(s.state));
  const filteredLocalVariables = useMemo(() => {
    const lowerFilter = filter.toLowerCase();
    return localVariableList.filter(v => {
      const textMatch = !filter.trim()
        || v.name.toLowerCase().includes(lowerFilter)
        || v.id.toLowerCase().includes(lowerFilter)
        || v.scopeName.toLowerCase().includes(lowerFilter);
      return textMatch && matchState(v.state) && matchVarType(v.type);
    });
  }, [localVariableList, filter, stateFilter, varTypeFilter]);

  // ========== 引用数量计算 ==========
  // 全局变量引用数量
  const globalVariableRefCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    variableList.forEach(v => {
      counts[v.id] = findGlobalVariableReferences(project, v.id).length;
    });
    return counts;
  }, [project, variableList]);

  // 局部变量引用数量（仅 Node 级别支持）
  const localVariableRefCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    localVariableList.forEach(v => {
      if (v.scopeType === 'Node') {
        // Node 局部变量使用 findNodeVariableReferences
        counts[v.id] = findNodeVariableReferences(project, v.scopeId, v.id).length;
      } else {
        // Stage 局部变量暂不支持引用追踪
        counts[v.id] = 0;
      }
    });
    return counts;
  }, [project, localVariableList]);

  // 脚本引用数量
  const scriptRefCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    scriptList.forEach(s => {
      counts[s.id] = findScriptReferences(project, s.id).length;
    });
    return counts;
  }, [project, scriptList]);

  // 事件引用数量
  const eventRefCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    eventList.forEach(e => {
      counts[e.id] = findEventReferences(project, e.id).length;
    });
    return counts;
  }, [project, eventList]);

  // 演出图引用数量
  const graphRefCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    graphList.forEach(g => {
      counts[g.id] = findPresentationGraphReferences(project, g.id).length;
    });
    return counts;
  }, [project, graphList]);

  // 按分类分组脚本（Lifecycle 细分作用范围）
  const scriptGroups = useMemo(() => {
    const groups: Record<Exclude<ScriptCategory, 'Lifecycle'>, ScriptDefinition[]> = {
      Performance: [], Condition: [], Trigger: []
    };
    filteredScripts.forEach(s => {
      if (s.category === 'Lifecycle') return;
      if (groups[s.category as Exclude<ScriptCategory, 'Lifecycle'>]) {
        groups[s.category as Exclude<ScriptCategory, 'Lifecycle'>].push(s);
      }
    });
    return groups;
  }, [filteredScripts]);

  const lifecycleGroups = useMemo(() => {
    return filteredScripts
      .filter(s => s.category === 'Lifecycle')
      .reduce<Record<'Stage' | 'Node' | 'State', ScriptDefinition[]>>((acc, cur) => {
        const key = cur.lifecycleType === 'Stage' || cur.lifecycleType === 'Node' || cur.lifecycleType === 'State'
          ? cur.lifecycleType
          : 'Stage';
        acc[key].push(cur);
        return acc;
      }, { Stage: [], Node: [], State: [] });
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
      const current = prev[key] ?? true; // 未初始化时视为展开
      const next = { ...prev, [key]: !current };
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
    const ownerNode = Object.values<PuzzleNode>(project.nodes).find(n => n.stateMachineId === fsmId);
    if (ownerNode) {
      dispatch({ type: 'NAVIGATE_TO', payload: { nodeId: ownerNode.id, stageId: ownerNode.stageId, graphId: null } });
    }
  };

  /**
   * 双击局部变量卡片：跳转到变量声明处并选中拥有者
   * - Stage 局部变量：导航到对应 Stage 并选中
   * - Node 局部变量：导航到对应 Node 所在的 Stage，然后选中该 Node
   */
  const handleDoubleClickLocalVariable = (localVar: LocalVarWithScope) => {
    if (localVar.scopeType === 'Stage') {
      // Stage 局部变量：导航到 Stage 并选中
      dispatch({ type: 'NAVIGATE_TO', payload: { stageId: localVar.scopeId, nodeId: null, graphId: null } });
      // 选中 Stage
      dispatch({ type: 'SELECT_OBJECT', payload: { type: 'STAGE', id: localVar.scopeId } });
    } else if (localVar.scopeType === 'Node') {
      // Node 局部变量：查找 Node 所在的 Stage，导航并选中 Node
      const ownerNode = project.nodes[localVar.scopeId];
      if (ownerNode) {
        dispatch({ type: 'NAVIGATE_TO', payload: { stageId: ownerNode.stageId, nodeId: null, graphId: null } });
        // 选中 Node
        dispatch({ type: 'SELECT_OBJECT', payload: { type: 'NODE', id: localVar.scopeId } });
      }
    }
  };

  // ========== Creation Handlers ==========
  const handleAddVariable = () => {
    // 使用"资源类型_计数器"格式生成 ID（ID 由系统生成，不可编辑）
    const id = generateVariableId(project);
    const newVar: VariableDefinition = {
      id,
      name: 'New Variable',
      type: 'boolean',
      value: false,
      state: 'Draft',
      description: '',
      scope: 'Global'
    };
    dispatch({ type: 'ADD_GLOBAL_VARIABLE', payload: { variable: newVar } });
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'VARIABLE', id } });
  };

  const handleAddEvent = () => {
    // 使用"资源类型_计数器"格式生成 ID（ID 由系统生成，不可编辑）
    const id = generateEventId(project);
    const newEvent: EventDefinition = {
      id,
      name: 'New Event',
      state: 'Draft',
      description: ''
    };
    dispatch({ type: 'ADD_EVENT', payload: { event: newEvent } });
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'EVENT', id } });
  };

  const handleAddScript = (category: ScriptCategory, lifecycleType?: 'Stage' | 'Node' | 'State') => {
    // 使用"资源类型_计数器"格式生成 ID（ID 由系统生成，不可编辑）
    const id = generateScriptId(project);
    const newScript: ScriptDefinition = {
      id,
      name: lifecycleType ? `New ${lifecycleType} Lifecycle Script` : `New ${category} Script`,
      category,
      state: 'Draft',
      description: '',
      ...(lifecycleType ? { lifecycleType } : {})
    };
    dispatch({ type: 'ADD_SCRIPT', payload: { script: newScript } });
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'SCRIPT', id } });
    setShowScriptMenu(false);
    setShowLifecycleSubmenu(false);
  };

  const handleAddPresentationGraph = () => {
    const id = `pg_${Date.now()}`;
    const newGraph = {
      id,
      name: 'New Presentation Graph',
      description: '',
      startNodeId: null,
      nodes: {}
    };
    dispatch({ type: 'ADD_PRESENTATION_GRAPH', payload: { graph: newGraph } });
    dispatch({ type: 'SELECT_OBJECT', payload: { type: 'PRESENTATION_GRAPH', id } });
  };



  // ========== Tab Content Renderers ==========
  const renderVariablesTab = () => (
    <>
      <SectionHeader title="Global Variables" count={filteredVariables.length} expanded={expandedSections['global'] ?? true} onToggle={() => toggleSection('global')} />
      {(expandedSections['global'] ?? true) && (
        <div className="card-grid card-grid--with-margin">
          {filteredVariables.length === 0
            ? <div className="empty-state empty-state--inline">No global variables defined</div>
            : filteredVariables.map(v => (
              <VariableCard key={v.id} variable={v} isSelected={ui.selection.type === 'VARIABLE' && ui.selection.id === v.id} onClick={() => handleSelectVariable(v.id)} referenceCount={globalVariableRefCounts[v.id]} />
            ))
          }
        </div>
      )}
      <SectionHeader title="Local Variables" count={filteredLocalVariables.length} expanded={expandedSections['local'] ?? true} onToggle={() => toggleSection('local')} />
      {(expandedSections['local'] ?? true) && (
        <div className="card-grid">
          {filteredLocalVariables.length === 0
            ? <div className="empty-state empty-state--inline">No local variables in Stages or Nodes</div>
            : filteredLocalVariables.map(v => (
              <LocalVariableCard
                key={v.id}
                variable={v}
                isSelected={ui.selection.type === 'VARIABLE' && ui.selection.id === v.id}
                onClick={() => handleSelectVariable(v.id)}
                onDoubleClick={() => handleDoubleClickLocalVariable(v)}
                referenceCount={localVariableRefCounts[v.id]}
              />
            ))
          }
        </div>
      )}
    </>
  );

  const renderScriptsTab = () => (
    <>
      {/* Lifecycle first, with nested groups */}
      <SectionHeader
        title="Lifecycle Scripts"
        count={lifecycleGroups.Stage.length + lifecycleGroups.Node.length + lifecycleGroups.State.length}
        expanded={expandedSections['Lifecycle'] ?? true}
        onToggle={() => toggleSection('Lifecycle')}
      />
      {(expandedSections['Lifecycle'] ?? true) && (
        <>
          {([['Stage', 'Lifecycle · Stage'] as const, ['Node', 'Lifecycle · Node'] as const, ['State', 'Lifecycle · State'] as const]
            .map(([key, title]) => (
              <React.Fragment key={key}>
                <SectionHeader
                  title={title}
                  count={lifecycleGroups[key as 'Stage' | 'Node' | 'State'].length}
                  expanded={expandedSections[`Lifecycle:${key}`] ?? true}
                  onToggle={() => toggleSection(`Lifecycle:${key}`)}
                  level={2}
                />
                {(expandedSections[`Lifecycle:${key}`] ?? true) && (
                  <div className="card-grid card-grid--with-margin">
                    {lifecycleGroups[key as 'Stage' | 'Node' | 'State'].length === 0
                      ? <div className="empty-state empty-state--inline">No lifecycle scripts</div>
                      : lifecycleGroups[key as 'Stage' | 'Node' | 'State'].map(s => (
                        <ScriptCard key={s.id} script={s} isSelected={ui.selection.type === 'SCRIPT' && ui.selection.id === s.id} onClick={() => handleSelectScript(s.id)} referenceCount={scriptRefCounts[s.id]} />
                      ))
                    }
                  </div>
                )}
              </React.Fragment>
            )))}
        </>
      )}

      {/* Then Performance, Condition, Trigger in order */}
      {(['Performance', 'Condition', 'Trigger'] as Exclude<ScriptCategory, 'Lifecycle'>[]).map(category => (
        <React.Fragment key={category}>
          <SectionHeader title={`${category} Scripts`} count={scriptGroups[category].length} expanded={expandedSections[category] ?? true} onToggle={() => toggleSection(category)} />
          {(expandedSections[category] ?? true) && (
            <div className="card-grid card-grid--with-margin">
              {scriptGroups[category].length === 0
                ? <div className="empty-state empty-state--inline">No {category.toLowerCase()} scripts</div>
                : scriptGroups[category].map(s => (
                  <ScriptCard key={s.id} script={s} isSelected={ui.selection.type === 'SCRIPT' && ui.selection.id === s.id} onClick={() => handleSelectScript(s.id)} referenceCount={scriptRefCounts[s.id]} />
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
          <EventCard key={e.id} event={e} isSelected={ui.selection.type === 'EVENT' && ui.selection.id === e.id} onClick={() => handleSelectEvent(e.id)} referenceCount={eventRefCounts[e.id] || 0} />
        ))
      }
    </div>
  );

  const renderGraphsTab = () => (
    <>
      {/* State Machines Section */}
      <SectionHeader title="State Machines" count={filteredFsms.length} expanded={expandedSections['fsm'] ?? true} onToggle={() => toggleSection('fsm')} />
      {(expandedSections['fsm'] ?? true) && (
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
      <SectionHeader title="Presentation Graphs" count={filteredGraphs.length} expanded={expandedSections['presentation'] ?? true} onToggle={() => toggleSection('presentation')} />
      {(expandedSections['presentation'] ?? true) && (
        <div className="card-grid">
          {filteredGraphs.length === 0
            ? <div className="empty-state empty-state--inline">No presentation graphs defined</div>
            : filteredGraphs.map(g => (
              <GraphCard key={g.id} graph={g} isSelected={ui.selection.type === 'PRESENTATION_GRAPH' && ui.selection.id === g.id} onClick={() => handleSelectGraph(g.id)} onDoubleClick={() => handleOpenGraph(g.id)} referenceCount={graphRefCounts[g.id] || 0} />
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
          {activeTab === 'Variables' && (
            <button className="btn-primary btn-sm" onClick={handleAddVariable} style={{ marginRight: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={14} /> New Variable
            </button>
          )}
          {activeTab === 'Events' && (
            <button className="btn-primary btn-sm" onClick={handleAddEvent} style={{ marginRight: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={14} /> New Event
            </button>
          )}
          {activeTab === 'Scripts' && (
            <div ref={scriptMenuRef} style={{ position: 'relative', marginRight: '8px' }}>
              <button
                className="btn-primary btn-sm"
                onClick={() => setShowScriptMenu(!showScriptMenu)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={14} /> New Script
              </button>
              {showScriptMenu && (
                <div
                  className="dropdown-menu"
                  style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#252526', border: '1px solid #3e3e42', borderRadius: '4px', padding: '4px', minWidth: '140px' }}
                  onMouseLeave={() => setShowLifecycleSubmenu(false)}
                >
                  {/* Performance */}
                  <div
                    className="dropdown-item"
                    onClick={() => handleAddScript('Performance')}
                    style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#c586c0' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#37373d'; setShowLifecycleSubmenu(false); }}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Performance Script
                  </div>
                  {/* Lifecycle with submenu */}
                  <div
                    style={{ position: 'relative' }}
                    onMouseEnter={() => setShowLifecycleSubmenu(true)}
                  >
                    <div
                      className="dropdown-item"
                      style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#4fc1ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#37373d'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span>Lifecycle Script</span>
                      <span style={{ fontSize: '10px' }}>▶</span>
                    </div>
                    {showLifecycleSubmenu && (
                      <div
                        className="dropdown-submenu"
                        style={{ position: 'absolute', left: '100%', top: 0, background: '#252526', border: '1px solid #3e3e42', borderRadius: '4px', padding: '4px', minWidth: '100px', zIndex: 101 }}
                      >
                        {(['Stage', 'Node', 'State'] as const).map(type => (
                          <div
                            key={type}
                            className="dropdown-item"
                            onClick={() => handleAddScript('Lifecycle', type)}
                            style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#4fc1ff' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#37373d'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            {type} Lifecycle
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Condition */}
                  <div
                    className="dropdown-item"
                    onClick={() => handleAddScript('Condition')}
                    style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#dcdcaa' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#37373d'; setShowLifecycleSubmenu(false); }}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Condition Script
                  </div>
                  {/* Trigger */}
                  <div
                    className="dropdown-item"
                    onClick={() => handleAddScript('Trigger')}
                    style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#ce9178' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#37373d'; setShowLifecycleSubmenu(false); }}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Trigger Script
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'Graphs' && (
            <button className="btn-primary btn-sm" onClick={handleAddPresentationGraph} style={{ marginRight: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={14} /> New Presentation
            </button>
          )}

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
