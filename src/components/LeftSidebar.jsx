import React, { useState, useMemo } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import {
  GitBranch,
  Database,
  Map,
  Compass,
  MapPin,
  Clock,
  Calendar,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Folder,
  Tag,
  Users,
  Globe,
  Zap,
  History,
  BookOpen,
  Sparkles,
  Shield,
  FileText
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

export default function LeftSidebar() {
  const activeWorkspace = useStoryStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useStoryStore((s) => s.setActiveWorkspace);
  const isLeftSidebarOpen = useStoryStore((s) => s.isLeftSidebarOpen);
  const toggleLeftSidebar = useStoryStore((s) => s.toggleLeftSidebar);

  // Story Nodes states
  const nodes = useStoryStore((s) => s.nodes) || [];
  const edges = useStoryStore((s) => s.edges) || [];
  const selectedNodeId = useStoryStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useStoryStore((s) => s.setSelectedNodeId);
  const addNode = useStoryStore((s) => s.addNode);

  // Database states
  const database = useStoryStore((s) => s.database) || { categories: [], entries: [] };
  const activeDatabaseCategory = useStoryStore((s) => s.activeDatabaseCategory);
  const setActiveDatabaseCategory = useStoryStore((s) => s.setActiveDatabaseCategory);
  const selectedDatabaseTag = useStoryStore((s) => s.selectedDatabaseTag);
  const setSelectedDatabaseTag = useStoryStore((s) => s.setSelectedDatabaseTag);
  const databaseSearchKeyword = useStoryStore((s) => s.databaseSearchKeyword);
  const setDatabaseSearchKeyword = useStoryStore((s) => s.setDatabaseSearchKeyword);

  // Map states
  const mapData = useStoryStore((s) => s.mapData) || { locations: [], timeline: [] };
  const selectedMapLocationId = useStoryStore((s) => s.selectedMapLocationId);
  const setSelectedMapLocationId = useStoryStore((s) => s.setSelectedMapLocationId);
  const selectedTimelineEventId = useStoryStore((s) => s.selectedTimelineEventId);
  const setSelectedTimelineEventId = useStoryStore((s) => s.setSelectedTimelineEventId);

  // Local filter states
  const [nodeSearchText, setNodeSearchText] = useState('');
  const [mapSearchText, setMapSearchText] = useState('');

  const categories = database.categories || [];
  const entries = database.entries || [];
  const locations = mapData.locations || [];
  const timeline = mapData.timeline || [];

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    if (!nodeSearchText.trim()) return nodes;
    const kw = nodeSearchText.toLowerCase();
    return nodes.filter(
      (n) =>
        (n.data?.title || '').toLowerCase().includes(kw) ||
        (n.data?.code || '').toLowerCase().includes(kw) ||
        (n.data?.summary || '').toLowerCase().includes(kw)
    );
  }, [nodes, nodeSearchText]);

  // Database category counts
  const categoryCounts = useMemo(() => {
    const counts = {};
    categories.forEach((cat) => {
      counts[cat.id] = entries.filter((e) => e.categoryId === cat.id).length;
    });
    return counts;
  }, [categories, entries]);

  // Database tags in active category
  const currentCategoryTags = useMemo(() => {
    const tagsSet = new Set();
    entries
      .filter((e) => e.categoryId === activeDatabaseCategory)
      .forEach((e) => {
        if (Array.isArray(e.tags)) {
          e.tags.forEach((t) => tagsSet.add(t));
        }
      });
    return Array.from(tagsSet);
  }, [entries, activeDatabaseCategory]);

  // Current active epoch in map
  const currentEpoch = useMemo(() => {
    return (mapData.epochs || []).find((e) => e.id === mapData.currentEpochId) || mapData.epochs?.[0] || null;
  }, [mapData.epochs, mapData.currentEpochId]);

  const currentEpochLocations = currentEpoch?.locations || [];

  // Filtered locations for map sub-panel (epoch-aware)
  const filteredLocations = useMemo(() => {
    const list = currentEpochLocations;
    if (!mapSearchText.trim()) return list;
    const kw = mapSearchText.toLowerCase();
    return list.filter(
      (l) =>
        (l.name || l.title || '').toLowerCase().includes(kw) ||
        (l.hierarchyText || '').toLowerCase().includes(kw) ||
        (l.country || '').toLowerCase().includes(kw) ||
        (l.province || '').toLowerCase().includes(kw) ||
        (l.region || '').toLowerCase().includes(kw)
    );
  }, [currentEpochLocations, mapSearchText]);

  const renderCategoryIcon = (iconName, className = 'w-4 h-4') => {
    const IconComponent = ICON_MAP[iconName] || Folder;
    return <IconComponent className={className} />;
  };

  // Workspace Definition
  const WORKSPACES = [
    { id: 'nodes', label: '情节节点', icon: GitBranch, color: 'text-sky-400', badge: nodes.length },
    { id: 'database', label: '资料库', icon: Database, color: 'text-indigo-400', badge: entries.length },
    { id: 'map', label: '地图', icon: Map, color: 'text-emerald-400', badge: currentEpochLocations.length }
  ];

  return (
    <aside
      className={`h-full bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 z-10 select-none ${
        isLeftSidebarOpen ? 'w-64' : 'w-14'
      }`}
    >
      {/* Top Bar: Workspace Switcher & Collapse Toggle */}
      <div className="h-12 border-b border-slate-800 px-2 flex items-center justify-between shrink-0 bg-slate-950/60">
        {isLeftSidebarOpen ? (
          <>
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 flex-1 mr-1">
              {WORKSPACES.map((ws) => {
                const isActive = activeWorkspace === ws.id;
                const IconComp = ws.icon;
                return (
                  <button
                    key={ws.id}
                    onClick={() => setActiveWorkspace(ws.id)}
                    className={`flex-1 py-1 px-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                      isActive
                        ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                    title={`切换至全幅 ${ws.label}`}
                  >
                    <IconComp className={`w-3.5 h-3.5 ${isActive ? ws.color : ''}`} />
                    <span className="truncate">{ws.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={toggleLeftSidebar}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors shrink-0"
              title="折叠左侧栏"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="w-full flex flex-col items-center justify-center">
            <button
              onClick={toggleLeftSidebar}
              className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="展开侧边导航栏"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Collapsed View Rail */}
      {!isLeftSidebarOpen ? (
        <div className="flex-1 py-3 flex flex-col items-center gap-3 overflow-y-auto">
          {WORKSPACES.map((ws) => {
            const isActive = activeWorkspace === ws.id;
            const IconComp = ws.icon;
            return (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws.id)}
                className={`p-2.5 rounded-xl transition-all relative group ${
                  isActive
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={`${ws.label} (${ws.badge})`}
              >
                <IconComp className="w-4 h-4" />
                {ws.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-slate-800 border border-slate-700 text-slate-300 text-[9px] rounded-full flex items-center justify-center font-bold">
                    {ws.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        /* Expanded View: Contextual Panel */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 1. WORKSPACE: Story Nodes */}
          {activeWorkspace === 'nodes' && (
            <div className="flex-1 flex flex-col overflow-hidden animate-fadeIn">
              {/* Search nodes */}
              <div className="p-2.5 border-b border-slate-800 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={nodeSearchText}
                    onChange={(e) => setNodeSearchText(e.target.value)}
                    placeholder="搜索节点编号或标题..."
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                  {nodeSearchText && (
                    <button
                      onClick={() => setNodeSearchText('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Node List Header */}
              <div className="px-3 py-2 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800/60 shrink-0">
                <span>故事大纲节点 ({filteredNodes.length})</span>
                <button
                  onClick={() => addNode()}
                  className="text-sky-400 hover:underline flex items-center gap-0.5 normal-case font-normal"
                >
                  <Plus className="w-3 h-3" /> 新建节点
                </button>
              </div>

              {/* Node List Items */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredNodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isEnding = node.data?.endingType && node.data?.endingType !== 'none';

                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`px-2.5 py-2 rounded-xl text-xs cursor-pointer border transition-all ${
                        isSelected
                          ? 'bg-sky-600/20 border-sky-500/50 text-white font-medium shadow-sm'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-mono text-[10px] font-bold text-sky-400">
                          {node.data?.code || 'NODE'}
                        </span>
                        {isEnding && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            结局
                          </span>
                        )}
                      </div>
                      <h4 className="truncate text-xs font-semibold text-slate-100">
                        {node.data?.title || '未命名节点'}
                      </h4>
                      {node.data?.summary && (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {node.data?.summary}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer Stats */}
              <div className="p-2.5 border-t border-slate-800 shrink-0 bg-slate-950/50 text-[11px] text-slate-400 flex items-center justify-between">
                <span>总节点数: {nodes.length}</span>
                <span>连线分支: {edges.length}</span>
              </div>
            </div>
          )}

          {/* 2. WORKSPACE: Database Categories & Tags */}
          {activeWorkspace === 'database' && (
            <div className="flex-1 flex flex-col overflow-hidden animate-fadeIn">
              {/* Category Header */}
              <div className="p-2.5 border-b border-slate-800 shrink-0 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">档案分类目录</span>
                <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700">
                  {entries.length} 篇
                </span>
              </div>

              {/* Categories list */}
              <div className="p-2 space-y-1 border-b border-slate-800 shrink-0">
                {categories.map((cat) => {
                  const isActive = activeDatabaseCategory === cat.id;
                  const count = categoryCounts[cat.id] || 0;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveDatabaseCategory(cat.id);
                        setSelectedDatabaseTag(null);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        isActive
                          ? 'bg-sky-600 text-white font-medium shadow-sm shadow-sky-600/30'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {renderCategoryIcon(cat.icon, `w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-sky-400'}`)}
                        <span className="truncate">{cat.name}</span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isActive ? 'bg-sky-700/60 text-sky-100' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Tag filters section */}
              {currentCategoryTags.length > 0 && (
                <div className="p-2.5 border-b border-slate-800 shrink-0 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1 font-semibold">
                      <Tag className="w-3 h-3 text-sky-400" /> 当前分类标签
                    </span>
                    {selectedDatabaseTag && (
                      <button
                        onClick={() => setSelectedDatabaseTag(null)}
                        className="text-sky-400 hover:underline"
                      >
                        清除筛选
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {currentCategoryTags.map((tag) => {
                      const isTagActive = selectedDatabaseTag === tag;
                      return (
                        <button
                          key={tag}
                          onClick={() => setSelectedDatabaseTag(tag)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                            isTagActive
                              ? 'bg-sky-600 border-sky-400 text-white font-semibold'
                              : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick info */}
              <div className="flex-1 p-3 text-[11px] text-slate-400 leading-relaxed overflow-y-auto">
                <p className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                  💡 右侧工作台现已全幅铺展。可点击上方分类与标签实时筛选卡片，支持方形卡片、多图相册与实时自动落盘保存。
                </p>
              </div>
            </div>
          )}

          {/* 3. WORKSPACE: Map & Timeline Quick Index */}
          {activeWorkspace === 'map' && (
            <div className="flex-1 flex flex-col overflow-hidden animate-fadeIn">
              {/* Search Map */}
              <div className="p-2.5 border-b border-slate-800 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={mapSearchText}
                    onChange={(e) => setMapSearchText(e.target.value)}
                    placeholder="搜索地标或区域..."
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  {mapSearchText && (
                    <button
                      onClick={() => setMapSearchText('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Locations List Header */}
              <div className="px-3 py-2 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800/60 shrink-0">
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="truncate">地标索引 · {currentEpoch?.name || '当前时期'}</span>
                  <span className="text-slate-500">({filteredLocations.length})</span>
                </span>
              </div>

              {/* Locations items */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredLocations.length === 0 ? (
                  <div className="py-12 px-4 text-center text-slate-500 text-xs flex flex-col items-center justify-center select-none">
                    <MapPin className="w-8 h-8 mb-2 text-slate-600 opacity-40" />
                    <p className="font-medium text-slate-400">当前时期暂无地标</p>
                    <p className="text-[10px] text-slate-500 mt-1">在地图空白处右键即可新建地点</p>
                  </div>
                ) : (
                  filteredLocations.map((loc) => {
                    const isSelected = selectedMapLocationId === loc.id;
                    const locColor = loc.color || '#38bdf8';
                    const regionOrCountry = loc.hierarchyText || [loc.country, loc.province || loc.city].filter(Boolean).join(' · ') || loc.region;

                    return (
                      <div
                        key={loc.id}
                        onClick={() => setSelectedMapLocationId(isSelected ? null : loc.id)}
                        className={`px-2.5 py-2 rounded-xl text-xs cursor-pointer border transition-all ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500/60 text-white font-medium shadow-sm'
                            : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: locColor }}
                            />
                            <span className="truncate font-semibold text-slate-100">{loc.name || loc.title}</span>
                          </div>
                          {regionOrCountry && (
                            <span className="text-[9px] text-slate-400 bg-slate-800 px-1 py-0.2 rounded shrink-0 max-w-[90px] truncate">
                              {regionOrCountry}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Timeline Epochs Summary Footer */}
              <div className="p-2.5 border-t border-slate-800 shrink-0 bg-slate-950/50 text-[11px] text-slate-400 flex items-center justify-between">
                <span>当前时期地标: {currentEpochLocations.length}</span>
                <span>{currentEpoch?.timeRange ? `${currentEpoch.timeRange[0]} ~ ${currentEpoch.timeRange[1]}年` : ''}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
