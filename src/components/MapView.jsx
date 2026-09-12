import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  preloadGeoAssets,
  getPreloadedContinentsGeo,
  getPreloadedCountries,
  getPreloadedProvinces,
  getPreloadedCountryLabels,
  getPreloadedProvinceLabels,
  getPreloadedContinents
} from '../services/geoPreloader';
import {
  Compass,
  MapPin,
  Castle,
  Anchor,
  Shield,
  Skull,
  Sparkles,
  Mountain,
  Flame,
  Plus,
  Trash2,
  Edit2,
  X,
  Search,
  Calendar,
  Clock,
  Flag,
  ChevronDown,
  ChevronUp,
  Layers,
  Palette,
  Eye,
  RotateCcw,
  Sliders,
  History,
  Maximize2
} from 'lucide-react';

const COLOR_PRESETS = [
  '#ef4444', // Red / Empire
  '#3b82f6', // Blue / Alliance
  '#10b981', // Emerald / Federation
  '#f59e0b', // Amber / Sacred
  '#8b5cf6', // Purple / Mystery
  '#ec4899', // Pink / Arcane
  '#06b6d4', // Cyan / Free Harbor
  '#64748b'  // Slate / Neutral
];

function labelsToGeoJSON(labels, platesData = {}) {
  if (!labels || !labels.length) {
    return { type: 'FeatureCollection', features: [] };
  }
  const features = [];
  for (let i = 0; i < labels.length; i++) {
    const item = labels[i];
    if (item.lat === undefined || item.lng === undefined) continue;
    const plate = platesData[item.id] || platesData[item.name] || {};
    const displayName = plate.name || item.name;
    const hasSub = item.name_en && item.name_en !== displayName;
    const labelText = hasSub ? `${displayName}\n${item.name_en}` : displayName;

    features.push({
      type: 'Feature',
      id: item.id || `lbl-${i}`,
      properties: {
        id: item.id,
        name: displayName,
        name_en: item.name_en || '',
        label: labelText,
        area: item.area || 0
      },
      geometry: {
        type: 'Point',
        coordinates: [item.lng, item.lat]
      }
    });
  }
  return { type: 'FeatureCollection', features };
}

function continentsWatermarksToGeoJSON(continentsData) {
  const features = [];
  if (continentsData?.continents) {
    continentsData.continents.forEach((cont, idx) => {
      features.push({
        type: 'Feature',
        id: `cont-wm-${idx}`,
        properties: {
          name: cont.name,
          name_en: cont.name_en || '',
          label: `${cont.name}\n${cont.name_en || ''}`,
          type: 'continent'
        },
        geometry: {
          type: 'Point',
          coordinates: [cont.lng, cont.lat]
        }
      });
    });
  }
  return { type: 'FeatureCollection', features };
}

function oceanWatermarksToGeoJSON(continentsData) {
  const features = [];
  if (continentsData?.oceans) {
    continentsData.oceans.forEach((ocean, idx) => {
      features.push({
        type: 'Feature',
        id: `ocean-wm-${idx}`,
        properties: {
          name: ocean.name,
          name_en: ocean.name_en || '',
          label: `~ ${ocean.name} ~\n${ocean.name_en || ''}`,
          type: 'ocean'
        },
        geometry: {
          type: 'Point',
          coordinates: [ocean.lng, ocean.lat]
        }
      });
    });
  }
  return { type: 'FeatureCollection', features };
}

function getPlateColorExpression(platesData, defaultColor = '#38bdf8') {
  const matchEntries = [];
  if (platesData) {
    for (const [key, val] of Object.entries(platesData)) {
      if (val && val.color) {
        matchEntries.push(key, val.color);
      }
    }
  }
  if (matchEntries.length === 0) {
    return defaultColor;
  }
  return ['match', ['get', 'id'], ...matchEntries, defaultColor];
}

// ---------------------------------------------------------------------------
// Singleton Plate Hover Card Component
// ---------------------------------------------------------------------------
function PlateHoverCard({ plate, cardRef }) {
  if (!plate || !plate.visible) return null;

  const { name, originalName, nameEn, type, parentName, color, description, x = 0, y = 0 } = plate;
  const isRenamed = originalName && name && originalName !== name;
  const badgeClass =
    type === '大洲板块'
      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
      : type === '国家板块'
      ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

  const cardW = 264;
  const cardH = 150;
  let posX = x + 16;
  let posY = y + 16;

  if (typeof window !== 'undefined') {
    if (posX + cardW > window.innerWidth - 12) {
      posX = x - cardW - 16;
    }
    if (posY + cardH > window.innerHeight - 12) {
      posY = y - cardH - 16;
    }
    posX = Math.max(12, Math.min(window.innerWidth - cardW - 12, posX));
    posY = Math.max(64, Math.min(window.innerHeight - cardH - 12, posY));
  }

  return (
    <div
      ref={cardRef}
      className="fixed z-40 pointer-events-none select-none w-64 text-slate-100 p-3.5 rounded-xl border border-slate-700 shadow-2xl font-sans"
      style={{
        left: `${posX}px`,
        top: `${posY}px`,
        backgroundColor: '#0f172a',
        opacity: 1
      }}
    >
      <div className="flex items-center justify-between text-[10px] pb-2 mb-2 border-b border-slate-800">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border font-medium ${badgeClass}`}>
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: color || '#38bdf8',
              boxShadow: color ? `0 0 6px ${color}` : undefined
            }}
          />
          <span>{type}</span>
        </span>
        {parentName && (
          <span className="text-slate-400 font-mono text-[10px] truncate max-w-[120px]" title={parentName}>
            {parentName}
          </span>
        )}
      </div>

      <div className="mb-2">
        <div className="text-sm font-bold text-white flex items-baseline gap-1.5 leading-tight">
          <span>{name}</span>
          {isRenamed && (
            <span className="text-[10px] text-slate-400 font-normal truncate">(原: {originalName})</span>
          )}
        </div>
        {nameEn && nameEn !== name && (
          <div className="text-[10px] text-slate-400 font-mono tracking-wide mt-0.5 truncate">{nameEn}</div>
        )}
      </div>

      <div className="text-[11px] leading-relaxed mb-2.5">
        {description ? (
          <div className="p-2.5 rounded-lg border border-slate-800 text-slate-300 bg-[#020617] whitespace-pre-wrap max-h-32 overflow-hidden text-ellipsis leading-relaxed">
            {description}
          </div>
        ) : (
          <div className="text-slate-500 italic text-[10px] py-1">暂无板块简介设定，点击板块可编辑</div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-sky-400 font-medium">
        <span className="flex items-center gap-1">
          <Edit2 className="w-3 h-3 text-sky-400 inline" />
          点击编辑板块名称、颜色与简介
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plate Editor Modal Component
// ---------------------------------------------------------------------------
function PlateEditorModal({ target, currentEpoch, onClose, onSave }) {
  const [name, setName] = useState(target?.name || '');
  const [color, setColor] = useState(target?.color || '');
  const [description, setDescription] = useState(target?.description || '');
  const [applyAllEpochs, setApplyAllEpochs] = useState(false);

  if (!target) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      plateId: target.id,
      name: name.trim() || target.originalName,
      color,
      description: description.trim(),
      applyAllEpochs
    });
  };

  const handleResetName = () => {
    setName(target.originalName || '');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 space-y-4 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow border border-white/10"
              style={{ backgroundColor: color || '#38bdf8', color: '#ffffff' }}
            >
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>编辑板块信息</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-sky-300">
                  {target.type}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                原名: {target.originalName} {target.nameEn ? `(${target.nameEn})` : ''} {target.parentName ? `· ${target.parentName}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            当前历史纪元:
          </span>
          <span className="font-semibold text-amber-300">{currentEpoch?.name || '默认纪元'}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-300">板块名称 (可自定义)</label>
              {name !== target.originalName && (
                <button
                  type="button"
                  onClick={handleResetName}
                  className="text-[10px] text-sky-400 hover:underline flex items-center gap-0.5"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> 恢复原名 ({target.originalName})
                </button>
              )}
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={target.originalName}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-300">板块主题颜色 / 势力涂色</label>
              {color && (
                <button
                  type="button"
                  onClick={() => setColor('')}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> 恢复默认统一度量底色
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-8 gap-1.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    className={`h-7 rounded-lg transition-transform hover:scale-110 flex items-center justify-center border shadow ${
                      color === preset ? 'ring-2 ring-white scale-105 border-white' : 'border-white/20'
                    }`}
                    style={{ backgroundColor: preset }}
                  />
                ))}
              </div>

              <label 
                className="w-7 h-7 rounded-lg border border-slate-700 cursor-pointer overflow-hidden flex items-center justify-center shrink-0 hover:scale-110 transition-transform" 
                title="自定义拾色器"
                style={{ backgroundColor: color || '#38bdf8' }}
              >
                <input
                  type="color"
                  value={color || '#38bdf8'}
                  onChange={(e) => setColor(e.target.value)}
                  className="opacity-0 w-0 h-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">板块简介 / 地理与历史设定</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="在此记录该板块在当前历史纪元的风土人情、政权势力、地理环境、神话传说或变迁背景..."
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-sky-500 transition-colors leading-relaxed resize-none"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none bg-slate-950/40 p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={applyAllEpochs}
              onChange={(e) => setApplyAllEpochs(e.target.checked)}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 bg-slate-900 border-slate-700 cursor-pointer"
            />
            <div className="text-[11px]">
              <span className="text-slate-200 font-medium">同步应用至所有历史纪元</span>
              <p className="text-slate-500 text-[10px]">
                默认仅作用于当前历史纪元（各纪元可具备独立的板块名称、版图颜色与设定）
              </p>
            </div>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-lg shadow-sky-600/20 transition-all"
            >
              保存修改
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MapView({ isActive = true }) {
  const mapData = useStoryStore((s) => s.mapData) || {};
  const saveMapData = useStoryStore((s) => s.saveMapData);
  const setTimelineBounds = useStoryStore((s) => s.setTimelineBounds);
  const setCurrentTime = useStoryStore((s) => s.setCurrentTime);
  const setCurrentEpochId = useStoryStore((s) => s.setCurrentEpochId);
  const setRegionColor = useStoryStore((s) => s.setRegionColor);
  const setPlateInfo = useStoryStore((s) => s.setPlateInfo);
  const addMapLocation = useStoryStore((s) => s.addMapLocation);
  const updateMapLocation = useStoryStore((s) => s.updateMapLocation);
  const deleteMapLocation = useStoryStore((s) => s.deleteMapLocation);
  const addTimelineEvent = useStoryStore((s) => s.addTimelineEvent);
  const updateTimelineEvent = useStoryStore((s) => s.updateTimelineEvent);
  const deleteTimelineEvent = useStoryStore((s) => s.deleteTimelineEvent);
  const selectedMapLocationId = useStoryStore((s) => s.selectedMapLocationId);
  const setSelectedMapLocationId = useStoryStore((s) => s.setSelectedMapLocationId);
  const selectedTimelineEventId = useStoryStore((s) => s.selectedTimelineEventId);
  const setSelectedTimelineEventId = useStoryStore((s) => s.setSelectedTimelineEventId);
  const setActiveWorkspace = useStoryStore((s) => s.setActiveWorkspace);

  const timelineSettings = mapData.timelineSettings || {
    minYear: -1000,
    maxYear: 2100,
    leftBound: -500,
    rightBound: 2080,
    currentTime: 2024
  };
  const currentEpochId = mapData.currentEpochId || 'epoch-modern';
  const epochs = mapData.epochs || [];
  const locations = mapData.locations || [];
  const timeline = mapData.timeline || [];

  const currentEpoch = useMemo(() => {
    return epochs.find((ep) => ep.id === currentEpochId) || epochs[0] || null;
  }, [epochs, currentEpochId]);

  const currentEpochRef = useRef(currentEpoch);
  useEffect(() => {
    currentEpochRef.current = currentEpoch;
  }, [currentEpoch]);

  // UI state
  const [zoomLevel, setZoomLevel] = useState(1.8);
  const [isTimelineOpen, setIsTimelineOpen] = useState(true);
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const isAddingLocationRef = useRef(isAddingLocation);
  isAddingLocationRef.current = isAddingLocation;

  const [editingLocation, setEditingLocation] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [editingPlateTarget, setEditingPlateTarget] = useState(null);

  // Singleton hover card
  const [hoveredPlate, setHoveredPlate] = useState(null);
  const plateHoverCardRef = useRef(null);

  const updateHoverCardPos = useCallback((clientX, clientY) => {
    const el = plateHoverCardRef.current;
    if (!el) return;
    const cardW = 264;
    const cardH = 150;
    let posX = clientX + 16;
    let posY = clientY + 16;
    if (typeof window !== 'undefined') {
      if (posX + cardW > window.innerWidth - 12) {
        posX = clientX - cardW - 16;
      }
      if (posY + cardH > window.innerHeight - 12) {
        posY = clientY - cardH - 16;
      }
      posX = Math.max(12, Math.min(window.innerWidth - cardW - 12, posX));
      posY = Math.max(64, Math.min(window.innerHeight - cardH - 12, posY));
    }
    el.style.left = `${posX}px`;
    el.style.top = `${posY}px`;
  }, []);

  const showHoverPlate = useCallback(
    (data, clientX, clientY) => {
      if (isAddingLocationRef.current) return;
      setHoveredPlate({
        ...data,
        visible: true,
        x: clientX,
        y: clientY
      });
    },
    []
  );

  const hideHoverPlate = useCallback(() => {
    setHoveredPlate((prev) => (prev?.visible ? { ...prev, visible: false } : prev));
  }, []);

  const hideHoverPlateRef = useRef(hideHoverPlate);
  hideHoverPlateRef.current = hideHoverPlate;

  // MapLibre refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const isMapLoadedRef = useRef(false);
  const markersRef = useRef([]);
  const zoomRafRef = useRef(null);

  // Data states from preloader
  const [continentsGeo, setContinentsGeo] = useState(() => getPreloadedContinentsGeo());
  const [countriesGeo, setCountriesGeo] = useState(() => getPreloadedCountries());
  const [provincesGeo, setProvincesGeo] = useState(() => getPreloadedProvinces());
  const [countryLabels, setCountryLabels] = useState(() => getPreloadedCountryLabels());
  const [provinceLabels, setProvinceLabels] = useState(() => getPreloadedProvinceLabels());
  const [continentsData, setContinentsData] = useState(() => getPreloadedContinents());

  useEffect(() => {
    if (!continentsGeo || !countriesGeo || !provincesGeo || !countryLabels || !provinceLabels || !continentsData) {
      preloadGeoAssets().then(() => {
        setContinentsGeo(getPreloadedContinentsGeo());
        setCountriesGeo(getPreloadedCountries());
        setProvincesGeo(getPreloadedProvinces());
        setCountryLabels(getPreloadedCountryLabels());
        setProvinceLabels(getPreloadedProvinceLabels());
        setContinentsData(getPreloadedContinents());
      });
    }
  }, [continentsGeo, countriesGeo, provincesGeo, countryLabels, provinceLabels, continentsData]);

  // Window resize invalidation
  useEffect(() => {
    if (isActive && mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.resize();
      }, 50);
    }
  }, [isActive]);

  const filteredEvents = useMemo(() => {
    const left = timelineSettings.leftBound ?? -1000;
    const right = timelineSettings.rightBound ?? 2100;
    return timeline.filter((evt) => {
      const yr = evt.year ?? 0;
      return yr >= left && yr <= right;
    });
  }, [timeline, timelineSettings.leftBound, timelineSettings.rightBound]);

  const filteredLocations = useMemo(() => {
    const left = timelineSettings.leftBound ?? -1000;
    const right = timelineSettings.rightBound ?? 2100;
    return locations.filter((loc) => {
      const yr = loc.year ?? 2024;
      if (yr < left || yr > right) return false;
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        return (
          (loc.name || '').toLowerCase().includes(kw) ||
          (loc.region || '').toLowerCase().includes(kw) ||
          (loc.country || '').toLowerCase().includes(kw)
        );
      }
      return true;
    });
  }, [locations, timelineSettings.leftBound, timelineSettings.rightBound, searchKeyword]);

  const selectedLocation = useMemo(() => {
    return locations.find((l) => l.id === selectedMapLocationId) || null;
  }, [locations, selectedMapLocationId]);

  const locationTimelineEvents = useMemo(() => {
    if (!selectedMapLocationId) return [];
    return filteredEvents.filter((t) => t.locationId === selectedMapLocationId);
  }, [filteredEvents, selectedMapLocationId]);

  const currentLOD = useMemo(() => {
    if (zoomLevel < 2.5) return 1;
    if (zoomLevel < 4.5) return 2;
    return 3;
  }, [zoomLevel]);

  // ---------------------------------------------------------------------------
  // Initialize MapLibre GL Map
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        glyphs: '/fonts/{fontstack}/{range}.pbf',
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#020617'
            }
          }
        ]
      },
      localIdeographFontFamily: 'sans-serif',
      center: [15, 25],
      zoom: 1.8,
      minZoom: 1.0,
      maxZoom: 14,
      renderWorldCopies: true,
      attributionControl: false
    });

    map.on('load', () => {
      isMapLoadedRef.current = true;

      // 1. Continents Source & Layers (Zoom 0 ~ 2.5)
      map.addSource('continents', {
        type: 'geojson',
        data: continentsGeo || { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'continents-fill',
        type: 'fill',
        source: 'continents',
        maxzoom: 2.5,
        paint: {
          'fill-color': getPlateColorExpression(currentEpochRef.current?.platesData, '#38bdf8'),
          'fill-opacity': 1.0
        }
      });

      map.addLayer({
        id: 'continents-line',
        type: 'line',
        source: 'continents',
        maxzoom: 2.5,
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.65)',
          'line-width': 2.0
        }
      });

      map.addLayer({
        id: 'continents-hover',
        type: 'line',
        source: 'continents',
        maxzoom: 2.5,
        paint: {
          'line-color': '#ffffff',
          'line-width': 3.5
        },
        filter: ['==', ['get', 'id'], '']
      });

      // 2. Countries Source & Layers (Zoom 2.5 ~ 4.5)
      map.addSource('countries', {
        type: 'geojson',
        data: countriesGeo || { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        minzoom: 2.5,
        maxzoom: 4.5,
        paint: {
          'fill-color': getPlateColorExpression(currentEpochRef.current?.platesData, '#38bdf8'),
          'fill-opacity': 1.0
        }
      });

      map.addLayer({
        id: 'countries-line',
        type: 'line',
        source: 'countries',
        minzoom: 2.5,
        maxzoom: 4.5,
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.75)',
          'line-width': 1.8
        }
      });

      map.addLayer({
        id: 'countries-hover',
        type: 'line',
        source: 'countries',
        minzoom: 2.5,
        maxzoom: 4.5,
        paint: {
          'line-color': '#ffffff',
          'line-width': 3.2
        },
        filter: ['==', ['get', 'id'], '']
      });

      // 3. Provinces Source & Layers (Zoom 4.5 ~ 14)
      map.addSource('provinces', {
        type: 'geojson',
        data: provincesGeo || { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'provinces-fill',
        type: 'fill',
        source: 'provinces',
        minzoom: 4.5,
        paint: {
          'fill-color': getPlateColorExpression(currentEpochRef.current?.platesData, '#38bdf8'),
          'fill-opacity': 1.0
        }
      });

      map.addLayer({
        id: 'provinces-line',
        type: 'line',
        source: 'provinces',
        minzoom: 4.5,
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.55)',
          'line-width': 1.2
        }
      });

      map.addLayer({
        id: 'provinces-hover',
        type: 'line',
        source: 'provinces',
        minzoom: 4.5,
        paint: {
          'line-color': '#ffffff',
          'line-width': 2.8
        },
        filter: ['==', ['get', 'id'], '']
      });

      // 4. Continents & Ocean Watermark Symbols
      map.addSource('continent-watermarks', {
        type: 'geojson',
        data: continentsWatermarksToGeoJSON(continentsData)
      });

      map.addLayer({
        id: 'continents-watermarks',
        type: 'symbol',
        source: 'continent-watermarks',
        maxzoom: 2.5,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-letter-spacing': 0.2,
          'text-justify': 'center',
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': 'rgba(255, 255, 255, 0.85)',
          'text-halo-width': 2.0
        }
      });

      map.addSource('ocean-watermarks', {
        type: 'geojson',
        data: oceanWatermarksToGeoJSON(continentsData)
      });

      map.addLayer({
        id: 'ocean-watermarks',
        type: 'symbol',
        source: 'ocean-watermarks',
        maxzoom: 2.5,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-letter-spacing': 0.3,
          'text-justify': 'center',
          'text-allow-overlap': true
        },
        paint: {
          'text-color': 'rgba(56, 189, 248, 0.5)',
          'text-halo-color': 'rgba(2, 6, 23, 0.7)',
          'text-halo-width': 1.2
        }
      });

      // 5. Country Labels (Zoom 2.5 ~ 4.5)
      map.addSource('country-labels', {
        type: 'geojson',
        data: labelsToGeoJSON(countryLabels, currentEpochRef.current?.platesData)
      });

      map.addLayer({
        id: 'country-labels',
        type: 'symbol',
        source: 'country-labels',
        minzoom: 2.5,
        maxzoom: 4.5,
        filter: ['>=', ['get', 'area'], 8],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Bold'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            2.5, 11,
            4.0, 13.5
          ],
          'text-variable-anchor': ['center', 'top', 'bottom'],
          'text-justify': 'center',
          'text-padding': 4,
          'text-allow-overlap': false
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': 'rgba(255, 255, 255, 0.95)',
          'text-halo-width': 2.5
        }
      });

      // 6. Province Labels (Zoom 4.5 ~ 14)
      map.addSource('province-labels', {
        type: 'geojson',
        data: labelsToGeoJSON(provinceLabels, currentEpochRef.current?.platesData)
      });

      map.addLayer({
        id: 'province-labels',
        type: 'symbol',
        source: 'province-labels',
        minzoom: 4.5,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Bold'],
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            4.5, 10.5,
            7.0, 13.5,
            10.0, 16
          ],
          'text-variable-anchor': ['center', 'top', 'bottom'],
          'text-justify': 'center',
          'text-padding': 3,
          'text-allow-overlap': false
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': 'rgba(255, 255, 255, 0.95)',
          'text-halo-width': 2.5
        }
      });

      // -------------------------------------------------------------------------
      // Interactive Layer Hover & Click Handlers
      // -------------------------------------------------------------------------
      const interactiveLayers = ['continents-fill', 'countries-fill', 'provinces-fill'];

      interactiveLayers.forEach((layerId) => {
        map.on('mousemove', layerId, (e) => {
          if (isAddingLocationRef.current) return;
          if (!e.features || !e.features.length) return;

          const feat = e.features[0];
          const props = feat.properties || {};
          const id = props.id || props.name;
          const type =
            layerId === 'continents-fill'
              ? '大洲板块'
              : layerId === 'countries-fill'
              ? '国家板块'
              : '省州板块';

          const hoverLayer = layerId.replace('-fill', '-hover');
          if (map.getLayer(hoverLayer)) {
            map.setFilter(hoverLayer, ['==', ['get', 'id'], id]);
          }
          map.getCanvas().style.cursor = 'pointer';

          const epochColors = currentEpochRef.current?.regionColors || {};
          const epochPlates = currentEpochRef.current?.platesData || {};
          const plateData = epochPlates[id] || epochPlates[props.name] || {};
          const displayName = plateData.name || props.name;
          const displayColor = plateData.color || epochColors[id] || '';
          const description = plateData.description || '';
          const parentName = props.country || props.admin || props.continent || '';

          showHoverPlate(
            {
              id,
              name: displayName,
              originalName: props.name,
              nameEn: props.name_en || '',
              type,
              parentName,
              color: displayColor,
              description
            },
            e.originalEvent.clientX,
            e.originalEvent.clientY
          );
        });

        map.on('mouseleave', layerId, () => {
          const hoverLayer = layerId.replace('-fill', '-hover');
          if (map.getLayer(hoverLayer)) {
            map.setFilter(hoverLayer, ['==', ['get', 'id'], '']);
          }
          map.getCanvas().style.cursor = isAddingLocationRef.current ? 'crosshair' : '';
          hideHoverPlateRef.current?.();
        });

        map.on('click', layerId, (e) => {
          if (isAddingLocationRef.current) return;
          if (!e.features || !e.features.length) return;

          const feat = e.features[0];
          const props = feat.properties || {};
          const id = props.id || props.name;
          const type =
            layerId === 'continents-fill'
              ? '大洲板块'
              : layerId === 'countries-fill'
              ? '国家板块'
              : '省州板块';

          hideHoverPlateRef.current?.();

          const epochColors = currentEpochRef.current?.regionColors || {};
          const epochPlates = currentEpochRef.current?.platesData || {};
          const plateData = epochPlates[id] || epochPlates[props.name] || {};
          const displayName = plateData.name || props.name;
          const displayColor = plateData.color || epochColors[id] || '';
          const description = plateData.description || '';
          const parentName = props.country || props.admin || props.continent || '';

          setEditingPlateTarget({
            id,
            name: displayName,
            originalName: props.name,
            nameEn: props.name_en || '',
            type,
            parentName,
            color: displayColor,
            description
          });
        });
      });
    });

    // Map-level click (for pin creation or deselection)
    map.on('click', (e) => {
      hideHoverPlateRef.current?.();

      if (isAddingLocationRef.current) {
        let { lng, lat } = e.lngLat;
        const normalizedLng = (((lng + 180) % 360 + 360) % 360) - 180;
        setEditingLocation({
          name: '',
          lat: Number(lat.toFixed(4)),
          lng: Number(normalizedLng.toFixed(4)),
          type: 'city',
          country: '自由地区',
          region: '未分区',
          year: timelineSettings.currentTime || 2024,
          description: '',
          icon: 'Castle',
          color: '#38bdf8'
        });
        setIsAddingLocation(false);
      } else {
        setSelectedMapLocationId(null);
      }
    });

    // Zoom level update (throttled via RAF)
    map.on('zoom', () => {
      if (!zoomRafRef.current) {
        zoomRafRef.current = requestAnimationFrame(() => {
          setZoomLevel(map.getZoom());
          zoomRafRef.current = null;
        });
      }
    });

    mapInstanceRef.current = map;

    return () => {
      if (zoomRafRef.current) cancelAnimationFrame(zoomRafRef.current);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
      isMapLoadedRef.current = false;
    };
  }, []);

  // Update GeoJSON sources when in-memory preloading resolves
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoadedRef.current) return;

    if (continentsGeo && map.getSource('continents')) {
      map.getSource('continents').setData(continentsGeo);
    }
    if (countriesGeo && map.getSource('countries')) {
      map.getSource('countries').setData(countriesGeo);
    }
    if (provincesGeo && map.getSource('provinces')) {
      map.getSource('provinces').setData(provincesGeo);
    }
    if (continentsData && map.getSource('continent-watermarks')) {
      map.getSource('continent-watermarks').setData(continentsWatermarksToGeoJSON(continentsData));
    }
    if (continentsData && map.getSource('ocean-watermarks')) {
      map.getSource('ocean-watermarks').setData(oceanWatermarksToGeoJSON(continentsData));
    }
    if (countryLabels && map.getSource('country-labels')) {
      map.getSource('country-labels').setData(labelsToGeoJSON(countryLabels, currentEpoch?.platesData));
    }
    if (provinceLabels && map.getSource('province-labels')) {
      map.getSource('province-labels').setData(labelsToGeoJSON(provinceLabels, currentEpoch?.platesData));
    }
  }, [continentsGeo, countriesGeo, provincesGeo, continentsData, countryLabels, provinceLabels]);

  // Update plate colors & label text when epoch changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoadedRef.current) return;

    const colorExpr = getPlateColorExpression(currentEpoch?.platesData, '#38bdf8');
    if (map.getLayer('continents-fill')) map.setPaintProperty('continents-fill', 'fill-color', colorExpr);
    if (map.getLayer('countries-fill')) map.setPaintProperty('countries-fill', 'fill-color', colorExpr);
    if (map.getLayer('provinces-fill')) map.setPaintProperty('provinces-fill', 'fill-color', colorExpr);

    if (map.getSource('country-labels') && countryLabels) {
      map.getSource('country-labels').setData(labelsToGeoJSON(countryLabels, currentEpoch?.platesData));
    }
    if (map.getSource('province-labels') && provinceLabels) {
      map.getSource('province-labels').setData(labelsToGeoJSON(provinceLabels, currentEpoch?.platesData));
    }
  }, [currentEpoch, countryLabels, provinceLabels]);

  // Sync interactive location markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filteredLocations.forEach((loc) => {
      const isSelected = selectedMapLocationId === loc.id;
      const pinColor = loc.color || '#38bdf8';
      const eventCount = filteredEvents.filter((t) => t.locationId === loc.id).length;

      const el = document.createElement('div');
      el.className = 'relative group cursor-pointer -translate-x-1/2 -translate-y-1/2';
      el.innerHTML = `
        <div class="absolute -inset-2 rounded-full opacity-40 ${
          isSelected ? 'animate-ping' : 'group-hover:animate-ping'
        }" style="background-color: ${pinColor};"></div>

        <div class="relative w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all shadow-xl ${
          isSelected ? 'border-white scale-110' : 'border-slate-800'
        }" style="background-color: ${isSelected ? pinColor : '#0f172a'}; color: ${
        isSelected ? '#ffffff' : pinColor
      }; box-shadow: 0 0 15px ${pinColor}88;">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          ${
            eventCount > 0
              ? `<span class="absolute -top-1.5 -right-1.5 px-1 min-w-4 h-4 text-[9px] font-bold rounded-full bg-amber-500 text-slate-950 flex items-center justify-center border border-slate-900">${eventCount}</span>`
              : ''
          }
        </div>

        <div class="mt-1 px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap border backdrop-blur flex items-center gap-1 shadow-lg ${
          isSelected
            ? 'bg-slate-900/95 border-white text-white'
            : 'bg-slate-900/80 border-slate-700/80 text-slate-200'
        }">
          <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${pinColor};"></span>
          <span>${loc.name}</span>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedMapLocationId(isSelected ? null : loc.id);
        setEditingPlateTarget(null);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([loc.lng, loc.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [filteredLocations, selectedMapLocationId, filteredEvents]);

  const flyToLocation = useCallback((lat, lng, zoom = 6) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo({
      center: [lng, lat],
      zoom,
      speed: 1.2
    });
  }, []);

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    if (!editingLocation.name.trim()) {
      alert('请输入地点名称');
      return;
    }
    if (editingLocation.id) {
      await updateMapLocation(editingLocation.id, editingLocation);
    } else {
      await addMapLocation(editingLocation);
    }
    setEditingLocation(null);
  };

  const handleSaveTimelineEvent = async (e) => {
    e.preventDefault();
    if (!editingEvent.title.trim()) {
      alert('请输入事件标题');
      return;
    }
    if (editingEvent.id) {
      await updateTimelineEvent(editingEvent.id, editingEvent);
    } else {
      await addTimelineEvent(editingEvent);
    }
    setEditingEvent(null);
  };

  const handleSavePlate = async ({ plateId, name, color, description, applyAllEpochs }) => {
    if (!editingPlateTarget) return;
    await setPlateInfo(currentEpochId, plateId, {
      name,
      color,
      description,
      applyAllEpochs
    });
    setEditingPlateTarget(null);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden relative font-sans">
      {/* Top Header & Map Controls */}
      <header className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/90 shrink-0 z-20 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>现实世界基底 · 时空变迁地图</span>
              <span className="text-[11px] font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                {currentEpoch?.name || '当前历史纪元'}
              </span>
            </h2>
          </div>
        </div>

        {/* Center: 3-Level Hierarchical LOD Quick Jump */}
        <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
          <span className="text-[10px] font-mono text-slate-400 px-1.5">缩放层级:</span>
          <button
            onClick={() => mapInstanceRef.current?.easeTo({ zoom: 1.8, duration: 600 })}
            className={`px-2.5 py-1 rounded-lg transition-all font-medium flex items-center gap-1 ${
              currentLOD === 1
                ? 'bg-sky-600 text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
            title="滚轮缩放 [1.0, 2.5)：1级 大洲板块宏观水韵与世界全貌"
          >
            <span>1级 大洲板块 [1.0~2.5)</span>
          </button>
          <button
            onClick={() => mapInstanceRef.current?.easeTo({ zoom: 3.2, duration: 600 })}
            className={`px-2.5 py-1 rounded-lg transition-all font-medium flex items-center gap-1 ${
              currentLOD === 2
                ? 'bg-sky-600 text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
            title="滚轮缩放 [2.5, 4.5)：2级 国家板块主权与地缘版图"
          >
            <span>2级 国家板块 [2.5~4.5)</span>
          </button>
          <button
            onClick={() => mapInstanceRef.current?.easeTo({ zoom: 5.5, duration: 600 })}
            className={`px-2.5 py-1 rounded-lg transition-all font-medium flex items-center gap-1 ${
              currentLOD === 3
                ? 'bg-sky-600 text-white shadow-sm font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
            title="滚轮缩放 [4.5, +∞)：3级 省州板块区划（细化至省/州/大区）"
          >
            <span>3级 省州板块 [4.5+)</span>
          </button>
          <span className="font-mono text-[10px] text-sky-400 pl-1">
            {zoomLevel.toFixed(1)}x
          </span>
        </div>

        {/* Right Tools: Add Pin, Add Event, Toggle Timeline, Return */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsAddingLocation(!isAddingLocation);
              setSelectedMapLocationId(null);
            }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md transition-all ${
              isAddingLocation
                ? 'bg-amber-600 hover:bg-amber-500 text-white ring-2 ring-amber-400 shadow-amber-600/30'
                : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20'
            }`}
            title="点击地图任意位置即可在真实经纬度精准插旗标注"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{isAddingLocation ? '点击地图任意处插旗...' : '新增标注点'}</span>
          </button>

          <button
            onClick={() => setIsTimelineOpen(!isTimelineOpen)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              isTimelineOpen
                ? 'bg-slate-800 border-slate-700 text-sky-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="展开或折叠双边界时间轴"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>时间轴</span>
            {isTimelineOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            onClick={() => setActiveWorkspace('nodes')}
            className="flex items-center gap-1 text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 transition-colors"
          >
            <span>返回画布</span>
          </button>
        </div>
      </header>

      {/* Floating Map Historical Epoch Switcher */}
      <div className="absolute top-16 left-6 z-20 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-xl">
        <span className="text-[10px] font-bold text-slate-400 px-2 flex items-center gap-1 uppercase tracking-wider">
          <History className="w-3.5 h-3.5 text-amber-400" />
          地图时空变迁:
        </span>
        {epochs.map((ep) => {
          const isCurrent = ep.id === currentEpochId;
          return (
            <button
              key={ep.id}
              onClick={() => {
                setCurrentEpochId(ep.id);
                if (ep.timeRange && ep.timeRange[0] !== undefined) {
                  setCurrentTime(ep.timeRange[0]);
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all font-medium flex items-center gap-1.5 ${
                isCurrent
                  ? 'bg-amber-600 text-white font-bold shadow-md shadow-amber-600/30'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title={ep.description}
            >
              <span>{ep.name}</span>
              <span className="text-[9px] opacity-70 font-mono">
                ({ep.timeRange?.[0]} ~ {ep.timeRange?.[1]})
              </span>
            </button>
          );
        })}
      </div>

      {/* Adding Mode Notification */}
      {isAddingLocation && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-amber-500 text-slate-950 font-bold px-4 py-1.5 rounded-full text-xs shadow-xl shadow-amber-500/30 flex items-center gap-2 animate-bounce">
          <MapPin className="w-4 h-4" />
          <span>请在世界地图任意位置单击，设置经纬度标注点</span>
          <button
            onClick={() => setIsAddingLocation(false)}
            className="ml-2 hover:bg-amber-600/50 rounded-full p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Map Body: MapLibre GL Canvas + Inspector Drawer */}
      <div className="flex-1 flex overflow-hidden relative">
        <div
          ref={mapContainerRef}
          className={`flex-1 w-full h-full ${
            isAddingLocation ? 'cursor-crosshair' : ''
          }`}
          style={{
            zIndex: 1,
            background: 'radial-gradient(ellipse at 50% 50%, #0c1c3d 0%, #07122b 60%, #020616 100%)'
          }}
        />

        {/* Selected Location Inspector Drawer */}
        {selectedLocation && (
          <aside className="w-80 border-l border-slate-800 bg-slate-900/95 backdrop-blur-md flex flex-col shrink-0 z-30 shadow-2xl animate-fadeIn">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow"
                  style={{
                    backgroundColor: `${selectedLocation.color || '#38bdf8'}22`,
                    color: selectedLocation.color || '#38bdf8'
                  }}
                >
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <h3 className="text-xs font-bold text-white truncate">
                    {selectedLocation.name}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {selectedLocation.country || ''} · {selectedLocation.region || '未分区'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditingLocation(selectedLocation)}
                  className="p-1 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition-colors"
                  title="编辑标注点"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (confirm(`确定要删除标注点“${selectedLocation.name}”吗？`)) {
                      await deleteMapLocation(selectedLocation.id);
                    }
                  }}
                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                  title="删除标注点"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setSelectedMapLocationId(null)}
                  className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between font-mono text-[11px] text-slate-400">
                <span className="flex items-center gap-1 text-sky-400">
                  <Compass className="w-3.5 h-3.5" />
                  真实经纬度:
                </span>
                <span className="text-slate-200">
                  {selectedLocation.lat?.toFixed(2)}°N, {selectedLocation.lng?.toFixed(2)}°E
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">标定时期 / 年份:</span>
                <span className="font-mono text-amber-300 font-bold">
                  {selectedLocation.year} 年
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400">设定与背景简介</label>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
                  {selectedLocation.description || '暂无详细设定描述。点击上方编辑按钮补充。'}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    发生在此处的纪事 ({locationTimelineEvents.length})
                  </span>
                  <button
                    onClick={() =>
                      setEditingEvent({
                        year: selectedLocation.year || 2024,
                        timeLabel: `${selectedLocation.year || 2024}年`,
                        title: '',
                        epochId: currentEpochId,
                        description: '',
                        locationId: selectedLocation.id,
                        tag: '现场事件'
                      })
                    }
                    className="text-[10px] text-sky-400 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> 记录事件
                  </button>
                </div>

                {locationTimelineEvents.length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-3 text-center bg-slate-950/40 rounded-xl border border-slate-800/60">
                    当前时间窗口内该地点无关联事件
                  </p>
                ) : (
                  <div className="space-y-2">
                    {locationTimelineEvents.map((evt) => (
                      <div
                        key={evt.id}
                        onClick={() => setSelectedTimelineEventId(evt.id)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                          selectedTimelineEventId === evt.id
                            ? 'bg-sky-950/50 border-sky-500 text-white shadow'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-amber-300">
                            {evt.timeLabel || `${evt.year}年`}
                          </span>
                          <span className="text-[10px] text-slate-400">{evt.tag}</span>
                        </div>
                        <h4 className="font-semibold text-xs text-slate-100">{evt.title}</h4>
                        {evt.description && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                            {evt.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      <PlateHoverCard plate={hoveredPlate} cardRef={plateHoverCardRef} />

      {editingPlateTarget && (
        <PlateEditorModal
          target={editingPlateTarget}
          currentEpoch={currentEpoch}
          onClose={() => setEditingPlateTarget(null)}
          onSave={handleSavePlate}
        />
      )}

      {/* Dual-Boundary Range Interactive Timeline Bar */}
      {isTimelineOpen && (
        <div className="h-44 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md flex flex-col shrink-0 z-20 shadow-2xl animate-fadeIn">
          <div className="h-9 border-b border-slate-800/80 px-4 flex items-center justify-between text-xs text-slate-400 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>双边界时间轴</span>
              </div>

              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                  左边界: {timelineSettings.leftBound} 年
                </span>
                <span className="text-slate-500">→</span>
                <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  右边界: {timelineSettings.rightBound} 年
                </span>
                <span className="text-slate-400 text-[10px]">
                  (仅展示边界内的 {filteredEvents.length} 个事件 · {filteredLocations.length} 个据点)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setEditingEvent({
                    year: timelineSettings.currentTime || 2024,
                    timeLabel: `${timelineSettings.currentTime || 2024}年`,
                    title: '',
                    epochId: currentEpochId,
                    description: '',
                    locationId: selectedMapLocationId || '',
                    tag: '新主线'
                  })
                }
                className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium hover:underline"
              >
                <Plus className="w-3 h-3" /> 添加时间点事件
              </button>
            </div>
          </div>

          <div className="px-6 py-2 border-b border-slate-800/60 bg-slate-950/60 flex items-center gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>起始 -1000年</span>
                <span className="text-amber-300 font-bold">
                  指针时刻: {timelineSettings.currentTime} 年
                </span>
                <span>未来 +2100年</span>
              </div>

              <div className="relative w-full h-6 flex items-center">
                <div className="absolute w-full h-1.5 bg-slate-800 rounded-full" />
                <div
                  className="absolute h-1.5 bg-gradient-to-r from-sky-500 to-amber-500 rounded-full"
                  style={{
                    left: `${((timelineSettings.leftBound + 1000) / 3100) * 100}%`,
                    width: `${
                      ((timelineSettings.rightBound - timelineSettings.leftBound) / 3100) * 100
                    }%`
                  }}
                />

                <input
                  type="range"
                  min="-1000"
                  max="2100"
                  step="10"
                  value={timelineSettings.leftBound}
                  onChange={(e) => {
                    const newLeft = Number(e.target.value);
                    if (newLeft < timelineSettings.rightBound) {
                      setTimelineBounds(newLeft, timelineSettings.rightBound);
                    }
                  }}
                  className="absolute w-full appearance-none bg-transparent pointer-events-auto cursor-pointer accent-sky-400"
                  title="调节左边界"
                />

                <input
                  type="range"
                  min="-1000"
                  max="2100"
                  step="10"
                  value={timelineSettings.rightBound}
                  onChange={(e) => {
                    const newRight = Number(e.target.value);
                    if (newRight > timelineSettings.leftBound) {
                      setTimelineBounds(timelineSettings.leftBound, newRight);
                    }
                  }}
                  className="absolute w-full appearance-none bg-transparent pointer-events-auto cursor-pointer accent-amber-400"
                  title="调节右边界"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-2 flex items-center gap-3 scrollbar-thin">
            {filteredEvents.length === 0 ? (
              <div className="w-full text-center text-xs text-slate-400 py-3">
                当前左右边界区间 ({timelineSettings.leftBound} ~ {timelineSettings.rightBound}) 内暂无事件，可拖动上方滑块放大范围或点击“添加时间点事件”。
              </div>
            ) : (
              filteredEvents.map((evt) => {
                const isSelected = selectedTimelineEventId === evt.id;
                const linkedLoc = locations.find((l) => l.id === evt.locationId);

                return (
                  <div
                    key={evt.id}
                    onClick={() => {
                      setSelectedTimelineEventId(isSelected ? null : evt.id);
                      if (linkedLoc && typeof linkedLoc.lat === 'number') {
                        setSelectedMapLocationId(linkedLoc.id);
                        flyToLocation(linkedLoc.lat, linkedLoc.lng, 5.5);
                      }
                    }}
                    className={`min-w-[240px] max-w-[280px] h-[72px] rounded-xl border p-2 flex flex-col justify-between cursor-pointer transition-all shrink-0 relative group ${
                      isSelected
                        ? 'bg-slate-800 border-sky-400 shadow-lg shadow-sky-500/20'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                        {evt.timeLabel || `${evt.year}年`}
                      </span>
                      {evt.tag && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                          {evt.tag}
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-slate-100 truncate mt-0.5">
                      {evt.title}
                    </h4>

                    <div className="flex items-center justify-between text-[10px]">
                      {linkedLoc ? (
                        <div
                          className="flex items-center gap-1 text-emerald-400 hover:underline truncate"
                          title={`位于: ${linkedLoc.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMapLocationId(linkedLoc.id);
                            flyToLocation(linkedLoc.lat, linkedLoc.lng, 5.5);
                          }}
                        >
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{linkedLoc.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">无关联地点</span>
                      )}

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEvent(evt);
                          }}
                          className="p-1 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`确定要删除事件“${evt.title}”吗？`)) {
                              await deleteTimelineEvent(evt.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Edit / Create Location Modal */}
      {editingLocation && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveLocation}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-sky-400" />
                <span>{editingLocation.id ? '编辑地标标注点' : '新建经纬度标注点'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingLocation(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">地点名称 *</label>
                <input
                  type="text"
                  value={editingLocation.name}
                  onChange={(e) =>
                    setEditingLocation({ ...editingLocation, name: e.target.value })
                  }
                  placeholder="例如：极东新京都市、圣辉王都..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">所属国家 / 领地</label>
                  <input
                    type="text"
                    value={editingLocation.country || ''}
                    onChange={(e) =>
                      setEditingLocation({ ...editingLocation, country: e.target.value })
                    }
                    placeholder="例如：中国、英国、日本..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">所属省州 / 大区</label>
                  <input
                    type="text"
                    value={editingLocation.region || ''}
                    onChange={(e) =>
                      setEditingLocation({ ...editingLocation, region: e.target.value })
                    }
                    placeholder="例如：东亚都市圈、加利福尼亚..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">真实经纬度</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.001"
                      value={editingLocation.lat}
                      onChange={(e) =>
                        setEditingLocation({ ...editingLocation, lat: Number(e.target.value) })
                      }
                      className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-center font-mono"
                      title="纬度 Lat"
                    />
                    <input
                      type="number"
                      step="0.001"
                      value={editingLocation.lng}
                      onChange={(e) =>
                        setEditingLocation({ ...editingLocation, lng: Number(e.target.value) })
                      }
                      className="w-1/2 bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-center font-mono"
                      title="经度 Lng"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">初现年份 / 纪元</label>
                  <input
                    type="number"
                    value={editingLocation.year ?? 2024}
                    onChange={(e) =>
                      setEditingLocation({ ...editingLocation, year: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">光效与主题颜色</label>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map((color) => {
                    const isSelected = editingLocation.color === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditingLocation({ ...editingLocation, color })}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          isSelected ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">设定与背景简介</label>
                <textarea
                  rows={3}
                  value={editingLocation.description}
                  onChange={(e) =>
                    setEditingLocation({ ...editingLocation, description: e.target.value })
                  }
                  placeholder="描写该地貌的生态、势力归属、历史渊源..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingLocation(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
              >
                保存标注点
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit / Create Timeline Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTimelineEvent}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>{editingEvent.id ? '编辑时间点事件' : '记录新时间点事件'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">所属历史纪元</label>
                  <select
                    value={editingEvent.epochId || currentEpochId}
                    onChange={(e) =>
                      setEditingEvent({ ...editingEvent, epochId: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {epochs.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">事件年份 (用于排序) *</label>
                  <input
                    type="number"
                    value={editingEvent.year ?? 2024}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        year: Number(e.target.value),
                        timeLabel: `${e.target.value}年`
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">事件名称 / 标题 *</label>
                <input
                  type="text"
                  value={editingEvent.title}
                  onChange={(e) =>
                    setEditingEvent({ ...editingEvent, title: e.target.value })
                  }
                  placeholder="例如：天裂灾变、圣辉王都流血政变..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">关联地理地标</label>
                  <select
                    value={editingEvent.locationId || ''}
                    onChange={(e) =>
                      setEditingEvent({ ...editingEvent, locationId: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- 无特定地标 --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.country || loc.region})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">事件分类 Tag</label>
                  <input
                    type="text"
                    value={editingEvent.tag || ''}
                    onChange={(e) =>
                      setEditingEvent({ ...editingEvent, tag: e.target.value })
                    }
                    placeholder="例如：主线起点、远古史诗..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">事件经过与影响简述</label>
                <textarea
                  rows={3}
                  value={editingEvent.description || ''}
                  onChange={(e) =>
                    setEditingEvent({ ...editingEvent, description: e.target.value })
                  }
                  placeholder="描述该历史或情节事件的前因后果、参与人物与世界变迁..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
              >
                保存事件
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
