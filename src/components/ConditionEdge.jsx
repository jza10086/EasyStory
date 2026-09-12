import React, { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import { useStoryStore } from '../store/useStoryStore';
import { X, Check, Edit2 } from 'lucide-react';

export default function ConditionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const updateEdgeCondition = useStoryStore((s) => s.updateEdgeCondition);
  const deleteEdge = useStoryStore((s) => s.deleteEdge);

  const [isEditing, setIsEditing] = useState(false);
  const [conditionText, setConditionText] = useState(data?.condition || '默认推进');

  const condition = data?.condition || '分支条件';

  const handleSave = (e) => {
    e.stopPropagation();
    updateEdgeCondition(id, conditionText.trim() || '默认推进');
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave(e);
    if (e.key === 'Escape') setIsEditing(false);
  };

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: '#64748b',
          strokeWidth: 2,
          ...style
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {isEditing ? (
            <div className="flex items-center gap-1 bg-slate-900 border border-sky-400 p-1 rounded-lg shadow-xl">
              <input
                type="text"
                value={conditionText}
                onChange={(e) => setConditionText(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                placeholder="输入触发条件，如[好感度>=60]"
                className="bg-slate-800 text-xs text-slate-100 px-2 py-0.5 rounded outline-none border border-slate-700 w-44"
              />
              <button
                onClick={handleSave}
                className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"
                title="保存"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1 text-slate-400 hover:bg-slate-700 rounded"
                title="取消"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="group/label relative flex items-center">
              <div
                onClick={() => {
                  setConditionText(condition);
                  setIsEditing(true);
                }}
                className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-sky-400 text-sky-300 shadow-md flex items-center gap-1.5 transition-all cursor-pointer select-none backdrop-blur-sm"
                title="点击修改此分支的触发条件"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                <span className="max-w-[180px] truncate">{condition}</span>
                <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover/label:opacity-100 text-slate-400 ml-0.5" />
              </div>

              {/* Quick Delete Edge Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteEdge(id);
                }}
                className="opacity-0 group-hover/label:opacity-100 ml-1 p-0.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-full transition-all"
                title="删除此连线"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
