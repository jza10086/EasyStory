import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
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
import {
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Plus,
  Edit3,
  GitFork,
  Copy,
  Trash2,
  Sparkles,
  Undo2,
  Redo2
} from 'lucide-react';

const nodeTypes = {
  storyNode: StoryNode
};

const edgeTypes = {
  conditionEdge: ConditionEdge
};

function NodeContextMenu({
  contextMenu,
  onClose,
  onEdit,
  onAddBranch,
  onAddRoot,
  onClone,
  onDelete,
  onInjectCopilot,
  onAutoLayout,
  onFitView
}) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ x: contextMenu.x, y: contextMenu.y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const padding = 12;
      let x = contextMenu.x;
      let y = contextMenu.y;

      if (x + rect.width > window.innerWidth - padding) {
        x = Math.max(padding, window.innerWidth - rect.width - padding);
      }
      if (y + rect.height > window.innerHeight - padding) {
        y = Math.max(padding, window.innerHeight - rect.height - padding);
      }
      setPos({ x, y });
    }
  }, [contextMenu.x, contextMenu.y]);

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const isNode = contextMenu.type === 'node' && contextMenu.node;
  const node = contextMenu.node;

  return (
    <div
      ref={menuRef}
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      className="fixed z-50 min-w-[210px] max-w-[280px] bg-slate-900/95 backdrop-blur-md border border-slate-750 rounded-xl shadow-2xl p-1.5 text-xs text-slate-200 select-none animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      {isNode ? (
        <>
          {/* Node Header Info */}
          <div className="px-2.5 py-1.5 mb-1 bg-slate-950/70 rounded-lg border border-sky-500/30 flex items-center gap-2">
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0">
              {node.data?.code || node.id}
            </span>
            <span className="font-bold text-white truncate text-xs">
              {node.data?.title || '未命名情节节点'}
            </span>
          </div>

          {/* Action 1: Edit */}
          <button
            type="button"
            onClick={() => {
              onEdit(node.id);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-sky-600/20 text-slate-200 hover:text-sky-200 transition-colors text-left cursor-pointer group"
          >
            <Edit3 className="w-3.5 h-3.5 text-sky-400 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-medium">编辑节点详情</span>
          </button>

          {/* Action 2: Add Branch */}
          <button
            type="button"
            onClick={() => {
              onAddBranch(node.id);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors text-left cursor-pointer group"
          >
            <GitFork className="w-3.5 h-3.5 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
            <span>为此节点新建分支</span>
          </button>

          {/* Action 3: Inject to Copilot */}
          <button
            type="button"
            onClick={() => {
              onInjectCopilot(node);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-indigo-950/40 text-indigo-300 hover:text-indigo-200 transition-colors text-left cursor-pointer group"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 group-hover:scale-110 transition-transform" />
            <span>注入 Story Copilot</span>
          </button>

          {/* Action 4: Clone Node */}
          <button
            type="button"
            onClick={() => {
              onClone(node.id);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors text-left cursor-pointer group"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0 group-hover:scale-110 transition-transform" />
            <span>复制节点副本</span>
          </button>

          <div className="h-px bg-slate-800 my-1 mx-1" />

          {/* Action 5: Delete Node */}
          <button
            type="button"
            onClick={() => {
              onDelete(node.id, node.data?.title);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-950/40 text-rose-300 hover:text-rose-200 transition-colors text-left cursor-pointer group"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0 group-hover:scale-110 transition-transform" />
            <span>删除该情节节点</span>
          </button>
        </>
      ) : (
        <>
          {/* Canvas Pane Actions */}
          <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
            画布操作
          </div>

          <button
            type="button"
            onClick={() => {
              onAddRoot(contextMenu.flowPosition);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-sky-600/20 text-slate-200 hover:text-sky-200 transition-colors text-left cursor-pointer group"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-medium">在此处新建情节节点</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onAutoLayout();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors text-left cursor-pointer group"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-slate-400 shrink-0 group-hover:scale-110 transition-transform" />
            <span>一键自动排版整树</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onFitView();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition-colors text-left cursor-pointer group"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-400 shrink-0 group-hover:scale-110 transition-transform" />
            <span>适应全图居中视图</span>
          </button>
        </>
      )}
    </div>
  );
}

function FlowCanvas() {
  const nodes = useStoryStore((s) => s.nodes);
  const edges = useStoryStore((s) => s.edges);
  const onNodesChange = useStoryStore((s) => s.onNodesChange);
  const onEdgesChange = useStoryStore((s) => s.onEdgesChange);
  const onConnect = useStoryStore((s) => s.onConnect);
  const setSelectedNodeId = useStoryStore((s) => s.setSelectedNodeId);
  const addNode = useStoryStore((s) => s.addNode);
  const cloneNode = useStoryStore((s) => s.cloneNode);
  const deleteNode = useStoryStore((s) => s.deleteNode);
  const injectEntityToCopilot = useStoryStore((s) => s.injectEntityToCopilot);
  const registerCanvasAction = useStoryStore((s) => s.registerCanvasAction);

  const pushGraphSnapshot = useStoryStore((s) => s.pushGraphSnapshot);
  const undoGraph = useStoryStore((s) => s.undoGraph);
  const redoGraph = useStoryStore((s) => s.redoGraph);
  const historyGraphPast = useStoryStore((s) => s.historyGraphPast);
  const historyGraphFuture = useStoryStore((s) => s.historyGraphFuture);

  const { fitView, zoomIn, zoomOut, screenToFlowPosition } = useReactFlow();

  const [contextMenu, setContextMenu] = useState(null);

  // Track drag start to record snapshot for undoing node movements
  const dragStartRef = useRef(null);

  const onNodeDragStart = useCallback((event, node) => {
    dragStartRef.current = {
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      snapshot: {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        selectedNodeId: useStoryStore.getState().selectedNodeId
      }
    };
  }, [nodes, edges]);

  const onNodeDragStop = useCallback((event, node) => {
    if (dragStartRef.current && dragStartRef.current.snapshot) {
      const start = dragStartRef.current;
      const dx = Math.abs(node.position.x - start.x);
      const dy = Math.abs(node.position.y - start.y);
      if (dx > 2 || dy > 2) {
        pushGraphSnapshot(start.snapshot);
      }
      dragStartRef.current = null;
    }
  }, [pushGraphSnapshot]);

  // One-click Auto Layout
  const handleAutoLayout = useCallback(() => {
    pushGraphSnapshot();
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
  }, [nodes, edges, onNodesChange, fitView, pushGraphSnapshot]);

  useEffect(() => {
    registerCanvasAction('fitView', () => fitView({ duration: 400 }));
    registerCanvasAction('autoLayout', handleAutoLayout);
  }, [registerCanvasAction, fitView, handleAutoLayout]);

  // Context Menu Handlers
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      type: 'node',
      x: event.clientX,
      y: event.clientY,
      node
    });
  }, []);

  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault();
    const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setContextMenu({
      type: 'pane',
      x: event.clientX,
      y: event.clientY,
      flowPosition
    });
  }, [screenToFlowPosition]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setContextMenu(null);
  }, [setSelectedNodeId]);

  const handleDeleteNode = useCallback((nodeId) => {
    deleteNode(nodeId);
  }, [deleteNode]);

  const handleInjectCopilot = useCallback((node) => {
    injectEntityToCopilot({
      id: node.id,
      type: 'node',
      code: node.data?.code,
      title: node.data?.title || '未命名节点',
      summary: node.data?.summary,
      content: node.data?.content,
      characters: node.data?.characters || []
    });
  }, [injectEntityToCopilot]);

  return (
    <div className="w-full h-full relative select-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        onMoveStart={() => { if (contextMenu) setContextMenu(null); }}
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
          {/* Undo / Redo */}
          <button
            onClick={() => undoGraph()}
            disabled={historyGraphPast.length === 0}
            className={`p-1.5 rounded-lg transition-colors ${
              historyGraphPast.length > 0
                ? 'text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer'
                : 'text-slate-600 cursor-not-allowed opacity-40'
            }`}
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => redoGraph()}
            disabled={historyGraphFuture.length === 0}
            className={`p-1.5 rounded-lg transition-colors ${
              historyGraphFuture.length > 0
                ? 'text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer'
                : 'text-slate-600 cursor-not-allowed opacity-40'
            }`}
            title="重做 (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-700 mx-0.5" />

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

      {/* Node and Canvas Context Menu */}
      {contextMenu && (
        <NodeContextMenu
          contextMenu={contextMenu}
          onClose={() => setContextMenu(null)}
          onEdit={(nodeId) => setSelectedNodeId(nodeId)}
          onAddBranch={(parentNodeId) => {
            const newId = addNode(parentNodeId);
            setSelectedNodeId(newId);
          }}
          onAddRoot={(flowPos) => {
            const newId = addNode(null, flowPos);
            setSelectedNodeId(newId);
          }}
          onClone={(nodeId) => {
            cloneNode(nodeId);
          }}
          onDelete={(nodeId, title) => {
            handleDeleteNode(nodeId, title);
          }}
          onInjectCopilot={handleInjectCopilot}
          onAutoLayout={handleAutoLayout}
          onFitView={() => fitView({ duration: 400 })}
        />
      )}
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
