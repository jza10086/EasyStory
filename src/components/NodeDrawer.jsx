import React, { useState, useRef, useEffect } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import ReactMarkdown from 'react-markdown';
import DialogueStreamEditor from './DialogueStreamEditor';
import {
  X,
  Trash2,
  Image as ImageIcon,
  Upload,
  Sparkles,
  GitFork,
  FileText,
  Users,
  Eye,
  Edit3,
  Plus,
  ArrowRight,
  Loader2,
  Check,
  Save,
  Shield,
  MessageSquare
} from 'lucide-react';

const markdownComponents = {
  h1: ({ children }) => <h1 className="text-base font-bold text-sky-300 mt-4 mb-2 pb-1 border-b border-slate-700/80">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold text-sky-400 mt-3 mb-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-xs font-bold text-sky-400 mt-2.5 mb-1.5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block"></span>{children}</h3>,
  p: ({ children }) => <p className="mb-2.5 leading-relaxed text-slate-200 text-xs">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-sky-400 bg-sky-950/40 pl-3.5 py-1.5 my-2.5 text-sky-200/90 text-xs italic rounded-r-md">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong className="text-sky-300 font-bold">{children}</strong>,
  em: ({ children }) => <em className="text-slate-300 italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 text-xs text-slate-200">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1 text-xs text-slate-200">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ inline, children }) =>
    inline ? (
      <code className="bg-slate-900 border border-slate-700/80 text-sky-300 px-1.5 py-0.5 rounded font-mono text-[11px]">{children}</code>
    ) : (
      <pre className="bg-slate-950 border border-slate-800 p-3 rounded-lg overflow-x-auto text-[11px] font-mono text-slate-300 my-2">{children}</pre>
    ),
  hr: () => <hr className="my-3 border-slate-700/60" />,
  img: ({ src, alt }) => (
    <span className="block my-2.5">
      <img src={src} alt={alt || ''} className="rounded-lg border border-slate-700 max-h-60 object-contain mx-auto shadow-md" />
      {alt && <span className="block text-[11px] text-slate-400 mt-1 text-center">{alt}</span>}
    </span>
  ),
};

export default function NodeDrawer() {
  const selectedNodeId = useStoryStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useStoryStore((s) => s.setSelectedNodeId);
  const nodes = useStoryStore((s) => s.nodes);
  const edges = useStoryStore((s) => s.edges);
  const characters = useStoryStore((s) => s.characters);
  const worldLore = useStoryStore((s) => s.worldLore);
  const updateNodeData = useStoryStore((s) => s.updateNodeData);
  const deleteNode = useStoryStore((s) => s.deleteNode);
  const addNode = useStoryStore((s) => s.addNode);
  const onConnect = useStoryStore((s) => s.onConnect);
  const updateEdgeCondition = useStoryStore((s) => s.updateEdgeCondition);
  const saveStoryImmediate = useStoryStore((s) => s.saveStoryImmediate);
  const saveStatus = useStoryStore((s) => s.saveStatus);
  const lastSavedTime = useStoryStore((s) => s.lastSavedTime);

  const [activeTab, setActiveTab] = useState('plot'); // 'plot' | 'choices' | 'ai'
  const [summaryMode, setSummaryMode] = useState('edit'); // 'edit' | 'preview'
  const [isUploading, setIsUploading] = useState(false);
  const [manualSavedNotice, setManualSavedNotice] = useState(false);

  // AI Assistant States
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiError, setAiError] = useState('');

  const fileInputRef = useRef(null);

  // Manual save handler
  const handleManualSave = async () => {
    await saveStoryImmediate();
    setManualSavedNotice(true);
    setTimeout(() => setManualSavedNotice(false), 2000);
  };

  // Listen for Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!selectedNodeId) return null;

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const { data } = node;

  // Find outbound edges from this node
  const outboundEdges = edges.filter((e) => e.source === selectedNodeId);

  // Selected character objects
  const selectedCharacters = characters.filter((c) => (data.characters || []).includes(c.id));

  // Quick field updates
  const handleChange = (field, value) => {
    updateNodeData(selectedNodeId, { [field]: value });
  };

  // Toggle character selection
  const handleToggleCharacter = (charId) => {
    const current = data.characters || [];
    const next = current.includes(charId)
      ? current.filter((id) => id !== charId)
      : [...current, charId];
    handleChange('characters', next);
  };

  // Convert legacy markdown content into dialogue list beats
  const handleConvertLegacyContent = () => {
    if (!data.content) return;
    const lines = data.content.split('\n').map((l) => l.trim()).filter(Boolean);
    const beats = [];
    lines.forEach((line, i) => {
      if (line.startsWith('###')) {
        beats.push({
          id: `beat-c-${Date.now().toString(36)}-${i}`,
          speakerId: 'narrator',
          speakerState: '场景说明',
          text: line.replace(/^###\s*/, '')
        });
      } else if (line.startsWith('>')) {
        const clean = line.replace(/^>\s*/, '').replace(/^"|"$/g, '').trim();
        beats.push({
          id: `beat-c-${Date.now().toString(36)}-${i}`,
          speakerId: data.characters?.[0] || 'narrator',
          speakerState: '微弱低语',
          text: clean
        });
      } else {
        beats.push({
          id: `beat-c-${Date.now().toString(36)}-${i}`,
          speakerId: 'narrator',
          speakerState: '环境叙述',
          text: line
        });
      }
    });
    handleChange('dialogueList', [...(data.dialogueList || []), ...beats]);
  };

  // Handle image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setIsUploading(true);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const resData = await res.json();
      if (resData.success) {
        handleChange('image', resData.url);
      } else {
        alert(`上传失败: ${resData.error}`);
      }
    } catch (err) {
      alert(`上传出错: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Call AI Assistant
  const handleRunAi = async (promptPreset) => {
    setAiLoading(true);
    setAiError('');
    setAiResult('');

    // Assemble rich context: World lore, Participating characters info, Preceding story
    const nodeChars = characters
      .filter((c) => (data.characters || []).includes(c.id))
      .map((c) => `【角色】${c.name} (${c.role}): ${c.bio}, 初始好感度: ${c.initialAffection}`)
      .join('\n');

    // Character statuses in this node
    const charStatusesNotes = (data.characters || [])
      .map((cid) => {
        const c = characters.find((char) => char.id === cid);
        const st = data.characterStatuses?.[cid];
        return c ? `- ${c.name} 当前状态: 【${st || '正常'}】` : '';
      })
      .filter(Boolean)
      .join('\n');

    // Existing dialogue stream
    const existingDialogue = (data.dialogueList || [])
      .map((b) => {
        const sp = b.speakerId === 'narrator'
          ? '【背景旁白】'
          : (characters.find((c) => c.id === b.speakerId)?.name || b.speakerId);
        const state = b.speakerState ? ` [神态: ${b.speakerState}]` : '';
        return `${sp}${state}: ${b.text}`;
      })
      .join('\n');

    // Find parent nodes to build narrative history
    const inboundEdges = edges.filter((e) => e.target === selectedNodeId);
    const parentNotes = inboundEdges
      .map((e) => {
        const parent = nodes.find((n) => n.id === e.source);
        return parent ? `前序节点 [${parent.data.code} ${parent.data.title}]: ${parent.data.summary}` : '';
      })
      .filter(Boolean)
      .join('\n');

    const systemPrompt = `你是一位顶级的游戏剧情设计专家与互动小说编剧。
你的任务是协助创作者进行多分支剧情创作，输出极具戏剧张力、符合角色性格与世界观的故事内容。

【世界观背景】
${worldLore || '暂无详细设定'}

【本剧情节点登场角色】
${nodeChars || '未特别指定登场角色'}

【角色在当前节点的具体状态】(请严格遵守，不可违背状态逻辑，例如处于虚弱昏迷的角色不可剧烈行动)
${charStatusesNotes || '无特殊异常状态'}

【前序剧情走向】
${parentNotes || '此为故事初始节点'}

【当前节点信息】
- 节点编号: ${data.code}
- 节点标题: ${data.title}
- 场景剧情梗概 (Summary):
${data.summary || '无'}
- 当前已录入的对白与场记流:
${existingDialogue || '暂无对白'}
`;

    const userPrompt = promptPreset || aiCustomPrompt || '请为当前节点推荐 2~3 个后续分支情节，并注明各分支触发条件。';

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          prompt: userPrompt,
        }),
      });

      const resData = await res.json();
      if (resData.success) {
        setAiResult(resData.reply);
      } else {
        setAiError(resData.error || '生成失败');
      }
    } catch (err) {
      setAiError(`网络请求错误: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 w-[560px] bg-slate-900 border-l border-slate-700/80 shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
          <input
            type="text"
            value={data.code || ''}
            onChange={(e) => handleChange('code', e.target.value)}
            className="w-16 px-2 py-1 text-xs font-mono font-bold bg-slate-800 border border-slate-700 rounded text-sky-400 text-center outline-none focus:border-sky-500"
            title="节点编号代码"
          />
          <input
            type="text"
            value={data.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="节点标题"
            className="flex-1 px-2.5 py-1 text-sm font-semibold bg-transparent hover:bg-slate-800/60 focus:bg-slate-800 border border-transparent hover:border-slate-700 focus:border-sky-500 rounded text-slate-100 outline-none transition-all truncate"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Manual Save Button */}
          <button
            onClick={handleManualSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
            title="快捷键 Ctrl+S 立即保存至本地硬盘"
          >
            {manualSavedNotice ? (
              <>
                <Check className="w-3.5 h-3.5 text-white animate-pulse" />
                <span>已存盘!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>保存 (Ctrl+S)</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              if (confirm(`确定要删除节点 [${data.code}] ${data.title} 吗？与之关联的连线也将被移除。`)) {
                deleteNode(selectedNodeId);
              }
            }}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-1"
            title="删除节点"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedNodeId(null)}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            title="关闭面板"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-5 border-b border-slate-800 bg-slate-950/40 text-xs">
        <button
          onClick={() => setActiveTab('plot')}
          className={`flex items-center gap-1.5 py-3 px-3 font-medium border-b-2 transition-all ${
            activeTab === 'plot'
              ? 'border-sky-400 text-sky-400 bg-sky-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          剧情与详情
        </button>
        <button
          onClick={() => setActiveTab('choices')}
          className={`flex items-center gap-1.5 py-3 px-3 font-medium border-b-2 transition-all ${
            activeTab === 'choices'
              ? 'border-sky-400 text-sky-400 bg-sky-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitFork className="w-3.5 h-3.5" />
          互动选项与分支 ({outboundEdges.length})
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-1.5 py-3 px-3 font-medium border-b-2 transition-all ${
            activeTab === 'ai'
              ? 'border-purple-400 text-purple-400 bg-purple-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI 编剧智囊
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {activeTab === 'plot' && (
          <>
            {/* Summary (Markdown Supported) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  剧情梗概 / 场景简述 (支持 Markdown)
                </label>
                <div className="flex items-center bg-slate-800 rounded p-0.5 border border-slate-700 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setSummaryMode('edit')}
                    className={`px-2 py-0.5 rounded transition-all ${
                      summaryMode === 'edit'
                        ? 'bg-sky-600 text-white font-medium'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => setSummaryMode('preview')}
                    className={`px-2 py-0.5 rounded transition-all ${
                      summaryMode === 'preview'
                        ? 'bg-sky-600 text-white font-medium'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    预览
                  </button>
                </div>
              </div>

              {summaryMode === 'edit' ? (
                <textarea
                  rows={3}
                  value={data.summary || ''}
                  onChange={(e) => handleChange('summary', e.target.value)}
                  placeholder="概括本节点发生的核心冲突或转折，支持 **Markdown** 粗体、引用、标题等语法..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 resize-y leading-relaxed font-sans"
                />
              ) : (
                <div className="w-full min-h-[60px] max-h-40 bg-slate-800/40 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 overflow-y-auto leading-relaxed">
                  <ReactMarkdown components={markdownComponents}>
                    {data.summary || '*暂无剧情梗概*'}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Ending Type & Attributes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">节点结局标记</label>
                <select
                  value={data.endingType || 'none'}
                  onChange={(e) => handleChange('endingType', e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="none">常规进行中节点 (无结局)</option>
                  <option value="normal">普通结局 (Normal End)</option>
                  <option value="true">真结局 (True End)</option>
                  <option value="bad">坏结局 / 阵亡 (Bad End)</option>
                </select>
              </div>

              {/* Node Image */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">节点立绘 / 场景插图</label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-200 py-2 px-3 rounded-lg transition-colors"
                  >
                    {isUploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-sky-400" />
                    )}
                    <span>{data.image ? '更换插图' : '上传本地插图'}</span>
                  </button>
                  {data.image && (
                    <button
                      onClick={() => handleChange('image', '')}
                      className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800 border border-slate-700 rounded-lg"
                      title="移除图片"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Image Preview if exists */}
            {data.image && (
              <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-950/60 max-h-48">
                <img
                  src={data.image}
                  alt="插图预览"
                  className="w-full h-full object-contain max-h-48"
                />
              </div>
            )}

            {/* Characters Involved & Node-Level Statuses */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                登场角色关联与节点角色状态标注
              </label>
              {characters.length === 0 ? (
                <p className="text-xs text-slate-500 py-1">
                  暂无角色，请点击顶部【👤 角色设定库】添加。
                </p>
              ) : (
                <div className="space-y-2.5">
                  {/* Character selection buttons */}
                  <div className="flex flex-wrap gap-2">
                    {characters.map((c) => {
                      const isSelected = (data.characters || []).includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleToggleCharacter(c.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                            isSelected
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-400 shadow-sm'
                              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: c.color || '#38bdf8' }}
                          />
                          <span>{c.name}</span>
                          {isSelected && <Check className="w-3 h-3 text-sky-400" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Specific Status Inputs for Selected Characters */}
                  {selectedCharacters.length > 0 && (
                    <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                      <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-sky-400" />
                        本节点登场角色状态标注 (用于演出神态及 AI 严格参考)：
                      </span>
                      <div className="space-y-2">
                        {selectedCharacters.map((c) => {
                          const currentStatus = data.characterStatuses?.[c.id] || '';
                          return (
                            <div key={c.id} className="space-y-1 bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
                              <div className="flex items-center justify-between">
                                <span
                                  className="text-xs font-semibold px-2 py-0.5 rounded border"
                                  style={{
                                    backgroundColor: `${c.color || '#38bdf8'}1a`,
                                    borderColor: `${c.color || '#38bdf8'}44`,
                                    color: c.color || '#38bdf8'
                                  }}
                                >
                                  {c.name}
                                </span>
                                {/* Quick status preset pills */}
                                <div className="flex items-center gap-1 text-[10px]">
                                  {['重伤昏迷', '警惕戒备', '情绪动容', '好感度+15', '神志清醒'].map((tag) => (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => {
                                        const nextStatuses = {
                                          ...(data.characterStatuses || {}),
                                          [c.id]: currentStatus ? `${currentStatus}, ${tag}` : tag
                                        };
                                        handleChange('characterStatuses', nextStatuses);
                                      }}
                                      className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60"
                                    >
                                      +{tag}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <input
                                type="text"
                                value={currentStatus}
                                onChange={(e) => {
                                  const nextStatuses = {
                                    ...(data.characterStatuses || {}),
                                    [c.id]: e.target.value
                                  };
                                  handleChange('characterStatuses', nextStatuses);
                                }}
                                placeholder={`标注【${c.name}】在当前节点的情绪/生理状态/好感变动...`}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Structured Dialogue Stream Beats Section */}
            <div className="pt-2 border-t border-slate-800">
              {(!data.dialogueList || data.dialogueList.length === 0) && data.content && (
                <div className="p-3 mb-3 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-center justify-between text-xs text-sky-300">
                  <span>检测到此前记录的纯文本正文，可一键提取为结构化对白场记流</span>
                  <button
                    type="button"
                    onClick={handleConvertLegacyContent}
                    className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-sm transition-all text-xs"
                  >
                    一键提取转换
                  </button>
                </div>
              )}

              <DialogueStreamEditor
                dialogueList={data.dialogueList || []}
                onChange={(newList) => handleChange('dialogueList', newList)}
                characters={characters}
                nodeCharacters={data.characters || []}
              />
            </div>
          </>
        )}

        {/* Tab 2: Choices & Branches */}
        {activeTab === 'choices' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                本节点向外通向的所有后续分支及触发条件：
              </p>
              <button
                onClick={() => addNode(selectedNodeId)}
                className="flex items-center gap-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/40 text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                新增延伸分支
              </button>
            </div>

            {outboundEdges.length === 0 ? (
              <div className="text-center py-10 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl space-y-2">
                <GitFork className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">此节点目前是终点，尚未连接任何子分支</p>
                <button
                  onClick={() => addNode(selectedNodeId)}
                  className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline pt-1"
                >
                  <Plus className="w-3.5 h-3.5" /> 立即添加一个分支节点
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {outboundEdges.map((edge) => {
                  const targetNode = nodes.find((n) => n.id === edge.target);
                  return (
                    <div
                      key={edge.id}
                      className="p-3.5 bg-slate-800/60 border border-slate-700 rounded-xl space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                            通向：[{targetNode?.data?.code || '?'}] {targetNode?.data?.title || '未命名'}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedNodeId(edge.target)}
                          className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                        >
                          跳转该节点 <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-400">
                          触发条件标注 (在连线上展示)：
                        </label>
                        <input
                          type="text"
                          value={edge.data?.condition || ''}
                          onChange={(e) => updateEdgeCondition(edge.id, e.target.value)}
                          placeholder="例如: [好感度 >= 60]、[选择拔刀相助]"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-400"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: AI Co-pilot */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-1">
              <h4 className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI 上下文感知机制
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                AI 会自动注入：当前节点的登场人物设定、前序上游剧情走向、以及你的全局世界观设定。
              </p>
            </div>

            {/* Quick Prompt Presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">常用预设指令</label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  disabled={aiLoading}
                  onClick={() => handleRunAi('结合当前情境和登场角色性格，推荐 3 个戏剧冲突强烈的可选分支剧情，并标注触发条件（如好感度、能力检定、物品）。')}
                  className="w-full text-left p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500 text-xs text-slate-200 transition-all flex items-center justify-between"
                >
                  <span>💡 推荐 3 个后续分支走向与触发条件</span>
                  <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                </button>

                <button
                  disabled={aiLoading}
                  onClick={() => handleRunAi('请根据当前节点的剧情概要和现有草稿，丰富环境描写、人物神态与对白，将其扩写为完整的剧情正文。')}
                  className="w-full text-left p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500 text-xs text-slate-200 transition-all flex items-center justify-between"
                >
                  <span>✍️ 扩写当前情节（丰富场景与精彩对白）</span>
                  <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                </button>

                <button
                  disabled={aiLoading}
                  onClick={() => handleRunAi('检查当前出场角色的对白语气，是否完全符合人设性格？请给出润色优化方案。')}
                  className="w-full text-left p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500 text-xs text-slate-200 transition-all flex items-center justify-between"
                >
                  <span>🎭 契合角色人设与性格的对白润色</span>
                  <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                </button>
              </div>
            </div>

            {/* Custom Prompt */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">自定义指令给 AI</label>
              <textarea
                rows={3}
                value={aiCustomPrompt}
                onChange={(e) => setAiCustomPrompt(e.target.value)}
                placeholder="例如：让艾莉丝在此处揭露一部分自己的真实身份，但对王都政变闪烁其词..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-400 resize-none"
              />
              <button
                disabled={aiLoading}
                onClick={() => handleRunAi()}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg transition-colors disabled:opacity-50"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI 正在深度推演中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    开始生成
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {aiError && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-xs text-rose-300 space-y-1">
                <p className="font-semibold">调用提示：</p>
                <p>{aiError}</p>
              </div>
            )}

            {/* AI Result */}
            {aiResult && (
              <div className="space-y-2 p-3.5 bg-slate-800/80 border border-purple-500/40 rounded-xl">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <span className="text-xs font-semibold text-purple-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> AI 推演结果
                  </span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      onClick={() => {
                        handleChange('content', (data.content || '') + '\n\n' + aiResult);
                        alert('已成功追加到正文末尾！');
                      }}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200"
                    >
                      追加至正文
                    </button>
                    <button
                      onClick={() => {
                        handleChange('content', aiResult);
                        alert('已成功替换正文！');
                      }}
                      className="px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded text-white font-medium"
                    >
                      替换为正文
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-200 max-w-none max-h-80 overflow-y-auto leading-relaxed">
                  <ReactMarkdown components={markdownComponents}>{aiResult}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Persistent Save Status Footer Bar */}
      <div className="px-5 py-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 select-none">
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' ? (
            <span className="flex items-center gap-1.5 text-amber-400 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              正在实时保存至本地磁盘...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>自动存盘正常</span>
              {lastSavedTime && <span className="text-slate-500 font-mono text-[11px]">({lastSavedTime})</span>}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>防抖自动落盘 + 快照备份</span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Ctrl+S</span>
        </div>
      </div>
    </div>
  );
}
