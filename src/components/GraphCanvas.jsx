import React, { useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import { useStoryStore } from '../store/useStoryStore';
import StoryNode from './StoryNode';
import ConditionEdge from './ConditionEdge';
import { LayoutGrid, ZoomIn, ZoomOut, Maximize2, Plus } from 'lucide-react';

const nodeTypes = {
  storyNode: StoryNode
};

const edgeTypes = {
  conditionEdge: ConditionEdge
};

function FlowCanvas() {
  const nodes = useStoryStore((s) => s.nodes);
  const edges = useStoryStore((s) => s.edges);
  const onNodesChange = useStoryStore((s) => s.onNodesChange);
  const onEdgesChange = useStoryStore((s) => s.onEdgesChange);
  const onConnect = useStoryStore((s) => s.onConnect);
  const setSelectedNodeId = useStoryStore((s) => s.setSelectedNodeId);
  const addNode = useStoryStore((s) => s.addNode);
  const registerCanvasAction = useStoryStore((s) => s.registerCanvasAction);

  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // One-click Auto Layout
  const handleAutoLayout = useCallback(() => {
    // Simple hierarchical positioning based on in-degrees / node codes
    const levels = {};
    const visited = new Set();

    // Map parent-child relationships
    const childrenMap = {};
    edges.forEach((e) => {
      if (!childrenMap[e.source]) childrenMap[e.source] = [];
      childrenMap[e.source].push(e.target);
    });

    // Find root nodes (in-degree == 0)
    const targets = new Set(edges.map((e) => e.target));
    const roots = nodes.filter((n) => !targets.has(n.id));

    let queue = roots.map((n) => ({ id: n.id, level: 0 }));
    if (queue.length === 0 && nodes.length > 0) {
      queue = [{ id: nodes[0].id, level: 0 }];
    }

    while (queue.length > 0) {
      const { id, level } = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);

      if (!levels[level]) levels[level] = [];
      levels[level].push(id);

      const children = childrenMap[id] || [];
      children.forEach((childId) => {
        if (!visited.has(childId)) {
          queue.push({ id: childId, level: level + 1 });
        }
      });
    }

    // Assign positions
    const updatedChanges = [];
    Object.keys(levels).forEach((lvl) => {
      const levelNodes = levels[lvl];
      const levelX = 100 + parseInt(lvl) * 480;
      levelNodes.forEach((nodeId, idx) => {
        const nodeY = 80 + idx * 240;
        updatedChanges.push({
          id: nodeId,
          type: 'position',
          position: { x: levelX, y: nodeY },
          dragging: false
        });
      });
    });

    if (updatedChanges.length > 0) {
      onNodesChange(updatedChanges);
      setTimeout(() => fitView({ duration: 400 }), 50);
    }
  }, [nodes, edges, onNodesChange, fitView]);

  useEffect(() => {
    registerCanvasAction('fitView', () => fitView({ duration: 400 }));
    registerCanvasAction('autoLayout', handleAutoLayout);
  }, [registerCanvasAction, fitView, handleAutoLayout]);

  return (
    <div className="w-full h-full relative select-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onPaneClick={() => setSelectedNodeId(null)}
        fitView
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'conditionEdge',
          data: { condition: '分支推进' }
        }}
        className="bg-slate-950"
      >
        <Background color="#334155" gap={20} size={1} />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          nodeColor={(n) => {
            if (n.data?.endingType === 'true') return '#f59e0b';
            if (n.data?.endingType === 'bad') return '#f43f5e';
            if (n.data?.endingType === 'normal') return '#10b981';
            return '#38bdf8';
          }}
          className="!bottom-4 !right-4"
        />

        {/* Floating Canvas Controls */}
        <Panel position="bottom-left" className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 p-1.5 rounded-xl shadow-xl backdrop-blur">
          <button
            onClick={() => zoomIn()}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="放大画布"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => zoomOut()}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="缩小画布"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => fitView({ duration: 400 })}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="居中适应视图"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-700 mx-0.5" />

          <button
            onClick={handleAutoLayout}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-sky-300 hover:bg-slate-800 rounded-lg transition-colors"
            title="一键自动对齐排版节点树"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-sky-400" />
            <span>自动排版</span>
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
