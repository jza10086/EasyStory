import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

const MAP_ICONS = {
  Castle,
  Anchor,
  Shield,
  Skull,
  Sparkles,
  Mountain,
  Flame,
  Compass,
  MapPin,
  Flag
};

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

// Longitude wrap offsets for infinite 360-degree horizontal seamless loop (-720° to +720°)
const WRAP_OFFSETS = [-720, -360, 0, 360, 720];

// Shift GeoJSON coordinates by a given longitude offset
function shiftGeoJSONCoordinates(geometry, offset) {
  if (!geometry || !geometry.coordinates) return geometry;

  const shiftRing = (ring) => ring.map(([lng, lat]) => [lng + offset, lat]);
  const shiftPolygon = (poly) => poly.map(shiftRing);
  const shiftMultiPolygon = (multi) => multi.map(shiftPolygon);

  let newCoordinates;
  if (geometry.type === 'Point') {
    newCoordinates = [geometry.coordinates[0] + offset, geometry.coordinates[1]];
  } else if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
    newCoordinates = geometry.coordinates.map(([lng, lat]) => [lng + offset, lat]);
  } else if (geometry.type === 'Polygon' || geometry.type === 'MultiLineString') {
    newCoordinates = shiftPolygon(geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    newCoordinates = shiftMultiPolygon(geometry.coordinates);
  } else {
    newCoordinates = geometry.coordinates;
  }

  return {
    ...geometry,
    coordinates: newCoordinates
  };
}

// Generate horizontally wrapped GeoJSON with world copies for 100% seamless antimeridian spanning
function createWrappedGeoJSON(geoJson, offsets = WRAP_OFFSETS) {
  if (!geoJson || !geoJson.features) return geoJson;

  const wrappedFeatures = [];
  offsets.forEach((offset) => {
    geoJson.features.forEach((feature) => {
      if (offset === 0) {
        wrappedFeatures.push(feature);
      } else {
        wrappedFeatures.push({
          ...feature,
          properties: {
            ...feature.properties,
            _wrapOffset: offset
          },
          geometry: shiftGeoJSONCoordinates(feature.geometry, offset)
        });
      }
    });
  });

  return {
    ...geoJson,
    features: wrappedFeatures
  };
}

// ---------------------------------------------------------------------------
// High-Performance GPU Canvas Labels Layer (0 DOM elements, 60fps hardware accelerated)
// ---------------------------------------------------------------------------
const CanvasLabelsLayer = L.Layer.extend({
  initialize: function (options) {
    L.setOptions(this, options);
    this._countryLabels = options?.countryLabels || [];
    this._provinceLabels = options?.provinceLabels || [];
    this._platesData = options?.platesData || {};
  },

  onAdd: function (map) {
    this._map = map;
    this._canvas = L.DomUtil.create('canvas', 'leaflet-canvas-labels-layer');
    this._canvas.style.pointerEvents = 'none';
    this._canvas.style.position = 'absolute';
    this._canvas.style.left = '0';
    this._canvas.style.top = '0';
    this._canvas.style.zIndex = '450';
    this._canvas.style.willChange = 'transform';
    this._canvas.style.transform = 'translate3d(0, 0, 0)';
    this._canvas.style.backfaceVisibility = 'hidden';

    map.getPanes().overlayPane.appendChild(this._canvas);

    this._onRender = () => this._update();
    map.on('move zoom resize viewreset', this._onRender);
    this._update();
  },

  onRemove: function (map) {
    if (this._canvas) {
      L.DomUtil.remove(this._canvas);
      this._canvas = null;
    }
    map.off('move zoom resize viewreset', this._onRender);
  },

  updateData: function (data) {
    if (data.countryLabels) this._countryLabels = data.countryLabels;
    if (data.provinceLabels) this._provinceLabels = data.provinceLabels;
    if (data.platesData !== undefined) this._platesData = data.platesData;
    this._update();
  },

  _update: function () {
    if (!this._map || !this._canvas) return;

    const map = this._map;
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return;

    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(size.x * dpr);
    const targetH = Math.round(size.y * dpr);

    if (this._canvas.width !== targetW || this._canvas.height !== targetH) {
      this._canvas.width = targetW;
      this._canvas.height = targetH;
      this._canvas.style.width = `${size.x}px`;
      this._canvas.style.height = `${size.y}px`;
    }

    const ctx = this._canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.x, size.y);

    const zoom = map.getZoom();
    const lod = zoom < 2.5 ? 1 : (zoom < 4.5 ? 2 : 3);
    const bounds = map.getBounds();
    const padBounds = bounds.pad(0.2); // 20% margin to prevent edge pop-in
    const south = padBounds.getSouth();
    const north = padBounds.getNorth();
    const west = padBounds.getWest();
    const east = padBounds.getEast();

    const offsets = [-720, -360, 0, 360, 720];

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    if (lod === 2 && this._countryLabels && this._countryLabels.length > 0) {
      // Level 2: Country Labels (国家板块)
      const minArea = zoom >= 3.5 ? 10 : 22;

      for (let i = 0; i < this._countryLabels.length; i++) {
        const c = this._countryLabels[i];
        if ((c.area || 0) < minArea) continue;
        if (c.lat < south || c.lat > north) continue;

        const hasSub = Boolean(c.name_en && c.name_en !== c.name);
        const plateInfo = this._platesData[c.id] || this._platesData[c.name];
        const displayName = plateInfo?.name || c.name;

        for (let j = 0; j < offsets.length; j++) {
          const lng = c.lng + offsets[j];
          if (lng < west || lng > east) continue;

          const pt = map.latLngToContainerPoint([c.lat, lng]);
          if (pt.x < -60 || pt.x > size.x + 60 || pt.y < -30 || pt.y > size.y + 30) continue;

          const textY = hasSub ? pt.y - 4 : pt.y;

          // Country Name (Chinese / Custom Plate Name)
          ctx.font = 'bold 12px "Microsoft YaHei", -apple-system, sans-serif';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.lineWidth = 3;
          ctx.strokeText(displayName, pt.x, textY);
          ctx.fillStyle = '#0f172a';
          ctx.fillText(displayName, pt.x, textY);

          // Country Name (English Subtext)
          if (hasSub) {
            ctx.font = '600 8.5px monospace, sans-serif';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 2;
            ctx.strokeText(c.name_en, pt.x, pt.y + 8);
            ctx.fillStyle = '#1e293b';
            ctx.fillText(c.name_en, pt.x, pt.y + 8);
          }
        }
      }
    } else if (lod === 3 && this._provinceLabels && this._provinceLabels.length > 0) {
      // Level 3: Province & State Labels (省州板块)
      const minArea = zoom >= 6.5 ? 0.2 : (zoom >= 5.5 ? 1.2 : 3.5);

      for (let i = 0; i < this._provinceLabels.length; i++) {
        const p = this._provinceLabels[i];
        if ((p.area || 0) < minArea) continue;
        if (p.lat < south || p.lat > north) continue;

        const hasSub = Boolean(p.name_en && p.name_en !== p.name);
        const plateInfo = this._platesData[p.id] || this._platesData[p.name];
        const displayName = plateInfo?.name || p.name;

        for (let j = 0; j < offsets.length; j++) {
          const lng = p.lng + offsets[j];
          if (lng < west || lng > east) continue;

          const pt = map.latLngToContainerPoint([p.lat, lng]);
          if (pt.x < -60 || pt.x > size.x + 60 || pt.y < -30 || pt.y > size.y + 30) continue;

          const textY = hasSub ? pt.y - 3 : pt.y;

          // Province Name (Chinese/Local / Custom Plate Name)
          ctx.font = 'bold 11px "Microsoft YaHei", -apple-system, sans-serif';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.lineWidth = 2.5;
          ctx.strokeText(displayName, pt.x, textY);
          ctx.fillStyle = '#0f172a';
          ctx.fillText(displayName, pt.x, textY);

          // Province Name (English Subtext)
          if (hasSub) {
            ctx.font = '600 7.5px monospace, sans-serif';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 2;
            ctx.strokeText(p.name_en, pt.x, pt.y + 7);
            ctx.fillStyle = '#334155';
            ctx.fillText(p.name_en, pt.x, pt.y + 7);
          }
        }
      }
    }

    ctx.restore();
  }
});

// ---------------------------------------------------------------------------
// Singleton Plate Hover Card Component (全局单例悬停卡片，物理级杜绝多卡片残留)
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
      {/* Top Badges & Parent */}
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

      {/* Title & Subtitle */}
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

      {/* Lore / Description */}
      <div className="text-[11px] leading-relaxed mb-2.5">
        {description ? (
          <div className="p-2.5 rounded-lg border border-slate-800 text-slate-300 bg-[#020617] whitespace-pre-wrap max-h-32 overflow-hidden text-ellipsis leading-relaxed">
            {description}
          </div>
        ) : (
          <div className="text-slate-500 italic text-[10px] py-1">暂无板块简介设定，点击板块可编辑</div>
        )}
      </div>

      {/* Footer Action Prompt */}
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
// Plate Editor Modal Component (板块编辑面板：名称、颜色、简介、全纪元同步)
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
        {/* Header */}
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

        {/* Current Epoch Notice */}
        <div className="flex items-center justify-between bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            当前历史纪元:
          </span>
          <span className="font-semibold text-amber-300">{currentEpoch?.name || '默认纪元'}</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Plate Name Input */}
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

          {/* Color Palette & Custom Picker */}
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

              {/* Custom Color Native Input */}
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

          {/* Lore / Description */}
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

          {/* Sync All Epochs Option */}
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

          {/* Action Buttons */}
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

  // Active epoch object
  const currentEpoch = useMemo(() => {
    return epochs.find((ep) => ep.id === currentEpochId) || epochs[0] || null;
  }, [epochs, currentEpochId]);

  // UI state
  const [zoomLevel, setZoomLevel] = useState(2.2);
  const [isTimelineOpen, setIsTimelineOpen] = useState(true);
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');

  // Selected plate for full plate editing (名称、颜色、简介)
  const [editingPlateTarget, setEditingPlateTarget] = useState(null); // { id, name, originalName, nameEn, type, parentName, color, description }

  // Singleton hovered plate state & card DOM ref (全局单例，物理级杜绝多卡片残留)
  const [hoveredPlate, setHoveredPlate] = useState(null);
  const plateHoverCardRef = useRef(null);

  // High-performance direct position updater (0 React re-renders on mousemove)
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
      if (isAddingLocation) return;
      setHoveredPlate({
        ...data,
        visible: true,
        x: clientX,
        y: clientY
      });
    },
    [isAddingLocation]
  );

  const hideHoverPlate = useCallback(() => {
    setHoveredPlate((prev) => (prev?.visible ? { ...prev, visible: false } : prev));
  }, []);

  const hideHoverPlateRef = useRef(hideHoverPlate);
  hideHoverPlateRef.current = hideHoverPlate;

  // Leaflet map refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const continentsVectorLayerRef = useRef(null);
  const continentsWatermarksLayerRef = useRef(null);
  const countriesLayerRef = useRef(null);
  const provincesLayerRef = useRef(null);
  const markersLayerRef = useRef(null);

  // Dual GPU Canvas Renderers:
  // 1. Overview renderer for Level 1 Continents & Level 2 Countries: padding 2.5 keeps panning 100% seamless
  const overviewRendererRef = useRef(null);
  if (!overviewRendererRef.current) {
    overviewRendererRef.current = L.canvas({
      padding: 2.5, // 250% extra buffer = never hits blank edge during panning across oceans
      tolerance: 5
    });
  }

  // 2. High-performance Provinces renderer for Level 3:
  // padding 1.0 provides a full screen width buffer in every direction
  const provincesRendererRef = useRef(null);
  if (!provincesRendererRef.current) {
    provincesRendererRef.current = L.canvas({
      padding: 1.0,
      tolerance: 4
    });
  }

  // GPU Canvas Labels Layer Ref
  const canvasLabelsLayerRef = useRef(null);

  // GeoJSON data initialized immediately from global in-memory preloader (0ms instant startup)
  const [continentsGeo, setContinentsGeo] = useState(() => getPreloadedContinentsGeo());
  const [countriesGeo, setCountriesGeo] = useState(() => getPreloadedCountries());
  const [provincesGeo, setProvincesGeo] = useState(() => getPreloadedProvinces());
  const [countryLabels, setCountryLabels] = useState(() => getPreloadedCountryLabels());
  const [provinceLabels, setProvinceLabels] = useState(() => getPreloadedProvinceLabels());
  const [continentsData, setContinentsData] = useState(() => getPreloadedContinents());

  // Guarantee that if data is still in-flight on cold start, set it as soon as preloader resolves
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

  // Handle workspace switching without remounting (instant size invalidation)
  useEffect(() => {
    if (isActive && mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 50);
    }
  }, [isActive]);

  // Filter events strictly by [leftBound, rightBound]
  const filteredEvents = useMemo(() => {
    const left = timelineSettings.leftBound ?? -1000;
    const right = timelineSettings.rightBound ?? 2100;
    return timeline.filter((evt) => {
      const yr = evt.year ?? 0;
      return yr >= left && yr <= right;
    });
  }, [timeline, timelineSettings.leftBound, timelineSettings.rightBound]);

  // Filter locations strictly by [leftBound, rightBound] and search keyword
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

  // Selected location object
  const selectedLocation = useMemo(() => {
    return locations.find((l) => l.id === selectedMapLocationId) || null;
  }, [locations, selectedMapLocationId]);

  // Location's timeline events
  const locationTimelineEvents = useMemo(() => {
    if (!selectedMapLocationId) return [];
    return filteredEvents.filter((t) => t.locationId === selectedMapLocationId);
  }, [filteredEvents, selectedMapLocationId]);

  // Initialize Leaflet Map with Canvas Vector Engine and Smooth Wheel Zoom
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [25, 10],
      zoom: 2.0,
      minZoom: 1.0,
      maxZoom: 14,
      zoomSnap: 0, // Continuous smooth zoom without notch locking
      attributionControl: false,
      worldCopyJump: false, // Explicitly false! Wrapped GeoJSON handles -720° to +720° seamlessly without violent jumping
      preferCanvas: true,
      renderer: overviewRendererRef.current
    });

    // Mount GPU Canvas Labels Layer (0 DOM elements, 60fps hardware accelerated)
    const labelsLayer = new CanvasLabelsLayer({
      countryLabels,
      provinceLabels,
      platesData: currentEpoch?.platesData || {}
    });
    labelsLayer.addTo(map);
    canvasLabelsLayerRef.current = labelsLayer;

    // Disable Leaflet's stepped debounce timer and CSS transform scaling animation
    map.scrollWheelZoom.disable();

    // High-Performance Smooth Wheel Zoom Engine (Hardware CSS Scale + Drag Coordination)
    let isWheeling = false;
    let goalZoom = map.getZoom();
    let prevCenter = map.getCenter();
    let prevZoom = map.getZoom();
    let wheelMousePosition = null;
    let wheelMouseLatLng = null;
    let centerPoint = null;
    let zoomAnimationId = null;
    let wheelEndTimer = null;
    let isMoved = false;

    let lastReportedZoom = map.getZoom();
    let zoomRaf = null;

    const onWheelStart = (e) => {
      isWheeling = true;
      wheelMousePosition = map.mouseEventToContainerPoint(e);
      centerPoint = map.getSize().divideBy(2);
      wheelMouseLatLng = map.containerPointToLatLng(wheelMousePosition);
      isMoved = false;

      map._stop();
      if (map._panAnim) map._panAnim.stop();

      goalZoom = map.getZoom();
      prevCenter = map.getCenter();
      prevZoom = map.getZoom();

      if (zoomAnimationId) cancelAnimationFrame(zoomAnimationId);
      zoomAnimationId = requestAnimationFrame(updateWheelZoom);
    };

    const onWheeling = (e) => {
      // Single notch deltaY is typically ±100px -> changes zoom by ~0.1
      const delta = -e.deltaY * 0.001;
      const clampedDelta = Math.max(-0.5, Math.min(0.5, delta));

      goalZoom = Math.min(14, Math.max(1.0, goalZoom + clampedDelta));

      wheelMousePosition = map.mouseEventToContainerPoint(e);
      wheelMouseLatLng = map.containerPointToLatLng(wheelMousePosition);

      clearTimeout(wheelEndTimer);
      wheelEndTimer = setTimeout(onWheelEnd, 140);
    };

    const onWheelEnd = () => {
      isWheeling = false;
      if (zoomAnimationId) {
        cancelAnimationFrame(zoomAnimationId);
        zoomAnimationId = null;
      }
      if (isMoved) {
        map._moveEnd(true);
        isMoved = false;
      }
    };

    const updateWheelZoom = () => {
      if (!isWheeling) return;

      // Yield immediately if user dragged the map!
      if (!map.getCenter().equals(prevCenter) || map.getZoom() !== prevZoom) {
        isWheeling = false;
        zoomAnimationId = null;
        if (isMoved) {
          map._moveEnd(true);
          isMoved = false;
        }
        return;
      }

      const currentZ = map.getZoom();
      const diff = goalZoom - currentZ;

      if (Math.abs(diff) < 0.0005) {
        if (isMoved) {
          map._moveEnd(true);
          isMoved = false;
        }
        isWheeling = false;
        zoomAnimationId = null;
        return;
      }

      // Buttery smooth Lerp step (0.24 damping factor)
      const nextZ = currentZ + diff * 0.24;

      const delta = wheelMousePosition.subtract(centerPoint);
      const newCenter = map.unproject(map.project(wheelMouseLatLng, nextZ).subtract(delta), nextZ);

      if (!isMoved) {
        map._moveStart(true, false);
        isMoved = true;
      }

      map._move(newCenter, nextZ);
      prevCenter = map.getCenter();
      prevZoom = map.getZoom();

      zoomAnimationId = requestAnimationFrame(updateWheelZoom);
    };

    const container = mapContainerRef.current;
    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isWheeling) {
        onWheelStart(e);
      }
      onWheeling(e);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    // Drag coordination: when dragging starts, instantly commit zoom and dismiss hover card
    map.on('dragstart', () => {
      hideHoverPlateRef.current?.();
      if (isWheeling) {
        onWheelEnd();
      }
    });

    map.on('zoomstart', () => {
      hideHoverPlateRef.current?.();
    });

    const handleContainerMouseLeave = () => {
      hideHoverPlateRef.current?.();
    };
    container.addEventListener('mouseleave', handleContainerMouseLeave);

    // Track zoom level: instant LOD switch when crossing 2.5 / 4.5, throttled updates for HUD
    map.on('zoom', () => {
      const z = map.getZoom();

      const oldLOD = lastReportedZoom < 2.5 ? 1 : (lastReportedZoom < 4.5 ? 2 : 3);
      const newLOD = z < 2.5 ? 1 : (z < 4.5 ? 2 : 3);

      if (oldLOD !== newLOD) {
        lastReportedZoom = z;
        setZoomLevel(z);
      } else {
        if (!zoomRaf) {
          zoomRaf = requestAnimationFrame(() => {
            lastReportedZoom = map.getZoom();
            setZoomLevel(lastReportedZoom);
            zoomRaf = null;
          });
        }
      }
    });

    // Click handler for map canvas (normalizes longitude into [-180, 180])
    map.on('click', (e) => {
      hideHoverPlateRef.current?.();
      if (isAddingLocation) {
        let { lat, lng } = e.latlng;
        // Normalize longitude into canonical [-180, 180]
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
        setEditingPlateTarget(null);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      if (zoomAnimationId) cancelAnimationFrame(zoomAnimationId);
      if (zoomRaf) cancelAnimationFrame(zoomRaf);
      clearTimeout(wheelEndTimer);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mouseleave', handleContainerMouseLeave);
      if (canvasLabelsLayerRef.current) {
        map.removeLayer(canvasLabelsLayerRef.current);
        canvasLabelsLayerRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Dynamic Level Determination (左闭右开区间):
  // 1级 大洲大洋: [1.0, 2.5)
  // 2级 国家主权: [2.5, 4.5)
  // 3级 省州大区: [4.5, +∞)
  const currentLOD = useMemo(() => {
    if (zoomLevel < 2.5) return 1;
    if (zoomLevel < 4.5) return 2;
    return 3;
  }, [zoomLevel]);

  // ---------------------------------------------------------------------------
  // Layer 1A: Continents Vector Layer (Level 1 [1.0, 2.5): Hover by Continent Block)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !continentsGeo) return;

    if (continentsVectorLayerRef.current) {
      map.removeLayer(continentsVectorLayerRef.current);
      continentsVectorLayerRef.current = null;
    }

    // Only active in Level 1
    if (currentLOD !== 1) return;

    const epochColors = currentEpoch?.regionColors || {};
    const epochPlates = currentEpoch?.platesData || {};

    const contLayer = L.geoJSON(continentsGeo, {
      renderer: overviewRendererRef.current,
      style: (feature) => {
        const id = feature.properties?.id || feature.properties?.name;
        const plateData = epochPlates[id] || epochPlates[feature.properties?.name] || {};
        const customColor = plateData.color || epochColors[id] || epochColors[feature.properties?.name_en];

        return {
          noClip: true,
          fillColor: customColor || '#38bdf8', // Default bright blue (#38BDF8)
          fillOpacity: customColor ? 0.95 : 0.88,
          color: 'rgba(255, 255, 255, 0.65)', // Scheme 1: Prominent continent boundary line
          weight: 2.5,
          lineJoin: 'round'
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.name || '大洲';
        const nameEn = feature.properties?.name_en || '';
        const id = feature.properties?.id || name;
        const plateData = epochPlates[id] || epochPlates[name] || {};
        const displayName = plateData.name || name;
        const displayColor = plateData.color || epochColors[id] || '';
        const description = plateData.description || '';

        // Hover effect: Highlights the ENTIRE continent block
        layer.on('mouseover', (e) => {
          const l = e.target;
          l.setStyle({
            color: '#ffffff',
            weight: 3.5,
            fillOpacity: 1.0
          });
          l.bringToFront();
          const orig = e.originalEvent;
          showHoverPlate({
            id,
            name: displayName,
            originalName: name,
            nameEn,
            type: '大洲板块',
            parentName: '',
            color: displayColor,
            description
          }, orig.clientX, orig.clientY);
        });

        layer.on('mousemove', (e) => {
          const orig = e.originalEvent;
          updateHoverCardPos(orig.clientX, orig.clientY);
        });

        layer.on('mouseout', (e) => {
          contLayer.resetStyle(e.target);
          hideHoverPlate();
        });

        layer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          hideHoverPlate();
          setEditingPlateTarget({
            id,
            name: displayName,
            originalName: name,
            nameEn,
            type: '大洲板块',
            parentName: '',
            color: displayColor,
            description
          });
        });
      }
    });

    contLayer.addTo(map);
    continentsVectorLayerRef.current = contLayer;
  }, [continentsGeo, currentEpoch, currentLOD, showHoverPlate, updateHoverCardPos, hideHoverPlate]);

  // ---------------------------------------------------------------------------
  // Layer 1B: Continent & Ocean Watermarks (Level 1 [1.0, 2.5) only)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !continentsData) return;

    if (continentsWatermarksLayerRef.current) {
      map.removeLayer(continentsWatermarksLayerRef.current);
      continentsWatermarksLayerRef.current = null;
    }

    // Watermarks only active in Level 1
    if (currentLOD !== 1) return;

    const layerGroup = L.layerGroup();

    WRAP_OFFSETS.forEach((offset) => {
      // Continent Watermarks
      continentsData.continents.forEach((cont) => {
        const html = `
          <div class="pointer-events-none select-none text-center transition-all duration-300">
            <div class="text-[12px] md:text-[13px] font-black tracking-[0.25em] text-slate-900/90 font-sans uppercase drop-shadow-[0_1px_2px_rgba(255,255,255,0.4)]">
              ${cont.name}
            </div>
            <div class="text-[9px] tracking-[0.4em] text-slate-800/75 font-mono font-bold">
              ${cont.name_en}
            </div>
          </div>
        `;
        const icon = L.divIcon({
          className: 'continent-label',
          html,
          iconSize: [140, 40],
          iconAnchor: [70, 20]
        });
        L.marker([cont.lat, cont.lng + offset], { icon, interactive: false }).addTo(layerGroup);
      });

      // Ocean Watermarks
      continentsData.oceans.forEach((ocean) => {
        const html = `
          <div class="pointer-events-none select-none text-center opacity-60">
            <div class="text-[12px] font-medium tracking-[0.4em] text-sky-300/60 uppercase font-serif italic">
              ~ ${ocean.name} ~
            </div>
            <div class="text-[9px] tracking-[0.3em] text-sky-400/40 uppercase font-mono">
              ${ocean.name_en || ''}
            </div>
          </div>
        `;
        const icon = L.divIcon({
          className: 'ocean-label',
          html,
          iconSize: [160, 30],
          iconAnchor: [80, 15]
        });
        L.marker([ocean.lat, ocean.lng + offset], { icon, interactive: false }).addTo(layerGroup);
      });
    });

    layerGroup.addTo(map);
    continentsWatermarksLayerRef.current = layerGroup;
  }, [continentsData, currentLOD]);

  // ---------------------------------------------------------------------------
  // Layer 2A: Countries Vector Layer (Level 2 [2.5, 4.5): Country boundaries & hover)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !countriesGeo) return;

    if (countriesLayerRef.current) {
      map.removeLayer(countriesLayerRef.current);
      countriesLayerRef.current = null;
    }

    // Active strictly in Level 2
    if (currentLOD !== 2) return;

    const epochColors = currentEpoch?.regionColors || {};
    const epochPlates = currentEpoch?.platesData || {};

    const geoLayer = L.geoJSON(countriesGeo, {
      renderer: overviewRendererRef.current,
      style: (feature) => {
        const id = feature.properties?.id || feature.properties?.name;
        const plateData = epochPlates[id] || epochPlates[feature.properties?.name] || {};
        const customColor = plateData.color || epochColors[id] || epochColors[feature.properties?.name_en];

        return {
          noClip: true,
          fillColor: customColor || '#38bdf8', // Default bright blue (#38BDF8)
          fillOpacity: 1.0,
          color: 'rgba(255, 255, 255, 0.75)', // Scheme 1: Prominent country boundary lines
          weight: 2.0,
          lineJoin: 'round'
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.name || feature.properties?.name_en || '国家/地区';
        const nameEn = feature.properties?.name_en || '';
        const id = feature.properties?.id || name;
        const parentName = feature.properties?.continent || '';
        const plateData = epochPlates[id] || epochPlates[name] || {};
        const displayName = plateData.name || name;
        const displayColor = plateData.color || epochColors[id] || '';
        const description = plateData.description || '';

        // Hover effect: Highlights the country
        layer.on('mouseover', (e) => {
          const l = e.target;
          l.setStyle({
            color: '#ffffff',
            weight: 3.2,
            fillOpacity: 1.0
          });
          l.bringToFront();
          const orig = e.originalEvent;
          showHoverPlate({
            id,
            name: displayName,
            originalName: name,
            nameEn,
            type: '国家板块',
            parentName,
            color: displayColor,
            description
          }, orig.clientX, orig.clientY);
        });

        layer.on('mousemove', (e) => {
          const orig = e.originalEvent;
          updateHoverCardPos(orig.clientX, orig.clientY);
        });

        layer.on('mouseout', (e) => {
          geoLayer.resetStyle(e.target);
          hideHoverPlate();
        });

        layer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          hideHoverPlate();
          setEditingPlateTarget({
            id,
            name: displayName,
            originalName: name,
            nameEn,
            type: '国家板块',
            parentName,
            color: displayColor,
            description
          });
        });
      }
    });

    geoLayer.addTo(map);
    countriesLayerRef.current = geoLayer;
  }, [countriesGeo, currentEpoch, currentLOD, showHoverPlate, updateHoverCardPos, hideHoverPlate]);

  // ---------------------------------------------------------------------------
  // Layer 3: Worldwide Provinces & States Vector Layer (Level 3 [4.5, +∞))
  // High detail: US states, China, Canada, Australia, Brazil, Japan, Russia, India, Europe, etc.
  // Viewport culling active: renderer padding 0.35 skimmer skips 95% offscreen polygons
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !provincesGeo) return;

    if (provincesLayerRef.current) {
      map.removeLayer(provincesLayerRef.current);
      provincesLayerRef.current = null;
    }

    // Only active in Level 3 (currentLOD === 3)
    if (currentLOD !== 3) return;

    const epochColors = currentEpoch?.regionColors || {};
    const epochPlates = currentEpoch?.platesData || {};

    const provLayer = L.geoJSON(provincesGeo, {
      renderer: provincesRendererRef.current,
      style: (feature) => {
        const id = feature.properties?.id || feature.properties?.name;
        const plateData = epochPlates[id] || epochPlates[feature.properties?.name] || {};
        const customColor = plateData.color || epochColors[id];

        return {
          fillColor: customColor || '#38bdf8',
          fillOpacity: 1.0,
          color: 'rgba(255, 255, 255, 0.5)', // Scheme 1: Crisp visible province boundary line
          weight: 1.5,
          lineJoin: 'round'
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.name || feature.properties?.name_en || '行政省州';
        const nameEn = feature.properties?.name_en || '';
        const id = feature.properties?.id || name;
        const parentName = feature.properties?.country || feature.properties?.admin || '所属国家';
        const plateData = epochPlates[id] || epochPlates[name] || {};
        const displayName = plateData.name || name;
        const displayColor = plateData.color || epochColors[id] || '';
        const description = plateData.description || '';

        layer.on('mouseover', (e) => {
          const l = e.target;
          l.setStyle({
            color: '#ffffff',
            weight: 2.5,
            fillOpacity: 1.0
          });
          l.bringToFront();
          const orig = e.originalEvent;
          showHoverPlate({
            id,
            name: displayName,
            originalName: name,
            nameEn,
            type: '省州板块',
            parentName,
            color: displayColor,
            description
          }, orig.clientX, orig.clientY);
        });

        layer.on('mousemove', (e) => {
          const orig = e.originalEvent;
          updateHoverCardPos(orig.clientX, orig.clientY);
        });

        layer.on('mouseout', (e) => {
          provLayer.resetStyle(e.target);
          hideHoverPlate();
        });

        layer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          hideHoverPlate();
          setEditingPlateTarget({
            id,
            name: displayName,
            originalName: name,
            nameEn,
            type: '省州板块',
            parentName,
            color: displayColor,
            description
          });
        });
      }
    });

    provLayer.addTo(map);
    provincesLayerRef.current = provLayer;
  }, [provincesGeo, currentEpoch, currentLOD, showHoverPlate, updateHoverCardPos, hideHoverPlate]);

  // ---------------------------------------------------------------------------
  // GPU Canvas Labels Data Synchronization
  // Zero DOM markers: all country & province labels rendered on GPU Canvas
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (canvasLabelsLayerRef.current) {
      canvasLabelsLayerRef.current.updateData({
        countryLabels,
        provinceLabels,
        platesData: currentEpoch?.platesData || {}
      });
    }
  }, [countryLabels, provinceLabels, currentEpoch?.platesData]);

  useEffect(() => {
    if (canvasLabelsLayerRef.current) {
      canvasLabelsLayerRef.current._update();
    }
  }, [currentLOD]);

  // Update Interactive Location Markers on Map (Wrapped across all world copies)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (markersLayerRef.current) {
      map.removeLayer(markersLayerRef.current);
      markersLayerRef.current = null;
    }

    const markersGroup = L.layerGroup();

    WRAP_OFFSETS.forEach((offset) => {
      filteredLocations.forEach((loc) => {
        const isSelected = selectedMapLocationId === loc.id;
        const pinColor = loc.color || '#38bdf8';
        const eventCount = filteredEvents.filter((t) => t.locationId === loc.id).length;

        const html = `
          <div class="relative group cursor-pointer -translate-x-1/2 -translate-y-1/2">
            <!-- Radar Pulse Wave -->
            <div class="absolute -inset-2 rounded-full opacity-40 ${
              isSelected ? 'animate-ping' : 'group-hover:animate-ping'
            }" style="background-color: ${pinColor};"></div>

            <!-- Pin Head -->
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

            <!-- Label Pill -->
            <div class="mt-1 px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap border backdrop-blur flex items-center gap-1 shadow-lg ${
              isSelected
                ? 'bg-slate-900/95 border-white text-white'
                : 'bg-slate-900/80 border-slate-700/80 text-slate-200'
            }">
              <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${pinColor};"></span>
              <span>${loc.name}</span>
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'novel-poi-pin',
          html,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([loc.lat, loc.lng + offset], { icon: customIcon });
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedMapLocationId(isSelected ? null : loc.id);
          setEditingPlateTarget(null);
        });

        marker.addTo(markersGroup);
      });
    });

    markersGroup.addTo(map);
    markersLayerRef.current = markersGroup;
  }, [filteredLocations, selectedMapLocationId, filteredEvents]);

  // Fly to location when selected (chooses the nearest wrapped copy)
  const flyToLocation = useCallback((lat, lng, zoom = 6) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentCenterLng = map.getCenter().lng;
    let bestLng = lng;
    let minDiff = Math.abs(lng - currentCenterLng);
    WRAP_OFFSETS.forEach((off) => {
      const diff = Math.abs(lng + off - currentCenterLng);
      if (diff < minDiff) {
        minDiff = diff;
        bestLng = lng + off;
      }
    });

    map.flyTo([lat, bestLng], zoom, {
      animate: true,
      duration: 1.2
    });
  }, []);

  // Save location modal
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

  // Save timeline event modal
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

  // Plate editing handler (板块信息与颜色保存)
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

        {/* Center: 3-Level Hierarchical LOD Indicator & Quick Jump */}
        <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
          <span className="text-[10px] font-mono text-slate-400 px-1.5">缩放层级:</span>
          <button
            onClick={() => mapInstanceRef.current?.setZoom(1.8)}
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
            onClick={() => mapInstanceRef.current?.setZoom(3.2)}
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
            onClick={() => mapInstanceRef.current?.setZoom(5.5)}
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
          {/* Add Pin Button */}
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

          {/* Toggle Timeline Bar */}
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

          {/* Switch to Nodes workspace */}
          <button
            onClick={() => setActiveWorkspace('nodes')}
            className="flex items-center gap-1 text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 transition-colors"
          >
            <span>返回画布</span>
          </button>
        </div>
      </header>

      {/* Floating Map Historical Epoch Switcher (地图时空变迁控制条) */}
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

      {/* Main Map Body: Leaflet Canvas + Inspector Drawer */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Leaflet DOM container (Dark Blue Ocean Vector Canvas) */}
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

        {/* Selected Location Inspector Drawer (Right Side) */}
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
              {/* Real Latitude / Longitude coordinates */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between font-mono text-[11px] text-slate-400">
                <span className="flex items-center gap-1 text-sky-400">
                  <Compass className="w-3.5 h-3.5" />
                  真实经纬度:
                </span>
                <span className="text-slate-200">
                  {selectedLocation.lat?.toFixed(2)}°N, {selectedLocation.lng?.toFixed(2)}°E
                </span>
              </div>

              {/* Time stamp */}
              <div className="flex items-center justify-between bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">标定时期 / 年份:</span>
                <span className="font-mono text-amber-300 font-bold">
                  {selectedLocation.year} 年
                </span>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400">设定与背景简介</label>
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
                  {selectedLocation.description || '暂无详细设定描述。点击上方编辑按钮补充。'}
                </div>
              </div>

              {/* Related Timeline Events */}
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

      {/* Plate Editor Modal (板块编辑面板：名称、颜色、简介) */}
      {editingPlateTarget && (
        <PlateEditorModal
          target={editingPlateTarget}
          currentEpoch={currentEpoch}
          onClose={() => setEditingPlateTarget(null)}
          onSave={handleSavePlate}
        />
      )}

      {/* Singleton Plate Hover Card (全局单例悬停卡片，物理级杜绝多卡片残留) */}
      <PlateHoverCard plate={hoveredPlate} cardRef={plateHoverCardRef} />

      {/* Dual-Boundary Range Interactive Timeline Bar (双边界过滤时间轴) */}
      {isTimelineOpen && (
        <div className="h-44 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md flex flex-col shrink-0 z-20 shadow-2xl animate-fadeIn">
          {/* Timeline Sub-header: Current Playhead & Range Status */}
          <div className="h-9 border-b border-slate-800/80 px-4 flex items-center justify-between text-xs text-slate-400 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>双边界时间轴</span>
              </div>

              {/* Left & Right boundary tags */}
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

          {/* Dual Range Sliders & Time Scrubber Bar */}
          <div className="px-6 py-2 border-b border-slate-800/60 bg-slate-950/60 flex items-center gap-4">
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>起始 -1000年</span>
                <span className="text-amber-300 font-bold">
                  指针时刻: {timelineSettings.currentTime} 年
                </span>
                <span>未来 +2100年</span>
              </div>

              {/* Sliders container */}
              <div className="relative w-full h-6 flex items-center">
                {/* Visual Active Range Bar */}
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

                {/* Left Boundary Range Input */}
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

                {/* Right Boundary Range Input */}
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

          {/* Filtered Events Horizontal Track */}
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
