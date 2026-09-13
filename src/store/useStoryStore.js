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
  
  // Main Workspace: 'nodes' | 'database' | 'map'
  activeWorkspace: 'nodes',
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),

  // Map & Timeline state
  mapData: {
    timelineSettings: {
      minYear: -1000,
      maxYear: 2100,
      leftBound: -500,
      rightBound: 2080,
      currentTime: 2024
    },
    currentEpochId: 'epoch-modern',
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
  loadProject: async () => {
    try {
      set({ isLoading: true });
      const res = await fetch('/api/project');
      const data = await res.json();
      if (data.success) {
        const loadedDb = data.database || { categories: [], entries: [] };
        const extractedChars = extractCharactersFromDatabase(loadedDb);
        const finalChars = extractedChars.length > 0 ? extractedChars : (data.characters || []);

        set({
          nodes: data.story.nodes || [],
          edges: data.story.edges || [],
          database: loadedDb,
          characters: finalChars,
          worldLore: data.worldLore || '',
          mapData: {
            timelineSettings: data.mapData?.timelineSettings || {
              minYear: -1000,
              maxYear: 2100,
              leftBound: -500,
              rightBound: 2080,
              currentTime: 2024
            },
            currentEpochId: data.mapData?.currentEpochId || 'epoch-modern',
            epochs: data.mapData?.epochs || [],
            locations: data.mapData?.locations || [],
            timeline: data.mapData?.timeline || []
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
    return normalizedEntry;
  },

  // Delete an entry from the database
  deleteDatabaseEntry: async (entryId) => {
    const db = get().database || { categories: [], entries: [] };
    const entries = (db.entries || []).filter((e) => e.id !== entryId);
    const updatedDb = { ...db, entries };
    await get().saveDatabase(updatedDb);
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
          minYear: -1000,
          maxYear: 2100,
          leftBound: -500,
          rightBound: 2080,
          currentTime: 2024
        },
        currentEpochId: newMapData?.currentEpochId || current.currentEpochId || 'epoch-modern',
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

  addMapLocation: async (location) => {
    const current = get().mapData || {};
    const locations = [...(current.locations || [])];
    const newLoc = {
      id: location.id || `loc-${Date.now().toString(36)}`,
      name: location.name || '新地标地点',
      lat: typeof location.lat === 'number' ? location.lat : 30.0,
      lng: typeof location.lng === 'number' ? location.lng : 110.0,
      type: location.type || 'city',
      country: location.country || '',
      region: location.region || '未分区',
      year: typeof location.year === 'number' ? location.year : current.timelineSettings?.currentTime || 2024,
      description: location.description || '',
      icon: location.icon || 'Castle',
      color: location.color || '#38bdf8'
    };
    locations.push(newLoc);
    await get().saveMapData({ ...current, locations });
    set({ selectedMapLocationId: newLoc.id });
    return newLoc;
  },

  updateMapLocation: async (id, patch) => {
    const current = get().mapData || {};
    const locations = (current.locations || []).map((loc) =>
      loc.id === id ? { ...loc, ...patch } : loc
    );
    await get().saveMapData({ ...current, locations });
  },

  deleteMapLocation: async (id) => {
    const current = get().mapData || {};
    const locations = (current.locations || []).filter((loc) => loc.id !== id);
    const timeline = (current.timeline || []).map((t) =>
      t.locationId === id ? { ...t, locationId: '' } : t
    );
    if (get().selectedMapLocationId === id) {
      set({ selectedMapLocationId: null });
    }
    await get().saveMapData({ ...current, locations, timeline });
  },

  addTimelineEvent: async (event) => {
    const current = get().mapData || {};
    const timeline = [...(current.timeline || [])];
    const newEvt = {
      id: event.id || `evt-${Date.now().toString(36)}`,
      year: typeof event.year === 'number' ? event.year : current.timelineSettings?.currentTime || 2024,
      timeLabel: event.timeLabel || `${event.year || 2024}年`,
      title: event.title || '新纪事事件',
      epochId: event.epochId || current.currentEpochId || 'epoch-modern',
      description: event.description || '',
      locationId: event.locationId || '',
      tag: event.tag || '主线'
    };
    timeline.push(newEvt);
    // Sort chronologically
    timeline.sort((a, b) => (a.year || 0) - (b.year || 0));
    await get().saveMapData({ ...current, timeline });
    set({ selectedTimelineEventId: newEvt.id });
    return newEvt;
  },

  updateTimelineEvent: async (id, patch) => {
    const current = get().mapData || {};
    const timeline = (current.timeline || []).map((evt) =>
      evt.id === id ? { ...evt, ...patch } : evt
    );
    timeline.sort((a, b) => (a.year || 0) - (b.year || 0));
    await get().saveMapData({ ...current, timeline });
  },

  deleteTimelineEvent: async (id) => {
    const current = get().mapData || {};
    const timeline = (current.timeline || []).filter((evt) => evt.id !== id);
    if (get().selectedTimelineEventId === id) {
      set({ selectedTimelineEventId: null });
    }
    await get().saveMapData({ ...current, timeline });
  }
}));
