import React, { ReactNode } from 'react';

interface SidebarProps {
  title: string;
  position: 'left' | 'right';
}

export const Sidebar = ({ title, position, children }: React.PropsWithChildren<SidebarProps>) => {
  return (
    <div className={`sidebar ${position}`}>
      <div className="panel-header">
        {title}
      </div>
      <div className="panel-content">
        {children}
      </div>
    </div>
  );
};