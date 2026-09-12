import React, { useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  BookOpen,
  Sparkles,
  MessageSquare,
  Eye,
  Edit3,
  Smile
} from 'lucide-react';

const COMMON_EMOTIONS = [
  '警惕', '虚弱喘息', '轻蔑冷笑', '神情动容', '脸色微红', '拔剑戒备', '压低声音', '若有所思'
];

export default function DialogueStreamEditor({
  dialogueList = [],
  onChange,
  characters = [],
  nodeCharacters = []
}) {
  const [viewMode, setViewMode] = useState('edit'); // 'edit' | 'preview'
  const listRef = useRef(null);

  // Available speakers: Narrator + all characters
  const allSpeakers = [
    {
      id: 'narrator',
      name: '背景旁白',
      role: '环境与场景叙述',
      color: '#f59e0b',
      isNarrator: true
    },
    ...characters.map((c) => ({
      ...c,
      isNarrator: false
    }))
  ];

  // Helper to get speaker by ID
  const getSpeaker = (speakerId) => {
    return (
      allSpeakers.find((s) => s.id === speakerId) || {
        id: speakerId,
        name: '未知陈述者',
        color: '#94a3b8',
        isNarrator: false
      }
    );
  };

  // Add a new dialogue beat
  const handleAddBeat = (speakerId = 'narrator', defaultState = '') => {
    const newBeat = {
      id: `beat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      speakerId: speakerId,
      speakerState: defaultState,
      text: ''
    };
    const next = [...dialogueList, newBeat];
    onChange(next);

    // Auto scroll to bottom
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 50);
  };

  // Update a single beat
  const handleUpdateBeat = (beatId, field, value) => {
    const next = dialogueList.map((b) =>
      b.id === beatId ? { ...b, [field]: value } : b
    );
    onChange(next);
  };

  // Remove beat
  const handleDeleteBeat = (beatId) => {
    const next = dialogueList.filter((b) => b.id !== beatId);
    onChange(next);
  };

  // Move beat up / down
  const handleMove = (index, direction) => {
    const next = [...dialogueList];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    onChange(next);
  };

  // Duplicate beat
  const handleDuplicate = (index) => {
    const item = dialogueList[index];
    const duplicated = {
      ...item,
      id: `beat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`
    };
    const next = [...dialogueList];
    next.splice(index + 1, 0, duplicated);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {/* Top Bar: Title & View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-sky-400" />
          <h4 className="text-xs font-bold text-slate-200 tracking-wide">
            剧本台词流与场记演出 ({dialogueList.length} 条)
          </h4>
        </div>

        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
              viewMode === 'edit'
                ? 'bg-sky-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3 h-3" /> 编辑场记
          </button>
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
              viewMode === 'preview'
                ? 'bg-sky-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3 h-3" /> 游戏对白演出
          </button>
        </div>
      </div>

      {/* Editor View Mode */}
      {viewMode === 'edit' ? (
        <div className="space-y-2.5">
          {dialogueList.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-700 rounded-xl bg-slate-900/40 text-center space-y-2">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">本节点暂未录入对白场记</p>
              <p className="text-[11px] text-slate-500">
                请在下方点击【+ 旁白】或【+ 角色】开始创建结构化剧本演出
              </p>
            </div>
          ) : (
            <div
              ref={listRef}
              className="space-y-3 max-h-[500px] overflow-y-auto pr-1"
            >
              {dialogueList.map((beat, idx) => {
                const speaker = getSpeaker(beat.speakerId);
                return (
                  <div
                    key={beat.id}
                    className={`rounded-xl border transition-all ${
                      speaker.isNarrator
                        ? 'bg-slate-900/90 border-amber-500/30'
                        : 'bg-slate-800/90 border-slate-700 hover:border-slate-600'
                    } p-3 space-y-2.5 shadow-sm group`}
                  >
                    {/* Header: Speaker selector + state + action buttons */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Speaker Avatar Icon */}
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 text-white shadow-sm"
                          style={{ backgroundColor: speaker.color || '#38bdf8' }}
                        >
                          {speaker.isNarrator ? (
                            <BookOpen className="w-3 h-3 text-slate-950" />
                          ) : speaker.avatar ? (
                            <img
                              src={speaker.avatar}
                              alt=""
                              className="w-full h-full object-cover rounded-full"
                            />
                          ) : (
                            speaker.name.slice(0, 1)
                          )}
                        </div>

                        {/* Speaker Selector Dropdown */}
                        <select
                          value={beat.speakerId}
                          onChange={(e) =>
                            handleUpdateBeat(beat.id, 'speakerId', e.target.value)
                          }
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold outline-none focus:border-sky-500 cursor-pointer"
                          style={{ color: speaker.color || '#e2e8f0' }}
                        >
                          {allSpeakers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.isNarrator ? '📖 ' : '👤 '}
                              {s.name}
                            </option>
                          ))}
                        </select>

                        {/* Speaker State / Action input */}
                        <div className="flex-1 flex items-center gap-1 min-w-0">
                          <input
                            type="text"
                            value={beat.speakerState || ''}
                            onChange={(e) =>
                              handleUpdateBeat(beat.id, 'speakerState', e.target.value)
                            }
                            placeholder="神态/动作/心声 (如: 警惕注视、轻蔑一笑)..."
                            className="flex-1 bg-slate-950/70 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 placeholder-slate-500 outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>

                      {/* Line actions */}
                      <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, -1)}
                          className="p-1 text-slate-400 hover:text-sky-300 hover:bg-slate-700 rounded disabled:opacity-20"
                          title="上移"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === dialogueList.length - 1}
                          onClick={() => handleMove(idx, 1)}
                          className="p-1 text-slate-400 hover:text-sky-300 hover:bg-slate-700 rounded disabled:opacity-20"
                          title="下移"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(idx)}
                          className="p-1 text-slate-400 hover:text-sky-300 hover:bg-slate-700 rounded"
                          title="复制此句"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBeat(beat.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded"
                          title="删除此句"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Emotion Preset Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5 scrollbar-none text-[10px]">
                      <span className="text-slate-500 shrink-0 flex items-center gap-0.5">
                        <Smile className="w-2.5 h-2.5" /> 常用神态:
                      </span>
                      {COMMON_EMOTIONS.map((emo) => (
                        <button
                          key={emo}
                          type="button"
                          onClick={() => handleUpdateBeat(beat.id, 'speakerState', emo)}
                          className="shrink-0 px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-700 border border-slate-700/60 text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {emo}
                        </button>
                      ))}
                    </div>

                    {/* Main Dialogue Content Input */}
                    <textarea
                      rows={2}
                      value={beat.text}
                      onChange={(e) =>
                        handleUpdateBeat(beat.id, 'text', e.target.value)
                      }
                      placeholder={
                        speaker.isNarrator
                          ? '输入背景旁白、环境描写或全知视角叙述...'
                          : `输入【${speaker.name}】的台词对白...`
                      }
                      className="w-full bg-slate-950/90 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 leading-relaxed resize-y"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Quick Append Bar */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <span>快速追加台词：</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Add Narrator */}
              <button
                type="button"
                onClick={() => handleAddBeat('narrator')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold transition-all active:scale-95 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ 背景旁白</span>
              </button>

              {/* Add for each Character */}
              {characters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleAddBeat(c.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 shadow-sm border"
                  style={{
                    backgroundColor: `${c.color || '#38bdf8'}1a`,
                    borderColor: `${c.color || '#38bdf8'}55`,
                    color: c.color || '#38bdf8'
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ {c.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Preview Mode: Visual Novel Style Game Dialogue Stream */
        <div className="space-y-3.5 max-h-[550px] overflow-y-auto p-3 bg-slate-950/60 rounded-xl border border-slate-800">
          {dialogueList.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-8">暂无对白可供演出预览</p>
          ) : (
            dialogueList.map((beat) => {
              const speaker = getSpeaker(beat.speakerId);

              // Narrator Line (Cinematic Bar)
              if (speaker.isNarrator) {
                return (
                  <div
                    key={beat.id}
                    className="p-3 bg-slate-900/70 border-l-4 border-amber-500/80 rounded-r-xl space-y-1 my-2"
                  >
                    <div className="flex items-center gap-2 text-[10px] text-amber-400/90 font-mono">
                      <BookOpen className="w-3 h-3" />
                      <span>【旁白】</span>
                      {beat.speakerState && (
                        <span className="px-1.5 py-0.2 bg-amber-500/10 rounded border border-amber-500/20 text-amber-300">
                          {beat.speakerState}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-200 italic leading-relaxed whitespace-pre-wrap">
                      {beat.text || '...'}
                    </p>
                  </div>
                );
              }

              // Character Dialogue Speech Bubble
              return (
                <div key={beat.id} className="flex items-start gap-3 my-2.5 group/preview">
                  {/* Speaker Avatar */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 text-white shadow-md overflow-hidden border-2"
                    style={{
                      borderColor: speaker.color || '#38bdf8',
                      backgroundColor: `${speaker.color || '#38bdf8'}33`
                    }}
                  >
                    {speaker.avatar ? (
                      <img src={speaker.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      speaker.name.slice(0, 1)
                    )}
                  </div>

                  {/* Speech Bubble */}
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold"
                        style={{ color: speaker.color || '#38bdf8' }}
                      >
                        {speaker.name}
                      </span>
                      {beat.speakerState && (
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {beat.speakerState}
                        </span>
                      )}
                    </div>

                    <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl rounded-tl-sm p-3 shadow-md text-xs text-slate-100 leading-relaxed whitespace-pre-wrap">
                      {beat.text || '...'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
