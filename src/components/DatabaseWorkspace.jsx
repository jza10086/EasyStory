import React, { useState, useMemo, useRef } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import ReactMarkdown from 'react-markdown';
import {
  Database,
  Users,
  Globe,
  Zap,
  History,
  Folder,
  Tag,
  Search,
  Plus,
  X,
  Edit2,
  Trash2,
  Filter,
  Sparkles,
  BookOpen,
  Heart,
  Eye,
  FileText,
  Shield,
  Check,
  CheckCircle2,
  Palette,
  Image as ImageIcon,
  Upload,
  Star,
  LayoutGrid,
  Square,
  Loader2,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';

const ICON_MAP = {
  Users,
  Globe,
  Zap,
  History,
  Folder,
  BookOpen,
  Sparkles,
  Shield
};

const COLOR_PRESETS = [
  '#38bdf8', // Sky
  '#ec4899', // Pink
  '#818cf8', // Indigo
  '#a855f7', // Purple
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#64748b'  // Slate
];

export default function DatabaseWorkspace() {
  const setActiveWorkspace = useStoryStore((s) => s.setActiveWorkspace);
  const database = useStoryStore((s) => s.database) || { categories: [], entries: [] };
  const activeDatabaseCategory = useStoryStore((s) => s.activeDatabaseCategory);
  const setActiveDatabaseCategory = useStoryStore((s) => s.setActiveDatabaseCategory);
  const selectedDatabaseTag = useStoryStore((s) => s.selectedDatabaseTag);
  const setSelectedDatabaseTag = useStoryStore((s) => s.setSelectedDatabaseTag);
  const databaseSearchKeyword = useStoryStore((s) => s.databaseSearchKeyword);
  const setDatabaseSearchKeyword = useStoryStore((s) => s.setDatabaseSearchKeyword);

  const saveDatabaseEntry = useStoryStore((s) => s.saveDatabaseEntry);
  const deleteDatabaseEntry = useStoryStore((s) => s.deleteDatabaseEntry);
  const saveDatabaseCategory = useStoryStore((s) => s.saveDatabaseCategory);
  const deleteDatabaseCategory = useStoryStore((s) => s.deleteDatabaseCategory);

  const categories = database.categories || [];
  const entries = database.entries || [];

  // View layout: 'auto' (respect each card's cardStyle) | 'standard' | 'square'
  const [viewLayout, setViewLayout] = useState('auto');

  // Active Category object
  const activeCategory = categories.find((c) => c.id === activeDatabaseCategory) || categories[0] || {
    id: 'general',
    name: '默认资料',
    icon: 'Folder',
    isCharacterType: false
  };

  // State for Card Editor
  const [editingEntry, setEditingEntry] = useState(null); // null = closed, object = editing/creating
  const [cardSaveStatus, setCardSaveStatus] = useState('saved'); // 'saving' | 'saved'
  const [editorTab, setEditorTab] = useState('content'); // 'content' | 'preview'
  const [tagInput, setTagInput] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Auto-save debounce timer and reference to current state
  const autoSaveTimerRef = useRef(null);
  const latestEditingEntryRef = useRef(editingEntry);
  latestEditingEntryRef.current = editingEntry;

  // State for Category Creator Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState({
    name: '',
    description: '',
    icon: 'Folder',
    isCharacterType: false
  });

  // Filter entries for current active category, search keyword, and tag
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (e.categoryId !== activeCategory.id) return false;
      if (selectedDatabaseTag && (!Array.isArray(e.tags) || !e.tags.includes(selectedDatabaseTag))) {
        return false;
      }
      if (databaseSearchKeyword.trim()) {
        const kw = databaseSearchKeyword.toLowerCase();
        const titleMatch = (e.title || e.name || '').toLowerCase().includes(kw);
        const bioMatch = (e.summary || e.bio || e.content || '').toLowerCase().includes(kw);
        const tagMatch = (e.tags || []).some((t) => t.toLowerCase().includes(kw));
        return titleMatch || bioMatch || tagMatch;
      }
      return true;
    });
  }, [entries, activeCategory.id, selectedDatabaseTag, databaseSearchKeyword]);

  // All tags in active category
  const activeCategoryTags = useMemo(() => {
    const setTags = new Set();
    entries
      .filter((e) => e.categoryId === activeCategory.id)
      .forEach((e) => {
        if (Array.isArray(e.tags)) {
          e.tags.forEach((t) => setTags.add(t));
        }
      });
    return Array.from(setTags);
  }, [entries, activeCategory.id]);

  const renderIcon = (iconName, className = 'w-4 h-4') => {
    const IconComponent = ICON_MAP[iconName] || Folder;
    return <IconComponent className={className} />;
  };

  // Persist entry to store / server
  const persistEntry = async (rawEntry) => {
    if (!rawEntry) return;
    const finalName = (rawEntry.title || rawEntry.name || '').trim();
    if (!finalName) return;

    const finalImages = Array.isArray(rawEntry.images) ? rawEntry.images : [];
    const finalPreview = rawEntry.previewImage || finalImages[0] || '';
    const isChar = activeCategory.isCharacterType || rawEntry.categoryId === 'characters';

    const normalized = {
      ...rawEntry,
      id: rawEntry.id || `entry-${Date.now().toString(36)}`,
      title: finalName,
      name: finalName,
      bio: rawEntry.bio || rawEntry.summary || '',
      summary: rawEntry.summary || rawEntry.bio || '',
      images: finalImages,
      previewImage: finalPreview,
      image: finalPreview,
      avatar: isChar ? (rawEntry.avatar || finalPreview) : (rawEntry.avatar || ''),
      cardStyle: rawEntry.cardStyle || 'standard',
      color: rawEntry.color || '#38bdf8'
    };

    if (!rawEntry.id && normalized.id) {
      setEditingEntry((prev) => (prev ? { ...prev, id: normalized.id } : null));
    }

    await saveDatabaseEntry(normalized);
    return normalized;
  };

  // Real-time update helper with debounce auto-save
  const updateEditingEntry = (updates) => {
    setEditingEntry((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updates };
      latestEditingEntryRef.current = next;

      const hasTitle = (next.title || next.name || '').trim();
      if (hasTitle) {
        setCardSaveStatus('saving');
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(async () => {
          try {
            await persistEntry(next);
            setCardSaveStatus('saved');
          } catch (e) {
            console.error('Auto save error:', e);
          }
        }, 500);
      }
      return next;
    });
  };

  // Open editor for new entry
  const handleCreateNewEntry = () => {
    const defaultStyle = activeCategory.id === 'tech' ? 'square' : 'standard';
    const newEntry = {
      id: '',
      categoryId: activeCategory.id,
      title: '',
      name: '',
      tags: [],
      role: '',
      bio: '',
      summary: '',
      content: '',
      avatar: '',
      image: '',
      images: [],
      previewImage: '',
      cardStyle: defaultStyle,
      color: '#38bdf8',
      initialAffection: 50
    };
    setEditingEntry(newEntry);
    latestEditingEntryRef.current = newEntry;
    setCardSaveStatus('saved');
    setTagInput('');
    setImageUrlInput('');
    setEditorTab('content');
  };

  // Open editor for existing entry
  const handleEditEntry = (entry) => {
    const entryImages = Array.isArray(entry.images) && entry.images.length > 0
      ? [...entry.images]
      : (entry.previewImage ? [entry.previewImage] : (entry.image ? [entry.image] : (entry.avatar ? [entry.avatar] : [])));
    const entryPreview = entry.previewImage || entry.image || entry.avatar || (entryImages[0] || '');

    const loadedEntry = {
      ...entry,
      title: entry.title || entry.name || '',
      name: entry.name || entry.title || '',
      tags: Array.isArray(entry.tags) ? [...entry.tags] : [],
      images: entryImages,
      previewImage: entryPreview,
      cardStyle: entry.cardStyle || 'standard',
      color: entry.color || '#38bdf8',
      initialAffection: entry.initialAffection ?? 50
    };

    setEditingEntry(loadedEntry);
    latestEditingEntryRef.current = loadedEntry;
    setCardSaveStatus('saved');
    setTagInput('');
    setImageUrlInput('');
    setEditorTab('content');
  };

  // Close drawer and immediately flush save
  const handleCloseDrawer = async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    if (latestEditingEntryRef.current) {
      await persistEntry(latestEditingEntryRef.current);
    }
    setEditingEntry(null);
  };

  // Tag helpers
  const handleAddTag = (tagToAdd) => {
    const val = (tagToAdd || tagInput).trim();
    if (!val) return;
    const curTags = editingEntry?.tags || [];
    if (!curTags.includes(val)) {
      updateEditingEntry({ tags: [...curTags, val] });
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove) => {
    const curTags = editingEntry?.tags || [];
    updateEditingEntry({ tags: curTags.filter((t) => t !== tagToRemove) });
  };

  // Image helpers
  const handleLocalImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.url) {
        const curImages = editingEntry?.images || [];
        const nextImages = [...curImages, data.url];
        updateEditingEntry({
          images: nextImages,
          previewImage: editingEntry?.previewImage || data.url
        });
      } else {
        alert('上传失败: ' + (data.error || '未知错误'));
      }
    } catch (err) {
      alert('上传出错: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddImageUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    const curImages = editingEntry?.images || [];
    if (!curImages.includes(url)) {
      const nextImages = [...curImages, url];
      updateEditingEntry({
        images: nextImages,
        previewImage: editingEntry?.previewImage || url
      });
    }
    setImageUrlInput('');
  };

  const handleSetPreviewImage = (url) => {
    updateEditingEntry({ previewImage: url });
  };

  const handleRemoveImage = (urlToRemove) => {
    const curImages = editingEntry?.images || [];
    const nextImages = curImages.filter((u) => u !== urlToRemove);
    let nextPreview = editingEntry?.previewImage;
    if (nextPreview === urlToRemove) {
      nextPreview = nextImages[0] || '';
    }
    updateEditingEntry({
      images: nextImages,
      previewImage: nextPreview
    });
  };

  // Category helpers
  const handleSaveCategory = async () => {
    if (!newCategoryData.name.trim()) {
      alert('请填写分类名称');
      return;
    }
    const createdCat = await saveDatabaseCategory({
      name: newCategoryData.name.trim(),
      description: newCategoryData.description.trim(),
      icon: newCategoryData.icon,
      isCharacterType: newCategoryData.isCharacterType
    });
    setActiveDatabaseCategory(createdCat.id);
    setIsCategoryModalOpen(false);
    setNewCategoryData({
      name: '',
      description: '',
      icon: 'Folder',
      isCharacterType: false
    });
  };

  const handleDeleteCategory = async (catId, catName) => {
    if (['characters', 'world'].includes(catId)) {
      alert('核心基础分类不可删除');
      return;
    }
    if (confirm(`确定要删除分类“${catName}”及其下所有档案条目吗？此操作不可逆。`)) {
      await deleteDatabaseCategory(catId);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Top Main Navigation Bar */}
      <header className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/90 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>设定资料库工作台</span>
              <span className="text-[11px] font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                共 {entries.length} 篇档案条目
              </span>
            </h2>
          </div>
        </div>

        {/* Global Search & Action Buttons */}
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={databaseSearchKeyword}
              onChange={(e) => setDatabaseSearchKeyword(e.target.value)}
              placeholder="搜索所有档案与设定..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
            />
            {databaseSearchKeyword && (
              <button
                onClick={() => setDatabaseSearchKeyword('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={handleCreateNewEntry}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md shadow-sky-500/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新建档案卡片</span>
          </button>

          <button
            onClick={() => setActiveWorkspace('nodes')}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 transition-colors ml-1"
            title="返回剧情大纲画布"
          >
            <span>返回剧情画布</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Category Navigator Rail */}
        <aside className="w-64 border-r border-slate-800 bg-slate-900/60 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              档案分类目录
            </span>
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium hover:underline"
              title="新建自定义分类（例如科技库、道具库、事件库）"
            >
              <Plus className="w-3 h-3" /> 新建分类
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {categories.map((cat) => {
              const isActive = activeDatabaseCategory === cat.id;
              const count = entries.filter((e) => e.categoryId === cat.id).length;
              const isBuiltIn = ['characters', 'world'].includes(cat.id);

              return (
                <div
                  key={cat.id}
                  onClick={() => {
                    setActiveDatabaseCategory(cat.id);
                    setSelectedDatabaseTag(null);
                  }}
                  className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                    isActive
                      ? 'bg-sky-600/90 text-white font-medium shadow-md shadow-sky-600/20'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {renderIcon(cat.icon, `w-4 h-4 ${isActive ? 'text-white' : 'text-sky-400'}`)}
                    <span className="truncate">{cat.name}</span>
                    {cat.isCharacterType && (
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-normal ${
                          isActive ? 'bg-sky-700 text-sky-100' : 'bg-slate-800 text-indigo-300'
                        }`}
                      >
                        人物型
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-sky-700/80 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {count}
                    </span>

                    {!isBuiltIn && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(cat.id, cat.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 rounded transition-opacity"
                        title="删除分类"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Category info box */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
            <p className="font-medium text-slate-300 mb-0.5">{activeCategory.name}</p>
            <p className="text-[11px] leading-relaxed">
              {activeCategory.description || '自定义档案分类，可自由添加标签与卡片条目。'}
            </p>
          </div>
        </aside>

        {/* Right Side: Category Dashboard & Card Grid */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950/50">
          {/* Subheader: Category Banner, View Layout Switcher & Tag Filter Row */}
          <div className="p-4 border-b border-slate-800 shrink-0 bg-slate-900/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-sky-400">
                  {renderIcon(activeCategory.icon, 'w-5 h-5')}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    {activeCategory.name}
                    <span className="text-xs font-normal text-slate-400">
                      ({filteredEntries.length} 条记录)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {activeCategory.description || '支持卡片式多标签筛选与完整 Markdown 文档渲染'}
                  </p>
                </div>
              </div>

              {/* View Layout Switcher & Add Entry Quick Button */}
              <div className="flex items-center gap-3">
                {/* Layout Mode Toggle */}
                <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => setViewLayout('auto')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                      viewLayout === 'auto'
                        ? 'bg-sky-600 text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="按卡片自定样式展示（道具自动显示方卡，设定显示标准卡）"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>自适应</span>
                  </button>
                  <button
                    onClick={() => setViewLayout('standard')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                      viewLayout === 'standard'
                        ? 'bg-sky-600 text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="强制全网格标准图文模式"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>标准图文</span>
                  </button>
                  <button
                    onClick={() => setViewLayout('square')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                      viewLayout === 'square'
                        ? 'bg-sky-600 text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="强制方形图鉴模式（仅显示名称与预览图片，特别适合关键道具/秘宝）"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>方形图鉴</span>
                  </button>
                </div>

                <button
                  onClick={handleCreateNewEntry}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-sky-400" />
                  <span>新建卡片</span>
                </button>
              </div>
            </div>

            {/* Tag Filter Pills Bar */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                <Filter className="w-3 h-3" /> 标签筛选:
              </span>
              <button
                onClick={() => setSelectedDatabaseTag(null)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                  selectedDatabaseTag === null
                    ? 'bg-sky-600 text-white font-medium shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/60'
                }`}
              >
                全部 ({entries.filter((e) => e.categoryId === activeCategory.id).length})
              </button>

              {activeCategoryTags.map((tag) => {
                const isSelected = selectedDatabaseTag === tag;
                const count = entries.filter(
                  (e) => e.categoryId === activeCategory.id && Array.isArray(e.tags) && e.tags.includes(tag)
                ).length;

                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedDatabaseTag(isSelected ? null : tag)}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-medium shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    <Tag className="w-3 h-3 opacity-70" />
                    <span>{tag}</span>
                    <span className="text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cards Grid Area with generous padding & margins */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8">
            {filteredEntries.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
                <FileText className="w-10 h-10 text-slate-400 mb-3" />
                <h4 className="text-sm font-semibold text-slate-300 mb-1">
                  当前分类下没有匹配的档案卡片
                </h4>
                <p className="text-xs text-slate-400 mb-4 max-w-sm">
                  {selectedDatabaseTag
                    ? `没有带有 “${selectedDatabaseTag}” 标签的档案条目，请尝试重置标签筛选。`
                    : '立即创建第一张卡片，开始构建丰满的游戏设定、关键道具与人物。'}
                </p>
                <button
                  onClick={handleCreateNewEntry}
                  className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-md shadow-sky-500/20 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>立即新建卡片</span>
                </button>
              </div>
            ) : (
              <div
                className={`grid ${
                  viewLayout === 'square'
                    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5'
                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                }`}
              >
                {filteredEntries.map((entry) => {
                  const isChar = activeCategory.isCharacterType || entry.categoryId === 'characters';
                  const themeColor = entry.color || '#38bdf8';
                  const previewImg = entry.previewImage || entry.image || entry.avatar || '';

                  // Determine card layout style
                  const resolvedStyle =
                    viewLayout === 'auto' ? (entry.cardStyle || 'standard') : viewLayout;

                  // -------------------------------------------------------------
                  // 1. 方形样式 (Square Style): 仅显示名称与预览大图，顶部展示通用颜色备注
                  // -------------------------------------------------------------
                  if (resolvedStyle === 'square') {
                    return (
                      <div
                        key={entry.id}
                        onClick={() => handleEditEntry(entry)}
                        className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-800 hover:border-sky-500/70 bg-slate-900 cursor-pointer shadow-lg transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-sky-500/10 flex flex-col justify-between select-none"
                      >
                        {/* Top universal color accent strip */}
                        <div
                          className="absolute top-0 left-0 right-0 h-1.5 z-20 shadow-sm"
                          style={{ backgroundColor: themeColor }}
                        />

                        {/* Background Preview Image or Fallback */}
                        {previewImg ? (
                          <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                            style={{ backgroundImage: `url(${previewImg})` }}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col items-center justify-center p-5">
                            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-sky-400 group-hover:text-sky-300 transition-colors">
                              {renderIcon(activeCategory.icon, 'w-8 h-8')}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-2 font-mono">暂无图片</span>
                          </div>
                        )}

                        {/* Top action hover bar with spacious padding */}
                        <div className="relative z-10 p-3 pt-3.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                          {entry.tags?.[0] ? (
                            <span className="text-[10px] bg-sky-500/30 text-sky-200 border border-sky-400/30 px-2 py-0.5 rounded-full backdrop-blur-md">
                              #{entry.tags[0]}
                            </span>
                          ) : (
                            <span />
                          )}

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditEntry(entry);
                              }}
                              className="p-1.5 bg-slate-900/90 hover:bg-sky-600 text-slate-300 hover:text-white rounded-lg backdrop-blur-sm transition-colors shadow"
                              title="编辑此道具卡片"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`确定要删除“${entry.title || entry.name}”卡片吗？`)) {
                                  deleteDatabaseEntry(entry.id);
                                }
                              }}
                              className="p-1.5 bg-slate-900/90 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg backdrop-blur-sm transition-colors shadow"
                              title="删除卡片"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Bottom Name Overlay with generous padding & margins */}
                        <div className="relative z-10 p-4 pt-12 pb-3.5 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent">
                          <h4 className="text-center font-bold text-sm text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate group-hover:text-sky-300 transition-colors px-1">
                            {entry.title || entry.name}
                          </h4>
                          {entry.role && (
                            <p className="text-[11px] text-center text-indigo-300 drop-shadow truncate mt-1">
                              {entry.role}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // -------------------------------------------------------------
                  // 2. 标准样式 (Standard Style): 融合预览图为质感背景，展示详细设定与标签
                  // -------------------------------------------------------------
                  return (
                    <div
                      key={entry.id}
                      onClick={() => handleEditEntry(entry)}
                      className="group relative bg-slate-900/90 hover:bg-slate-800/95 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 sm:p-5.5 flex flex-col justify-between cursor-pointer transition-all hover:shadow-xl hover:shadow-sky-500/5 overflow-hidden"
                      style={{
                        ...(previewImg
                          ? {
                              backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.90), rgba(15, 23, 42, 0.96)), url(${previewImg})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center'
                            }
                          : {})
                      }}
                    >
                      {/* Top universal color accent strip */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1.5 shadow-sm"
                        style={{ backgroundColor: themeColor }}
                      />

                      <div className="space-y-3.5">
                        {/* Card Header with generous spacing */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {isChar ? (
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-inner border border-slate-700/80"
                                style={{
                                  backgroundColor: themeColor,
                                  backgroundImage: entry.avatar ? `url(${entry.avatar})` : (previewImg ? `url(${previewImg})` : 'none'),
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center'
                                }}
                              >
                                {!entry.avatar && !previewImg && (entry.name?.[0] || '人')}
                              </div>
                            ) : previewImg ? (
                              <img
                                src={previewImg}
                                alt={entry.title}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-700/80 shrink-0 shadow-sm"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-sky-400 shrink-0 border border-slate-700">
                                {renderIcon(activeCategory.icon, 'w-4 h-4')}
                              </div>
                            )}

                            <div className="space-y-0.5">
                              <h4 className="text-sm font-semibold text-slate-100 group-hover:text-sky-300 transition-colors flex items-center gap-1.5">
                                <span>{entry.title || entry.name}</span>
                              </h4>
                              {isChar && entry.role && (
                                <p className="text-[11px] text-indigo-400 font-medium">
                                  {entry.role}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Quick action buttons */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditEntry(entry);
                              }}
                              className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-700/80 rounded-lg transition-colors"
                              title="编辑此档案卡片"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`确定要删除“${entry.title || entry.name}”卡片吗？`)) {
                                  deleteDatabaseEntry(entry.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/80 rounded-lg transition-colors"
                              title="删除此卡片"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Character Affection Indicator with comfortable padding */}
                        {isChar && (
                          <div className="bg-slate-950/70 p-2.5 px-3 rounded-xl border border-slate-800/80 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="flex items-center gap-1 text-rose-400 font-medium">
                                <Heart className="w-3 h-3 fill-rose-500 text-rose-500" /> 初始好感度
                              </span>
                              <span className="font-bold text-slate-200">
                                {entry.initialAffection ?? 50} / 100
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, Math.max(0, entry.initialAffection ?? 50))}%`,
                                  backgroundColor: themeColor
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Summary / Bio with increased line-height & margin */}
                        <p className="text-xs text-slate-300/90 line-clamp-3 leading-relaxed px-0.5 pt-0.5">
                          {entry.summary || entry.bio || entry.content || '暂无内容概要...'}
                        </p>
                      </div>

                      {/* Card Footer: Tags & Images count with clean top margin & padding */}
                      <div className="pt-3.5 mt-3.5 border-t border-slate-800/80 flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {Array.isArray(entry.tags) && entry.tags.length > 0 ? (
                            entry.tags.map((tag) => (
                              <span
                                key={tag}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDatabaseTag(tag);
                                }}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-400 hover:text-sky-300 hover:bg-slate-700 transition-colors cursor-pointer border border-slate-700/60"
                              >
                                #{tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400">无标签</span>
                          )}
                        </div>

                        {/* Image count badge */}
                        {Array.isArray(entry.images) && entry.images.length > 0 && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0 ml-1.5 bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/50">
                            <ImageIcon className="w-3 h-3 text-sky-400/80" />
                            <span>{entry.images.length}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Slide-over Card Editor Drawer / Modal: Click left backdrop to save & exit */}
      {editingEntry && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex justify-end animate-fadeIn cursor-pointer"
          onClick={handleCloseDrawer}
          title="点击左侧空白区域即可直接保存并退出编辑"
        >
          <div
            className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-slideLeft select-text cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header with auto-save status and finish button */}
            <div className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/95 shrink-0 select-none">
              <div className="flex items-center gap-2.5">
                <Edit2 className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white">
                  {editingEntry.id ? '编辑档案卡片' : '新建档案卡片'}
                </h3>
                <div
                  className="w-3.5 h-3.5 rounded-full border border-slate-700 shadow-sm ml-1"
                  style={{ backgroundColor: editingEntry.color || '#38bdf8' }}
                  title="当前卡片颜色备注"
                />
              </div>

              {/* Real-time status & Finish button */}
              <div className="flex items-center gap-3">
                {cardSaveStatus === 'saving' ? (
                  <span className="text-xs text-amber-400 flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>实时保存中...</span>
                  </span>
                ) : (
                  <span className="text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>已实时保存</span>
                  </span>
                )}

                <button
                  onClick={handleCloseDrawer}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-slate-700 shadow-sm transition-colors"
                  title="点击完成退出（或点击左侧空白区域直接退出）"
                >
                  <span>完成</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Drawer Body Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Category Selector & Title Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    所属档案分类
                  </label>
                  <select
                    value={editingEntry.categoryId}
                    onChange={(e) => updateEditingEntry({ categoryId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.isCharacterType ? '(人物)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    条目标题 / 道具名称 <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingEntry.title || editingEntry.name || ''}
                    onChange={(e) =>
                      updateEditingEntry({
                        title: e.target.value,
                        name: e.target.value
                      })
                    }
                    placeholder="例如：圣辉王印吊坠 / 艾莉丝 (Alice) / 古代以太原石"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Universal Color Note / Top Accent Strip for ALL cards */}
              <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-sky-400" />
                    <span>卡片颜色备注 (顶部条带与分类色标)</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"
                      style={{ backgroundColor: editingEntry.color || '#38bdf8' }}
                    />
                    {editingEntry.color || '#38bdf8'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateEditingEntry({ color })}
                      className={`w-7 h-7 rounded-full transition-all flex items-center justify-center ${
                        editingEntry.color === color
                          ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-slate-900 shadow-md'
                          : 'hover:scale-105 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`选择颜色备注: ${color}`}
                    >
                      {editingEntry.color === color && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ml-2 border-l border-slate-800 pl-2">
                    <span className="text-[11px] text-slate-400">自定义:</span>
                    <input
                      type="color"
                      value={editingEntry.color || '#38bdf8'}
                      onChange={(e) => updateEditingEntry({ color: e.target.value })}
                      className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer"
                      title="点击选择自定义色板"
                    />
                  </div>
                </div>
              </div>

              {/* Card Style Selector */}
              <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <label className="block text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Square className="w-3.5 h-3.5 text-sky-400" />
                  <span>卡片呈现样式</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      editingEntry.cardStyle !== 'square'
                        ? 'bg-sky-600/20 border-sky-500/60 text-sky-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cardStyle"
                      value="standard"
                      checked={editingEntry.cardStyle !== 'square'}
                      onChange={() => updateEditingEntry({ cardStyle: 'standard' })}
                      className="mt-0.5 accent-sky-500"
                    />
                    <div>
                      <div className="font-semibold text-xs text-slate-100 flex items-center gap-1">
                        <LayoutGrid className="w-3.5 h-3.5 text-sky-400" /> 标准图文卡片
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        显示简介概括、标签、属性与背景预览图，适合人物与大纲设定。
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      editingEntry.cardStyle === 'square'
                        ? 'bg-sky-600/20 border-sky-500/60 text-sky-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cardStyle"
                      value="square"
                      checked={editingEntry.cardStyle === 'square'}
                      onChange={() => updateEditingEntry({ cardStyle: 'square' })}
                      className="mt-0.5 accent-sky-500"
                    />
                    <div>
                      <div className="font-semibold text-xs text-slate-100 flex items-center gap-1">
                        <Square className="w-3.5 h-3.5 text-sky-400" /> 方形图鉴卡片
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        1:1 方形大图，仅展示名称与预览图，极度直观，专为关键道具、宝物、装备设计！
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Image Gallery & Preview Cover Manager */}
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-sky-400" />
                    <span>图片图库与背景预览封面</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    可添加多张图片，并指定其中一张作为卡片背景与预览
                  </span>
                </div>

                {/* Upload & URL Input Controls */}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleLocalImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium shadow transition-colors shrink-0 disabled:opacity-50"
                  >
                    {isUploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{isUploading ? '正在上传...' : '上传本地图片'}</span>
                  </button>

                  <div className="flex-1 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddImageUrl();
                        }
                      }}
                      placeholder="或输入图片外部链接 / 本地相对路径..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 shrink-0 transition-colors"
                    >
                      添加
                    </button>
                  </div>
                </div>

                {/* Thumbnail list with preview picker */}
                {editingEntry.images && editingEntry.images.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>点击图片下方的【设为预览封面】可指定卡片背景:</span>
                      <span className="text-sky-400 font-medium">
                        共 {editingEntry.images.length} 张图片
                      </span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {editingEntry.images.map((imgUrl, idx) => {
                        const isCurrentPreview =
                          editingEntry.previewImage === imgUrl ||
                          (!editingEntry.previewImage && idx === 0);

                        return (
                          <div
                            key={idx}
                            className={`group relative rounded-xl overflow-hidden border transition-all ${
                              isCurrentPreview
                                ? 'border-amber-400 ring-2 ring-amber-400/30 shadow-lg shadow-amber-500/10'
                                : 'border-slate-800 hover:border-slate-700'
                            } bg-slate-900 flex flex-col`}
                          >
                            <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                              <img
                                src={imgUrl}
                                alt="pic"
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />

                              {isCurrentPreview && (
                                <div className="absolute top-1.5 left-1.5 bg-amber-500 text-slate-950 font-bold text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow">
                                  <Star className="w-2.5 h-2.5 fill-slate-950" /> 预览封面
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRemoveImage(imgUrl)}
                                className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-rose-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all shadow"
                                title="删除此图"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSetPreviewImage(imgUrl)}
                              className={`w-full py-1 text-[10px] font-medium text-center transition-colors ${
                                isCurrentPreview
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                              }`}
                            >
                              {isCurrentPreview ? '★ 当前预览封面' : '设为卡片预览'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
                    <span>暂无图片，上传或粘贴链接后可设为卡片背景</span>
                  </div>
                )}
              </div>

              {/* Character specific fields */}
              {(activeCategory.isCharacterType || editingEntry.categoryId === 'characters') && (
                <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-4">
                  <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> 人物专属属性
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        身份 / 角色定位
                      </label>
                      <input
                        type="text"
                        value={editingEntry.role || ''}
                        onChange={(e) => updateEditingEntry({ role: e.target.value })}
                        placeholder="例如：圣术使 / 雇佣兵副官 / 敌对头目"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        初始好感度: <span className="text-rose-400 font-bold">{editingEntry.initialAffection ?? 50}</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={editingEntry.initialAffection ?? 50}
                        onChange={(e) =>
                          updateEditingEntry({
                            initialAffection: parseInt(e.target.value)
                          })
                        }
                        className="w-full accent-rose-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tags Editor */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  标签分类 (按 Enter 添加)
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="输入标签名后按回车，例如：核心道具、重要秘宝、主要角色..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddTag()}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg border border-slate-700 transition-colors"
                  >
                    添加
                  </button>
                </div>

                {/* Selected Tags list */}
                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                  {editingEntry.tags && editingEntry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 bg-indigo-950/80 border border-indigo-500/30 text-indigo-200 text-xs px-2.5 py-1 rounded-md"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-indigo-400 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Suggested existing tags in category */}
                {activeCategoryTags.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 flex-wrap text-[11px] text-slate-400">
                    <span>推荐标签:</span>
                    {activeCategoryTags
                      .filter((t) => !editingEntry.tags?.includes(t))
                      .slice(0, 6)
                      .map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleAddTag(t)}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 hover:text-slate-200 transition-colors"
                        >
                          +{t}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Summary Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  简要概括 / 一句话简介
                </label>
                <textarea
                  rows={2}
                  value={editingEntry.summary || editingEntry.bio || ''}
                  onChange={(e) =>
                    updateEditingEntry({
                      summary: e.target.value,
                      bio: e.target.value
                    })
                  }
                  placeholder="提供精简的概述，会显示在卡片封面与快速列表预览中..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Detailed Markdown Content */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    <span>详细设定与生平剧情（支持 Markdown）</span>
                  </label>
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setEditorTab('content')}
                      className={`px-2 py-1 rounded transition-colors ${
                        editorTab === 'content'
                          ? 'bg-sky-600 text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      编辑 Markdown
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorTab('preview')}
                      className={`px-2 py-1 rounded transition-colors ${
                        editorTab === 'preview'
                          ? 'bg-sky-600 text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Eye className="w-3 h-3 inline mr-1" /> 实时预览
                    </button>
                  </div>
                </div>

                {editorTab === 'content' ? (
                  <textarea
                    rows={12}
                    value={editingEntry.content || ''}
                    onChange={(e) => updateEditingEntry({ content: e.target.value })}
                    placeholder="使用 Markdown 自由书写设定、道具效果、背景渊源、法术原理、对话片段、历史纪要等...&#10;&#10;### 1. 核心概述&#10;- 属性特质：...&#10;- 关键秘密：..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-sky-500"
                  />
                ) : (
                  <div className="w-full min-h-[280px] bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-slate-200 prose prose-invert max-w-none overflow-y-auto">
                    {editingEntry.content ? (
                      <ReactMarkdown>{editingEntry.content}</ReactMarkdown>
                    ) : (
                      <p className="text-slate-400 italic">暂无内容以供预览</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create New Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-70 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Folder className="w-4 h-4 text-sky-400" />
                <span>新建自定义档案分类</span>
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  分类名称 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newCategoryData.name}
                  onChange={(e) =>
                    setNewCategoryData({ ...newCategoryData, name: e.target.value })
                  }
                  placeholder="例如：道具库、科技库、历史事件、地理版图"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  分类描述
                </label>
                <input
                  type="text"
                  value={newCategoryData.description}
                  onChange={(e) =>
                    setNewCategoryData({ ...newCategoryData, description: e.target.value })
                  }
                  placeholder="简要说明该分类收录的设定内容..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  选择图标
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.keys(ICON_MAP).map((iconKey) => {
                    const isSelected = newCategoryData.icon === iconKey;
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() =>
                          setNewCategoryData({ ...newCategoryData, icon: iconKey })
                        }
                        className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-colors ${
                          isSelected
                            ? 'bg-sky-600/30 border-sky-500 text-sky-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {renderIcon(iconKey, 'w-4 h-4')}
                        <span className="text-[10px]">{iconKey}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCategoryData.isCharacterType}
                    onChange={(e) =>
                      setNewCategoryData({
                        ...newCategoryData,
                        isCharacterType: e.target.checked
                      })
                    }
                    className="rounded bg-slate-950 border-slate-700 text-sky-600 focus:ring-0"
                  />
                  <span>是否为人物类型档案？（启用角色立绘、好感度、角色状态属性）</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleSaveCategory}
                className="px-4 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
              >
                创建分类
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
