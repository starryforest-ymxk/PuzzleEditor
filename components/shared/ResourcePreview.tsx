import React from 'react';
import { ResourceState } from '../../types/common';
import { resourceStateColor } from './uiTokens';
import './ui.css';

interface Props {
  name: string;
  id: string;
  description?: string;
  state?: ResourceState;
  rows?: { label: string; value: React.ReactNode }[];
  footer?: React.ReactNode;
  style?: React.CSSProperties;
}

// 所有资源预览共用名称、ID、摘要及详情网格；业务组件只传入数据。
export const ResourcePreview: React.FC<Props> = ({
  name,
  id,
  description,
  state,
  rows = [],
  footer,
  style,
}) => (
  <div className="ui-resource-preview" style={style}>
    <div className="ui-card-heading">
      <span>{name}</span>
      <span className="ui-id">{id}</span>
    </div>
    <div className="ui-resource-preview__rows">
      {state && (
        <>
          <span>State:</span>
          <span style={{ color: resourceStateColor(state).color }}>{state}</span>
        </>
      )}
      {rows.map((row) => (
        <React.Fragment key={row.label}>
          <span>{row.label}</span>
          <span>{row.value}</span>
        </React.Fragment>
      ))}
    </div>
    {description && <div className="ui-resource-preview__description">{description}</div>}
    {footer && <div className="ui-resource-preview__footer">{footer}</div>}
  </div>
);
