import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import ReactMarkdown from 'react-markdown';
import { preloadGeoAssets } from '../services/geoPreloader';
import { reverseGeocode, searchAdministrativeDivisions } from '../services/geoHierarchyService';
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
  ChevronRight,
  MapPin,
  Compass,
  Clock,
  Calendar
} from 'lucide-react';

const ICON_MAP = {
  Users,
  Globe,
  Zap,
  History,
  Folder,
  BookOpen,
  Sparkles,
  Shield,
  MapPin,
  Compass
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

  // Map & Epoch Location Store actions
  const mapData = useStoryStore((s) => s.mapData) || { epochs: [] };
  const saveEpochLocation = useStoryStore((s) => s.saveEpochLocation);
  const deleteEpochLocation = useStoryStore((s) => s.deleteEpochLocation);
  const setSelectedMapLocationId = useStoryStore((s) => s.setSelectedMapLocationId);
  const selectEpoch = useStoryStore((s) => s.selectEpoch);
  const focusTimelineEvent = useStoryStore((s) => s.focusTimelineEvent);
  const injectEntityToCopilot = useStoryStore((s) => s.injectEntityToCopilot);

  const categories = database.categories || [];
  const entries = database.entries || [];

  const allCharacters = useMemo(() => {
    return entries.filter((e) => e.categoryId === 'characters' || e.isCharacterType);
  }, [entries]);

  // View layout: 'auto' (respect each card's cardStyle) | 'standard' | 'square'
  const [viewLayout, setViewLayout] = useState('auto');

  // Active Category object
  const activeCategory = categories.find((c) => c.id === activeDatabaseCategory) || categories[0] || {
    id: 'general',
    name: '默认资料',
    icon: 'Folder',
    isCharacterType: false
  };

  // State for Map Epoch Folders (when in 'locations' or 'events' category)
  const [selectedEpochFolderId, setSelectedEpochFolderId] = useState(() => {
    return mapData.currentEpochId || mapData.epochs?.[0]?.id || 'epoch-pre-ww3';
  });

  // State for Administrative division search (for location cards)
  const [divisionQuery, setDivisionQuery] = useState('');
  const [divisionResults, setDivisionResults] = useState([]);
  const [isDivisionDropdownOpen, setIsDivisionDropdownOpen] = useState(false);

  // Preload geo assets for reverse geocoding & autocomplete
  useEffect(() => {
    preloadGeoAssets().catch(() => {});
  }, []);

  // Sync selectedEpochFolderId if mapData changes
  useEffect(() => {
    if (mapData.epochs && mapData.epochs.length > 0) {
      const exists = mapData.epochs.some((e) => e.id === selectedEpochFolderId);
      if (!exists) {
        setSelectedEpochFolderId(mapData.currentEpochId || mapData.epochs[0].id);
      }
    }
  }, [mapData.epochs, mapData.currentEpochId, selectedEpochFolderId]);

  const currentEpochFolder = mapData.epochs?.find((e) => e.id === selectedEpochFolderId) || mapData.epochs?.[0];
  const currentEpochLocations = currentEpochFolder?.locations || [];

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
    if (activeCategory.id === 'locations') {
      return currentEpochLocations.filter((loc) => {
        if (selectedDatabaseTag && (!Array.isArray(loc.tags) || !loc.tags.includes(selectedDatabaseTag))) {
          return false;
        }
        if (databaseSearchKeyword.trim()) {
          const kw = databaseSearchKeyword.toLowerCase();
          const titleMatch = (loc.title || loc.name || '').toLowerCase().includes(kw);
          const bioMatch = (loc.summary || loc.description || loc.content || '').toLowerCase().includes(kw);
          const geoMatch = (loc.hierarchyText || loc.country || loc.province || loc.continent || '').toLowerCase().includes(kw);
          const tagMatch = (loc.tags || []).some((t) => t.toLowerCase().includes(kw));
          return titleMatch || bioMatch || geoMatch || tagMatch;
        }
        return true;
      });
    }

    if (activeCategory.id === 'events') {
      return entries.filter((e) => {
        if (e.categoryId !== 'events') return false;
        if (selectedEpochFolderId && selectedEpochFolderId !== 'all') {
          const epId = e.epochId || mapData.epochs?.[0]?.id;
          if (epId !== selectedEpochFolderId) return false;
        }
        if (selectedDatabaseTag && (!Array.isArray(e.tags) || !e.tags.includes(selectedDatabaseTag))) {
          return false;
        }
        if (databaseSearchKeyword.trim()) {
          const kw = databaseSearchKeyword.toLowerCase();
          const titleMatch = (e.title || e.name || '').toLowerCase().includes(kw);
          const bioMatch = (e.summary || e.bio || e.content || '').toLowerCase().includes(kw);
          const locMatch = (e.locationName || e.hierarchyText || '').toLowerCase().includes(kw);
          const charMatch = (e.characters || []).some((c) => (c.name || '').toLowerCase().includes(kw)) ||
            (e.customCharacters || '').toLowerCase().includes(kw);
          const tagMatch = (e.tags || []).some((t) => t.toLowerCase().includes(kw));
          return titleMatch || bioMatch || locMatch || charMatch || tagMatch;
        }
        return true;
      });
    }

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
  }, [entries, activeCategory.id, selectedDatabaseTag, databaseSearchKeyword, currentEpochLocations, selectedEpochFolderId, mapData.epochs]);

  // All tags in active category
  const activeCategoryTags = useMemo(() => {
    const setTags = new Set();
    if (activeCategory.id === 'locations') {
      currentEpochLocations.forEach((e) => {
        if (Array.isArray(e.tags)) {
          e.tags.forEach((t) => setTags.add(t));
        }
      });
    } else {
      entries
        .filter((e) => e.categoryId === activeCategory.id)
        .forEach((e) => {
          if (Array.isArray(e.tags)) {
            e.tags.forEach((t) => setTags.add(t));
          }
        });
    }
    return Array.from(setTags);
  }, [entries, activeCategory.id, currentEpochLocations]);

  const renderIcon = (iconName, className = 'w-4 h-4') => {
    const IconComponent = ICON_MAP[iconName] || Folder;
    return <IconComponent className={className} />;
  };

  // Persist entry to store / server
  const persistEntry = async (rawEntry) => {
    if (!rawEntry) return;
    const finalName = (rawEntry.title || rawEntry.name || '').trim();
    if (!finalName) return;

    // Handle Location category persistence to Epoch Locations
    if (rawEntry.categoryId === 'locations' || activeCategory.id === 'locations') {
      const targetEpochId = rawEntry.epochId || selectedEpochFolderId || mapData.currentEpochId || mapData.epochs?.[0]?.id;
      const finalImages = Array.isArray(rawEntry.images) ? rawEntry.images : [];
      const finalPreview = rawEntry.previewImage || finalImages[0] || '';

      const normalizedLoc = {
        ...rawEntry,
        id: rawEntry.id || `loc-${Date.now().toString(36)}`,
        categoryId: 'locations',
        epochId: targetEpochId,
        title: finalName,
        name: finalName,
        continent: rawEntry.continent || '亚洲',
        country: rawEntry.country || '',
        province: rawEntry.province || '',
        city: rawEntry.city || '',
        lat: typeof rawEntry.lat === 'number' ? rawEntry.lat : 30.0,
        lng: typeof rawEntry.lng === 'number' ? rawEntry.lng : 110.0,
        centerLat: typeof rawEntry.centerLat === 'number' ? rawEntry.centerLat : (rawEntry.lat || 30.0),
        centerLng: typeof rawEntry.centerLng === 'number' ? rawEntry.centerLng : (rawEntry.lng || 110.0),
        isSnappedToCenter: !!rawEntry.isSnappedToCenter,
        hierarchyText: rawEntry.hierarchyText || [rawEntry.continent, rawEntry.country, rawEntry.province || rawEntry.city].filter(Boolean).join(' · '),
        summary: rawEntry.summary || rawEntry.description || '',
        description: rawEntry.description || rawEntry.summary || '',
        content: rawEntry.content || '',
        tags: Array.isArray(rawEntry.tags) ? rawEntry.tags : ['据点'],
        images: finalImages,
        previewImage: finalPreview,
        cardStyle: rawEntry.cardStyle || 'standard',
        color: rawEntry.color || '#38bdf8'
      };

      if (!rawEntry.id && normalizedLoc.id) {
        setEditingEntry((prev) => (prev ? { ...prev, id: normalizedLoc.id } : null));
      }

      await saveEpochLocation(targetEpochId, normalizedLoc);
      return normalizedLoc;
    }

    // Handle Event category persistence
    if (rawEntry.categoryId === 'events' || activeCategory.id === 'events') {
      const targetEpochId = rawEntry.epochId || (selectedEpochFolderId !== 'all' ? selectedEpochFolderId : null) || mapData.currentEpochId || mapData.epochs?.[0]?.id || 'epoch-pre-ww3';
      const finalImages = Array.isArray(rawEntry.images) ? rawEntry.images : [];
      const finalPreview = rawEntry.previewImage || finalImages[0] || '';

      const normalizedEvent = {
        ...rawEntry,
        id: rawEntry.id || `evt-${Date.now().toString(36)}`,
        categoryId: 'events',
        epochId: targetEpochId,
        year: typeof rawEntry.year === 'number' ? rawEntry.year : 2024,
        timeLabel: rawEntry.timeLabel || `${rawEntry.year || 2024}年`,
        title: finalName,
        name: finalName,
        locationId: rawEntry.locationId || '',
        locationName: rawEntry.locationName || '',
        hierarchyText: rawEntry.hierarchyText || '',
        continent: rawEntry.continent || '',
        country: rawEntry.country || '',
        province: rawEntry.province || '',
        city: rawEntry.city || '',
        lng: typeof rawEntry.lng === 'number' ? rawEntry.lng : undefined,
        lat: typeof rawEntry.lat === 'number' ? rawEntry.lat : undefined,
        characterIds: Array.isArray(rawEntry.characterIds) ? rawEntry.characterIds : [],
        characters: Array.isArray(rawEntry.characters) ? rawEntry.characters : [],
        customCharacters: rawEntry.customCharacters || '',
        summary: rawEntry.summary || rawEntry.bio || '',
        bio: rawEntry.bio || rawEntry.summary || '',
        description: rawEntry.summary || rawEntry.bio || '',
        content: rawEntry.content || '',
        tags: Array.isArray(rawEntry.tags) && rawEntry.tags.length ? rawEntry.tags : ['历史事件'],
        images: finalImages,
        previewImage: finalPreview,
        cardStyle: rawEntry.cardStyle || 'standard',
        color: rawEntry.color || '#f59e0b'
      };

      if (!rawEntry.id && normalizedEvent.id) {
        setEditingEntry((prev) => (prev ? { ...prev, id: normalizedEvent.id } : null));
      }

      await saveDatabaseEntry(normalizedEvent);
      return normalizedEvent;
    }

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
    if (activeCategory.id === 'locations') {
      const targetEpoch = selectedEpochFolderId || mapData.currentEpochId || mapData.epochs?.[0]?.id || 'epoch-ancient';
      const newLoc = {
        id: '',
        categoryId: 'locations',
        epochId: targetEpoch,
        title: '',
        name: '',
        continent: '亚洲',
        country: '中国',
        province: '陕西省',
        city: '西安市',
        lat: 34.3416,
        lng: 108.9402,
        centerLat: 34.3416,
        centerLng: 108.9402,
        isSnappedToCenter: true,
        hierarchyText: '亚洲 · 中国 · 陕西省',
        tags: ['据点'],
        summary: '',
        bio: '',
        content: '',
        images: [],
        previewImage: '',
        cardStyle: 'standard',
        color: '#38bdf8'
      };
      setEditingEntry(newLoc);
      latestEditingEntryRef.current = newLoc;
      setCardSaveStatus('saved');
      setTagInput('');
      setImageUrlInput('');
      setEditorTab('content');
      setDivisionQuery('');
      setDivisionResults([]);
      return;
    }

    if (activeCategory.id === 'events') {
      const targetEpoch = (selectedEpochFolderId && selectedEpochFolderId !== 'all')
        ? selectedEpochFolderId
        : (mapData.currentEpochId || mapData.epochs?.[0]?.id || 'epoch-pre-ww3');
      const targetEpochObj = mapData.epochs?.find((e) => e.id === targetEpoch) || mapData.epochs?.[0];
      const defaultYear = targetEpochObj?.timeRange?.[0] || 2024;
      const newEvent = {
        id: '',
        categoryId: 'events',
        epochId: targetEpoch,
        year: defaultYear,
        timeLabel: `${defaultYear}年`,
        title: '',
        name: '',
        locationId: '',
        locationName: '',
        hierarchyText: '',
        continent: '亚洲',
        country: '',
        province: '',
        city: '',
        lng: 116.4074,
        lat: 39.9042,
        characterIds: [],
        characters: [],
        customCharacters: '',
        tags: ['历史事件'],
        summary: '',
        bio: '',
        content: '',
        images: [],
        previewImage: '',
        cardStyle: 'standard',
        color: '#f59e0b'
      };
      setEditingEntry(newEvent);
      latestEditingEntryRef.current = newEvent;
      setCardSaveStatus('saved');
      setTagInput('');
      setImageUrlInput('');
      setEditorTab('content');
      setDivisionQuery('');
      setDivisionResults([]);
      return;
    }

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
      categoryId: entry.categoryId || (activeCategory.id === 'locations' ? 'locations' : activeCategory.id === 'events' ? 'events' : 'general'),
      epochId: entry.epochId || (selectedEpochFolderId !== 'all' ? selectedEpochFolderId : null) || mapData.currentEpochId || mapData.epochs?.[0]?.id,
      year: typeof entry.year === 'number' ? entry.year : 2024,
      timeLabel: entry.timeLabel || `${entry.year || 2024}年`,
      locationId: entry.locationId || '',
      locationName: entry.locationName || '',
      characterIds: Array.isArray(entry.characterIds) ? [...entry.characterIds] : [],
      characters: Array.isArray(entry.characters) ? [...entry.characters] : [],
      customCharacters: entry.customCharacters || '',
      title: entry.title || entry.name || '',
      name: entry.name || entry.title || '',
      tags: Array.isArray(entry.tags) ? [...entry.tags] : [],
      images: entryImages,
      previewImage: entryPreview,
      cardStyle: entry.cardStyle || 'standard',
      color: entry.color || (entry.categoryId === 'events' ? '#f59e0b' : '#38bdf8'),
      initialAffection: entry.initialAffection ?? 50,
      // Geo properties
      continent: entry.continent || '亚洲',
      country: entry.country || '',
      province: entry.province || '',
      city: entry.city || '',
      lat: typeof entry.lat === 'number' ? entry.lat : 34.3416,
      lng: typeof entry.lng === 'number' ? entry.lng : 108.9402,
      centerLat: typeof entry.centerLat === 'number' ? entry.centerLat : (entry.lat || 34.3416),
      centerLng: typeof entry.centerLng === 'number' ? entry.centerLng : (entry.lng || 108.9402),
      isSnappedToCenter: !!entry.isSnappedToCenter,
      hierarchyText: entry.hierarchyText || [entry.continent, entry.country, entry.province || entry.city].filter(Boolean).join(' · ')
    };

    setEditingEntry(loadedEntry);
    latestEditingEntryRef.current = loadedEntry;
    setCardSaveStatus('saved');
    setTagInput('');
    setImageUrlInput('');
    setEditorTab('content');
    setDivisionQuery('');
    setDivisionResults([]);
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
              const count = cat.id === 'locations'
                ? (mapData.epochs || []).reduce((sum, ep) => sum + (ep.locations?.length || 0), 0)
                : entries.filter((e) => e.categoryId === cat.id).length;
              const isBuiltIn = ['characters', 'world', 'locations'].includes(cat.id);

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

            {/* Epoch Folders Row for Locations or Events */}
            {(activeCategory.id === 'locations' || activeCategory.id === 'events') && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {activeCategory.id === 'events'
                        ? '历史时期纪事文件夹 (按纪元归档编年)'
                        : '地图时期地点文件夹 (按历史时期归档)'}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    当前文件夹：<strong className="text-amber-200">
                      {selectedEpochFolderId === 'all'
                        ? '全部历史时期'
                        : (currentEpochFolder?.name || '未知时期')}
                    </strong> · 共 {
                      activeCategory.id === 'events'
                        ? (selectedEpochFolderId === 'all'
                            ? entries.filter((e) => e.categoryId === 'events').length
                            : entries.filter((e) => e.categoryId === 'events' && (e.epochId === selectedEpochFolderId || (!e.epochId && selectedEpochFolderId === mapData.epochs[0]?.id))).length)
                        : currentEpochLocations.length
                    } 个{activeCategory.id === 'events' ? '纪事事件' : '据点'}
                  </span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {/* All Epochs folder button for events */}
                  {activeCategory.id === 'events' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEpochFolderId('all');
                        setSelectedDatabaseTag(null);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 border ${
                        selectedEpochFolderId === 'all'
                          ? 'bg-amber-500/20 border-amber-500/70 text-amber-200 shadow-md shadow-amber-500/10'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <History className={`w-3.5 h-3.5 ${selectedEpochFolderId === 'all' ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span className="font-bold">全部时期事件</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                        selectedEpochFolderId === 'all' ? 'bg-amber-500/40 text-amber-100' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {entries.filter((e) => e.categoryId === 'events').length}
                      </span>
                    </button>
                  )}

                  {(mapData.epochs || []).map((ep) => {
                    const isSelectedFolder = ep.id === selectedEpochFolderId;
                    const count = activeCategory.id === 'events'
                      ? entries.filter((e) => e.categoryId === 'events' && (e.epochId === ep.id || (!e.epochId && ep.id === mapData.epochs[0]?.id))).length
                      : (ep.locations?.length || 0);

                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => {
                          setSelectedEpochFolderId(ep.id);
                          setSelectedDatabaseTag(null);
                        }}
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 border ${
                          isSelectedFolder
                            ? 'bg-amber-500/20 border-amber-500/70 text-amber-200 shadow-md shadow-amber-500/10'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <Folder className={`w-3.5 h-3.5 ${isSelectedFolder ? 'text-amber-400' : 'text-slate-400'}`} />
                        <div className="text-left">
                          <span className="font-bold">{ep.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                            ({ep.timeRange?.[0]} ~ {ep.timeRange?.[1]}年)
                          </span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                          isSelectedFolder ? 'bg-amber-500/40 text-amber-100' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
                全部 ({activeCategory.id === 'locations' ? currentEpochLocations.length : activeCategory.id === 'events' ? filteredEntries.length : entries.filter((e) => e.categoryId === activeCategory.id).length})
              </button>

              {activeCategoryTags.map((tag) => {
                const isSelected = selectedDatabaseTag === tag;
                const count = activeCategory.id === 'locations'
                  ? currentEpochLocations.filter((e) => Array.isArray(e.tags) && e.tags.includes(tag)).length
                  : entries.filter((e) => e.categoryId === activeCategory.id && Array.isArray(e.tags) && e.tags.includes(tag)).length;

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
                                if (activeCategory.id === 'locations' || entry.categoryId === 'locations') {
                                  deleteEpochLocation(entry.epochId || selectedEpochFolderId, entry.id);
                                } else {
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
                                {activeCategory.id === 'locations' || entry.categoryId === 'locations' ? (
                                  <MapPin className="w-5 h-5 text-sky-400" />
                                ) : activeCategory.id === 'events' || entry.categoryId === 'events' ? (
                                  <Clock className="w-5 h-5 text-amber-400" />
                                ) : (
                                  renderIcon(activeCategory.icon, 'w-4 h-4')
                                )}
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
                              {(activeCategory.id === 'events' || entry.categoryId === 'events') && (
                                <p className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                                  <span>{mapData.epochs?.find((ep) => ep.id === entry.epochId)?.name || '纪元'}</span>
                                  <span>·</span>
                                  <span>{entry.year || 2024}年</span>
                                  {entry.timeLabel && entry.timeLabel !== `${entry.year}年` && (
                                    <span className="text-slate-400 font-normal">({entry.timeLabel})</span>
                                  )}
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
                                if (activeCategory.id === 'locations' || entry.categoryId === 'locations') {
                                  deleteEpochLocation(entry.epochId || selectedEpochFolderId, entry.id);
                                } else {
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

                        {/* Location Hierarchy & Coordinates Card (4-Level hierarchy) */}
                        {(activeCategory.id === 'locations' || entry.categoryId === 'locations') && (
                          <div className="bg-slate-950/80 rounded-xl p-2.5 px-3 border border-slate-800 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs text-sky-300 font-semibold truncate">
                              <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span className="truncate">
                                {entry.hierarchyText || [entry.continent, entry.country, entry.province || entry.city].filter(Boolean).join(' · ') || '世界地理未定'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                              <span>坐标: [{Number(entry.lng ?? 0).toFixed(4)}°, {Number(entry.lat ?? 0).toFixed(4)}°]</span>
                              {entry.isSnappedToCenter && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/80">
                                  中心吸附
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Event Three-Element Pill Badges: Time, Location, Characters */}
                        {(activeCategory.id === 'events' || entry.categoryId === 'events') && (
                          <div className="bg-slate-950/80 rounded-xl p-2.5 px-3 border border-slate-800 space-y-2">
                            {/* 1. Time Badge */}
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 text-amber-300 font-semibold truncate">
                                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="truncate">{entry.timeLabel || `${entry.year || 2024}年`}</span>
                              </div>
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-amber-950/70 text-amber-300 border border-amber-800/80 shrink-0">
                                {mapData.epochs?.find((ep) => ep.id === entry.epochId)?.name || '纪元'} · {entry.year || 2024}年
                              </span>
                            </div>

                            {/* 2. Location Badge */}
                            <div className="flex items-center justify-between text-xs text-sky-300">
                              <div className="flex items-center gap-1.5 truncate">
                                <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                <span className="font-medium truncate">{entry.locationName || '未定地点'}</span>
                                {entry.hierarchyText && (
                                  <span className="text-[10px] text-slate-400 font-normal truncate hidden sm:inline">
                                    ({entry.hierarchyText})
                                  </span>
                                )}
                              </div>
                              {typeof entry.lng === 'number' && typeof entry.lat === 'number' && (
                                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                  [{Number(entry.lng).toFixed(2)}°, {Number(entry.lat).toFixed(2)}°]
                                </span>
                              )}
                            </div>

                            {/* 3. Characters Badge */}
                            {((Array.isArray(entry.characters) && entry.characters.length > 0) || entry.customCharacters) && (
                              <div className="pt-1 border-t border-slate-800/60 flex items-center gap-1.5 flex-wrap">
                                <Users className="w-3 h-3 text-indigo-400 shrink-0" />
                                {Array.isArray(entry.characters) && entry.characters.map((char) => (
                                  <span
                                    key={char.id}
                                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/60 border border-indigo-700/50 text-indigo-200"
                                    title={`${char.name} (${char.role || '参涉人物'})`}
                                  >
                                    {char.avatar ? (
                                      <img src={char.avatar} alt={char.name} className="w-3 h-3 rounded-full object-cover" />
                                    ) : (
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: char.color || '#818cf8' }} />
                                    )}
                                    <span className="font-medium truncate max-w-[80px]">{char.name}</span>
                                  </span>
                                ))}
                                {entry.customCharacters && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono truncate max-w-[120px]" title={entry.customCharacters}>
                                    {entry.customCharacters}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

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
                          {entry.summary || entry.bio || entry.description || entry.content || '暂无内容概要...'}
                        </p>
                      </div>

                      {/* Card Footer: Tags, Images count & Map Locate button */}
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

                        <div className="flex items-center gap-2">
                          {/* Image count badge */}
                          {Array.isArray(entry.images) && entry.images.length > 0 && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0 bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/50">
                              <ImageIcon className="w-3 h-3 text-sky-400/80" />
                              <span>{entry.images.length}</span>
                            </span>
                          )}

                          {/* Map Locate Button for Location or Event */}
                          {(activeCategory.id === 'locations' || entry.categoryId === 'locations') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (entry.epochId && entry.epochId !== mapData.currentEpochId) {
                                  selectEpoch(entry.epochId);
                                }
                                setSelectedMapLocationId(entry.id);
                                setActiveWorkspace('map');
                              }}
                              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-sky-600/30 hover:bg-sky-600 text-sky-200 hover:text-white border border-sky-500/40 transition-colors shadow-sm ml-1"
                              title="在世界地图中定位此据点并查看"
                            >
                              <Compass className="w-3 h-3 text-sky-300" />
                              <span>地图定位</span>
                            </button>
                          )}

                          {(activeCategory.id === 'events' || entry.categoryId === 'events') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                focusTimelineEvent(entry);
                              }}
                              className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-white border border-amber-500/40 transition-colors shadow-sm ml-1 font-medium"
                              title="在世界地图中定位并高亮显示此历史事件"
                            >
                              <Compass className="w-3 h-3 text-amber-300" />
                              <span>地图定位</span>
                            </button>
                          )}

                          {/* Inject to Copilot Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              injectEntityToCopilot({
                                id: entry.id,
                                type: entry.categoryId || activeCategory?.id || 'database_entry',
                                title: entry.name || entry.title || '未命名条目',
                                category: entry.categoryId || activeCategory?.name,
                                description: entry.description || entry.content || entry.summary,
                                tags: entry.tags || [],
                                attributes: entry.attributes || [],
                                time: entry.time,
                                location: entry.location
                              });
                            }}
                            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-white border border-indigo-500/40 transition-colors shadow-sm ml-1"
                            title="将此卡片作为上下文注入到 Story Copilot"
                          >
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            <span>注入 Copilot</span>
                          </button>
                        </div>
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

                {(editingEntry.categoryId === 'locations' || activeCategory.id === 'locations') && (
                  <button
                    type="button"
                    onClick={async () => {
                      const targetId = editingEntry.id || 'loc-temp';
                      await handleCloseDrawer();
                      if (editingEntry.epochId && editingEntry.epochId !== mapData.currentEpochId) {
                        selectEpoch(editingEntry.epochId);
                      }
                      setSelectedMapLocationId(targetId);
                      setActiveWorkspace('map');
                    }}
                    className="flex items-center gap-1.5 bg-sky-600/30 hover:bg-sky-600 text-sky-200 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-sky-500/40 transition-colors shadow-sm"
                    title="在世界地图中定位并查看此地点"
                  >
                    <Compass className="w-3.5 h-3.5 text-sky-300" />
                    <span>在地图中定位</span>
                  </button>
                )}

                {(editingEntry.categoryId === 'events' || activeCategory.id === 'events') && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleCloseDrawer();
                      focusTimelineEvent(editingEntry);
                    }}
                    className="flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-500/40 transition-colors shadow-sm"
                    title="在世界地图中定位并高亮显示此事件"
                  >
                    <Compass className="w-3.5 h-3.5 text-amber-300" />
                    <span>在地图中定位</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    injectEntityToCopilot({
                      id: editingEntry.id,
                      type: editingEntry.categoryId || activeCategory?.id || 'database_entry',
                      title: editingEntry.name || editingEntry.title || '未命名条目',
                      category: editingEntry.categoryId || activeCategory?.name,
                      description: editingEntry.description || editingEntry.content || editingEntry.summary,
                      tags: editingEntry.tags || [],
                      attributes: editingEntry.attributes || [],
                      time: editingEntry.time,
                      location: editingEntry.location
                    });
                  }}
                  className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-500/40 transition-colors shadow-sm cursor-pointer"
                  title="将此档案卡片作为上下文注入到 Story Copilot"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>注入 Copilot</span>
                </button>

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
                    {editingEntry.categoryId === 'locations' || activeCategory.id === 'locations'
                      ? '地点据点名称'
                      : editingEntry.categoryId === 'events' || activeCategory.id === 'events'
                      ? '事件名称 / 历史战役标题'
                      : '条目标题 / 道具名称'} <span className="text-rose-400">*</span>
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
                    placeholder={
                      editingEntry.categoryId === 'locations' || activeCategory.id === 'locations'
                        ? '例如：以太帝都·天穹圣座 / 晨曦港 / 龙息要塞'
                        : editingEntry.categoryId === 'events' || activeCategory.id === 'events'
                        ? '例如：布宜诺斯艾利斯和平协定 / 极东防线崩溃 / 第三次世界大战爆发'
                        : '例如：圣辉王印吊坠 / 艾莉丝 (Alice) / 古代以太原石'
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Location Establishment & Geo Hierarchy Section */}
              {(editingEntry.categoryId === 'locations' || activeCategory.id === 'locations') && (
                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <h4 className="text-xs font-bold text-sky-300 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-sky-400" />
                      <span>地理位置确立与隶属层级</span>
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      支持省市搜索定位或精确经纬度设定
                    </span>
                  </div>

                  {/* Epoch Folder Selection */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      所属地图时期文件夹 (归属时代) <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={editingEntry.epochId || selectedEpochFolderId}
                      onChange={(e) => updateEditingEntry({ epochId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-medium"
                    >
                      {(mapData.epochs || []).map((ep) => (
                        <option key={ep.id} value={ep.id}>
                          {ep.name} ({ep.timeRange?.[0]} ~ {ep.timeRange?.[1]}年)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Province / City Autocomplete */}
                  <div className="relative">
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      快速搜索行政区划（省份 / 城市 / 国家）
                    </label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={divisionQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDivisionQuery(val);
                          if (val.trim()) {
                            const res = searchAdministrativeDivisions(val);
                            setDivisionResults(res);
                            setIsDivisionDropdownOpen(true);
                          } else {
                            setDivisionResults([]);
                            setIsDivisionDropdownOpen(false);
                          }
                        }}
                        onFocus={() => {
                          if (divisionQuery.trim()) {
                            const res = searchAdministrativeDivisions(divisionQuery);
                            setDivisionResults(res);
                            setIsDivisionDropdownOpen(true);
                          }
                        }}
                        placeholder="输入省份、城市或国家，例如：陕西、巴黎、埃及、加利福尼亚..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                      />
                      {divisionQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setDivisionQuery('');
                            setDivisionResults([]);
                            setIsDivisionDropdownOpen(false);
                          }}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Dropdown Results */}
                    {isDivisionDropdownOpen && divisionResults.length > 0 && (
                      <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-slate-800">
                        {divisionResults.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              const geo = reverseGeocode(item.lng, item.lat);
                              const newUpdates = {
                                continent: item.continent || geo.continent,
                                country: item.country || geo.country,
                                province: item.type === 'province' ? item.name : (geo.province || ''),
                                city: item.type === 'province' ? item.name : (geo.city || ''),
                                lat: parseFloat(item.lat.toFixed(4)),
                                lng: parseFloat(item.lng.toFixed(4)),
                                centerLat: parseFloat(item.lat.toFixed(4)),
                                centerLng: parseFloat(item.lng.toFixed(4)),
                                isSnappedToCenter: true,
                                hierarchyText: item.hierarchyText || geo.hierarchyText
                              };
                              if (!editingEntry.title && !editingEntry.name) {
                                newUpdates.title = item.name;
                                newUpdates.name = item.name;
                              }
                              updateEditingEntry(newUpdates);
                              setIsDivisionDropdownOpen(false);
                              setDivisionQuery('');
                            }}
                            className="p-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <div>
                                <span className="font-semibold text-slate-100">{item.name}</span>
                                {item.nameEn && item.nameEn !== item.name && (
                                  <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({item.nameEn})</span>
                                )}
                                <div className="text-[10px] text-slate-400">{item.hierarchyText}</div>
                              </div>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700 font-mono shrink-0">
                              {item.type === 'province' ? '省州行政区' : '国家主权'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Manual Lat / Lng Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        经度 (Longitude, -180 ~ 180)
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={editingEntry.lng ?? 108.9402}
                        onChange={(e) => {
                          const newLng = parseFloat(e.target.value) || 0;
                          const geo = reverseGeocode(newLng, editingEntry.lat ?? 0);
                          updateEditingEntry({
                            lng: newLng,
                            continent: geo.continent,
                            country: geo.country,
                            province: geo.province,
                            city: geo.city,
                            centerLat: geo.centerLat,
                            centerLng: geo.centerLng,
                            isSnappedToCenter: false,
                            hierarchyText: geo.hierarchyText
                          });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        纬度 (Latitude, -90 ~ 90)
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={editingEntry.lat ?? 34.3416}
                        onChange={(e) => {
                          const newLat = parseFloat(e.target.value) || 0;
                          const geo = reverseGeocode(editingEntry.lng ?? 0, newLat);
                          updateEditingEntry({
                            lat: newLat,
                            continent: geo.continent,
                            country: geo.country,
                            province: geo.province,
                            city: geo.city,
                            centerLat: geo.centerLat,
                            centerLng: geo.centerLng,
                            isSnappedToCenter: false,
                            hierarchyText: geo.hierarchyText
                          });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  {/* Snap to Center Toggle */}
                  <div className="flex items-center justify-between bg-slate-900/90 p-2.5 px-3 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-amber-400" />
                      <div>
                        <div className="text-xs font-medium text-slate-200">吸附到地点中心经纬度</div>
                        <div className="text-[10px] text-slate-400">
                          行政中心坐标: [{Number(editingEntry.centerLng || editingEntry.lng).toFixed(4)}°, {Number(editingEntry.centerLat || editingEntry.lat).toFixed(4)}°]
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextSnapped = !editingEntry.isSnappedToCenter;
                        if (nextSnapped && typeof editingEntry.centerLat === 'number') {
                          updateEditingEntry({
                            isSnappedToCenter: true,
                            lat: editingEntry.centerLat,
                            lng: editingEntry.centerLng
                          });
                        } else {
                          updateEditingEntry({
                            isSnappedToCenter: false
                          });
                        }
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        editingEntry.isSnappedToCenter
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {editingEntry.isSnappedToCenter ? '已开启吸附' : '吸附到中心'}
                    </button>
                  </div>

                  {/* 4-Level Full Hierarchy Breadcrumb Banner */}
                  <div className="bg-gradient-to-r from-sky-950/60 via-indigo-950/40 to-slate-950/60 border border-sky-500/30 p-3 rounded-xl space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-sky-400 flex items-center gap-1 tracking-wider">
                      <Globe className="w-3 h-3" /> 完整隶属层级解析 (大洲 - 国家 - 省份/城市 - 经纬度)
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs font-semibold text-slate-100">
                      <span className="px-2 py-0.5 rounded bg-sky-900/60 text-sky-200 border border-sky-700/50">
                        {editingEntry.continent || '未知大洲'}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-200 border border-indigo-700/50">
                        {editingEntry.country || '公海 / 未知领地'}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                        {editingEntry.province || editingEntry.city || '未指定省市'}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-[11px] border border-amber-500/40">
                        [{Number(editingEntry.lng || 0).toFixed(4)}°, {Number(editingEntry.lat || 0).toFixed(4)}°]
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Event Time, Location, Characters Section */}
              {(editingEntry.categoryId === 'events' || activeCategory.id === 'events') && (
                <div className="bg-slate-950/80 border border-amber-500/30 p-4 rounded-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <h4 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>事件核心三要素（时间 · 地点 · 人物）</span>
                    </h4>
                    <span className="text-[11px] text-amber-400/80">
                      保存后自动映射至世界地图与编年总线时间轴
                    </span>
                  </div>

                  {/* 1. 时间要素 (Time) */}
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>1. 时间设定 (所属时期与发生年份)</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          所属历史纪元时期 <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={editingEntry.epochId || mapData.epochs?.[0]?.id || 'epoch-pre-ww3'}
                          onChange={(e) => {
                            const newEpochId = e.target.value;
                            const targetEp = mapData.epochs?.find((ep) => ep.id === newEpochId);
                            const epMin = targetEp?.timeRange?.[0] ?? 2000;
                            const epMax = targetEp?.timeRange?.[1] ?? 2100;
                            const curYear = editingEntry.year ?? epMin;
                            const clampedYear = Math.max(epMin, Math.min(epMax, curYear));
                            updateEditingEntry({
                              epochId: newEpochId,
                              year: clampedYear,
                              timeLabel: `${clampedYear}年`
                            });
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                        >
                          {(mapData.epochs || []).map((ep) => (
                            <option key={ep.id} value={ep.id}>
                              {ep.name} ({ep.timeRange?.[0]} ~ {ep.timeRange?.[1]}年)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] text-slate-400">
                            发生年份 (限制于时期内) <span className="text-rose-400">*</span>
                          </label>
                          <span className="text-[10px] text-amber-300 font-mono font-bold">
                            {editingEntry.year ?? 2024}年
                          </span>
                        </div>
                        {(() => {
                          const targetEp = mapData.epochs?.find((ep) => ep.id === (editingEntry.epochId || mapData.epochs?.[0]?.id)) || mapData.epochs?.[0];
                          const epMin = targetEp?.timeRange?.[0] ?? 2000;
                          const epMax = targetEp?.timeRange?.[1] ?? 2100;
                          return (
                            <div className="space-y-1">
                              <input
                                type="number"
                                min={epMin}
                                max={epMax}
                                value={editingEntry.year ?? epMin}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val)) {
                                    const bounded = Math.max(epMin, Math.min(epMax, val));
                                    updateEditingEntry({ year: bounded, timeLabel: editingEntry.timeLabel?.includes('年') ? `${bounded}年` : editingEntry.timeLabel });
                                  }
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                              />
                              <input
                                type="range"
                                min={epMin}
                                max={epMax}
                                value={editingEntry.year ?? epMin}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  updateEditingEntry({ year: val, timeLabel: editingEntry.timeLabel?.includes('年') ? `${val}年` : editingEntry.timeLabel });
                                }}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                              />
                            </div>
                          );
                        })()}
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          具体日期 / 阶段标签
                        </label>
                        <input
                          type="text"
                          value={editingEntry.timeLabel || ''}
                          onChange={(e) => updateEditingEntry({ timeLabel: e.target.value })}
                          placeholder="例如：2035年9月18日 / 战役前夕"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. 地点要素 (Location) */}
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-sky-200 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-sky-400" />
                        <span>2. 地点设定 (地图映射坐标与地理层级)</span>
                      </div>
                      {editingEntry.locationName && (
                        <span className="text-[11px] text-sky-300 font-medium">
                          当前绑定: <strong>{editingEntry.locationName}</strong>
                        </span>
                      )}
                    </div>

                    {/* Quick Select from existing epoch locations */}
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        从当前时期已有地图据点快捷选择
                      </label>
                      <select
                        value={editingEntry.locationId || ''}
                        onChange={(e) => {
                          const chosenLocId = e.target.value;
                          if (!chosenLocId) {
                            updateEditingEntry({ locationId: '', locationName: '' });
                            return;
                          }
                          const curEpochObj = mapData.epochs?.find((ep) => ep.id === (editingEntry.epochId || mapData.currentEpochId));
                          const foundLoc = (curEpochObj?.locations || []).find((l) => l.id === chosenLocId);
                          if (foundLoc) {
                            updateEditingEntry({
                              locationId: foundLoc.id,
                              locationName: foundLoc.name || foundLoc.title,
                              hierarchyText: foundLoc.hierarchyText || '',
                              continent: foundLoc.continent || '',
                              country: foundLoc.country || '',
                              province: foundLoc.province || '',
                              city: foundLoc.city || '',
                              lng: foundLoc.lng,
                              lat: foundLoc.lat
                            });
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                      >
                        <option value="">-- 自定义输入或不关联固定据点 --</option>
                        {(() => {
                          const curEpochObj = mapData.epochs?.find((ep) => ep.id === (editingEntry.epochId || mapData.currentEpochId));
                          const locList = curEpochObj?.locations || [];
                          return locList.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              📍 {loc.name || loc.title} ({loc.hierarchyText || loc.country || '世界据点'}) [{loc.lng?.toFixed(2)}°, {loc.lat?.toFixed(2)}°]
                            </option>
                          ));
                        })()}
                      </select>
                    </div>

                    {/* Search administrative division or custom name */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          发生地点名称
                        </label>
                        <input
                          type="text"
                          value={editingEntry.locationName || ''}
                          onChange={(e) => updateEditingEntry({ locationName: e.target.value })}
                          placeholder="例如：布宜诺斯艾利斯 / 极东战线"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div className="relative">
                        <label className="block text-[11px] text-slate-400 mb-1">
                          快速定位行政区（搜索推算坐标）
                        </label>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                          <input
                            type="text"
                            value={divisionQuery}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDivisionQuery(val);
                              if (val.trim()) {
                                const res = searchAdministrativeDivisions(val);
                                setDivisionResults(res);
                                setIsDivisionDropdownOpen(true);
                              } else {
                                setDivisionResults([]);
                                setIsDivisionDropdownOpen(false);
                              }
                            }}
                            placeholder="输入省市搜索自动填充..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-6 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                          />
                          {divisionQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setDivisionQuery('');
                                setDivisionResults([]);
                                setIsDivisionDropdownOpen(false);
                              }}
                              className="absolute right-2 top-2 text-slate-400 hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {isDivisionDropdownOpen && divisionResults.length > 0 && (
                          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-40 overflow-y-auto divide-y divide-slate-800">
                            {divisionResults.map((item, idx) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  const geo = reverseGeocode(item.lng, item.lat);
                                  updateEditingEntry({
                                    locationName: editingEntry.locationName || item.name,
                                    continent: item.continent || geo.continent,
                                    country: item.country || geo.country,
                                    province: item.type === 'province' ? item.name : (geo.province || ''),
                                    city: item.type === 'province' ? item.name : (geo.city || ''),
                                    lat: parseFloat(item.lat.toFixed(4)),
                                    lng: parseFloat(item.lng.toFixed(4)),
                                    hierarchyText: item.hierarchyText || geo.hierarchyText
                                  });
                                  setIsDivisionDropdownOpen(false);
                                  setDivisionQuery('');
                                }}
                                className="p-2 hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs"
                              >
                                <span className="text-white font-medium">{item.name} ({item.hierarchyText})</span>
                                <span className="text-[10px] text-sky-400 font-mono">[{item.lng.toFixed(2)}°, {item.lat.toFixed(2)}°]</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Coordinates input */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">
                          经度 (Longitude, -180 ~ 180)
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          value={editingEntry.lng ?? 116.4074}
                          onChange={(e) => {
                            const newLng = parseFloat(e.target.value) || 0;
                            const geo = reverseGeocode(newLng, editingEntry.lat ?? 39.9042);
                            updateEditingEntry({
                              lng: newLng,
                              continent: geo.continent,
                              country: geo.country,
                              province: geo.province,
                              city: geo.city,
                              hierarchyText: geo.hierarchyText
                            });
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">
                          纬度 (Latitude, -90 ~ 90)
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          value={editingEntry.lat ?? 39.9042}
                          onChange={(e) => {
                            const newLat = parseFloat(e.target.value) || 0;
                            const geo = reverseGeocode(editingEntry.lng ?? 116.4074, newLat);
                            updateEditingEntry({
                              lat: newLat,
                              continent: geo.continent,
                              country: geo.country,
                              province: geo.province,
                              city: geo.city,
                              hierarchyText: geo.hierarchyText
                            });
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    {/* Hierarchy badge display */}
                    <div className="bg-slate-950/70 border border-slate-800/80 p-2 rounded-lg flex items-center justify-between text-[11px] text-slate-300">
                      <span className="flex items-center gap-1.5 text-sky-400 font-medium truncate">
                        <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate">{editingEntry.hierarchyText || '未定地理层级'}</span>
                      </span>
                      <span className="text-[10px] font-mono text-amber-300 shrink-0 ml-2">
                        [{Number(editingEntry.lng ?? 0).toFixed(4)}°, {Number(editingEntry.lat ?? 0).toFixed(4)}°]
                      </span>
                    </div>
                  </div>

                  {/* 3. 人物要素 (Characters) */}
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-indigo-200 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <span>3. 参涉人物 (出场角色与参战势力)</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        已选择 {(editingEntry.characterIds || []).length} 位人物
                      </span>
                    </div>

                    {/* Character Selector Pills from Character Database */}
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1.5">
                        点击勾选参涉人物档案 (来自人物资料库):
                      </label>
                      <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                        {allCharacters.length === 0 ? (
                          <div className="text-[11px] text-slate-400 py-1 px-2">
                            暂无可用的人物档案，可在「人物资料库」中先创建角色。
                          </div>
                        ) : (
                          allCharacters.map((char) => {
                            const isSelected = (editingEntry.characterIds || []).includes(char.id);
                            return (
                              <button
                                key={char.id}
                                type="button"
                                onClick={() => {
                                  const curIds = [...(editingEntry.characterIds || [])];
                                  const curChars = [...(editingEntry.characters || [])];
                                  if (isSelected) {
                                    const nextIds = curIds.filter((id) => id !== char.id);
                                    const nextChars = curChars.filter((c) => c.id !== char.id);
                                    updateEditingEntry({ characterIds: nextIds, characters: nextChars });
                                  } else {
                                    const charData = {
                                      id: char.id,
                                      name: char.name || char.title || '角色',
                                      role: char.role || '',
                                      avatar: char.avatar || char.previewImage || '',
                                      color: char.color || '#818cf8'
                                    };
                                    updateEditingEntry({
                                      characterIds: [...curIds, char.id],
                                      characters: [...curChars, charData]
                                    });
                                  }
                                }}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all border ${
                                  isSelected
                                    ? 'bg-indigo-600/30 border-indigo-400 text-white font-medium shadow-sm'
                                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                                }`}
                              >
                                {char.avatar ? (
                                  <img src={char.avatar} alt={char.name} className="w-3.5 h-3.5 rounded-full object-cover" />
                                ) : (
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: char.color || '#818cf8' }} />
                                )}
                                <span>{char.name || char.title}</span>
                                {char.role && (
                                  <span className="text-[10px] opacity-70">({char.role})</span>
                                )}
                                {isSelected && <Check className="w-3 h-3 text-indigo-300 ml-0.5" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Custom Characters / Temporary NPCs or Armies */}
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        自定义参涉人员 / 阵营部队 / 临时NPC
                      </label>
                      <input
                        type="text"
                        value={editingEntry.customCharacters || ''}
                        onChange={(e) => updateEditingEntry({ customCharacters: e.target.value })}
                        placeholder="例如：反抗军第7突击联队、神圣修会特使、不知名神秘向导"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

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
