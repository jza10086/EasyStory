import React, { useState, useEffect } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import ReactMarkdown from 'react-markdown';
import { X, Globe, Edit3, Eye, Save, Check } from 'lucide-react';

const markdownComponents = {
  h1: ({ children }) => <h1 className="text-lg font-bold text-indigo-300 mt-4 mb-2 pb-1 border-b border-slate-700/80">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold text-indigo-400 mt-3 mb-1.5">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-bold text-indigo-400 mt-2.5 mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block"></span>{children}</h3>,
  p: ({ children }) => <p className="mb-2.5 leading-relaxed text-slate-200 text-xs">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-indigo-400 bg-indigo-950/40 pl-3.5 py-1.5 my-2.5 text-indigo-200/90 text-xs italic rounded-r-md">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong className="text-indigo-300 font-bold">{children}</strong>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 text-xs text-slate-200">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1 text-xs text-slate-200">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ inline, children }) =>
    inline ? (
      <code className="bg-slate-900 border border-slate-700/80 text-indigo-300 px-1.5 py-0.5 rounded font-mono text-[11px]">{children}</code>
    ) : (
      <pre className="bg-slate-950 border border-slate-800 p-3 rounded-lg overflow-x-auto text-[11px] font-mono text-slate-300 my-2">{children}</pre>
    ),
};

export default function WorldLoreModal() {
  const activeModal = useStoryStore((s) => s.activeModal);
  const setActiveModal = useStoryStore((s) => s.setActiveModal);
  const worldLore = useStoryStore((s) => s.worldLore);
  const saveWorldLore = useStoryStore((s) => s.saveWorldLore);

  const [content, setContent] = useState(worldLore);
  const [mode, setMode] = useState('split'); // 'edit' | 'preview' | 'split'
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setContent(worldLore);
  }, [worldLore]);

  if (activeModal !== 'world') return null;

  const handleSave = () => {
    saveWorldLore(content);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-[900px] h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">世界观设定与全局规则</h2>
            <span className="text-xs text-slate-400">（支持 Markdown，AI 推演剧情时将严格遵循此设定）</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-md"
            >
              {isSaved ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSaved ? '已保存！' : '保存设定'}</span>
            </button>
            <button
              onClick={() => setActiveModal(null)}
              className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Mode Bar */}
        <div className="flex items-center justify-between px-6 py-2 bg-slate-950/40 border-b border-slate-800 text-xs">
          <span className="text-slate-400">编辑世界背景、势力格局、魔法科技法则、重要名词解释</span>
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              onClick={() => setMode('edit')}
              className={`px-2 py-0.5 rounded ${mode === 'edit' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
            >
              纯编辑
            </button>
            <button
              onClick={() => setMode('split')}
              className={`px-2 py-0.5 rounded ${mode === 'split' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
            >
              双栏对照
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`px-2 py-0.5 rounded ${mode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
            >
              纯预览
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {(mode === 'edit' || mode === 'split') && (
            <div className={`p-4 flex flex-col ${mode === 'split' ? 'w-1/2 border-r border-slate-800' : 'w-full'}`}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="以 Markdown 格式书写世界观设定..."
                className="w-full h-full bg-slate-950/40 border border-slate-700 rounded-xl p-4 text-xs font-mono text-slate-100 leading-relaxed outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          )}

          {(mode === 'preview' || mode === 'split') && (
            <div className={`p-6 overflow-y-auto ${mode === 'split' ? 'w-1/2' : 'w-full'}`}>
              <div className="max-w-none text-slate-200 leading-relaxed">
                <ReactMarkdown components={markdownComponents}>{content || '*暂无世界观设定*'}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
