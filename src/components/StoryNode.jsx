import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useStoryStore } from '../store/useStoryStore';
import ReactMarkdown from 'react-markdown';
import { GitFork, Users, Flag, Image as ImageIcon, MessageSquare } from 'lucide-react';

const endingBadgeConfig = {
  normal: { text: '普通结局', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  true: { text: '真结局 (True End)', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  bad: { text: '坏结局 (Bad End)', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
};

function StoryNodeComponent({ id, data, selected }) {
  const setSelectedNodeId = useStoryStore((s) => s.setSelectedNodeId);
  const addNode = useStoryStore((s) => s.addNode);
  const characters = useStoryStore((s) => s.characters);

  const ending = endingBadgeConfig[data.endingType];
  const nodeCharacters = characters.filter((c) => (data.characters || []).includes(c.id));

  return (
    <div
      onClick={() => setSelectedNodeId(id)}
      className={`relative w-80 rounded-xl border transition-all duration-200 cursor-pointer shadow-lg bg-slate-800/95 backdrop-blur-md group ${
        selected
          ? 'border-sky-400 ring-4 ring-sky-500/20 shadow-sky-500/10'
          : 'border-slate-700 hover:border-slate-500 hover:shadow-xl'
      }`}
    >
      {/* Input Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !-left-2 !bg-sky-400 !border-2 !border-slate-900"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 bg-slate-900/50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-md bg-sky-500/20 text-sky-400 border border-sky-500/30">
            {data.code || id}
          </span>
          <h3 className="text-sm font-semibold text-slate-100 truncate max-w-[150px]">
            {data.title || '未命名节点'}
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          {data.dialogueList && data.dialogueList.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-sky-300/80 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 font-mono" title={`${data.dialogueList.length} 句场记台词`}>
              <MessageSquare className="w-2.5 h-2.5" />
              {data.dialogueList.length}
            </span>
          )}

          {ending ? (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${ending.bg}`}>
              {ending.text}
            </span>
          ) : (
            data.choices && data.choices.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <GitFork className="w-3 h-3 text-sky-400" />
                {data.choices.length} 分支
              </span>
            )
          )}
        </div>
      </div>

      {/* Body: Thumbnail image if any + Summary */}
      <div className="p-4 space-y-3">
        {data.image && (
          <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-700 relative group/img">
            <img
              src={data.image}
              alt="节点配图"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
              <span className="text-xs text-white bg-black/60 px-2 py-0.5 rounded flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> 已附插图
              </span>
            </div>
          </div>
        )}

        {/* Summary (Markdown Rendering) */}
        <div className="text-xs text-slate-300 line-clamp-3 leading-relaxed font-sans prose prose-invert max-w-none text-[11px] px-0.5">
          <ReactMarkdown>{data.summary || '*暂无剧情简介，点击展开详情编写...*'}</ReactMarkdown>
        </div>

        {/* Character badges with node-level status */}
        {nodeCharacters.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2 mt-1 border-t border-slate-700/40">
            <Users className="w-3 h-3 text-slate-400 shrink-0" />
            {nodeCharacters.map((c) => {
              const status = data.characterStatuses?.[c.id];
              return (
                <span
                  key={c.id}
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium truncate max-w-[200px]"
                  style={{
                    backgroundColor: `${c.color || '#38bdf8'}22`,
                    color: c.color || '#38bdf8',
                    border: `1px solid ${c.color || '#38bdf8'}44`
                  }}
                  title={status ? `${c.name}: ${status}` : c.name}
                >
                  {c.name.split(' ')[0]}
                  {status ? ` · ${status}` : ''}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover Quick Action: Add Child Branch */}
      <div className="px-4 pb-3 pt-0 flex justify-between items-center text-[11px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] text-slate-500">点击查看/编辑详情</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            addNode(id);
          }}
          className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium px-2 py-0.5 rounded hover:bg-sky-500/10 transition-colors"
          title="为此节点添加子分支"
        >
          <GitFork className="w-3 h-3" />
          <span>＋ 加分支</span>
        </button>
      </div>

      {/* Output Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !-right-2 !bg-sky-400 !border-2 !border-slate-900"
      />
    </div>
  );
}

export default memo(StoryNodeComponent);
