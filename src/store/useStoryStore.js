import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';

let debounceTimer = null;

function extractCharactersFromDatabase(database) {
  if (!database || !database.entries) return [];
  const charCategoryIds = new Set(
    (database.categories || [])
      .filter((c) => c.isCharacterType || c.id === 'characters')
      .map((c) => c.id)
  );
  return database.entries
    .filter((e) => charCategoryIds.has(e.categoryId) || e.categoryId === 'characters')
    .map((e) => ({
      id: e.id,
      name: e.name || e.title || '未命名角色',
      role: e.role || '',
      color: e.color || '#38bdf8',
      bio: e.bio || e.summary || '',
      avatar: e.avatar || '',
      initialAffection: e.initialAffection ?? 50
    }));
}

export const useStoryStore = create((set, get) => ({
  nodes: [],
  edges: [],
  characters: [],
  worldLore: '',
  database: {
    categories: [],
    entries: []
  },
  settings: {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    temperature: 0.7
  },

  // Multi-project states
  currentProject: null,
  projectsList: [],
  isProjectsModalOpen: false,
  setIsProjectsModalOpen: (open) => set({ isProjectsModalOpen: open }),

  // Story Copilot (Antigravity AI) States
  isCopilotOpen: false,
  setIsCopilotOpen: (open) => set({ isCopilotOpen: open }),
  copilotInjectedEntities: [],
  copilotSessions: [],
  currentCopilotSessionId: null,
  copilotMessages: [],
  copilotLoading: false,
  copilotActiveThinking: '',
  copilotModel: 'flash',
  setCopilotModel: (model) => set({ copilotModel: model }),
  
  // Main Workspace: 'nodes' | 'database' | 'map'
  activeWorkspace: 'nodes',
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),

  // Map & Timeline state
  mapData: {
    timelineSettings: {
      minYear: 2000,
      maxYear: 2100,
      leftBound: 2000,
      rightBound: 2042,
      currentTime: 2024
    },
    currentEpochId: 'epoch-pre-ww3',
    epochs: [],
    locations: [],
    timeline: []
  },
  selectedMapLocationId: null,
  selectedTimelineEventId: null,
  setSelectedMapLocationId: (id) => set({ selectedMapLocationId: id }),
  setSelectedTimelineEventId: (id) => set({ selectedTimelineEventId: id }),

  // Left Sidebar & Database states
  isLeftSidebarOpen: true,
  isFullDatabaseOpen: false,
  activeDatabaseCategory: 'characters',
  selectedDatabaseTag: null,
  databaseSearchKeyword: '',

  // Registered canvas actions
  canvasActions: {
    fitView: null,
    autoLayout: null
  },

  selectedNodeId: null,
  activeModal: null, // 'characters' | 'world' | 'settings' | 'export' | null
  
  saveStatus: 'idle', // 'idle' | 'saving' | 'saved' | 'error'
  saveError: null,
  lastSavedTime: null,
  isLoading: true,

  // Load complete project from local server
  loadProject: async (projectId = null) => {
    try {
      set({
        isLoading: true,
        selectedNodeId: null,
        selectedMapLocationId: null,
        selectedTimelineEventId: null,
        selectedDatabaseTag: null
      });

      const targetPid = projectId || localStorage.getItem('lastOpenedProjectId') || '';
      const url = targetPid ? `/api/project?projectId=${encodeURIComponent(targetPid)}` : '/api/project';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        if (data.activeProjectId || data.project?.id) {
          localStorage.setItem('lastOpenedProjectId', data.activeProjectId || data.project.id);
        }
        const loadedDb = data.database || { categories: [], entries: [] };
        const extractedChars = extractCharactersFromDatabase(loadedDb);
        const finalChars = extractedChars.length > 0 ? extractedChars : (data.characters || []);

        set({
          currentProject: data.project || null,
          nodes: data.story.nodes || [],
          edges: data.story.edges || [],
          database: loadedDb,
          characters: finalChars,
          worldLore: data.worldLore || '',
          mapData: {
            timelineSettings: data.mapData?.timelineSettings || {
              minYear: 2000,
              maxYear: 2100,
              leftBound: 2000,
              rightBound: 2042,
              currentTime: 2024
            },
            currentEpochId: data.mapData?.currentEpochId || 'epoch-pre-ww3',
            epochs: (data.mapData?.epochs || []).map((ep) => {
              if (Array.isArray(ep.locations)) return ep;
              const rootLocs = data.mapData?.locations || [];
              const matched = rootLocs.filter(
                (l) => l.epochId === ep.id || (typeof l.year === 'number' && l.year >= ep.timeRange[0] && l.year <= ep.timeRange[1])
              );
              return { ...ep, locations: matched };
            }),
            locations: (data.mapData?.epochs || []).flatMap((e) => e.locations || []).length > 0
              ? (data.mapData?.epochs || []).flatMap((e) => e.locations || [])
              : (data.mapData?.locations || []),
            timeline: (() => {
              const loadedTimeline = data.mapData?.timeline || [];
              const eventEntries = (loadedDb.entries || []).filter((e) => e.categoryId === 'events');
              const map = new Map();
              loadedTimeline.forEach((t) => map.set(t.id, t));
              eventEntries.forEach((e) => {
                const existing = map.get(e.id) || {};
                map.set(e.id, { ...existing, ...e });
              });
              return Array.from(map.values()).sort((a, b) => (a.year || 0) - (b.year || 0));
            })()
          },
          settings: data.settings || get().settings,
          isLoading: false,
          saveStatus: 'saved',
          lastSavedTime: new Date().toLocaleTimeString()
        });
      } else {
        set({ isLoading: false, saveStatus: 'error', saveError: data.error });
      }
    } catch (err) {
      console.error('Failed to load project:', err);
      set({ isLoading: false, saveStatus: 'error', saveError: err.message });
    }
  },

  // Save story to local disk with debounce
  triggerAutoSave: () => {
    set({ saveStatus: 'saving' });
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      try {
        const { nodes, edges } = get();
        const res = await fetch('/api/story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodes, edges })
        });
        const result = await res.json();
        if (result.success) {
          set({
            saveStatus: 'saved',
            lastSavedTime: new Date().toLocaleTimeString(),
            saveError: null
          });
        } else {
          set({ saveStatus: 'error', saveError: result.error });
        }
      } catch (err) {
        set({ saveStatus: 'error', saveError: err.message });
      }
    }, 800);
  },

  // Immediate save
  saveStoryImmediate: async () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    set({ saveStatus: 'saving' });
    try {
      const { nodes, edges } = get();
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });
      const result = await res.json();
      if (result.success) {
        set({
          saveStatus: 'saved',
          lastSavedTime: new Date().toLocaleTimeString(),
          saveError: null
        });
      }
    } catch (err) {
      set({ saveStatus: 'error', saveError: err.message });
    }
  },

  // Node changes from React Flow
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes)
    });
    // Check if positions or deletions occurred to trigger save
    const hasMeaningfulChanges = changes.some(
      (c) => c.type === 'position' && c.dragging === false || c.type === 'remove'
    );
    if (hasMeaningfulChanges) {
      get().triggerAutoSave();
    }
  },

  // Edge changes from React Flow
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges)
    });
    get().triggerAutoSave();
  },

  // On edge connect
  onConnect: (connection) => {
    const edgeId = `e-${connection.source}-${connection.target}-${Date.now().toString(36)}`;
    const newEdge = {
      ...connection,
      id: edgeId,
      type: 'conditionEdge',
      data: { condition: '分支条件' }
    };
    set({
      edges: [...get().edges, newEdge]
    });
    get().triggerAutoSave();
  },

  // Add a new node
  addNode: (parentNodeId = null) => {
    const nodes = get().nodes;
    let newPosition = { x: 250, y: 200 };
    let newCode = `${nodes.length + 1}`;

    if (parentNodeId) {
      const parent = nodes.find((n) => n.id === parentNodeId);
      if (parent) {
        // Find existing children to calculate branch code and position
        const existingEdges = get().edges.filter((e) => e.source === parentNodeId);
        const childCount = existingEdges.length + 1;
        newCode = `${parent.data.code}.${childCount}`;
        newPosition = {
          x: parent.position.x + 480,
          y: parent.position.y + (childCount - 1) * 160 - 40
        };
      }
    }

    const newNodeId = `node-${Date.now().toString(36)}`;
    const newNode = {
      id: newNodeId,
      type: 'storyNode',
      position: newPosition,
      data: {
        code: newCode,
        title: '新情节节点',
        summary: '请在此输入该节点的剧情梗概与关键要点（支持 **Markdown** 格式）...',
        characters: [],
        characterStatuses: {},
        dialogueList: [],
        endingType: 'none',
        image: '',
        choices: []
      }
    };

    const nextNodes = [...nodes, newNode];
    let nextEdges = get().edges;

    // Connect from parent if specified
    if (parentNodeId) {
      const newEdge = {
        id: `e-${parentNodeId}-${newNodeId}-${Date.now().toString(36)}`,
        source: parentNodeId,
        target: newNodeId,
        type: 'conditionEdge',
        data: { condition: '选项分支' }
      };
      nextEdges = [...nextEdges, newEdge];

      // Also register into parent node's choices
      nextNodes.forEach((n) => {
        if (n.id === parentNodeId) {
          n.data = {
            ...n.data,
            choices: [
              ...(n.data.choices || []),
              {
                id: `choice-${Date.now().toString(36)}`,
                label: `通向 ${newCode} 的选项`,
                targetId: newNodeId,
                condition: '选项分支'
              }
            ]
          };
        }
      });
    }

    set({
      nodes: nextNodes,
      edges: nextEdges,
      selectedNodeId: newNodeId
    });

    get().triggerAutoSave();
    return newNodeId;
  },

  // Update node data
  updateNodeData: (nodeId, dataUpdate) => {
    const nodes = get().nodes.map((n) => {
      if (n.id === nodeId) {
        return {
          ...n,
          data: { ...n.data, ...dataUpdate }
        };
      }
      return n;
    });
    set({ nodes });
    get().triggerAutoSave();
  },

  // Delete node and its edges
  deleteNode: (nodeId) => {
    const nodes = get().nodes.filter((n) => n.id !== nodeId);
    const edges = get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    const selectedNodeId = get().selectedNodeId === nodeId ? null : get().selectedNodeId;
    set({ nodes, edges, selectedNodeId });
    get().triggerAutoSave();
  },

  // Update edge condition label
  updateEdgeCondition: (edgeId, condition) => {
    const edges = get().edges.map((e) => {
      if (e.id === edgeId) {
        return {
          ...e,
          data: { ...e.data, condition }
        };
      }
      return e;
    });
    set({ edges });
    get().triggerAutoSave();
  },

  // Delete edge
  deleteEdge: (edgeId) => {
    const edges = get().edges.filter((e) => e.id !== edgeId);
    set({ edges });
    get().triggerAutoSave();
  },

  // Save characters
  saveCharacters: async (characters) => {
    try {
      set({ characters });
      await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(characters)
      });
    } catch (err) {
      console.error('Failed to save characters:', err);
    }
  },

  // Save world lore
  saveWorldLore: async (content) => {
    try {
      set({ worldLore: content });
      await fetch('/api/world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
    } catch (err) {
      console.error('Failed to save world lore:', err);
    }
  },

  // Save settings
  saveSettings: async (settings) => {
    try {
      set({ settings });
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setActiveModal: (modal) => set({ activeModal: modal }),

  // Sidebar & Full View controls
  setLeftSidebarOpen: (isOpen) => set({ isLeftSidebarOpen: isOpen }),
  toggleLeftSidebar: () => set((s) => ({ isLeftSidebarOpen: !s.isLeftSidebarOpen })),
  setFullDatabaseOpen: (isOpen) => set({ isFullDatabaseOpen: isOpen, ...(isOpen ? { activeWorkspace: 'database' } : { activeWorkspace: 'nodes' }) }),
  openFullDatabase: (categoryId = null, tag = null) => set((s) => ({
    isFullDatabaseOpen: true,
    activeWorkspace: 'database',
    activeDatabaseCategory: categoryId || s.activeDatabaseCategory,
    selectedDatabaseTag: tag !== undefined ? tag : s.selectedDatabaseTag
  })),
  closeFullDatabase: () => set({ isFullDatabaseOpen: false, activeWorkspace: 'nodes' }),
  setActiveDatabaseCategory: (categoryId) => set({ activeDatabaseCategory: categoryId, selectedDatabaseTag: null }),
  setSelectedDatabaseTag: (tag) => set((s) => ({ selectedDatabaseTag: s.selectedDatabaseTag === tag ? null : tag })),
  setDatabaseSearchKeyword: (keyword) => set({ databaseSearchKeyword: keyword }),

  // Canvas actions registration
  registerCanvasAction: (name, fn) => set((s) => ({
    canvasActions: { ...s.canvasActions, [name]: fn }
  })),

  // Unified Database persistence
  saveDatabase: async (database) => {
    try {
      const extractedChars = extractCharactersFromDatabase(database);
      set({
        database,
        characters: extractedChars.length > 0 ? extractedChars : get().characters
      });
      const res = await fetch('/api/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(database)
      });
      return await res.json();
    } catch (err) {
      console.error('Failed to save database:', err);
      throw err;
    }
  },

  // Save or update an entry in the database
  saveDatabaseEntry: async (entry) => {
    const db = get().database || { categories: [], entries: [] };
    const entries = [...(db.entries || [])];
    const entryId = entry.id || `entry-${Date.now().toString(36)}`;
    const normalizedEntry = {
      ...entry,
      id: entryId,
      name: entry.name || entry.title || '新条目',
      title: entry.title || entry.name || '新条目',
      tags: Array.isArray(entry.tags) ? entry.tags : []
    };

    const existingIndex = entries.findIndex((e) => e.id === entryId);
    if (existingIndex >= 0) {
      entries[existingIndex] = { ...entries[existingIndex], ...normalizedEntry };
    } else {
      entries.push(normalizedEntry);
    }

    const updatedDb = { ...db, entries };
    await get().saveDatabase(updatedDb);

    // If this is an event, synchronize with mapData.timeline
    if (normalizedEntry.categoryId === 'events') {
      const mapData = get().mapData || {};
      const timeline = [...(mapData.timeline || [])];
      const eventRecord = {
        id: normalizedEntry.id,
        categoryId: 'events',
        title: normalizedEntry.title || normalizedEntry.name,
        name: normalizedEntry.name || normalizedEntry.title,
        epochId: normalizedEntry.epochId || mapData.currentEpochId || 'epoch-pre-ww3',
        year: typeof normalizedEntry.year === 'number' ? normalizedEntry.year : (mapData.timelineSettings?.currentTime || 2024),
        timeLabel: normalizedEntry.timeLabel || `${normalizedEntry.year || 2024}年`,
        locationId: normalizedEntry.locationId || '',
        locationName: normalizedEntry.locationName || '',
        hierarchyText: normalizedEntry.hierarchyText || '',
        continent: normalizedEntry.continent || '',
        country: normalizedEntry.country || '',
        province: normalizedEntry.province || '',
        city: normalizedEntry.city || '',
        lng: typeof normalizedEntry.lng === 'number' ? normalizedEntry.lng : undefined,
        lat: typeof normalizedEntry.lat === 'number' ? normalizedEntry.lat : undefined,
        characterIds: Array.isArray(normalizedEntry.characterIds) ? normalizedEntry.characterIds : [],
        characters: Array.isArray(normalizedEntry.characters) ? normalizedEntry.characters : [],
        customCharacters: normalizedEntry.customCharacters || '',
        description: normalizedEntry.summary || normalizedEntry.bio || normalizedEntry.content || '',
        summary: normalizedEntry.summary || normalizedEntry.bio || '',
        content: normalizedEntry.content || '',
        tag: normalizedEntry.tags?.[0] || '历史事件',
        tags: normalizedEntry.tags?.length ? normalizedEntry.tags : ['历史事件'],
        color: normalizedEntry.color || '#f59e0b',
        images: Array.isArray(normalizedEntry.images) ? normalizedEntry.images : [],
        previewImage: normalizedEntry.previewImage || ''
      };

      const tIdx = timeline.findIndex((t) => t.id === entryId);
      if (tIdx >= 0) {
        timeline[tIdx] = { ...timeline[tIdx], ...eventRecord };
      } else {
        timeline.push(eventRecord);
      }
      timeline.sort((a, b) => (a.year || 0) - (b.year || 0));
      await get().saveMapData({ ...mapData, timeline });
    }

    return normalizedEntry;
  },

  // Delete an entry from the database
  deleteDatabaseEntry: async (entryId) => {
    const db = get().database || { categories: [], entries: [] };
    const entries = (db.entries || []).filter((e) => e.id !== entryId);
    const updatedDb = { ...db, entries };
    await get().saveDatabase(updatedDb);

    // Also remove from mapData.timeline if present
    const mapData = get().mapData || {};
    const timeline = (mapData.timeline || []).filter((t) => t.id !== entryId);
    if (timeline.length !== (mapData.timeline || []).length) {
      if (get().selectedTimelineEventId === entryId) {
        set({ selectedTimelineEventId: null });
      }
      await get().saveMapData({ ...mapData, timeline });
    }
  },

  // Save or update a category in the database
  saveDatabaseCategory: async (category) => {
    const db = get().database || { categories: [], entries: [] };
    const categories = [...(db.categories || [])];
    const catId = category.id || `cat-${Date.now().toString(36)}`;
    const normalizedCat = {
      ...category,
      id: catId,
      name: category.name || '新分类',
      icon: category.icon || 'Folder',
      isCharacterType: !!category.isCharacterType,
      description: category.description || ''
    };

    const existingIndex = categories.findIndex((c) => c.id === catId);
    if (existingIndex >= 0) {
      categories[existingIndex] = { ...categories[existingIndex], ...normalizedCat };
    } else {
      categories.push(normalizedCat);
    }

    const updatedDb = { ...db, categories };
    await get().saveDatabase(updatedDb);
    return normalizedCat;
  },

  // Delete a category and its entries
  deleteDatabaseCategory: async (categoryId) => {
    const db = get().database || { categories: [], entries: [] };
    const categories = (db.categories || []).filter((c) => c.id !== categoryId);
    const entries = (db.entries || []).filter((e) => e.categoryId !== categoryId);
    const updatedDb = { ...db, categories, entries };
    const nextActiveCat = categories[0]?.id || 'characters';
    set({ activeDatabaseCategory: nextActiveCat });
    await get().saveDatabase(updatedDb);
  },

  // Map & Timeline persistence
  saveMapData: async (newMapData) => {
    try {
      const current = get().mapData || {};
      const merged = {
        timelineSettings: newMapData?.timelineSettings || current.timelineSettings || {
          minYear: 2000,
          maxYear: 2100,
          leftBound: 2000,
          rightBound: 2042,
          currentTime: 2024
        },
        currentEpochId: newMapData?.currentEpochId || current.currentEpochId || 'epoch-pre-ww3',
        epochs: newMapData?.epochs || current.epochs || [],
        locations: newMapData?.locations || current.locations || [],
        timeline: newMapData?.timeline || current.timeline || []
      };
      set({ mapData: merged });
      const res = await fetch('/api/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      });
      return await res.json();
    } catch (err) {
      console.error('Failed to save map data:', err);
      throw err;
    }
  },

  setTimelineBounds: async (leftBound, rightBound) => {
    const current = get().mapData || {};
    const timelineSettings = {
      ...(current.timelineSettings || { minYear: -1000, maxYear: 2100, currentTime: 2024 }),
      leftBound,
      rightBound
    };
    await get().saveMapData({ ...current, timelineSettings });
  },

  setCurrentTime: async (currentTime) => {
    const current = get().mapData || {};
    const timelineSettings = {
      ...(current.timelineSettings || { minYear: -1000, maxYear: 2100, leftBound: -500, rightBound: 2080 }),
      currentTime
    };
    await get().saveMapData({ ...current, timelineSettings });
  },

  setCurrentEpochId: async (epochId) => {
    const current = get().mapData || {};
    await get().saveMapData({ ...current, currentEpochId: epochId });
  },

  selectEpoch: async (epochId, leftBound, rightBound) => {
    const current = get().mapData || {};
    const epochs = current.epochs || [];
    const target = epochs.find((ep) => ep.id === epochId);
    const start = leftBound !== undefined ? leftBound : (target?.timeRange?.[0] ?? -1000);
    const end = rightBound !== undefined ? rightBound : (target?.timeRange?.[1] ?? 2100);
    const timelineSettings = {
      ...(current.timelineSettings || { minYear: -1000, maxYear: 2100 }),
      leftBound: start,
      rightBound: end,
      currentTime: start
    };
    await get().saveMapData({
      ...current,
      currentEpochId: epochId,
      timelineSettings
    });
  },

  setRegionColor: async (epochId, regionKey, color) => {
    const current = get().mapData || {};
    const epochs = (current.epochs || []).map((ep) => {
      if (ep.id === epochId) {
        const nextColors = { ...(ep.regionColors || {}) };
        const nextPlates = { ...(ep.platesData || {}) };
        if (color) {
          nextColors[regionKey] = color;
          nextPlates[regionKey] = {
            ...(nextPlates[regionKey] || {}),
            color
          };
        } else {
          delete nextColors[regionKey];
          if (nextPlates[regionKey]) {
            nextPlates[regionKey] = {
              ...nextPlates[regionKey],
              color: ''
            };
          }
        }
        return { ...ep, regionColors: nextColors, platesData: nextPlates };
      }
      return ep;
    });
    await get().saveMapData({ ...current, epochs });
  },

  setPlateInfo: async (epochId, plateId, { name, color, description, applyAllEpochs = false }) => {
    const current = get().mapData || {};
    const epochs = (current.epochs || []).map((ep) => {
      if (ep.id === epochId || applyAllEpochs) {
        const nextPlates = { ...(ep.platesData || {}) };
        nextPlates[plateId] = {
          name: (name || '').trim(),
          color: color || '',
          description: (description || '').trim(),
          updatedAt: Date.now()
        };

        const nextColors = { ...(ep.regionColors || {}) };
        if (color) {
          nextColors[plateId] = color;
        } else {
          delete nextColors[plateId];
        }

        return {
          ...ep,
          platesData: nextPlates,
          regionColors: nextColors
        };
      }
      return ep;
    });
    await get().saveMapData({ ...current, epochs });
  },

  saveEpochLocation: async (epochId, locationData) => {
    const current = get().mapData || {};
    const epochs = [...(current.epochs || [])];
    const targetEpochId = epochId || current.currentEpochId || epochs[0]?.id || 'epoch-pre-ww3';
    const epochIndex = epochs.findIndex((e) => e.id === targetEpochId);
    if (epochIndex === -1) return null;

    const epoch = { ...epochs[epochIndex] };
    const epochLocs = [...(epoch.locations || [])];

    const locId = locationData.id || `loc-${Date.now().toString(36)}`;
    const normalizedLoc = {
      ...locationData,
      id: locId,
      name: locationData.name || locationData.title || '新据点地点',
      title: locationData.name || locationData.title || '新据点地点',
      epochId: targetEpochId,
      continent: locationData.continent || '未知大洲',
      country: locationData.country || '',
      province: locationData.province || locationData.region || '',
      region: locationData.region || locationData.province || '',
      city: locationData.city || locationData.province || '',
      lat: typeof locationData.lat === 'number' ? locationData.lat : 30.0,
      lng: typeof locationData.lng === 'number' ? locationData.lng : 110.0,
      centerLat: typeof locationData.centerLat === 'number' ? locationData.centerLat : locationData.lat,
      centerLng: typeof locationData.centerLng === 'number' ? locationData.centerLng : locationData.lng,
      isSnappedToCenter: !!locationData.isSnappedToCenter,
      description: locationData.description || locationData.summary || '',
      summary: locationData.summary || locationData.description || '',
      color: locationData.color || '#38bdf8',
      tag: locationData.tag || '据点',
      hierarchyText: locationData.hierarchyText || [locationData.continent, locationData.country, locationData.province || locationData.city].filter(Boolean).join(' · ')
    };

    const existingIdx = epochLocs.findIndex((l) => l.id === locId);
    if (existingIdx >= 0) {
      epochLocs[existingIdx] = normalizedLoc;
    } else {
      epochLocs.push(normalizedLoc);
    }
    epoch.locations = epochLocs;
    epochs[epochIndex] = epoch;

    const allLocations = epochs.flatMap((e) => e.locations || []);

    await get().saveMapData({
      ...current,
      epochs,
      locations: allLocations
    });
    set({ selectedMapLocationId: locId });
    return normalizedLoc;
  },

  deleteEpochLocation: async (epochId, locationId) => {
    const current = get().mapData || {};
    const epochs = [...(current.epochs || [])];
    const targetEpochId = epochId || current.currentEpochId;
    const epochIndex = epochs.findIndex((e) => e.id === targetEpochId);
    if (epochIndex === -1) return;

    const epoch = { ...epochs[epochIndex] };
    epoch.locations = (epoch.locations || []).filter((l) => l.id !== locationId);
    epochs[epochIndex] = epoch;

    const allLocations = epochs.flatMap((e) => e.locations || []);
    const timeline = (current.timeline || []).map((t) =>
      t.locationId === locationId ? { ...t, locationId: '' } : t
    );
    if (get().selectedMapLocationId === locationId) {
      set({ selectedMapLocationId: null });
    }
    await get().saveMapData({
      ...current,
      epochs,
      locations: allLocations,
      timeline
    });
  },

  addMapLocation: async (location) => {
    return await get().saveEpochLocation(location.epochId, location);
  },

  updateMapLocation: async (id, patch) => {
    const current = get().mapData || {};
    for (const ep of current.epochs || []) {
      const found = (ep.locations || []).find((l) => l.id === id);
      if (found) {
        return await get().saveEpochLocation(ep.id, { ...found, ...patch });
      }
    }
  },

  deleteMapLocation: async (id) => {
    const current = get().mapData || {};
    for (const ep of current.epochs || []) {
      const found = (ep.locations || []).find((l) => l.id === id);
      if (found) {
        return await get().deleteEpochLocation(ep.id, id);
      }
    }
  },

  addTimelineEvent: async (event) => {
    const current = get().mapData || {};
    const timeline = [...(current.timeline || [])];
    const eventId = event.id || `evt-${Date.now().toString(36)}`;
    const newEvt = {
      id: eventId,
      categoryId: 'events',
      year: typeof event.year === 'number' ? event.year : current.timelineSettings?.currentTime || 2024,
      timeLabel: event.timeLabel || `${event.year || 2024}年`,
      title: event.title || event.name || '新纪事事件',
      name: event.title || event.name || '新纪事事件',
      epochId: event.epochId || current.currentEpochId || 'epoch-pre-ww3',
      description: event.description || event.summary || '',
      summary: event.summary || event.description || '',
      content: event.content || '',
      locationId: event.locationId || '',
      locationName: event.locationName || '',
      hierarchyText: event.hierarchyText || '',
      continent: event.continent || '',
      country: event.country || '',
      province: event.province || '',
      city: event.city || '',
      lng: typeof event.lng === 'number' ? event.lng : undefined,
      lat: typeof event.lat === 'number' ? event.lat : undefined,
      characterIds: Array.isArray(event.characterIds) ? event.characterIds : [],
      characters: Array.isArray(event.characters) ? event.characters : [],
      customCharacters: event.customCharacters || '',
      tag: event.tag || (event.tags?.[0]) || '历史事件',
      tags: Array.isArray(event.tags) ? event.tags : [event.tag || '历史事件'],
      color: event.color || '#f59e0b',
      images: Array.isArray(event.images) ? event.images : [],
      previewImage: event.previewImage || ''
    };
    timeline.push(newEvt);
    timeline.sort((a, b) => (a.year || 0) - (b.year || 0));
    await get().saveMapData({ ...current, timeline });
    set({ selectedTimelineEventId: newEvt.id });

    // Also sync to database.entries
    const db = get().database || { categories: [], entries: [] };
    const entries = [...(db.entries || [])];
    const eIdx = entries.findIndex((e) => e.id === eventId);
    if (eIdx >= 0) {
      entries[eIdx] = { ...entries[eIdx], ...newEvt };
    } else {
      entries.push(newEvt);
    }
    await get().saveDatabase({ ...db, entries });

    return newEvt;
  },

  updateTimelineEvent: async (id, patch) => {
    const current = get().mapData || {};
    let updatedEvt = null;
    const timeline = (current.timeline || []).map((evt) => {
      if (evt.id === id) {
        updatedEvt = { ...evt, ...patch };
        return updatedEvt;
      }
      return evt;
    });
    timeline.sort((a, b) => (a.year || 0) - (b.year || 0));
    await get().saveMapData({ ...current, timeline });

    // Also sync to database.entries
    if (updatedEvt) {
      const db = get().database || { categories: [], entries: [] };
      const entries = (db.entries || []).map((e) => e.id === id ? { ...e, ...updatedEvt } : e);
      await get().saveDatabase({ ...db, entries });
    }
  },

  deleteTimelineEvent: async (id) => {
    const current = get().mapData || {};
    const timeline = (current.timeline || []).filter((evt) => evt.id !== id);
    if (get().selectedTimelineEventId === id) {
      set({ selectedTimelineEventId: null });
    }
    await get().saveMapData({ ...current, timeline });

    // Also delete from database.entries
    const db = get().database || { categories: [], entries: [] };
    const entries = (db.entries || []).filter((e) => e.id !== id);
    await get().saveDatabase({ ...db, entries });
  },

  focusTimelineEvent: async (event) => {
    if (!event) return;
    const current = get().mapData || {};
    const epochs = current.epochs || [];
    const targetEpochId = event.epochId || current.currentEpochId || 'epoch-pre-ww3';
    const targetEpoch = epochs.find((e) => e.id === targetEpochId) || epochs[0];
    const epStart = targetEpoch?.timeRange?.[0] ?? 2000;
    const epEnd = targetEpoch?.timeRange?.[1] ?? 2100;
    const evtYear = typeof event.year === 'number' ? event.year : epStart;

    let left = current.timelineSettings?.leftBound ?? epStart;
    let right = current.timelineSettings?.rightBound ?? epEnd;

    // Make sure bounds encompass the event year within the epoch
    if (evtYear < left) left = Math.max(epStart, evtYear);
    if (evtYear > right) right = Math.min(epEnd, evtYear);

    const timelineSettings = {
      ...(current.timelineSettings || {}),
      leftBound: left,
      rightBound: right,
      currentTime: evtYear
    };

    set({
      activeWorkspace: 'map',
      selectedTimelineEventId: event.id,
      selectedMapLocationId: event.locationId || null
    });

    await get().saveMapData({
      ...current,
      currentEpochId: targetEpochId,
      timelineSettings
    });
  },

  // Projects Management Actions
  fetchProjectsList: async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) {
        const active = data.projects.find((p) => p.id === data.activeProjectId) || data.projects[0];
        set({
          projectsList: data.projects || [],
          currentProject: active || get().currentProject
        });
      }
    } catch (err) {
      console.error('Failed to fetch projects list:', err);
    }
  },

  switchProject: async (projectId) => {
    try {
      if (get().currentProject?.id === projectId) return;
      // Flush unsaved story changes if any
      await get().saveStoryImmediate();

      set({ isLoading: true });
      const res = await fetch('/api/projects/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      const data = await res.json();
      if (data.success) {
        await get().loadProject(projectId);
        await get().fetchProjectsList();
      } else {
        alert(`切换企划失败: ${data.error || '未知错误'}`);
        set({ isLoading: false });
      }
    } catch (err) {
      console.error('Failed to switch project:', err);
      set({ isLoading: false });
    }
  },

  createProject: async ({ name, description, template }) => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, template })
      });
      const data = await res.json();
      if (data.success) {
        await get().loadProject(data.activeProjectId || data.project.id);
        await get().fetchProjectsList();
        return { success: true, project: data.project };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Failed to create project:', err);
      return { success: false, error: err.message };
    }
  },

  updateProjectMeta: async (id, { name, description }) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });
      const data = await res.json();
      if (data.success) {
        if (get().currentProject?.id === id) {
          set({ currentProject: data.project });
        }
        await get().fetchProjectsList();
        return { success: true, project: data.project };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Failed to update project:', err);
      return { success: false, error: err.message };
    }
  },

  duplicateProject: async (id) => {
    try {
      const res = await fetch(`/api/projects/${id}/duplicate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        await get().fetchProjectsList();
        return { success: true, project: data.project };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Failed to duplicate project:', err);
      return { success: false, error: err.message };
    }
  },

  deleteProject: async (id) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        if (data.switched) {
          await get().loadProject(data.activeProjectId);
        }
        await get().fetchProjectsList();
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
      return { success: false, error: err.message };
    }
  },

  // -------------------------------------------------------------------------
  // Story Copilot Actions
  // -------------------------------------------------------------------------
  injectEntityToCopilot: (entity) => {
    const current = get().copilotInjectedEntities || [];
    if (!current.some((e) => e.id === entity.id)) {
      set({
        copilotInjectedEntities: [...current, entity],
        isCopilotOpen: true
      });
    } else {
      set({ isCopilotOpen: true });
    }
  },

  removeInjectedEntity: (id) => {
    set({
      copilotInjectedEntities: (get().copilotInjectedEntities || []).filter((e) => e.id !== id)
    });
  },

  clearInjectedEntities: () => {
    set({ copilotInjectedEntities: [] });
  },

  fetchCopilotSessions: async () => {
    try {
      const pid = get().currentProject?.id;
      const url = pid ? `/api/copilot/sessions?projectId=${pid}` : '/api/copilot/sessions';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        const active = (data.sessions || []).find((s) => s.id === data.activeSessionId) || data.sessions?.[0] || null;
        set({
          copilotSessions: data.sessions || [],
          currentCopilotSessionId: active ? active.id : null,
          copilotMessages: active ? (active.messages || []) : []
        });
      }
    } catch (err) {
      console.error('Failed to fetch copilot sessions:', err);
    }
  },

  createCopilotSession: async (title = '新剧情推演会话') => {
    try {
      const pid = get().currentProject?.id;
      const res = await fetch('/api/copilot/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: pid, title })
      });
      const data = await res.json();
      if (data.success) {
        await get().fetchCopilotSessions();
        return data.session;
      }
    } catch (err) {
      console.error('Failed to create copilot session:', err);
    }
  },

  switchCopilotSession: async (sessionId) => {
    try {
      const pid = get().currentProject?.id;
      await fetch('/api/copilot/sessions/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: pid, sessionId })
      });
      const target = (get().copilotSessions || []).find((s) => s.id === sessionId);
      set({
        currentCopilotSessionId: sessionId,
        copilotMessages: target ? (target.messages || []) : []
      });
    } catch (err) {
      console.error('Failed to switch copilot session:', err);
    }
  },

  deleteCopilotSession: async (sessionId) => {
    try {
      const pid = get().currentProject?.id;
      await fetch(`/api/copilot/sessions/${sessionId}?projectId=${pid}`, {
        method: 'DELETE'
      });
      await get().fetchCopilotSessions();
    } catch (err) {
      console.error('Failed to delete copilot session:', err);
    }
  },

  sendCopilotMessage: async (prompt) => {
    const {
      currentCopilotSessionId,
      copilotInjectedEntities,
      copilotModel,
      currentProject
    } = get();

    if (!prompt || !prompt.trim()) return;

    set({
      copilotLoading: true,
      copilotActiveThinking: ''
    });

    const userTempMsg = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: prompt.trim(),
      injectedEntities: [...copilotInjectedEntities],
      timestamp: new Date().toISOString()
    };

    set({
      copilotMessages: [...get().copilotMessages, userTempMsg]
    });

    try {
      const chatRes = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject?.id,
          sessionId: currentCopilotSessionId,
          prompt: prompt.trim(),
          model: copilotModel || 'flash',
          contextEntities: copilotInjectedEntities
        })
      });
      const chatData = await chatRes.json();
      if (!chatData.success) {
        throw new Error(chatData.error || '调用 Agent 失败');
      }

      const activeSessionId = chatData.sessionId;
      const conversationId = chatData.conversationId;

      // Poll until done
      let attempts = 0;
      const maxAttempts = 60; // 60s
      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000));
        attempts++;

        const pollRes = await fetch(
          `/api/copilot/poll?projectId=${currentProject?.id}&sessionId=${activeSessionId}&conversationId=${conversationId || ''}`
        );
        const pollData = await pollRes.json();

        if (pollData.success) {
          if (pollData.thinking) {
            set({ copilotActiveThinking: pollData.thinking });
          }

          if (pollData.isDone) {
            set({
              copilotLoading: false,
              copilotActiveThinking: ''
            });

            // Reload project in case tool modified story_graph or database
            await get().loadProject();
            await get().fetchCopilotSessions();
            return { success: true, content: pollData.content, actions: pollData.actions };
          }
        }
      }

      set({ copilotLoading: false });
    } catch (err) {
      console.error('Failed to send copilot message:', err);
      set({
        copilotLoading: false,
        copilotActiveThinking: ''
      });
      alert(`Copilot 推演失败: ${err.message}`);
    }
  },

  executeCopilotToolAction: async (action, params) => {
    try {
      const pid = get().currentProject?.id;
      const res = await fetch('/api/copilot/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: pid, action, params })
      });
      const data = await res.json();
      if (data.success) {
        await get().loadProject();
        return { success: true, result: data.result };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.error('Failed to execute copilot tool action:', err);
      return { success: false, error: err.message };
    }
  }
}));
