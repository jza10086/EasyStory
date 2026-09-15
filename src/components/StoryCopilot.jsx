import React, { useState, useEffect, useRef } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  X,
  Plus,
  Send,
  Loader2,
  Trash2,
  Minimize2,
  Maximize2,
  ChevronDown,
  GitBranch,
  User,
  BookOpen,
  MapPin,
  Clock,
  Check,
  ChevronRight,
  Pin,
  Layers,
  Wand2,
  AlertCircle
} from 'lucide-react';

export default function StoryCopilot() {
  const isCopilotOpen = useStoryStore((s) => s.isCopilotOpen);
  const setIsCopilotOpen = useStoryStore((s) => s.setIsCopilotOpen);

  const copilotInjectedEntities = useStoryStore((s) => s.copilotInjectedEntities);
  const injectEntityToCopilot = useStoryStore((s) => s.injectEntityToCopilot);
  const removeInjectedEntity = useStoryStore((s) => s.removeInjectedEntity);
  const clearInjectedEntities = useStoryStore((s) => s.clearInjectedEntities);

  const copilotSessions = useStoryStore((s) => s.copilotSessions);
  const currentCopilotSessionId = useStoryStore((s) => s.currentCopilotSessionId);
  const copilotMessages = useStoryStore((s) => s.copilotMessages);
  const copilotLoading = useStoryStore((s) => s.copilotLoading);
  const copilotActiveThinking = useStoryStore((s) => s.copilotActiveThinking);
  const copilotModel = useStoryStore((s) => s.copilotModel);
  const setCopilotModel = useStoryStore((s) => s.setCopilotModel);

  const fetchCopilotSessions = useStoryStore((s) => s.fetchCopilotSessions);
  const createCopilotSession = useStoryStore((s) => s.createCopilotSession);
  const switchCopilotSession = useStoryStore((s) => s.switchCopilotSession);
  const deleteCopilotSession = useStoryStore((s) => s.deleteCopilotSession);
  const sendCopilotMessage = useStoryStore((s) => s.sendCopilotMessage);
  const executeCopilotToolAction = useStoryStore((s) => s.executeCopilotToolAction);

  const selectedNodeId = useStoryStore((s) => s.selectedNodeId);
  const nodes = useStoryStore((s) => s.nodes);
  const characters = useStoryStore((s) => s.characters);
  const database = useStoryStore((s) => s.database);
  const currentProject = useStoryStore((s) => s.currentProject);

  const [promptText, setPromptText] = useState('');
  const [isDocked, setIsDocked] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [appliedActions, setAppliedActions] = useState(new Set());
  const [applyingActionId, setApplyingActionId] = useState(null);

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isCopilotOpen) {
      fetchCopilotSessions();
    }
  }, [isCopilotOpen, currentProject?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotMessages, copilotActiveThinking, copilotLoading]);

  if (!isCopilotOpen) return null;

  const handleSend = async () => {
    if (!promptText.trim() || copilotLoading) return;
    const text = promptText;
    setPromptText('');
    setShowMentionMenu(false);
    await sendCopilotMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateNewSession = async () => {
    const title = prompt('请输入新会话主题名称:', '剧情推演会话');
    if (title && title.trim()) {
      await createCopilotSession(title.trim());
    }
  };

  const handleDeleteCurrentSession = async () => {
    if (!currentCopilotSessionId) return;
    if (confirm('确定要删除当前会话及其全部推演历史记录吗？')) {
      await deleteCopilotSession(currentCopilotSessionId);
    }
  };

  const handleInjectCurrentSelection = () => {
    if (selectedNodeId) {
      const node = nodes.find((n) => n.id === selectedNodeId);
      if (node) {
        injectEntityToCopilot({
          id: node.id,
          type: 'node',
          code: node.data?.code,
          title: node.data?.title || '未命名节点',
          summary: node.data?.summary,
          content: node.data?.content,
          characters: node.data?.characters || []
        });
      }
    }
  };

  const handleApplyAction = async (actionItem, actIdx) => {
    const key = `${actionItem.action}-${actIdx}`;
    setApplyingActionId(key);
    const res = await executeCopilotToolAction(actionItem.action, actionItem.params);
    setApplyingActionId(null);
    if (res.success) {
      setAppliedActions((prev) => new Set([...prev, key]));
    } else {
      alert(`应用失败: ${res.error || '未知错误'}`);
    }
  };

  const getEntityIcon = (type) => {
    switch (type) {
      case 'node': return <GitBranch className="w-3 h-3 text-sky-400" />;
      case 'character': return <User className="w-3 h-3 text-pink-400" />;
      case 'entry': return <BookOpen className="w-3 h-3 text-purple-400" />;
      case 'location': return <MapPin className="w-3 h-3 text-emerald-400" />;
      case 'event': return <Clock className="w-3 h-3 text-amber-400" />;
      default: return <Sparkles className="w-3 h-3 text-sky-400" />;
    }
  };

  // Minimized Floating Pill
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-xl shadow-sky-900/40 hover:scale-105 transition-all cursor-pointer font-medium text-xs border border-sky-400/40"
        >
          <Sparkles className="w-4 h-4 animate-pulse text-sky-200" />
          <span>Story Copilot</span>
          {copilotInjectedEntities.length > 0 && (
            <span className="bg-sky-900/80 text-sky-200 text-[10px] px-1.5 py-0.5 rounded-full border border-sky-400/30">
              {copilotInjectedEntities.length} 上下文
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-50 flex flex-col bg-slate-900 border border-slate-750 shadow-2xl transition-all duration-200 overflow-hidden ${
        isDocked
          ? 'top-14 right-0 bottom-0 w-[520px] max-w-full border-l border-slate-700'
          : 'bottom-6 right-6 w-[520px] max-w-[95vw] h-[680px] max-h-[85vh] rounded-2xl'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur select-none">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          
          {/* Session Switcher */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <div className="relative flex-1 min-w-0">
              <select
                value={currentCopilotSessionId || ''}
                onChange={(e) => switchCopilotSession(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-sky-500 font-medium truncate cursor-pointer appearance-none pr-6"
              >
                {copilotSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
                {copilotSessions.length === 0 && (
                  <option value="">默认推演会话</option>
                )}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
            </div>

            <button
              onClick={handleCreateNewSession}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors shrink-0"
              title="新建推演会话"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {copilotSessions.length > 0 && (
              <button
                onClick={handleDeleteCurrentSession}
                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors shrink-0"
                title="删除当前会话记录"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Model Tier & Window Controls */}
        <div className="flex items-center gap-1.5 pl-2 shrink-0">
          <select
            value={copilotModel}
            onChange={(e) => setCopilotModel(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-sky-400 font-medium outline-none focus:border-sky-500 cursor-pointer"
            title="切换 Antigravity 原生模型"
          >
            <option value="flash">AGY Flash (极速推演)</option>
            <option value="pro">AGY Pro (深度构思)</option>
          </select>

          <button
            onClick={() => setIsDocked(!isDocked)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title={isDocked ? '浮动窗口模式' : '靠右停靠模式'}
          >
            <Pin className={`w-3.5 h-3.5 ${isDocked ? 'text-sky-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title="最小化"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsCopilotOpen(false)}
            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
            title="关闭"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Injected Context Tray */}
      <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto text-xs">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
          <span className="text-[11px] text-slate-500 font-medium shrink-0">上下文:</span>
          {copilotInjectedEntities.map((ent) => (
            <div
              key={ent.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300 text-[11px] max-w-[160px]"
            >
              {getEntityIcon(ent.type)}
              <span className="truncate">{ent.title || ent.name}</span>
              <button
                onClick={() => removeInjectedEntity(ent.id)}
                className="text-slate-400 hover:text-rose-400 rounded-full ml-0.5"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}

          {copilotInjectedEntities.length === 0 && (
            <span className="text-[11px] text-slate-400 italic">暂未注入实体</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedNodeId && (
            <button
              onClick={handleInjectCurrentSelection}
              className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-800/50 px-2 py-0.5 rounded-md transition-colors"
              title="将当前画布选中的节点快速注入"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>注入选中节点</span>
            </button>
          )}

          {copilotInjectedEntities.length > 0 && (
            <button
              onClick={clearInjectedEntities}
              className="text-[11px] text-slate-500 hover:text-slate-400 px-1"
              title="清空已注入实体"
            >
              清空
            </button>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs font-sans">
        {copilotMessages.length === 0 && !copilotLoading && (
          <div className="text-center py-16 text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 mx-auto shadow-inner">
              <Wand2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-200 text-sm">StoryFlow 剧流副驾驶已就绪</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                直接调用本地 Antigravity 官方模型推演。支持画布节点与人物卡片注入，并通过 MCP 工具直接连线写入图谱。
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-1.5 pt-2 max-w-md mx-auto">
              <button
                onClick={() => setPromptText('根据当前剧情与人物好感度，为当前节点推演 2 个后续冲突分支，并给出分支触发条件。')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-[11px] transition-colors"
              >
                ✨ 推演后续 2 个冲突分支
              </button>
              <button
                onClick={() => setPromptText('请为当前节点润色剧本对白与场景场记，强化角色的性格反差与语气细节。')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-[11px] transition-colors"
              >
                🎭 润色对白与场记
              </button>
              <button
                onClick={() => setPromptText('在此处设计一个重大转折伏笔，并创建相应的新分支节点。')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-[11px] transition-colors"
              >
                ⚡ 设计伏笔转折分支
              </button>
            </div>
          </div>
        )}

        {copilotMessages.map((msg, idx) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id || idx}
              className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 shadow-sm leading-relaxed ${
                  isUser
                    ? 'bg-sky-600 text-white rounded-tr-sm'
                    : 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-tl-sm'
                }`}
              >
                {/* User Injected Pills */}
                {isUser && Array.isArray(msg.injectedEntities) && msg.injectedEntities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5 pb-1 border-b border-sky-500/40">
                    {msg.injectedEntities.map((e) => (
                      <span
                        key={e.id}
                        className="inline-flex items-center gap-0.5 text-[10px] bg-sky-700/80 text-sky-100 px-1.5 py-0.5 rounded"
                      >
                        {e.title || e.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Assistant Thinking Accordion */}
                {!isUser && msg.thinking && (
                  <details className="mb-2 text-slate-400 bg-slate-900/60 rounded-lg border border-slate-750 overflow-hidden text-[11px]">
                    <summary className="px-2.5 py-1 cursor-pointer hover:text-slate-300 font-medium select-none flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>Antigravity 思考过程 (点击展开)</span>
                    </summary>
                    <div className="p-2.5 border-t border-slate-800/80 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap text-slate-400 max-h-48 overflow-y-auto">
                      {msg.thinking}
                    </div>
                  </details>
                )}

                {/* Content */}
                <div className="prose prose-invert prose-xs max-w-none break-words">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {/* Proposed Actions Card */}
                {!isUser && Array.isArray(msg.actions) && msg.actions.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-700 space-y-2">
                    <div className="text-[11px] font-semibold text-sky-400 flex items-center gap-1">
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>AI 提议的结构化变更：</span>
                    </div>

                    {msg.actions.map((act, actIdx) => {
                      const actKey = `${act.action}-${actIdx}`;
                      const isApplied = appliedActions.has(actKey);
                      const isApplying = applyingActionId === actKey;

                      return (
                        <div
                          key={actIdx}
                          className="bg-slate-900/80 border border-sky-500/30 rounded-lg p-2.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-200 text-xs">
                              {act.action === 'story_create_branch'
                                ? `创建分支: ${act.params?.title || '新分支'}`
                                : act.action}
                            </span>

                            {isApplied ? (
                              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                                <Check className="w-3 h-3" />
                                <span>已应用到画布</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleApplyAction(act, actIdx)}
                                disabled={isApplying}
                                className="flex items-center gap-1 text-[11px] font-semibold bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1 rounded shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                <span>一键应用到工程</span>
                              </button>
                            )}
                          </div>

                          {act.params?.summary && (
                            <p className="text-[11px] text-slate-400 line-clamp-2">
                              {act.params.summary}
                            </p>
                          )}
                          {act.params?.condition && (
                            <div className="text-[10px] text-amber-400 font-mono">
                              触发条件: {act.params.condition}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Live Thinking / Loading Box */}
        {copilotLoading && (
          <div className="flex flex-col items-start gap-1.5 animate-in fade-in duration-150">
            <div className="max-w-[90%] bg-slate-800/80 border border-slate-700/80 rounded-2xl rounded-tl-sm px-3.5 py-2.5 space-y-2">
              <div className="flex items-center gap-2 text-sky-400 font-medium text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Antigravity 原生 Agent 正在深度推演...</span>
              </div>

              {copilotActiveThinking && (
                <div className="text-slate-400 font-mono text-[10.5px] max-h-32 overflow-y-auto whitespace-pre-wrap p-2 bg-slate-900/70 rounded border border-slate-750">
                  {copilotActiveThinking}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Tray & Box */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80 space-y-2">
        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={2}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的创作诉求，按 Enter 发送，Shift+Enter 换行..."
            className="w-full bg-slate-900 border border-slate-750 hover:border-slate-600 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none resize-none transition-colors"
          />

          <button
            onClick={handleSend}
            disabled={copilotLoading || !promptText.trim()}
            className="absolute right-2 bottom-3 p-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white shadow-md shadow-sky-600/30 transition-all cursor-pointer"
            title="发送指令 (Enter)"
          >
            {copilotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span>提示：支持点击画布节点右上角【注入 Copilot】或点击下方预设</span>
          <span>按 Enter 发送</span>
        </div>
      </div>
    </div>
  );
}

