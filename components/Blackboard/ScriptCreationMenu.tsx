import { MenuSurface, MenuItem } from '../shared/Menu';
import React, { useState, useRef } from 'react';
import { Plus } from 'lucide-react';
import type { ScriptCategory } from '../../types/common';

/** 创建菜单只管理显隐；类别与生命周期作用域由回调交给应用层。 */
export function ScriptCreationMenu({
  onCreate,
}: {
  onCreate: (category: ScriptCategory, lifecycleType?: 'Stage' | 'Node' | 'State') => void;
}) {
  const [open, setOpen] = useState(false);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const create = (category: ScriptCategory, lifecycleType?: 'Stage' | 'Node' | 'State') => {
    onCreate(category, lifecycleType);
    setOpen(false);
    setLifecycleOpen(false);
  };
  const item = (category: Exclude<ScriptCategory, 'Lifecycle'>) => (
    <MenuItem
      className={`blackboard-menu-item blackboard-script-${category.toLowerCase()}`}
      onClick={() => create(category)}
      onMouseEnter={() => setLifecycleOpen(false)}
    >
      {category} Script
    </MenuItem>
  );
  return (
    <div ref={menuRef} className="blackboard-script-menu">
      <button
        className="btn-primary btn-sm blackboard-action"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Plus size={14} /> New Script
      </button>
      {open && (
        <MenuSurface
          boundaryRef={menuRef}
          onClose={() => {
            setOpen(false);
            setLifecycleOpen(false);
          }}
          className="blackboard-menu"
          onMouseLeave={() => setLifecycleOpen(false)}
        >
          {item('Performance')}
          <div className="blackboard-lifecycle-menu" onMouseEnter={() => setLifecycleOpen(true)}>
            <MenuItem
              className="blackboard-menu-item blackboard-script-lifecycle blackboard-lifecycle-toggle"
              aria-haspopup="menu"
              aria-expanded={lifecycleOpen}
              onClick={() => setLifecycleOpen(true)}
            >
              <span>Lifecycle Script</span>
              <span className="blackboard-submenu-arrow">▶</span>
            </MenuItem>
            {lifecycleOpen && (
              <MenuSurface submenu className="blackboard-menu blackboard-submenu">
                {(['Stage', 'Node', 'State'] as const).map((type) => (
                  <MenuItem
                    className="blackboard-menu-item blackboard-script-lifecycle"
                    key={type}
                    onClick={() => create('Lifecycle', type)}
                  >
                    {type} Lifecycle
                  </MenuItem>
                ))}
              </MenuSurface>
            )}
          </div>
          {item('Condition')}
          {item('Trigger')}
        </MenuSurface>
      )}
    </div>
  );
}
