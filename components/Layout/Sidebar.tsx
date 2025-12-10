import React, { ReactNode } from 'react';

interface SidebarProps {
  title: string;
  position: 'left' | 'right';
  width?: number;
}

export const Sidebar = ({ title, position, width, children }: React.PropsWithChildren<SidebarProps>) => {
  return (
    <div
      className={`sidebar ${position}`}
      style={{ width: width ? `${width}px` : undefined }}
    >
      <div className="panel-header">
        {title}
      </div>
      <div className="panel-content">
        {children}
      </div>
    </div>
  );
};