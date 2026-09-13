import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useStoryStore } from '../store/useStoryStore';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Configure Web Worker URL to bypass bundler resolution and guarantee offline execution
if (typeof window !== 'undefined') {
  maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
}
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
  Clock,
  ChevronDown,
  ChevronUp,
  Palette,
  RotateCcw,
  Edit2,
  X
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

function getPlateColorExpression(epoch, defaultColor = '#38bdf8') {
  const matchMap = new Map();
  if (epoch?.regionColors) {
    for (const [key, color] of Object.entries(epoch.regionColors)) {
      if (color) matchMap.set(key, color);
    }
  }
  const platesData = epoch?.platesData || (epoch && !epoch.regionColors && !epoch.id ? epoch : {});
  if (platesData) {
    for (const [key, val] of Object.entries(platesData)) {
      if (val && val.color) matchMap.set(key, val.color);
    }
  }
  if (matchMap.size === 0) {
    return defaultColor;
  }
  const matchEntries = [];
  for (const [key, color] of matchMap.entries()) {
    matchEntries.push(key, color);
  }
  return [
    'match',
    ['coalesce', ['get', 'id'], ['get', 'name'], ''],
    ...matchEntries,
    defaultColor
  ];
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
  const setTimelineBounds = useStoryStore((s) => s.setTimelineBounds);
  const setCurrentEpochId = useStoryStore((s) => s.setCurrentEpochId);
  const selectEpoch = useStoryStore((s) => s.selectEpoch);
  const setPlateInfo = useStoryStore((s) => s.setPlateInfo);
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

  // Total timeline extent across all epochs (总线范围)
  const totalMin = useMemo(() => {
    if (!epochs.length) return -1000;
    return Math.min(...epochs.map((ep) => ep.timeRange?.[0] ?? -1000));
  }, [epochs]);

  const totalMax = useMemo(() => {
    if (!epochs.length) return 2100;
    return Math.max(...epochs.map((ep) => ep.timeRange?.[1] ?? 2100));
  }, [epochs]);

  const totalSpan = Math.max(1, totalMax - totalMin);

  const currentEpoch = useMemo(() => {
    return epochs.find((ep) => ep.id === currentEpochId) || epochs[0] || null;
  }, [epochs, currentEpochId]);

  const currentEpochRef = useRef(currentEpoch);
  useEffect(() => {
    currentEpochRef.current = currentEpoch;
  }, [currentEpoch]);

  const epochMin = currentEpoch?.timeRange?.[0] ?? totalMin;
  const epochMax = currentEpoch?.timeRange?.[1] ?? totalMax;

  // Clamped bounds strictly restricted to current epoch
  const rawLeft = timelineSettings.leftBound ?? epochMin;
  const rawRight = timelineSettings.rightBound ?? epochMax;
  const boundedLeft = Math.max(epochMin, Math.min(epochMax, rawLeft));
  const boundedRight = Math.max(boundedLeft, Math.min(epochMax, rawRight));
  const savedLeft = boundedLeft;
  const savedRight = boundedRight;

  // Local bounds for real-time smooth interaction at 60fps
  const [activeLeft, setActiveLeft] = useState(savedLeft);
  const [activeRight, setActiveRight] = useState(savedRight);

  // Refs to avoid stale closures in event listeners
  const activeLeftRef = useRef(activeLeft);
  const activeRightRef = useRef(activeRight);

  // Dragging interaction state for DualHandleSlider on the Total Timeline (总线)
  const timelineTrackRef = useRef(null);
  const [draggingHandle, setDraggingHandle] = useState(null);

  useEffect(() => {
    if (!draggingHandle) {
      setActiveLeft(savedLeft);
      activeLeftRef.current = savedLeft;
    }
  }, [savedLeft, draggingHandle]);

  useEffect(() => {
    if (!draggingHandle) {
      setActiveRight(savedRight);
      activeRightRef.current = savedRight;
    }
  }, [savedRight, draggingHandle]);

  const clampedLeft = activeLeft;
  const clampedRight = activeRight;

  // Numeric text inputs for manual input
  const [leftInputVal, setLeftInputVal] = useState(String(clampedLeft));
  const [rightInputVal, setRightInputVal] = useState(String(clampedRight));

  useEffect(() => {
    setLeftInputVal(String(clampedLeft));
  }, [clampedLeft]);

  useEffect(() => {
    setRightInputVal(String(clampedRight));
  }, [clampedRight]);

  const handleCommitLeft = () => {
    const num = parseInt(leftInputVal, 10);
    if (isNaN(num)) {
      setLeftInputVal(String(activeLeftRef.current));
      return;
    }
    const val = Math.max(epochMin, Math.min(activeRightRef.current, num));
    setLeftInputVal(String(val));
    setActiveLeft(val);
    activeLeftRef.current = val;
    setTimelineBounds(val, activeRightRef.current);
  };

  const handleCommitRight = () => {
    const num = parseInt(rightInputVal, 10);
    if (isNaN(num)) {
      setRightInputVal(String(activeRightRef.current));
      return;
    }
    const val = Math.max(activeLeftRef.current, Math.min(epochMax, num));
    setRightInputVal(String(val));
    setActiveRight(val);
    activeRightRef.current = val;
    setTimelineBounds(activeLeftRef.current, val);
  };

  // Percentages relative to the TOTAL timeline (总线)
  const leftPercent = Math.max(0, Math.min(100, ((clampedLeft - totalMin) / totalSpan) * 100));
  const rightPercent = Math.max(0, Math.min(100, ((clampedRight - totalMin) / totalSpan) * 100));
  const epochLeftPercent = Math.max(0, Math.min(100, ((epochMin - totalMin) / totalSpan) * 100));
  const epochRightPercent = Math.max(0, Math.min(100, ((epochMax - totalMin) / totalSpan) * 100));

  const handlePointerDown = (handle, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingHandle(handle);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (handle, e) => {
    if (draggingHandle !== handle || !timelineTrackRef.current) return;
    const rect = timelineTrackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const year = Math.round(totalMin + ratio * totalSpan);

    if (handle === 'left') {
      // Must not go below epochMin (cannot slide outside current epoch) or above activeRight
      const clamped = Math.max(epochMin, Math.min(activeRightRef.current, year));
      if (clamped !== activeLeftRef.current) {
        activeLeftRef.current = clamped;
        setActiveLeft(clamped);
        setLeftInputVal(String(clamped));
      }
    } else if (handle === 'right') {
      // Must not go below activeLeft or above epochMax (cannot slide outside current epoch)
      const clamped = Math.max(activeLeftRef.current, Math.min(epochMax, year));
      if (clamped !== activeRightRef.current) {
        activeRightRef.current = clamped;
        setActiveRight(clamped);
        setRightInputVal(String(clamped));
      }
    }
  };

  const handlePointerUp = (handle, e) => {
    if (draggingHandle === handle) {
      setDraggingHandle(null);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      // Persist final bounds to store on release using ref
      setTimelineBounds(activeLeftRef.current, activeRightRef.current);
    }
  };

  const handleTrackClick = (e) => {
    if (!timelineTrackRef.current || draggingHandle) return;
    const rect = timelineTrackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const clickedYear = Math.round(totalMin + ratio * totalSpan);

    const targetYear = Math.max(epochMin, Math.min(epochMax, clickedYear));
    const distToLeft = Math.abs(targetYear - activeLeftRef.current);
    const distToRight = Math.abs(targetYear - activeRightRef.current);

    if (distToLeft < distToRight) {
      const clamped = Math.max(epochMin, Math.min(activeRightRef.current, targetYear));
      activeLeftRef.current = clamped;
      setActiveLeft(clamped);
      setLeftInputVal(String(clamped));
      setTimelineBounds(clamped, activeRightRef.current);
    } else {
      const clamped = Math.max(activeLeftRef.current, Math.min(epochMax, targetYear));
      activeRightRef.current = clamped;
      setActiveRight(clamped);
      setRightInputVal(String(clamped));
      setTimelineBounds(activeLeftRef.current, clamped);
    }
  };

  const handleSelectEpoch = (ep) => {
    const epStart = ep.timeRange?.[0] ?? -1000;
    const epEnd = ep.timeRange?.[1] ?? 2100;
    setActiveLeft(epStart);
    setActiveRight(epEnd);
    activeLeftRef.current = epStart;
    activeRightRef.current = epEnd;
    setLeftInputVal(String(epStart));
    setRightInputVal(String(epEnd));
    if (selectEpoch) {
      selectEpoch(ep.id, epStart, epEnd);
    } else {
      setCurrentEpochId(ep.id);
      setTimelineBounds(epStart, epEnd);
    }
  };

  // UI state
  const [zoomLevel, setZoomLevel] = useState(1.8);
  const [isTimelineOpen, setIsTimelineOpen] = useState(true);
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
  const zoomRafRef = useRef(null);

  // Data states from preloader
  const [continentsGeo, setContinentsGeo] = useState(() => getPreloadedContinentsGeo());
  const [countriesGeo, setCountriesGeo] = useState(() => getPreloadedCountries());
  const [provincesGeo, setProvincesGeo] = useState(() => getPreloadedProvinces());
  const [countryLabels, setCountryLabels] = useState(() => getPreloadedCountryLabels());
  const [provinceLabels, setProvinceLabels] = useState(() => getPreloadedProvinceLabels());
  const [continentsData, setContinentsData] = useState(() => getPreloadedContinents());

  const continentsGeoRef = useRef(continentsGeo);
  continentsGeoRef.current = continentsGeo;
  const countriesGeoRef = useRef(countriesGeo);
  countriesGeoRef.current = countriesGeo;
  const provincesGeoRef = useRef(provincesGeo);
  provincesGeoRef.current = provincesGeo;
  const countryLabelsRef = useRef(countryLabels);
  countryLabelsRef.current = countryLabels;
  const provinceLabelsRef = useRef(provinceLabels);
  provinceLabelsRef.current = provinceLabels;
  const continentsDataRef = useRef(continentsData);
  continentsDataRef.current = continentsData;

  const updateMapSources = useCallback((map) => {
    if (!map || !isMapLoadedRef.current) return;

    const cGeo = continentsGeoRef.current || getPreloadedContinentsGeo();
    if (cGeo && map.getSource('continents')) {
      map.getSource('continents').setData(cGeo);
    }
    const ctryGeo = countriesGeoRef.current || getPreloadedCountries();
    if (ctryGeo && map.getSource('countries')) {
      map.getSource('countries').setData(ctryGeo);
    }
    const provGeo = provincesGeoRef.current || getPreloadedProvinces();
    if (provGeo && map.getSource('provinces')) {
      map.getSource('provinces').setData(provGeo);
    }
    const cData = continentsDataRef.current || getPreloadedContinents();
    if (cData && map.getSource('continent-watermarks')) {
      map.getSource('continent-watermarks').setData(continentsWatermarksToGeoJSON(cData));
    }
    if (cData && map.getSource('ocean-watermarks')) {
      map.getSource('ocean-watermarks').setData(oceanWatermarksToGeoJSON(cData));
    }
    const cLabels = countryLabelsRef.current || getPreloadedCountryLabels();
    if (cLabels && map.getSource('country-labels')) {
      map.getSource('country-labels').setData(labelsToGeoJSON(cLabels, currentEpochRef.current?.platesData));
    }
    const pLabels = provinceLabelsRef.current || getPreloadedProvinceLabels();
    if (pLabels && map.getSource('province-labels')) {
      map.getSource('province-labels').setData(labelsToGeoJSON(pLabels, currentEpochRef.current?.platesData));
    }
  }, []);

  useEffect(() => {
    if (!continentsGeo || !countriesGeo || !provincesGeo || !countryLabels || !provinceLabels || !continentsData) {
      preloadGeoAssets().then(() => {
        const cGeo = getPreloadedContinentsGeo();
        const ctry = getPreloadedCountries();
        const prov = getPreloadedProvinces();
        const cl = getPreloadedCountryLabels();
        const pl = getPreloadedProvinceLabels();
        const cd = getPreloadedContinents();
        setContinentsGeo(cGeo);
        setCountriesGeo(ctry);
        setProvincesGeo(prov);
        setCountryLabels(cl);
        setProvinceLabels(pl);
        setContinentsData(cd);
        continentsGeoRef.current = cGeo;
        countriesGeoRef.current = ctry;
        provincesGeoRef.current = prov;
        countryLabelsRef.current = cl;
        provinceLabelsRef.current = pl;
        continentsDataRef.current = cd;
        if (mapInstanceRef.current && isMapLoadedRef.current) {
          updateMapSources(mapInstanceRef.current);
        }
      });
    }
  }, [continentsGeo, countriesGeo, provincesGeo, countryLabels, provinceLabels, continentsData, updateMapSources]);

  // Window resize invalidation
  useEffect(() => {
    if (isActive && mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.resize();
      }, 50);
    }
  }, [isActive]);

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

      // 1. Continents Source & Layers (Zoom 0 ~ 2.8 with smooth cushion)
      map.addSource('continents', {
        type: 'geojson',
        data: continentsGeoRef.current || getPreloadedContinentsGeo() || { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'continents-fill',
        type: 'fill',
        source: 'continents',
        maxzoom: 2.8,
        paint: {
          'fill-color': getPlateColorExpression(currentEpochRef.current, '#38bdf8'),
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            2.3, 1.0,
            2.7, 0.0
          ]
        }
      });

      map.addLayer({
        id: 'continents-line',
        type: 'line',
        source: 'continents',
        maxzoom: 2.7,
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.65)',
          'line-width': 2.0,
          'line-opacity': [
            'interpolate', ['linear'], ['zoom'],
            2.3, 1.0,
            2.6, 0.0
          ]
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

      // 2. Countries Source & Layers (Zoom 2.1 ~ 4.8 with pre-warming & cushion)
      map.addSource('countries', {
        type: 'geojson',
        data: countriesGeoRef.current || getPreloadedCountries() || { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        minzoom: 2.1,
        maxzoom: 4.8,
        paint: {
          'fill-color': getPlateColorExpression(currentEpochRef.current, '#38bdf8'),
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            2.2, 0.0,
            2.5, 1.0,
            4.3, 1.0,
            4.7, 0.0
          ]
        }
      });

      map.addLayer({
        id: 'countries-line',
        type: 'line',
        source: 'countries',
        minzoom: 2.3,
        maxzoom: 4.7,
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.75)',
          'line-width': 1.8,
          'line-opacity': [
            'interpolate', ['linear'], ['zoom'],
            2.3, 0.0,
            2.5, 1.0,
            4.3, 1.0,
            4.6, 0.0
          ]
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

      // 3. Provinces Source & Layers (Zoom 4.1 ~ 14 with pre-warming)
      map.addSource('provinces', {
        type: 'geojson',
        data: provincesGeoRef.current || getPreloadedProvinces() || { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'provinces-fill',
        type: 'fill',
        source: 'provinces',
        minzoom: 4.1,
        paint: {
          'fill-color': getPlateColorExpression(currentEpochRef.current, '#38bdf8'),
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            4.2, 0.0,
            4.5, 1.0
          ]
        }
      });

      map.addLayer({
        id: 'provinces-line',
        type: 'line',
        source: 'provinces',
        minzoom: 4.3,
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.55)',
          'line-width': 1.2,
          'line-opacity': [
            'interpolate', ['linear'], ['zoom'],
            4.3, 0.0,
            4.5, 1.0
          ]
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
        data: continentsWatermarksToGeoJSON(continentsDataRef.current || getPreloadedContinents())
      });

      map.addLayer({
        id: 'continents-watermarks',
        type: 'symbol',
        source: 'continent-watermarks',
        maxzoom: 2.7,
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
          'text-halo-width': 2.0,
          'text-opacity': [
            'interpolate', ['linear'], ['zoom'],
            2.2, 1.0,
            2.6, 0.0
          ]
        }
      });

      map.addSource('ocean-watermarks', {
        type: 'geojson',
        data: oceanWatermarksToGeoJSON(continentsDataRef.current || getPreloadedContinents())
      });

      map.addLayer({
        id: 'ocean-watermarks',
        type: 'symbol',
        source: 'ocean-watermarks',
        maxzoom: 2.7,
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
          'text-halo-width': 1.2,
          'text-opacity': [
            'interpolate', ['linear'], ['zoom'],
            2.2, 1.0,
            2.6, 0.0
          ]
        }
      });

      // 5. Country Labels (Zoom 2.3 ~ 4.7 with smooth fade)
      map.addSource('country-labels', {
        type: 'geojson',
        data: labelsToGeoJSON(countryLabelsRef.current || getPreloadedCountryLabels(), currentEpochRef.current?.platesData)
      });

      map.addLayer({
        id: 'country-labels',
        type: 'symbol',
        source: 'country-labels',
        minzoom: 2.3,
        maxzoom: 4.7,
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
          'text-halo-width': 2.5,
          'text-opacity': [
            'interpolate', ['linear'], ['zoom'],
            2.3, 0.0,
            2.5, 1.0,
            4.3, 1.0,
            4.6, 0.0
          ]
        }
      });

      // 6. Province Labels (Zoom 4.3 ~ 14 with smooth fade)
      map.addSource('province-labels', {
        type: 'geojson',
        data: labelsToGeoJSON(provinceLabelsRef.current || getPreloadedProvinceLabels(), currentEpochRef.current?.platesData)
      });

      map.addLayer({
        id: 'province-labels',
        type: 'symbol',
        source: 'province-labels',
        minzoom: 4.3,
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
          'text-halo-width': 2.5,
          'text-opacity': [
            'interpolate', ['linear'], ['zoom'],
            4.3, 0.0,
            4.5, 1.0
          ]
        }
      });

      // -------------------------------------------------------------------------
      // Interactive Layer Hover & Click Handlers
      // -------------------------------------------------------------------------
      const interactiveLayers = ['continents-fill', 'countries-fill', 'provinces-fill'];

      interactiveLayers.forEach((layerId) => {
        map.on('mousemove', layerId, (e) => {
          if (!e.features || !e.features.length) return;

          const z = map.getZoom();
          if (layerId === 'continents-fill' && z >= 2.5) return;
          if (layerId === 'countries-fill' && (z < 2.5 || z >= 4.5)) return;
          if (layerId === 'provinces-fill' && z < 4.5) return;

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
          map.getCanvas().style.cursor = '';
          hideHoverPlateRef.current?.();
        });

        map.on('click', layerId, (e) => {
          const z = map.getZoom();
          if (layerId === 'continents-fill' && z >= 2.5) return;
          if (layerId === 'countries-fill' && (z < 2.5 || z >= 4.5)) return;
          if (layerId === 'provinces-fill' && z < 4.5) return;

          if (e.originalEvent) e.originalEvent._plateClicked = true;
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

      isMapLoadedRef.current = true;
      updateMapSources(map);
      setTimeout(() => {
        map.resize();
      }, 50);
    });

    // Map-level click (for plate editing target deselection)
    map.on('click', (e) => {
      if (e.originalEvent?._plateClicked) return;
      hideHoverPlateRef.current?.();
      setEditingPlateTarget(null);
    });

    map.on('zoomstart', () => {
      hideHoverPlateRef.current?.();
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
      map.remove();
      mapInstanceRef.current = null;
      isMapLoadedRef.current = false;
    };
  }, []);

  // Update GeoJSON sources when in-memory preloading resolves
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoadedRef.current) return;
    updateMapSources(map);
  }, [continentsGeo, countriesGeo, provincesGeo, continentsData, countryLabels, provinceLabels, updateMapSources]);

  // Update plate colors & label text when epoch changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoadedRef.current) return;

    const colorExpr = getPlateColorExpression(currentEpoch, '#38bdf8');
    if (map.getLayer('continents-fill')) map.setPaintProperty('continents-fill', 'fill-color', colorExpr);
    if (map.getLayer('countries-fill')) map.setPaintProperty('countries-fill', 'fill-color', colorExpr);
    if (map.getLayer('provinces-fill')) map.setPaintProperty('provinces-fill', 'fill-color', colorExpr);

    const cLabels = countryLabels || getPreloadedCountryLabels();
    if (map.getSource('country-labels') && cLabels) {
      map.getSource('country-labels').setData(labelsToGeoJSON(cLabels, currentEpoch?.platesData));
    }
    const pLabels = provinceLabels || getPreloadedProvinceLabels();
    if (map.getSource('province-labels') && pLabels) {
      map.getSource('province-labels').setData(labelsToGeoJSON(pLabels, currentEpoch?.platesData));
    }
  }, [currentEpoch, countryLabels, provinceLabels]);

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

        {/* Right Tools: Toggle Timeline, Return */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTimelineOpen(!isTimelineOpen)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
              isTimelineOpen
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="展开或折叠时空总线时间轴"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">{currentEpoch?.name || '时空总线时间轴'}</span>
            <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
              ({clampedLeft} ~ {clampedRight}年)
            </span>
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

      {/* Main Map Body: MapLibre GL Canvas */}
      <div className="flex-1 flex overflow-hidden relative">
        <div
          ref={mapContainerRef}
          className="flex-1 w-full h-full"
          style={{
            zIndex: 1,
            background: 'radial-gradient(ellipse at 50% 50%, #0c1c3d 0%, #07122b 60%, #020616 100%)'
          }}
        />

        {/* Selected Location Inspector Drawer */}
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

      {/* Total Timeline Interactive Bar (总线时间轴) */}
      {isTimelineOpen && (
        <div className="border-t border-slate-800 bg-slate-900/95 backdrop-blur-md flex flex-col shrink-0 z-20 shadow-2xl animate-fadeIn">
          {/* Header Bar: Epoch Title + Exact Numeric Inputs + Reset */}
          <div className="h-9 border-b border-slate-800/80 px-6 flex items-center justify-between text-xs shrink-0 bg-slate-950/40">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>时空总线时间轴</span>
              </div>

              <div className="h-3.5 w-[1px] bg-slate-800" />

              {/* Left Bound Input (Cyan) */}
              <div className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded-lg border border-cyan-500/30 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-cyan-400/30 shrink-0" />
                <span className="text-[11px] text-cyan-300 font-medium">起:</span>
                <input
                  type="number"
                  value={leftInputVal}
                  min={epochMin}
                  max={clampedRight}
                  onChange={(e) => setLeftInputVal(e.target.value)}
                  onBlur={handleCommitLeft}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommitLeft()}
                  className="w-16 bg-transparent text-cyan-300 font-mono text-xs font-bold focus:outline-none focus:bg-slate-800/80 rounded px-1 text-center"
                  title={`当前时期左边界 (范围: ${epochMin} ~ ${clampedRight})`}
                />
                <span className="text-[10px] text-slate-400 font-mono">年</span>
              </div>

              <span className="text-slate-500 font-bold">~</span>

              {/* Right Bound Input (Yellow) */}
              <div className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded-lg border border-yellow-500/30 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-yellow-400 ring-2 ring-yellow-400/30 shrink-0" />
                <span className="text-[11px] text-yellow-300 font-medium">止:</span>
                <input
                  type="number"
                  value={rightInputVal}
                  min={clampedLeft}
                  max={epochMax}
                  onChange={(e) => setRightInputVal(e.target.value)}
                  onBlur={handleCommitRight}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommitRight()}
                  className="w-16 bg-transparent text-yellow-300 font-mono text-xs font-bold focus:outline-none focus:bg-slate-800/80 rounded px-1 text-center"
                  title={`当前时期右边界 (范围: ${clampedLeft} ~ ${epochMax})`}
                />
                <span className="text-[10px] text-slate-400 font-mono">年</span>
              </div>

              {/* Reset to Full Epoch Button */}
              <button
                onClick={() => {
                  setActiveLeft(epochMin);
                  setActiveRight(epochMax);
                  activeLeftRef.current = epochMin;
                  activeRightRef.current = epochMax;
                  setLeftInputVal(String(epochMin));
                  setRightInputVal(String(epochMax));
                  setTimelineBounds(epochMin, epochMax);
                }}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
                title="将左右控制柄重置为当前时期的起止完整范围"
              >
                <RotateCcw className="w-3 h-3" />
                <span>重置当前时期</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              总线跨度: <span className="text-slate-200 font-bold">{totalMin} ~ {totalMax}年</span> ({totalSpan}年)
            </div>
          </div>

          {/* Section 1: Contiguous Proportional Epoch Segmented Bar (Aligned 1:1 with timeline below) */}
          <div className="px-6 py-2 bg-slate-950/70 border-b border-slate-800/60">
            <div className="w-full flex items-stretch border border-slate-700/80 rounded-xl overflow-hidden divide-x divide-slate-800 bg-slate-900/60 shadow-inner h-11">
              {epochs.map((ep) => {
                const isCurrent = ep.id === currentEpochId;
                const epStart = ep.timeRange?.[0] ?? -1000;
                const epEnd = ep.timeRange?.[1] ?? 2100;
                const duration = Math.max(0, epEnd - epStart);
                const widthPercent = totalSpan > 0 ? (duration / totalSpan) * 100 : 100 / epochs.length;

                return (
                  <button
                    key={ep.id}
                    onClick={() => handleSelectEpoch(ep)}
                    style={{
                      width: `${widthPercent}%`
                    }}
                    className={`relative px-3 py-1 text-left transition-all group flex flex-col justify-center select-none overflow-hidden shrink-0 ${
                      isCurrent
                        ? 'bg-gradient-to-r from-amber-500/25 via-amber-500/15 to-amber-600/20 text-white shadow-md'
                        : 'bg-slate-900/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                    title={`${ep.name}\n${epStart}年 ~ ${epEnd}年 (时长: ${duration}年)\n${ep.description || ''}`}
                  >
                    {/* Active top line highlight */}
                    {isCurrent && (
                      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />
                    )}
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-bold truncate ${isCurrent ? 'text-amber-300 font-extrabold' : 'text-slate-300 group-hover:text-white'}`}>
                        {ep.name}
                      </span>
                      {isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                      <span>{epStart} ~ {epEnd}</span>
                      <span className="opacity-75">({duration}年)</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Total Timeline Track with Epoch Boundary Constraints */}
          <div className="px-6 py-2.5 bg-slate-950/90 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 select-none">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                总线起点: {totalMin} 年
              </span>
              <span className="text-slate-300 truncate">
                当前选中时期: <span className="text-amber-300 font-bold">{currentEpoch?.name || '未知时期'}</span>
                <span className="text-slate-500 mx-1.5">|</span>
                时期边界: <span className="text-slate-300 font-mono">{epochMin} ~ {epochMax}年</span>
                <span className="text-slate-500 mx-1.5">|</span>
                控制区间: <span className="text-cyan-300 font-bold font-mono">{clampedLeft}年</span>
                <span className="text-slate-500 mx-1">~</span>
                <span className="text-yellow-300 font-bold font-mono">{clampedRight}年</span>
                <span className="text-slate-400 ml-1">({clampedRight - clampedLeft}年)</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                总线终点: {totalMax} 年
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              </span>
            </div>

            <div
              ref={timelineTrackRef}
              onClick={handleTrackClick}
              className="relative w-full h-8 flex items-center cursor-pointer select-none py-2"
              title="拖动控制柄或点击轨道调整范围 (限制在当前时期内)"
            >
              {/* Total Inactive Base Track */}
              <div className="absolute w-full h-2 bg-slate-800/80 rounded-full border border-slate-700/60" />

              {/* Current Epoch Allowable Range Region Highlight */}
              <div
                className="absolute h-2 bg-slate-700/60 rounded-full border border-slate-600/40"
                style={{
                  left: `${epochLeftPercent}%`,
                  width: `${Math.max(0, epochRightPercent - epochLeftPercent)}%`
                }}
                title={`当前时期允许范围: ${epochMin} ~ ${epochMax}年`}
              />

              {/* Active Selected Range Gradient Highlight (Cyan to Yellow) */}
              <div
                className="absolute h-2 bg-gradient-to-r from-cyan-400 via-sky-400 to-yellow-400 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.4)]"
                style={{
                  left: `${leftPercent}%`,
                  width: `${Math.max(0, rightPercent - leftPercent)}%`
                }}
              />

              {/* Left Handle (Cyan Circle with Dark Center) */}
              <div
                role="slider"
                aria-label="时间轴左边界控制柄"
                aria-valuenow={clampedLeft}
                aria-valuemin={epochMin}
                aria-valuemax={clampedRight}
                tabIndex={0}
                onPointerDown={(e) => handlePointerDown('left', e)}
                onPointerMove={(e) => handlePointerMove('left', e)}
                onPointerUp={(e) => handlePointerUp('left', e)}
                style={{ left: `${leftPercent}%` }}
                className="absolute -translate-x-1/2 w-5 h-5 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-lg shadow-cyan-500/50 cursor-ew-resize flex items-center justify-center hover:scale-125 active:scale-130 transition-transform z-10 touch-none ring-2 ring-cyan-400/50"
                title={`左边界控制柄: ${clampedLeft}年 (当前时期下限: ${epochMin}年)`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
              </div>

              {/* Right Handle (Yellow Circle with Dark Center) */}
              <div
                role="slider"
                aria-label="时间轴右边界控制柄"
                aria-valuenow={clampedRight}
                aria-valuemin={clampedLeft}
                aria-valuemax={epochMax}
                tabIndex={0}
                onPointerDown={(e) => handlePointerDown('right', e)}
                onPointerMove={(e) => handlePointerMove('right', e)}
                onPointerUp={(e) => handlePointerUp('right', e)}
                style={{ left: `${rightPercent}%` }}
                className="absolute -translate-x-1/2 w-5 h-5 rounded-full bg-yellow-400 border-2 border-slate-950 shadow-lg shadow-yellow-500/50 cursor-ew-resize flex items-center justify-center hover:scale-125 active:scale-130 transition-transform z-10 touch-none ring-2 ring-yellow-400/50"
                title={`右边界控制柄: ${clampedRight}年 (当前时期上限: ${epochMax}年)`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
