import { ResourcePreview } from '../../shared/ResourcePreview';
import { InspectorError } from '../InspectorInfo';
import React from 'react';
import { PresentationBinding } from '../../../types/common';
import { PresentationGraph } from '../../../types/presentation';
import { ResourceSelect, ResourceOption } from '../ResourceSelect';

interface GraphBindingSectionProps {
  binding: PresentationBinding & { type: 'Graph' };
  onChange: (binding: PresentationBinding) => void;
  graphOptions: ResourceOption[];
  graphData?: Record<string, PresentationGraph>;
  onNavigateToGraph?: (graphId: string) => void;
  readOnly?: boolean;
}

// 演出图绑定部分：显示选中演出图的概要信息
export const GraphBindingSection: React.FC<GraphBindingSectionProps> = ({
  binding,
  onChange,
  graphOptions,
  graphData,
  onNavigateToGraph,
  readOnly = false,
}) => {
  const selectedGraph = binding.graphId ? graphOptions.find((g) => g.id === binding.graphId) : null;
  const fullGraphData = binding.graphId && graphData ? graphData[binding.graphId] : null;
  const nodeCount = fullGraphData ? Object.keys(fullGraphData.nodes || {}).length : 0;
  const startNode = fullGraphData?.startNodeId
    ? fullGraphData.nodes[fullGraphData.startNodeId]
    : null;

  return (
    <div style={{ marginTop: 8 }}>
      <ResourceSelect
        options={graphOptions}
        value={binding.graphId || ''}
        onChange={(val) => onChange({ type: 'Graph', graphId: val })}
        placeholder="Select presentation graph"
        warnOnMarkedDelete
        disabled={readOnly}
        onClear={binding.graphId ? () => onChange({ type: 'Graph', graphId: '' }) : undefined}
      />
      {selectedGraph && (
        <ResourcePreview
          name={selectedGraph.name}
          id={selectedGraph.id}
          state={selectedGraph.state}
          description={selectedGraph.description}
          style={{ marginTop: 8 }}
          rows={
            fullGraphData
              ? [
                  { label: 'Nodes:', value: nodeCount },
                  { label: 'Start Node:', value: startNode?.name || '-' },
                ]
              : []
          }
          footer={
            onNavigateToGraph && (
              <button
                className="btn-ghost"
                disabled={readOnly}
                onClick={() => onNavigateToGraph(binding.graphId)}
              >
                Edit Graph &gt;
              </button>
            )
          }
        />
      )}
      {binding.graphId && !selectedGraph && (
        <InspectorError style={{ marginTop: 8 }} message="Warning: Presentation graph not found" />
      )}
    </div>
  );
};
