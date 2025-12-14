import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';
import { VariableDefinition } from '../../types/blackboard';
import { VariableScope, VariableType } from '../../types/common';

interface Props {
  value: string;
  variables: VariableDefinition[];
  onChange: (variableId: string, scope: VariableScope, picked?: VariableDefinition) => void;
  placeholder?: string;
  allowedTypes?: VariableType[]; // 允许的类型列表，用于筛选
  height?: number; // 控件高度
}

// UI Style Guide Colors
const COLORS = {
  bg: '#18181b', // Matte charcoal
  bgInput: '#27272a', // Input background
  border: '#52525b', // Main border
  accent: '#f97316', // Safety Orange
  text: '#e4e4e7', // Off-white
  textDim: '#a1a1aa',
  hover: '#3f3f46',
  selected: '#2d2d30',
};

const getTypeColor = (type: VariableType): string => {
  switch (type) {
    case 'boolean': return '#569cd6';
    case 'integer': return '#b5cea8';
    case 'float': return '#4ec9b0';
    case 'string': return '#ce9178';
    default: return '#ccc';
  }
};

const scopeColors: Record<VariableScope, string> = {
  Global: '#4fc1ff',
  StageLocal: '#f6c344',
  NodeLocal: '#9d7dff',
  Temporary: '#ff8a80'
};

const Badge: React.FC<{ text: string; color: string; width?: number }> = ({ text, color, width }) => (
  <span
    style={{
      fontSize: '10px',
      padding: '2px 6px',
      borderRadius: 4,
      border: `1px solid ${color}`,
      color: color,
      lineHeight: '1.2',
      fontFamily: 'IBM Plex Mono, monospace', // Tech look
      width: width,
      display: width ? 'inline-block' : undefined,
      textAlign: width ? 'center' : undefined,
      boxSizing: 'border-box',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }}
  >
    {text}
  </span>
);

export const VariableSelector: React.FC<Props> = ({
  value,
  variables,
  onChange,
  placeholder = 'Select variable',
  allowedTypes,
  height = 30
}) => {
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<VariableType | 'all'>('all');
  const [scopeFilter, setScopeFilter] = useState<VariableScope | 'All'>('All');
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectableVars = useMemo(
    () => variables.filter(v => v.state !== 'MarkedForDelete'),
    [variables]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return selectableVars.filter(v => {
      const byType = typeFilter === 'all' ? true : v.type === typeFilter;
      const byScope = scopeFilter === 'All' ? true : v.scope === scopeFilter;
      const bySearch = query ? v.name.toLowerCase().includes(query) : true;
      return byType && byScope && bySearch;
    });
  }, [selectableVars, scopeFilter, search, typeFilter]);

  const selectedVar = useMemo(
    () => selectableVars.find(v => v.id === value),
    [selectableVars, value]
  );

  const handleSelect = (picked?: VariableDefinition) => {
    setOpen(false);
    if (!picked) {
      onChange('', 'Global');
    } else {
      onChange(picked.id, picked.scope, picked);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Trigger Button */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          background: COLORS.bgInput,
          border: `1px solid ${open ? COLORS.accent : COLORS.border}`,
          borderRadius: 4, // Style guide rounded corners
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          height: height, // Use prop instead of hardcoded value
          boxSizing: 'border-box',
          transition: 'border-color 0.15s ease',
        }}
      >
        {selectedVar ? (
          <>
            {/* 变量名称 - 占据剩余空间，左对齐 */}
            <span style={{
              color: COLORS.text,
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              minWidth: 0
            }}>
              {selectedVar.name}
            </span>
            {/* 标签容器 - 固定在右侧 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <Badge text={selectedVar.type} color={getTypeColor(selectedVar.type)} width={56} />
              <Badge text={selectedVar.scope} color={scopeColors[selectedVar.scope]} width={80} />
            </div>
          </>
        ) : (
          <span style={{ color: COLORS.textDim, fontSize: 12, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{placeholder}</span>
        )}
        <ChevronDown size={16} color={COLORS.textDim} style={{ flexShrink: 0, marginLeft: 8 }} />
      </div>

      {/* Dropdown Panel */}
      {open && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '100%',
            // 移除 minWidth，让面板始终与触发器同宽
            background: COLORS.bg,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 100,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            boxSizing: 'border-box'
          }}
        >
          {/* Header Area: Search & Filters */}
          <div style={{ padding: 8, borderBottom: `1px solid #333`, display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={14} color={COLORS.textDim} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search variables..."
                style={{
                  width: '100%',
                  background: COLORS.bgInput,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 4,
                  padding: '6px 8px 6px 28px',
                  color: COLORS.text,
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Filter Row */}
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: COLORS.bgInput,
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.text,
                  borderRadius: 4,
                  padding: '4px 6px',
                  fontSize: 12,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="all">All Types</option>
                {(!allowedTypes || allowedTypes.includes('boolean')) && <option value="boolean">Boolean</option>}
                {(!allowedTypes || allowedTypes.includes('integer')) && <option value="integer">Integer</option>}
                {(!allowedTypes || allowedTypes.includes('float')) && <option value="float">Float</option>}
                {(!allowedTypes || allowedTypes.includes('string')) && <option value="string">String</option>}
              </select>

              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as any)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: COLORS.bgInput,
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.text,
                  borderRadius: 4,
                  padding: '4px 6px',
                  fontSize: 12,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="All">All Scopes</option>
                <option value="Global">Global</option>
                <option value="StageLocal">StageLocal</option>
                <option value="NodeLocal">NodeLocal</option>
                <option value="Temporary">Temporary</option>
              </select>
            </div>
          </div>

          {/* List Area */}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            <div
              onClick={() => handleSelect(undefined)}
              style={{
                padding: '8px 12px',
                color: COLORS.textDim,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderBottom: '1px solid #27272a'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = COLORS.hover}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <X size={12} />
              Clear selection
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: COLORS.textDim, fontSize: 12 }}>
                No variables found.
              </div>
            ) : (
              filtered.map(v => {
                const isSelected = v.id === selectedVar?.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => handleSelect(v)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      background: isSelected ? COLORS.selected : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #27272a'
                    }}
                    onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = COLORS.hover)}
                    onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{
                      color: isSelected ? COLORS.accent : COLORS.text,
                      fontSize: 13,
                      fontFamily: 'Inter, sans-serif',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1,
                      minWidth: 0 // 允许缩小以适应窄宽度
                    }}>
                      {v.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1, minWidth: 0 }}>
                      <Badge text={v.type} color={getTypeColor(v.type)} width={56} />
                      <Badge text={v.scope} color={scopeColors[v.scope]} width={80} />
                      <div style={{ width: 16, display: 'flex', justifyContent: 'center' }}>
                        {isSelected && <Check size={14} color={COLORS.accent} />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

