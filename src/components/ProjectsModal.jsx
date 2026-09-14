import React, { useState, useEffect } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import {
  X,
  FolderGit2,
  Plus,
  Copy,
  Trash2,
  Edit3,
  Check,
  Calendar,
  Layers,
  BookOpen,
  MapPin,
  Sparkles,
  Search,
  ExternalLink,
  Clock,
  AlertTriangle
} from 'lucide-react';

export default function ProjectsModal() {
  const isProjectsModalOpen = useStoryStore((s) => s.isProjectsModalOpen);
  const setIsProjectsModalOpen = useStoryStore((s) => s.setIsProjectsModalOpen);
  const currentProject = useStoryStore((s) => s.currentProject);
  const projectsList = useStoryStore((s) => s.projectsList);
  const fetchProjectsList = useStoryStore((s) => s.fetchProjectsList);
  const switchProject = useStoryStore((s) => s.switchProject);
  const createProject = useStoryStore((s) => s.createProject);
  const updateProjectMeta = useStoryStore((s) => s.updateProjectMeta);
  const duplicateProject = useStoryStore((s) => s.duplicateProject);
  const deleteProject = useStoryStore((s) => s.deleteProject);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTemplate, setNewTemplate] = useState('empty'); // 'empty' | 'default'
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Delete confirm state
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (isProjectsModalOpen) {
      fetchProjectsList();
    }
  }, [isProjectsModalOpen, fetchProjectsList]);

  if (!isProjectsModalOpen) return null;

  const handleStartCreate = () => {
    setNewName('');
    setNewDescription('');
    setNewTemplate('empty');
    setIsCreating(true);
    setEditingId(null);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSubmitting(true);
    const res = await createProject({
      name: newName.trim(),
      description: newDescription.trim(),
      template: newTemplate
    });
    setIsSubmitting(false);
    if (res.success) {
      setIsCreating(false);
      setIsProjectsModalOpen(false);
    } else {
      alert(`创建失败: ${res.error || '未知错误'}`);
    }
  };

  const handleStartEdit = (p) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditDescription(p.description || '');
    setIsCreating(false);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setIsSubmitting(true);
    const res = await updateProjectMeta(editingId, {
      name: editName.trim(),
      description: editDescription.trim()
    });
    setIsSubmitting(false);
    if (res.success) {
      setEditingId(null);
    } else {
      alert(`保存失败: ${res.error || '未知错误'}`);
    }
  };

  const handleDuplicate = async (p) => {
    if (confirm(`确定要为企划「${p.name}」创建副本吗？`)) {
      setIsSubmitting(true);
      await duplicateProject(p.id);
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (p) => {
    if (projectsList.length <= 1) {
      alert('不能删除唯一企划！');
      return;
    }
    if (confirm(`确定要彻底删除企划「${p.name}」吗？\n所有专属剧情节点、世界观与资料库卡片将一并删除，且不可恢复！`)) {
      setIsSubmitting(true);
      await deleteProject(p.id);
      setIsSubmitting(false);
      setDeletingId(null);
    }
  };

  const handleSwitch = async (projectId) => {
    if (projectId === currentProject?.id) return;
    setIsProjectsModalOpen(false);
    await switchProject(projectId);
  };

  const filteredProjects = projectsList.filter((p) => {
    if (!searchKeyword.trim()) return true;
    const kw = searchKeyword.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(kw)) ||
      (p.description && p.description.toLowerCase().includes(kw))
    );
  });

  const formatDate = (isoStr) => {
    if (!isoStr) return '未知';
    try {
      const d = new Date(isoStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-[920px] max-w-[95vw] h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                企划与作品管理
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal border border-slate-700">
                  共 {projectsList.length} 个企划
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                支持管理不同小说或剧本企划，各企划的剧情图谱、人物资料、世界观与纪事地图相互隔离。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCreating && (
              <button
                onClick={handleStartCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新建企划</span>
              </button>
            )}
            <button
              onClick={() => setIsProjectsModalOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action / Search Bar */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索企划名称或简介..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>当前打开：</span>
            <span className="font-semibold text-sky-400 bg-sky-950/60 border border-sky-800/50 px-2 py-0.5 rounded">
              {currentProject?.name || '以太纪元'}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          
          {/* Create Project Panel */}
          {isCreating && (
            <div className="bg-slate-850 border border-sky-500/40 rounded-xl p-5 shadow-lg space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>创建新作品企划</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  取消
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      企划名称 <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="如：赛博朋克2077 · 边缘行者"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      企划模板预设
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewTemplate('empty')}
                        className={`px-3 py-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                          newTemplate === 'empty'
                            ? 'bg-sky-600/20 border-sky-500 text-sky-300 font-medium'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <div className="font-semibold text-slate-200">空白纯净企划</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">从零构思新剧本</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewTemplate('default')}
                        className={`px-3 py-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                          newTemplate === 'default'
                            ? 'bg-sky-600/20 border-sky-500 text-sky-300 font-medium'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <div className="font-semibold text-slate-200">带示例模版</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">预设以太纪元样例文档</div>
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    企划简介 / 创作构思
                  </label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="简述该企划的核心题材、主线灵感或创作目标..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newName.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-sky-500/20 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? '正在创建...' : '立即创建并载入'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Edit Project Panel */}
          {editingId && (
            <div className="bg-slate-850 border border-indigo-500/40 rounded-xl p-5 shadow-lg space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                  <Edit3 className="w-4 h-4" />
                  <span>编辑企划信息</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  取消
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    企划名称 <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    企划简介
                  </label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-4 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !editName.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? '保存中...' : '保存修改'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Project List Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProjects.map((p) => {
              const isActive = p.id === currentProject?.id;

              return (
                <div
                  key={p.id}
                  className={`group relative rounded-xl border p-4.5 flex flex-col justify-between transition-all duration-200 ${
                    isActive
                      ? 'bg-sky-950/30 border-sky-500/60 shadow-lg shadow-sky-950/50 ring-1 ring-sky-500/30'
                      : 'bg-slate-800/60 hover:bg-slate-800 border-slate-750 hover:border-slate-600 shadow-sm'
                  }`}
                >
                  {/* Top Bar inside Card */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-sky-500 text-white'
                              : 'bg-slate-700 text-slate-300 group-hover:text-white'
                          }`}
                        >
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-100 truncate" title={p.name}>
                          {p.name}
                        </h3>
                      </div>

                      {isActive ? (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          当前打开
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSwitch(p.id)}
                          className="shrink-0 flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-white bg-sky-600/20 hover:bg-sky-600 border border-sky-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>切换至此</span>
                        </button>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px] leading-relaxed mb-3">
                      {p.description || '暂无企划描述。点击右上角编辑按钮可补充企划简介。'}
                    </p>

                    {/* Stats badges */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-2.5 bg-slate-900/60 rounded-lg border border-slate-800/80 mb-3 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-sky-400" />
                        <span>{p.nodeCount ?? 0} 个节点</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{p.entryCount ?? 0} 条资料</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{p.epochCount ?? 0} 个时期</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Metadata & Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1" title={`更新时间: ${formatDate(p.updatedAt)}`}>
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(p.updatedAt).split(' ')[0]}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(p)}
                        className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 rounded transition-colors"
                        title="编辑企划名称与简介"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDuplicate(p)}
                        className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 rounded transition-colors"
                        title="创建该企划的完整副本"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(p)}
                        disabled={projectsList.length <= 1}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 disabled:opacity-30 disabled:hover:text-slate-400 disabled:cursor-not-allowed rounded transition-colors"
                        title={projectsList.length <= 1 ? '不能删除唯一企划' : '删除此企划'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProjects.length === 0 && (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <FolderGit2 className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs">未找到匹配的企划</p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <span>提示：每次切换企划时，当前工程的所有修改均会自动实时安全存盘。</span>
          <button
            onClick={() => setIsProjectsModalOpen(false)}
            className="px-4 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs"
          >
            完成
          </button>
        </div>

      </div>
    </div>
  );
}

