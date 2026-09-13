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
import { reverseGeocode } from '../services/geoHierarchyService';
import {
  Compass,
  Clock,
  ChevronDown,
  ChevronUp,
  Palette,
  RotateCcw,
  Edit2,
  X,
  MapPin,
  Globe,
  Trash2,
  Check,
  ExternalLink,
  ChevronRight,
  Plus,
  Move
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

// ---------------------------------------------------------------------------
// Create/Edit Location Modal (Right-click "新建地点" / Edit dialog)
// ---------------------------------------------------------------------------
function CreateLocationModal({ data, currentEpoch, epochs, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    title: data.title || data.name || '',
    epochId: data.epochId || currentEpoch?.id || epochs[0]?.id || 'epoch-ancient',
    continent: data.continent || '亚洲',
    country: data.country || '',
    province: data.province || '',
    city: data.city || '',
    rawLng: data.rawLng ?? data.lng,
    rawLat: data.rawLat ?? data.lat,
    centerLng: data.centerLng ?? data.lng,
    centerLat: data.centerLat ?? data.lat,
    lng: data.lng,
    lat: data.lat,
    isSnappedToCenter: !!data.isSnappedToCenter,
    hierarchyText: data.hierarchyText || '',
    tag: data.tags?.[0] || data.tag || '据点',
    color: data.color || '#38bdf8',
    description: data.description || ''
  }));

  const handleToggleSnap = () => {
    setForm((prev) => {
      const nextSnapped = !prev.isSnappedToCenter;
      if (nextSnapped && typeof prev.centerLng === 'number' && typeof prev.centerLat === 'number') {
        return {
          ...prev,
          isSnappedToCenter: true,
          lng: prev.centerLng,
          lat: prev.centerLat
        };
      } else {
        return {
          ...prev,
          isSnappedToCenter: false,
          lng: prev.rawLng ?? prev.lng,
          lat: prev.rawLat ?? prev.lat
        };
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      alert('请填写地点名称');
      return;
    }
    onSave({
      ...data,
      id: data.id || `loc-${Date.now().toString(36)}`,
      name: form.title.trim(),
      title: form.title.trim(),
      epochId: form.epochId,
      continent: form.continent,
      country: form.country,
      province: form.province,
      city: form.city,
      lat: form.lat,
      lng: form.lng,
      centerLat: form.centerLat,
      centerLng: form.centerLng,
      isSnappedToCenter: form.isSnappedToCenter,
      hierarchyText: form.hierarchyText,
      tag: form.tag,
      tags: [form.tag],
      color: form.color,
      description: form.description.trim(),
      summary: form.description.trim()
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn select-text"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="h-14 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-950/60 select-none">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {data.id ? '编辑地图地点' : '在当前右键坐标新建地点'}
              </h3>
              <p className="text-[11px] text-slate-400">
                已自动根据经纬度反查推算地理隶属层级
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* 4-Level Full Hierarchy Display Banner */}
          <div className="bg-gradient-to-r from-sky-950/60 via-indigo-950/40 to-slate-950/60 border border-sky-500/30 p-3 rounded-xl space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-sky-400 flex items-center gap-1 tracking-wider">
              <Globe className="w-3 h-3" /> 逆地理编码推算结果 (大洲 - 国家 - 省份/城市 - 经纬度)
            </div>
            <div className="flex items-center gap-1.5 flex-wrap font-semibold text-slate-100">
              <span className="px-2 py-0.5 rounded bg-sky-900/60 text-sky-200 border border-sky-700/50">
                {form.continent || '未知大洲'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-200 border border-indigo-700/50">
                {form.country || '公海 / 未知水域'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                {form.province || form.city || '未指定省市'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-[11px] border border-amber-500/40">
                [{Number(form.lng).toFixed(4)}°, {Number(form.lat).toFixed(4)}°]
              </span>
            </div>
          </div>

          {/* Location Name & Epoch Selection Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-300 mb-1">
                地点名称 <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例如：以太帝都·天穹圣座"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                所属历史纪元时期 <span className="text-rose-400">*</span>
              </label>
              <select
                value={form.epochId}
                onChange={(e) => setForm({ ...form, epochId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
              >
                {epochs.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.name} ({ep.timeRange?.[0]} ~ {ep.timeRange?.[1]}年)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Coordinate Snapping Toggle Box */}
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Compass className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="text-slate-200 font-medium">经纬度吸附控制</div>
                <div className="text-[10px] text-slate-400">
                  {form.isSnappedToCenter
                    ? `已吸附至行政中心: [${form.centerLng}°, ${form.centerLat}°]`
                    : `保持右键点击的精确坐标: [${form.rawLng}°, ${form.rawLat}°]`}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleSnap}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5 ${
                form.isSnappedToCenter
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {form.isSnappedToCenter ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>已吸附中心</span>
                </>
              ) : (
                <span>吸附至地点中心</span>
              )}
            </button>
          </div>

          {/* Tag & Color Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-300 mb-1">据点类型标签</label>
              <select
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="据点">据点</option>
                <option value="帝国首都">帝国首都</option>
                <option value="远古遗迹">远古遗迹</option>
                <option value="军事要塞">军事要塞</option>
                <option value="自由港口">自由港口</option>
                <option value="神圣教会">神圣教会</option>
                <option value="秘境禁地">秘境禁地</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">标记标识颜色</label>
              <div className="flex items-center gap-1.5 pt-1">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    style={{ backgroundColor: color }}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      form.color === color
                        ? 'scale-115 ring-2 ring-white ring-offset-2 ring-offset-slate-900 shadow-sm'
                        : 'opacity-80 hover:opacity-100 hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Description Textarea */}
          <div>
            <label className="block font-medium text-slate-300 mb-1">
              简要设定与剧情描述
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="记录该地点在当前历史时期的势力背景、故事伏笔或地理风貌..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800 select-none">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold shadow-md shadow-sky-500/20 transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>确立并保存地点</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Singleton Location Detail Popover on Map
// ---------------------------------------------------------------------------
function LocationDetailCard({ location, currentEpoch, onClose, onEdit, onMove, onDelete, onOpenDatabase }) {
  if (!location) return null;
  const themeColor = location.color || '#38bdf8';

  return (
    <div className="absolute top-16 right-6 z-30 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-4 text-xs text-slate-200 select-none animate-fadeIn space-y-3">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ backgroundColor: themeColor }} />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 pt-1">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
            style={{ backgroundColor: themeColor }}
          >
            <MapPin className="w-4 h-4 drop-shadow" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
              <span>{location.name || location.title}</span>
            </h4>
            <span className="text-[10px] text-amber-300 font-medium">
              {currentEpoch?.name || '当前时期'}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 4-Level Full Hierarchy Display */}
      <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800 space-y-1">
        <div className="text-[11px] text-sky-300 font-semibold flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="truncate">
            {location.hierarchyText || [location.continent, location.country, location.province || location.city].filter(Boolean).join(' · ')}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>坐标: [{Number(location.lng).toFixed(4)}°, {Number(location.lat).toFixed(4)}°]</span>
          {location.isSnappedToCenter && (
            <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
              中心吸附
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-slate-300 leading-relaxed max-h-24 overflow-y-auto">
        {location.description || location.summary || '暂无详细设定描述...'}
      </p>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
        <button
          onClick={() => onOpenDatabase(location)}
          className="flex-1 flex items-center justify-center gap-1.5 bg-sky-600/30 hover:bg-sky-600 text-sky-200 hover:text-white py-1.5 px-2.5 rounded-xl border border-sky-500/40 transition-colors font-medium shadow-sm text-[11px]"
          title="在资料库地点档案中查看并编辑完整 Markdown 设定"
        >
          <ExternalLink className="w-3 h-3" />
          <span>资料库中打开</span>
        </button>

        <button
          onClick={() => onEdit(location)}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors"
          title="编辑此地点"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onMove(location)}
          className="p-1.5 bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors"
          title="移动此地点 (在地图重新放置)"
        >
          <Move className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onDelete(location)}
          className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors"
          title="删除此地点"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right-Click Context Menu for Map & Locations
// ---------------------------------------------------------------------------
function MapContextMenu({
  contextMenu,
  selectedLocation,
  movingLocation,
  onClose,
  onCreate,
  onEdit,
  onStartMove,
  onExecuteMove,
  onDelete,
  onOpenDatabase
}) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ x: contextMenu.x, y: contextMenu.y });

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const padding = 12;
      let x = contextMenu.x;
      let y = contextMenu.y;

      if (x + rect.width > window.innerWidth - padding) {
        x = Math.max(padding, window.innerWidth - rect.width - padding);
      }
      if (y + rect.height > window.innerHeight - padding) {
        y = Math.max(padding, window.innerHeight - rect.height - padding);
      }
      setPos({ x, y });
    }
  }, [contextMenu.x, contextMenu.y]);

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [onClose]);

  const target = contextMenu.targetLocation;
  const activeLoc = target || movingLocation || selectedLocation;

  return (
    <div
      ref={menuRef}
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      className="fixed z-50 min-w-[210px] max-w-[280px] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl p-1.5 text-xs text-slate-200 select-none animate-scaleUp"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      {target ? (
        <div className="px-2.5 py-1.5 mb-1.5 bg-slate-950/70 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-2 font-bold text-white truncate">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
              style={{ backgroundColor: target.color || '#38bdf8' }}
            />
            <span className="truncate">{target.name || target.title}</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800 shrink-0 font-normal">
              {target.tag || '地点'}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
            {target.hierarchyText || [target.continent, target.country, target.province].filter(Boolean).join(' · ')}
          </div>
          <div className="text-[9px] text-slate-500 font-mono">
            [{Number(target.lng).toFixed(4)}°, {Number(target.lat).toFixed(4)}°]
          </div>
        </div>
      ) : (
        <div className="px-2.5 py-1.5 mb-1.5 bg-slate-950/70 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-400">
            <Compass className="w-3 h-3 text-sky-400 shrink-0" />
            <span>地图坐标点</span>
          </div>
          <div className="text-[10px] text-slate-300 font-medium truncate mt-0.5">
            {contextMenu.geoInfo?.hierarchyText || `${contextMenu.geoInfo?.country || '公海'} · ${contextMenu.geoInfo?.province || ''}`}
          </div>
          <div className="text-[9px] text-slate-500 font-mono">
            [{Number(contextMenu.lng).toFixed(4)}°, {Number(contextMenu.lat).toFixed(4)}°]
          </div>
        </div>
      )}

      {/* Menu Actions */}
      <div className="space-y-0.5">
        {/* 1. Create Location Here */}
        <button
          onClick={() => {
            onCreate({
              lng: contextMenu.lng,
              lat: contextMenu.lat,
              geoInfo: contextMenu.geoInfo
            });
            onClose();
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-200 hover:text-white hover:bg-sky-600/25 transition-colors group"
        >
          <Plus className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform shrink-0" />
          <span className="flex-1 font-medium">在此处新建地点</span>
        </button>

        {/* 2. Relocate to Here */}
        {!target && activeLoc && (
          <button
            onClick={() => {
              onExecuteMove(activeLoc, {
                lng: contextMenu.lng,
                lat: contextMenu.lat,
                geoInfo: contextMenu.geoInfo
              });
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-cyan-300 hover:text-white hover:bg-cyan-600/30 transition-colors group border border-cyan-500/30 bg-cyan-950/30"
          >
            <Move className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
            <span className="flex-1 font-medium truncate">
              将「{activeLoc.name || activeLoc.title}」移动到此处
            </span>
          </button>
        )}

        {/* 3. Edit Location */}
        {activeLoc && (
          <button
            onClick={() => {
              onEdit(activeLoc);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-200 hover:text-white hover:bg-slate-800 transition-colors group"
          >
            <Edit2 className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
            <span className="flex-1 font-medium truncate">
              {target ? '编辑此地点' : `编辑已选地点「${activeLoc.name || activeLoc.title}」`}
            </span>
          </button>
        )}

        {/* 4. Move Location */}
        {target && (
          <button
            onClick={() => {
              onStartMove(target);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-200 hover:text-white hover:bg-slate-800 transition-colors group"
          >
            <Move className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
            <span className="flex-1 font-medium">移动此地点 (在地图重放)</span>
          </button>
        )}

        {/* 5. Delete Location */}
        {activeLoc && (
          <button
            onClick={() => {
              onDelete(activeLoc);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-400 hover:text-rose-200 hover:bg-rose-600/20 transition-colors group"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform shrink-0" />
            <span className="flex-1 font-medium truncate">
              {target ? '删除此地点' : `删除已选地点「${activeLoc.name || activeLoc.title}」`}
            </span>
          </button>
        )}

        {/* 6. Open in Database */}
        {activeLoc && (
          <>
            <div className="h-px bg-slate-800 my-1" />
            <button
              onClick={() => {
                onOpenDatabase(activeLoc);
                onClose();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-300 hover:text-white hover:bg-slate-800 transition-colors group"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="flex-1">在资料库中打开</span>
            </button>
          </>
        )}
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

  const saveEpochLocation = useStoryStore((s) => s.saveEpochLocation);
  const deleteEpochLocation = useStoryStore((s) => s.deleteEpochLocation);
  const selectedMapLocationId = useStoryStore((s) => s.selectedMapLocationId);
  const setSelectedMapLocationId = useStoryStore((s) => s.setSelectedMapLocationId);
  const setActiveDatabaseCategory = useStoryStore((s) => s.setActiveDatabaseCategory);

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

  // Location card and creation modal states
  const [creatingLocationData, setCreatingLocationData] = useState(null);
  const [activeLocationCard, setActiveLocationCard] = useState(null);
  const locationMarkersRef = useRef([]);

  // Context menu and moving mode states
  const [contextMenu, setContextMenu] = useState(null);
  const [movingLocation, setMovingLocation] = useState(null);
  const movingLocationRef = useRef(movingLocation);
  movingLocationRef.current = movingLocation;

  // Change canvas cursor during moving mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    try {
      const canvas = map.getCanvas();
      if (canvas) {
        canvas.style.cursor = movingLocation ? 'crosshair' : '';
      }
    } catch (e) {
      // ignore
    }
  }, [movingLocation]);

  // ESC key listener to cancel moving mode or dismiss context menu
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (contextMenu) setContextMenu(null);
        if (movingLocation) setMovingLocation(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu, movingLocation]);

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

  // Selected location object from active epoch
  const selectedLocation = useMemo(() => {
    if (!selectedMapLocationId || !currentEpoch?.locations) return null;
    return currentEpoch.locations.find((l) => l.id === selectedMapLocationId) || null;
  }, [selectedMapLocationId, currentEpoch?.locations]);

  const handleCreateLocationAt = useCallback(({ lng, lat, geoInfo }) => {
    const clickedLng = parseFloat(lng.toFixed(4));
    const clickedLat = parseFloat(lat.toFixed(4));
    const gInfo = geoInfo || reverseGeocode(clickedLng, clickedLat);
    const centerLng = parseFloat((gInfo.centerLng ?? clickedLng).toFixed(4));
    const centerLat = parseFloat((gInfo.centerLat ?? clickedLat).toFixed(4));
    const suggestedName = gInfo.province || gInfo.country || '新建立地点';

    setCreatingLocationData({
      title: suggestedName,
      name: suggestedName,
      epochId: currentEpochRef.current?.id || 'epoch-ancient',
      continent: gInfo.continent,
      country: gInfo.country,
      province: gInfo.province,
      city: gInfo.city,
      rawLng: clickedLng,
      rawLat: clickedLat,
      lng: clickedLng,
      lat: clickedLat,
      centerLng: centerLng,
      centerLat: centerLat,
      isSnappedToCenter: false,
      hierarchyText: gInfo.hierarchyText,
      tags: ['据点'],
      tag: '据点',
      color: '#38bdf8',
      description: '',
      summary: ''
    });
  }, []);

  const handleEditLocation = useCallback((loc) => {
    if (!loc) return;
    setActiveLocationCard(null);
    setCreatingLocationData({
      ...loc,
      title: loc.name || loc.title,
      tag: loc.tags?.[0] || loc.tag || '据点'
    });
  }, []);

  const handleStartMove = useCallback((loc) => {
    if (!loc) return;
    setActiveLocationCard(null);
    setMovingLocation(loc);
  }, []);

  const handleExecuteMove = useCallback(
    async (locToMove, { lng, lat, geoInfo }) => {
      if (!locToMove) return;
      const targetLng = parseFloat(lng.toFixed(4));
      const targetLat = parseFloat(lat.toFixed(4));
      const targetGeo = geoInfo || reverseGeocode(targetLng, targetLat);

      const updatedLoc = {
        ...locToMove,
        lng: targetLng,
        lat: targetLat,
        rawLng: targetLng,
        rawLat: targetLat,
        continent: targetGeo.continent || locToMove.continent,
        country: targetGeo.country || locToMove.country,
        province: targetGeo.province || locToMove.province,
        city: targetGeo.city || locToMove.city,
        hierarchyText: targetGeo.hierarchyText || locToMove.hierarchyText,
        centerLng: targetGeo.centerLng ?? targetLng,
        centerLat: targetGeo.centerLat ?? targetLat,
        isSnappedToCenter: false
      };

      const targetEpochId = locToMove.epochId || currentEpochRef.current?.id || 'epoch-ancient';
      await saveEpochLocation(targetEpochId, updatedLoc);
      setMovingLocation(null);
      setSelectedMapLocationId(updatedLoc.id);
      setActiveLocationCard(updatedLoc);
    },
    [saveEpochLocation, setSelectedMapLocationId]
  );

  const handleExecuteMoveRef = useRef(handleExecuteMove);
  handleExecuteMoveRef.current = handleExecuteMove;

  const handleDeleteLocation = useCallback(
    async (loc) => {
      if (!loc) return;
      if (confirm(`确定要删除地点“${loc.name || loc.title}”吗？`)) {
        const targetEpochId = loc.epochId || currentEpochRef.current?.id || 'epoch-ancient';
        await deleteEpochLocation(targetEpochId, loc.id);
        setActiveLocationCard(null);
        setSelectedMapLocationId(null);
        if (movingLocationRef.current?.id === loc.id) {
          setMovingLocation(null);
        }
      }
    },
    [deleteEpochLocation, setSelectedMapLocationId]
  );

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

    // Map-level click (for placing moving location, closing context menu, and plate editing deselection)
    map.on('click', (e) => {
      setContextMenu(null);

      // If in moving mode, drop the moving location at this position
      if (movingLocationRef.current) {
        const loc = movingLocationRef.current;
        const { lng, lat } = e.lngLat;
        let normalizedLng = (lng + 180) % 360;
        if (normalizedLng < 0) normalizedLng += 360;
        normalizedLng -= 180;
        const normalizedLat = Math.max(-85, Math.min(85, lat));
        const targetLng = parseFloat(normalizedLng.toFixed(4));
        const targetLat = parseFloat(normalizedLat.toFixed(4));
        const geoInfo = reverseGeocode(targetLng, targetLat);

        handleExecuteMoveRef.current?.(loc, {
          lng: targetLng,
          lat: targetLat,
          geoInfo
        });
        return;
      }

      if (e.originalEvent?._plateClicked) return;
      hideHoverPlateRef.current?.();
      setEditingPlateTarget(null);
    });

    map.on('zoomstart', () => {
      hideHoverPlateRef.current?.();
      setContextMenu(null);
    });

    map.on('movestart', () => {
      setContextMenu(null);
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

    // Right-click contextmenu handler for summoning custom context menu
    map.on('contextmenu', (e) => {
      e.preventDefault();
      const { lng, lat } = e.lngLat;
      let normalizedLng = (lng + 180) % 360;
      if (normalizedLng < 0) normalizedLng += 360;
      normalizedLng -= 180;
      const normalizedLat = Math.max(-85, Math.min(85, lat));

      const clickedLng = parseFloat(normalizedLng.toFixed(4));
      const clickedLat = parseFloat(normalizedLat.toFixed(4));
      const geoInfo = reverseGeocode(clickedLng, clickedLat);

      setContextMenu({
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        lng: clickedLng,
        lat: clickedLat,
        geoInfo,
        targetLocation: null
      });
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

  // Synchronize MapLibre Markers for currentEpoch.locations
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoadedRef.current) return;

    // Remove old markers
    locationMarkersRef.current.forEach((marker) => marker.remove());
    locationMarkersRef.current = [];

    const locations = currentEpoch?.locations || [];

    locations.forEach((loc) => {
      if (typeof loc.lng !== 'number' || typeof loc.lat !== 'number') return;

      const el = document.createElement('div');
      el.className = 'location-marker-pin group relative cursor-pointer select-none';
      el.style.width = '28px';
      el.style.height = '36px';

      const isSelected = selectedMapLocationId === loc.id;
      const markerColor = loc.color || '#38bdf8';

      el.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <div style="width: 28px; height: 28px; border-radius: 50%; background-color: ${markerColor}; border: 2px solid #ffffff; box-shadow: 0 0 10px ${markerColor}, 0 2px 6px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; transform: ${isSelected ? 'scale(1.25)' : 'scale(1)'}; transition: transform 0.2s ease;">
            <svg style="width: 14px; height: 14px; fill: white;" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
          <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid ${markerColor}; margin-top: -1px;"></div>
          <div style="position: absolute; bottom: 32px; background: rgba(15, 23, 42, 0.92); color: #f8fafc; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.4); white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.5); pointer-events: none;">
            ${loc.name || loc.title || '据点'}
          </div>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setContextMenu(null);
        if (movingLocationRef.current) {
          const locToMove = movingLocationRef.current;
          const geoInfo = reverseGeocode(loc.lng, loc.lat);
          handleExecuteMoveRef.current?.(locToMove, {
            lng: loc.lng,
            lat: loc.lat,
            geoInfo
          });
          return;
        }
        setSelectedMapLocationId(loc.id);
        setActiveLocationCard(loc);
      });

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const geoInfo = reverseGeocode(loc.lng, loc.lat);
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          lng: loc.lng,
          lat: loc.lat,
          geoInfo,
          targetLocation: loc
        });
      });

      try {
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([loc.lng, loc.lat])
          .addTo(map);

        locationMarkersRef.current.push(marker);
      } catch (err) {
        console.warn('Failed to add location marker:', err);
      }
    });
  }, [currentEpoch, currentEpoch?.locations, selectedMapLocationId, setSelectedMapLocationId]);

  // Fly to location when selected
  useEffect(() => {
    if (!selectedMapLocationId || !mapInstanceRef.current || !isMapLoadedRef.current) return;
    const loc = currentEpoch?.locations?.find((l) => l.id === selectedMapLocationId);
    if (loc && typeof loc.lng === 'number' && typeof loc.lat === 'number') {
      setActiveLocationCard(loc);
      mapInstanceRef.current.flyTo({
        center: [loc.lng, loc.lat],
        zoom: Math.max(mapInstanceRef.current.getZoom(), 5.5),
        speed: 1.2,
        curve: 1.42,
        essential: true
      });
    }
  }, [selectedMapLocationId, currentEpoch]);

  const handleOpenDatabaseForLocation = (loc) => {
    setActiveLocationCard(null);
    setSelectedMapLocationId(loc.id);
    setActiveDatabaseCategory('locations');
    setActiveWorkspace('database');
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

        {/* Moving Mode Top Alert Banner */}
        {movingLocation && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-amber-950/90 border border-amber-500/60 backdrop-blur-md px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3 animate-fadeIn select-none">
            <Move className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
            <span className="text-xs text-amber-200">
              正在移动地点 <strong className="text-white font-bold">“{movingLocation.name || movingLocation.title}”</strong>：请在地图目标位置<span className="text-amber-400 font-bold underline underline-offset-2">单击</span>放置（或按 ESC 取消）
            </span>
            <button
              onClick={() => setMovingLocation(null)}
              className="text-xs px-2.5 py-1 rounded-lg bg-amber-900/80 hover:bg-amber-800 text-amber-100 hover:text-white border border-amber-700/60 transition-colors font-medium ml-2"
            >
              取消移动 (ESC)
            </button>
          </div>
        )}

        {/* Selected Location Card Popover on Map */}
        {activeLocationCard && (
          <LocationDetailCard
            location={activeLocationCard}
            currentEpoch={currentEpoch}
            onClose={() => {
              setActiveLocationCard(null);
              setSelectedMapLocationId(null);
            }}
            onEdit={handleEditLocation}
            onMove={handleStartMove}
            onDelete={handleDeleteLocation}
            onOpenDatabase={handleOpenDatabaseForLocation}
          />
        )}

        {/* Right-Click Context Menu */}
        {contextMenu && (
          <MapContextMenu
            contextMenu={contextMenu}
            selectedLocation={selectedLocation}
            movingLocation={movingLocation}
            onClose={() => setContextMenu(null)}
            onCreate={handleCreateLocationAt}
            onEdit={handleEditLocation}
            onStartMove={handleStartMove}
            onExecuteMove={handleExecuteMove}
            onDelete={handleDeleteLocation}
            onOpenDatabase={handleOpenDatabaseForLocation}
          />
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

      {creatingLocationData && (
        <CreateLocationModal
          data={creatingLocationData}
          currentEpoch={currentEpoch}
          epochs={epochs}
          onClose={() => setCreatingLocationData(null)}
          onSave={async (locData) => {
            await saveEpochLocation(locData.epochId, locData);
            setCreatingLocationData(null);
            setActiveLocationCard(locData);
            setSelectedMapLocationId(locData.id);
          }}
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
