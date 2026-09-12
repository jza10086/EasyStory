import React, { useState } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import { X, Plus, Trash2, Users, Upload, Heart, Shield } from 'lucide-react';

const presetColors = [
  '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'
];

export default function CharactersModal() {
  const activeModal = useStoryStore((s) => s.activeModal);
  const setActiveModal = useStoryStore((s) => s.setActiveModal);
  const characters = useStoryStore((s) => s.characters);
  const saveCharacters = useStoryStore((s) => s.saveCharacters);

  const [selectedCharId, setSelectedCharId] = useState(characters[0]?.id || null);
  const [localChars, setLocalChars] = useState([...characters]);

  if (activeModal !== 'characters') return null;

  const currentChar = localChars.find((c) => c.id === selectedCharId) || localChars[0];

  const handleUpdateChar = (field, value) => {
    if (!currentChar) return;
    const updated = localChars.map((c) =>
      c.id === currentChar.id ? { ...c, [field]: value } : c
    );
    setLocalChars(updated);
    saveCharacters(updated);
  };

  const handleAddCharacter = () => {
    const newId = `char-${Date.now().toString(36)}`;
    const newChar = {
      id: newId,
      name: '新人物',
      role: '主角伙伴 / 关键NPC',
      bio: '请在此输入人物的外貌、性格特征、背景故事及重要行为模式...',
      avatar: '',
      color: presetColors[localChars.length % presetColors.length],
      initialAffection: 50
    };
    const next = [...localChars, newChar];
    setLocalChars(next);
    setSelectedCharId(newId);
    saveCharacters(next);
  };

  const handleDeleteCharacter = (charId) => {
    if (confirm('确定要删除该角色吗？')) {
      const next = localChars.filter((c) => c.id !== charId);
      setLocalChars(next);
      setSelectedCharId(next[0]?.id || null);
      saveCharacters(next);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentChar) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        handleUpdateChar('avatar', data.url);
      }
    } catch (err) {
      alert(`上传头像失败: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-[800px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-slate-100">人物设定库</h2>
            <span className="text-xs text-slate-400">（AI 编写剧情与分支时将自动学习人物人设）</span>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content: Left Sidebar + Right Editor */}
        <div className="flex-1 flex overflow-hidden">
          {/* Character List */}
          <div className="w-60 border-r border-slate-800 bg-slate-950/40 p-3 flex flex-col justify-between">
            <div className="space-y-1.5 overflow-y-auto max-h-[500px]">
              {localChars.map((c) => {
                const isSelected = currentChar?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCharId(c.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-sky-500/15 border border-sky-500/40 text-slate-100 shadow-sm'
                        : 'border border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden"
                      style={{
                        backgroundColor: `${c.color || '#38bdf8'}33`,
                        color: c.color || '#38bdf8',
                        border: `1.5px solid ${c.color || '#38bdf8'}`
                      }}
                    >
                      {c.avatar ? (
                        <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        c.name.slice(0, 1)
                      )}
                    </div>
                    <div className="truncate flex-1">
                      <div className="text-xs font-semibold truncate">{c.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{c.role || '未定身份'}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleAddCharacter}
              className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 border border-dashed border-slate-700 hover:border-sky-500 text-slate-400 hover:text-sky-300 rounded-xl text-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加新角色</span>
            </button>
          </div>

          {/* Character Details Form */}
          {currentChar ? (
            <div className="flex-1 p-6 space-y-4 overflow-y-auto">
              {/* Basic Details */}
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="relative group shrink-0">
                  <div
                    className="w-20 h-20 rounded-2xl border-2 flex items-center justify-center overflow-hidden bg-slate-800"
                    style={{ borderColor: currentChar.color || '#38bdf8' }}
                  >
                    {currentChar.avatar ? (
                      <img src={currentChar.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold" style={{ color: currentChar.color }}>
                        {currentChar.name.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <label className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] text-white cursor-pointer transition-opacity">
                    <Upload className="w-4 h-4 mb-0.5" />
                    <span>传头像</span>
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </label>
                </div>

                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-medium">姓名</label>
                      <input
                        type="text"
                        value={currentChar.name}
                        onChange={(e) => handleUpdateChar('name', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-medium">身份 / 职业标签</label>
                      <input
                        type="text"
                        value={currentChar.role || ''}
                        onChange={(e) => handleUpdateChar('role', e.target.value)}
                        placeholder="如: 落难王储 / 精英猎兵"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  {/* Colors & Stats */}
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-medium flex items-center gap-1">
                        <Shield className="w-3 h-3 text-sky-400" />
                        代表主题色
                      </label>
                      <div className="flex items-center gap-1.5">
                        {presetColors.map((color) => (
                          <button
                            key={color}
                            onClick={() => handleUpdateChar('color', color)}
                            className={`w-5 h-5 rounded-full transition-transform ${
                              currentChar.color === color ? 'scale-125 ring-2 ring-white/50' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-medium flex items-center gap-1">
                        <Heart className="w-3 h-3 text-rose-400" />
                        初始好感度 / 羁绊值
                      </label>
                      <input
                        type="number"
                        value={currentChar.initialAffection ?? 50}
                        onChange={(e) => handleUpdateChar('initialAffection', parseInt(e.target.value) || 0)}
                        className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bio & Lore */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <label className="text-xs text-slate-300 font-medium">
                  人物性格、说话口吻、弱点与隐藏设定
                </label>
                <textarea
                  rows={8}
                  value={currentChar.bio || ''}
                  onChange={(e) => handleUpdateChar('bio', e.target.value)}
                  placeholder="描写角色的性格脾气、语癖（如口头禅）、对主角的态度、不为人知的动机..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 leading-relaxed outline-none focus:border-sky-500 resize-none"
                />
              </div>

              {/* Danger Zone */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => handleDeleteCharacter(currentChar.id)}
                  className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除该角色</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              请选择或添加角色
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
