import { useLayerDismissal } from '../shared/useLayerDismissal';
import { Badge } from '../shared/Badge';
import { uiColors as COLORS, variableScopeColor } from '../shared/uiTokens';
import { variableTypeColor as getTypeColor } from '../shared/uiTokens';
import React, { useMemo, useState, useRef } from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';
import { VariableDefinition } from '../../types/blackboard';
import { VariableScope, VariableType } from '../../types/common';
import { filterActiveResources } from '../../utils/resourceFilters';

interface Props {
  value: string;
  variables: VariableDefinition[];
  onChange: (variableId: string, scope: VariableScope, picked?: VariableDefinition) => void;
  placeholder?: string;
  allowedTypes?: VariableType[]; // 允许的类型列表，用于筛选
  height?: number; // 控件高度
}

// UI Style Guide Colors

export const VariableSelector: React.FC<Props> = ({
  value,
  variables,
  onChange,
  placeholder = 'Select variable',
  allowedTypes,
  height = 30,
}) => {
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<VariableType | 'all'>('all');
  const [scopeFilter, setScopeFilter] = useState<VariableScope | 'All'>('All');
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useLayerDismissal({
    layerRef: dropdownRef,
    boundaryRef: containerRef,
    onClose: () => setOpen(false),
    enabled: open,
  });

  const selectableVars = useMemo(() => filterActiveResources(variables), [variables]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return selectableVars.filter((v) => {
      const byType = typeFilter === 'all' ? true : v.type === typeFilter;
      const byScope = scopeFilter === 'All' ? true : v.scope === scopeFilter;
      const bySearch = query ? v.name.toLowerCase().includes(query) : true;
      return byType && byScope && bySearch;
    });
  }, [selectableVars, scopeFilter, search, typeFilter]);

  const selectedVar = useMemo(
    () => selectableVars.find((v) => v.id === value),
    [selectableVars, value],
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
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        data-open={open}
        className="ui-control ui-control--trigger"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          height: height,
          transition: 'border-color 0.15s ease',
        }}
      >
        {selectedVar ? (
          <>
            {/* 变量名称 - 占据剩余空间，左对齐 */}
            <span
              style={{
                color: COLORS.text,
                fontSize: 12,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
              }}
            >
              {selectedVar.name}
            </span>
            {/* 标签容器 - 固定在右侧 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                overflow: 'hidden',
                flex: 1,
                minWidth: 0,
              }}
            >
              <Badge text={selectedVar.type} color={getTypeColor(selectedVar.type)} width={56} />
              <Badge
                text={selectedVar.scope}
                color={variableScopeColor(selectedVar.scope)}
                width={80}
              />
            </div>
          </>
        ) : (
          <span
            style={{
              color: COLORS.textDim,
              fontSize: 12,
              flex: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {placeholder}
          </span>
        )}
        <ChevronDown size={16} color={COLORS.textDim} style={{ flexShrink: 0, marginLeft: 8 }} />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          className="ui-popover"
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          {/* Header Area: Search & Filters */}
          <div
            style={{
              padding: 8,
              borderBottom: `1px solid #333`,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                size={14}
                color={COLORS.textDim}
                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                className="ui-control ui-control--search"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search variables..."
                style={{ width: '100%' }}
              />
            </div>

            {/* Filter Row */}
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                className="ui-control"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as VariableType | 'all')}
                style={{ flex: 1, minWidth: 0 }}
              >
                <option value="all">All Types</option>
                {(!allowedTypes || allowedTypes.includes('boolean')) && (
                  <option value="boolean">Boolean</option>
                )}
                {(!allowedTypes || allowedTypes.includes('integer')) && (
                  <option value="integer">Integer</option>
                )}
                {(!allowedTypes || allowedTypes.includes('float')) && (
                  <option value="float">Float</option>
                )}
                {(!allowedTypes || allowedTypes.includes('string')) && (
                  <option value="string">String</option>
                )}
              </select>

              <select
                className="ui-control"
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as VariableScope | 'All')}
                style={{ flex: 1, minWidth: 0 }}
              >
                {/* 临时参数只在演出脚本参数传递时定义，不会在其他地方被引用，因此不显示 Temporary 选项 */}
                <option value="All">All Scopes</option>
                <option value="Global">Global</option>
                <option value="StageLocal">StageLocal</option>
                <option value="NodeLocal">NodeLocal</option>
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
                borderBottom: '1px solid #27272a',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <X size={12} />
              Clear selection
            </div>

            {filtered.length === 0 ? (
              <div
                style={{ padding: 16, textAlign: 'center', color: COLORS.textDim, fontSize: 12 }}
              >
                No variables found.
              </div>
            ) : (
              filtered.map((v) => {
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
                      borderBottom: '1px solid #27272a',
                    }}
                    onMouseEnter={(e) =>
                      !isSelected && (e.currentTarget.style.background = COLORS.hover)
                    }
                    onMouseLeave={(e) =>
                      !isSelected && (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <span
                      style={{
                        color: isSelected ? COLORS.accent : COLORS.text,
                        fontSize: 13,
                        fontFamily: 'Inter, sans-serif',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                        minWidth: 0, // 允许缩小以适应窄宽度
                      }}
                    >
                      {v.name}
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        overflow: 'hidden',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <Badge text={v.type} color={getTypeColor(v.type)} width={56} />
                      <Badge text={v.scope} color={variableScopeColor(v.scope)} width={80} />
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
