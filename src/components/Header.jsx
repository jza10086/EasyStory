import React, { useEffect } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import {
  BookOpen,
  Database,
  Settings,
  PlusCircle,
  Save,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  PanelLeft,
  LayoutGrid,
  Maximize2,
  FolderGit2,
  ChevronDown
} from 'lucide-react';

export default function Header() {
  const addNode = useStoryStore((s) => s.addNode);
  const saveStoryImmediate = useStoryStore((s) => s.saveStoryImmediate);
  const saveStatus = useStoryStore((s) => s.saveStatus);
  const lastSavedTime = useStoryStore((s) => s.lastSavedTime);
  const setActiveModal = useStoryStore((s) => s.setActiveModal);
  const nodes = useStoryStore((s) => s.nodes);

  const currentProject = useStoryStore((s) => s.currentProject);
  const setIsProjectsModalOpen = useStoryStore((s) => s.setIsProjectsModalOpen);
  const fetchProjectsList = useStoryStore((s) => s.fetchProjectsList);

  const isLeftSidebarOpen = useStoryStore((s) => s.isLeftSidebarOpen);
  const toggleLeftSidebar = useStoryStore((s) => s.toggleLeftSidebar);
  const activeWorkspace = useStoryStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useStoryStore((s) => s.setActiveWorkspace);
  const canvasActions = useStoryStore((s) => s.canvasActions);

  useEffect(() => {
    fetchProjectsList();
  }, [fetchProjectsList]);

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveStoryImmediate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveStoryImmediate]);

  return (
    <header className="h-14 bg-slate-900/95 border-b border-slate-800 px-4 flex items-center justify-between z-20 backdrop-blur select-none">
      {/* Brand & Left Controls */}
      <div className="flex items-center gap-3">
        {/* Toggle Left Sidebar */}
        <button
          onClick={toggleLeftSidebar}
          className={`p-1.5 rounded-lg border transition-colors ${
            isLeftSidebarOpen
              ? 'bg-sky-600/20 border-sky-500/40 text-sky-400 hover:bg-sky-600/30'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
          title={isLeftSidebarOpen ? '折叠左侧资料库' : '展开左侧资料库'}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Brand Icon */}
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
          <BookOpen className="w-4 h-4" />
        </div>

        {/* Brand Title & Project Switcher */}
        <div className="flex items-center gap-2.5">
          <h1 className="text-sm font-bold text-slate-100 tracking-wide">
            StoryFlow <span className="text-xs font-normal text-sky-400">剧流 · 分支剧情工坊</span>
          </h1>

          {/* Project Switcher Pill Button */}
          <button
            onClick={() => setIsProjectsModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 hover:border-sky-500/50 text-slate-200 hover:text-white transition-all text-xs group cursor-pointer"
            title="点击管理与切换企划"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
            <span className="font-medium max-w-[130px] truncate">
              {currentProject?.name || '以太纪元'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-sky-400 transition-colors" />
          </button>

          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            共 {nodes.length} 个节点
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800 mx-1" />

        {/* Global Workspace Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveWorkspace('nodes')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeWorkspace === 'nodes'
                ? 'bg-sky-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            情节节点
          </button>
          <button
            onClick={() => setActiveWorkspace('database')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeWorkspace === 'database'
                ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            设定资料库
          </button>
          <button
            onClick={() => setActiveWorkspace('map')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activeWorkspace === 'map'
                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            世界地图与时间轴
          </button>
        </div>
      </div>

      {/* Center: Auto-save Status Indicator */}
      <div className="flex items-center gap-2 text-xs">
        {saveStatus === 'saving' && (
          <span className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            正在落盘保存至硬盘...
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            已实时落盘 {lastSavedTime ? `(${lastSavedTime})` : ''}
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            保存失败，请检查服务
          </span>
        )}
      </div>

      {/* Right Side: Contextual Tools */}
      <div className="flex items-center gap-2">
        {activeWorkspace === 'nodes' && (
          <>
            {/* Add Node */}
            <button
              onClick={() => addNode()}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md shadow-sky-500/20 transition-colors"
              title="在画布中新建一个剧情节点"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>新建节点</span>
            </button>

            {/* Auto Layout */}
            <button
              onClick={() => {
                if (canvasActions.autoLayout) {
                  canvasActions.autoLayout();
                }
              }}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
              title="一键自动对齐排版节点树"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-sky-400" />
              <span>自动排版</span>
            </button>

            {/* Fit View */}
            <button
              onClick={() => {
                if (canvasActions.fitView) {
                  canvasActions.fitView();
                }
              }}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
              title="重置画布缩放并居中所有节点"
            >
              <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>居中适应</span>
            </button>

            <div className="h-4 w-px bg-slate-800 mx-1" />
          </>
        )}

        {/* AI Settings */}
        <button
          onClick={() => setActiveModal('settings')}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
          title="配置大模型 API 密钥 (如 DeepSeek)"
        >
          <Settings className="w-3.5 h-3.5 text-purple-400" />
          <span>AI 设置</span>
        </button>

        {/* Export Story */}
        <button
          onClick={() => setActiveModal('export')}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg transition-colors"
          title="导出完整剧本文档或游戏逻辑数据"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>导出剧本</span>
        </button>

        {/* Manual Save Button */}
        <button
          onClick={() => saveStoryImmediate()}
          className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          title="立即强制保存故事 (Ctrl+S)"
        >
          <Save className="w-4 h-4 text-emerald-400" />
        </button>
      </div>
    </header>
  );
}
