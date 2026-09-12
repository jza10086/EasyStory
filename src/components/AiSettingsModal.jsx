import React, { useState, useEffect } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import { X, Settings, Sparkles, Key, Check, Info } from 'lucide-react';

export default function AiSettingsModal() {
  const activeModal = useStoryStore((s) => s.activeModal);
  const setActiveModal = useStoryStore((s) => s.setActiveModal);
  const settings = useStoryStore((s) => s.settings);
  const saveSettings = useStoryStore((s) => s.saveSettings);

  const [form, setForm] = useState(settings);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  if (activeModal !== 'settings') return null;

  const handleSave = () => {
    saveSettings(form);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const applyPreset = (type) => {
    if (type === 'deepseek') {
      setForm({
        ...form,
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat'
      });
    } else if (type === 'siliconflow') {
      setForm({
        ...form,
        baseUrl: 'https://api.siliconflow.cn/v1',
        model: 'deepseek-ai/DeepSeek-V3'
      });
    } else if (type === 'openai') {
      setForm({
        ...form,
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini'
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-[580px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-slate-100">AI 大模型配置</h2>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-start gap-2.5 text-xs text-purple-200">
            <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <span>
              支持任何兼容 OpenAI 标准接口的大模型平台（国内首选 <b>DeepSeek</b> 或 <b>硅基流动 SiliconFlow</b>，价格极其低廉，百万字仅需几毛钱）。若不配置，也可以随时在 Antigravity 聊天窗口中让我为你推演剧情！
            </span>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">快速填入厂商预设</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => applyPreset('deepseek')}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 transition-colors"
              >
                DeepSeek 官方
              </button>
              <button
                type="button"
                onClick={() => applyPreset('siliconflow')}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 transition-colors"
              >
                硅基流动 (SiliconFlow)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('openai')}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 transition-colors"
              >
                OpenAI (官方)
              </button>
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-purple-400" />
              API Key (密钥，仅保存在你本地电脑的 settings.json)
            </label>
            <input
              type="password"
              value={form.apiKey || ''}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-purple-500"
            />
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              API Base URL (接口地址)
            </label>
            <input
              type="text"
              value={form.baseUrl || ''}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.deepseek.com"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-purple-500"
            />
          </div>

          {/* Model Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Model Name (模型名称)
            </label>
            <input
              type="text"
              value={form.model || ''}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="deepseek-chat"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-purple-500"
            />
          </div>

          {/* Temperature */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-300">发散度 / 随机性 (Temperature)</span>
              <span className="text-purple-400 font-mono">{form.temperature ?? 0.7}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.5"
              step="0.1"
              value={form.temperature ?? 0.7}
              onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-2 bg-slate-950/30">
          <button
            onClick={() => setActiveModal(null)}
            className="px-4 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-md"
          >
            {isSaved ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{isSaved ? '已保存设置！' : '保存设置'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
