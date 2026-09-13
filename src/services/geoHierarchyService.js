import {
  getPreloadedContinentsGeo,
  getPreloadedCountries,
  getPreloadedProvinces,
  getPreloadedCountryLabels,
  getPreloadedProvinceLabels,
  getPreloadedContinents
} from './geoPreloader';

// Point-in-polygon ray casting algorithm
function pointInPolygon(pt, ring) {
  let inside = false;
  const x = pt[0], y = pt[1];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInMultiPolygon(pt, coordinates) {
  for (const poly of coordinates) {
    if (pointInPolygon(pt, poly[0])) return true;
  }
  return false;
}

// Country -> Continent mapping dictionary
const KNOWN_COUNTRY_CONTINENTS = {
  // Asia
  '中国': '亚洲', 'China': '亚洲', '日本': '亚洲', 'Japan': '亚洲',
  '韩国': '亚洲', 'South Korea': '亚洲', '朝鲜': '亚洲', 'North Korea': '亚洲',
  '印度': '亚洲', 'India': '亚洲', '印度尼西亚': '亚洲', 'Indonesia': '亚洲',
  '越南': '亚洲', 'Vietnam': '亚洲', '泰国': '亚洲', 'Thailand': '亚洲',
  '马来西亚': '亚洲', 'Malaysia': '亚洲', '新加坡': '亚洲', 'Singapore': '亚洲',
  '菲律宾': '亚洲', 'Philippines': '亚洲', '缅甸': '亚洲', 'Myanmar': '亚洲',
  '蒙古': '亚洲', 'Mongolia': '亚洲', '沙特阿拉伯': '亚洲', 'Saudi Arabia': '亚洲',
  '阿拉伯联合酋长国': '亚洲', 'United Arab Emirates': '亚洲', '阿联酋': '亚洲',
  '土耳其': '亚洲', 'Turkey': '亚洲', '以色列': '亚洲', 'Israel': '亚洲',
  '伊朗': '亚洲', 'Iran': '亚洲', '伊拉克': '亚洲', 'Iraq': '亚洲',
  '哈萨克斯坦': '亚洲', 'Kazakhstan': '亚洲', '乌兹别克斯坦': '亚洲', 'Uzbekistan': '亚洲',
  '巴基斯坦': '亚洲', 'Pakistan': '亚洲', '阿富汗': '亚洲', 'Afghanistan': '亚洲',

  // Europe
  '俄罗斯': '欧洲', 'Russia': '欧洲', '英国': '欧洲', 'United Kingdom': '欧洲',
  '法国': '欧洲', 'France': '欧洲', '德国': '欧洲', 'Germany': '欧洲',
  '意大利': '欧洲', 'Italy': '欧洲', '西班牙': '欧洲', 'Spain': '欧洲',
  '葡萄牙': '欧洲', 'Portugal': '欧洲', '荷兰': '欧洲', 'Netherlands': '欧洲',
  '比利时': '欧洲', 'Belgium': '欧洲', '瑞士': '欧洲', 'Switzerland': '欧洲',
  '瑞典': '欧洲', 'Sweden': '欧洲', '挪威': '欧洲', 'Norway': '欧洲',
  '丹麦': '欧洲', 'Denmark': '欧洲', '芬兰': '欧洲', 'Finland': '欧洲',
  '波兰': '欧洲', 'Poland': '欧洲', '希腊': '欧洲', 'Greece': '欧洲',
  '乌克兰': '欧洲', 'Ukraine': '欧洲', '爱尔兰': '欧洲', 'Ireland': '欧洲',
  '奥地利': '欧洲', 'Austria': '欧洲', '捷克': '欧洲', 'Czechia': '欧洲',
  '匈牙利': '欧洲', 'Hungary': '欧洲', '罗马尼亚': '欧洲', 'Romania': '欧洲',
  '保加利亚': '欧洲', 'Bulgaria': '欧洲', '塞尔维亚': '欧洲', 'Serbia': '欧洲',
  '克罗地亚': '欧洲', 'Croatia': '欧洲', '塞浦路斯': '欧洲', 'Cyprus': '欧洲',
  '梵蒂冈': '欧洲', 'Vatican': '欧洲', '摩纳哥': '欧洲', 'Monaco': '欧洲',

  // North America
  '美国': '北美洲', 'United States of America': '北美洲', 'USA': '北美洲',
  '加拿大': '北美洲', 'Canada': '北美洲', '墨西哥': '北美洲', 'Mexico': '北美洲',
  '古巴': '北美洲', 'Cuba': '北美洲', '海地': '北美洲', 'Haiti': '北美洲',
  '多米尼加': '北美洲', 'Dominican Rep.': '北美洲', '牙买加': '北美洲', 'Jamaica': '北美洲',
  '巴拿马': '北美洲', 'Panama': '北美洲', '哥斯达黎加': '北美洲', 'Costa Rica': '北美洲',
  '危地马拉': '北美洲', 'Guatemala': '北美洲', '洪都拉斯': '北美洲', 'Honduras': '北美洲',
  '格陵兰': '北美洲', 'Greenland': '北美洲',

  // South America
  '巴西': '南美洲', 'Brazil': '南美洲', '阿根廷': '南美洲', 'Argentina': '南美洲',
  '智利': '南美洲', 'Chile': '南美洲', '哥伦比亚': '南美洲', 'Colombia': '南美洲',
  '秘鲁': '南美洲', 'Peru': '南美洲', '委内瑞拉': '南美洲', 'Venezuela': '南美洲',
  '厄瓜多尔': '南美洲', 'Ecuador': '南美洲', '玻利维亚': '南美洲', 'Bolivia': '南美洲',
  '乌拉圭': '南美洲', 'Uruguay': '南美洲', '巴拉圭': '南美洲', 'Paraguay': '南美洲',

  // Africa
  '埃及': '非洲', 'Egypt': '非洲', '南非': '非洲', 'South Africa': '非洲',
  '尼日利亚': '非洲', 'Nigeria': '非洲', '肯尼亚': '非洲', 'Kenya': '非洲',
  '埃塞俄比亚': '非洲', 'Ethiopia': '非洲', '阿尔及利亚': '非洲', 'Algeria': '非洲',
  '摩洛哥': '非洲', 'Morocco': '非洲', '突尼斯': '非洲', 'Tunisia': '非洲',
  '加纳': '非洲', 'Ghana': '非洲', '塞内加尔': '非洲', 'Senegal': '非洲',
  '冈比亚': '非洲', 'Gambia': '非洲', '马达加斯加': '非洲', 'Madagascar': '非洲',
  '苏丹': '非洲', 'Sudan': '非洲', '刚果': '非洲', 'Congo': '非洲',

  // Oceania
  '澳大利亚': '大洋洲', 'Australia': '大洋洲', '新西兰': '大洋洲', 'New Zealand': '大洋洲',
  '巴布亚新几内亚': '大洋洲', 'Papua New Guinea': '大洋洲', '斐济': '大洋洲', 'Fiji': '大洋洲',

  // Antarctica
  '南极洲': '南极洲', 'Antarctica': '南极洲'
};

// Cached Spatial Index BBoxes for 0.1ms rapid pruning
let cachedProvinceBBoxes = null;
let cachedCountryBBoxes = null;

function buildBBoxes(features) {
  if (!Array.isArray(features)) return [];
  return features.map((f) => {
    let minX = 180, maxX = -180, minY = 90, maxY = -90;
    const checkRing = (ring) => {
      if (!Array.isArray(ring)) return;
      for (const pt of ring) {
        if (!pt || pt.length < 2) continue;
        const [x, y] = pt;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    };
    const geom = f.geometry;
    if (!geom) return null;
    if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
      checkRing(geom.coordinates[0]);
    } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
      for (const poly of geom.coordinates) {
        if (Array.isArray(poly)) checkRing(poly[0]);
      }
    }
    return { feature: f, minX, maxX, minY, maxY };
  }).filter(Boolean);
}

// Get continent name for a country
export function getContinentForCountry(countryName) {
  if (!countryName) return '未知大洲';
  if (KNOWN_COUNTRY_CONTINENTS[countryName]) {
    return KNOWN_COUNTRY_CONTINENTS[countryName];
  }
  // Try substring match in known map
  for (const [k, cont] of Object.entries(KNOWN_COUNTRY_CONTINENTS)) {
    if (countryName.includes(k) || k.includes(countryName)) {
      return cont;
    }
  }
  return '未知大洲';
}

// Detect continent by polygon point-in-polygon
export function detectContinentByPoint(lng, lat) {
  const continentsGeo = getPreloadedContinentsGeo();
  if (!continentsGeo || !Array.isArray(continentsGeo.features)) return null;

  const pt = [lng, lat];
  for (const f of continentsGeo.features) {
    const geom = f.geometry;
    if (!geom) continue;
    if (geom.type === 'Polygon' && pointInPolygon(pt, geom.coordinates[0])) {
      return f.properties?.name || null;
    }
    if (geom.type === 'MultiPolygon' && pointInMultiPolygon(pt, geom.coordinates)) {
      return f.properties?.name || null;
    }
  }
  return null;
}

// Core Reverse Geocoding API: converts [lng, lat] into full hierarchy in < 1ms
export function reverseGeocode(lng, lat) {
  const parsedLng = Number(lng);
  const parsedLat = Number(lat);

  if (isNaN(parsedLng) || isNaN(parsedLat)) {
    return {
      continent: '未知大洲',
      country: '未知国家',
      province: '未知区域',
      city: '',
      centerLat: 0,
      centerLng: 0,
      inputLat: 0,
      inputLng: 0,
      isOcean: true,
      hierarchyText: '未知领域'
    };
  }

  const provinces = getPreloadedProvinces();
  const countries = getPreloadedCountries();
  const provinceLabels = getPreloadedProvinceLabels() || [];
  const countryLabels = getPreloadedCountryLabels() || [];

  // Build / retrieve bounding box indices
  if (!cachedProvinceBBoxes && provinces?.features) {
    cachedProvinceBBoxes = buildBBoxes(provinces.features);
  }
  if (!cachedCountryBBoxes && countries?.features) {
    cachedCountryBBoxes = buildBBoxes(countries.features);
  }

  const pt = [parsedLng, parsedLat];

  // 1. Check Provinces (Level 3 - finest granularity)
  let matchedProvinceProp = null;
  if (cachedProvinceBBoxes) {
    const candidates = cachedProvinceBBoxes.filter(
      (b) => parsedLng >= b.minX && parsedLng <= b.maxX && parsedLat >= b.minY && parsedLat <= b.maxY
    );
    for (const b of candidates) {
      const geom = b.feature.geometry;
      if (geom.type === 'Polygon' && pointInPolygon(pt, geom.coordinates[0])) {
        matchedProvinceProp = b.feature.properties;
        break;
      }
      if (geom.type === 'MultiPolygon' && pointInMultiPolygon(pt, geom.coordinates)) {
        matchedProvinceProp = b.feature.properties;
        break;
      }
    }
  }

  // 2. Check Countries (Level 2)
  let matchedCountryProp = null;
  if (cachedCountryBBoxes) {
    const candidates = cachedCountryBBoxes.filter(
      (b) => parsedLng >= b.minX && parsedLng <= b.maxX && parsedLat >= b.minY && parsedLat <= b.maxY
    );
    for (const b of candidates) {
      const geom = b.feature.geometry;
      if (geom.type === 'Polygon' && pointInPolygon(pt, geom.coordinates[0])) {
        matchedCountryProp = b.feature.properties;
        break;
      }
      if (geom.type === 'MultiPolygon' && pointInMultiPolygon(pt, geom.coordinates)) {
        matchedCountryProp = b.feature.properties;
        break;
      }
    }
  }

  // 3. Resolve Country & Province names
  let provinceName = matchedProvinceProp?.name || matchedProvinceProp?.name_local || matchedProvinceProp?.name_en || '';
  let countryName = matchedProvinceProp?.country || matchedProvinceProp?.admin || matchedCountryProp?.name || matchedCountryProp?.country || '';

  // 4. Resolve Center Coordinates
  let centerLat = parsedLat;
  let centerLng = parsedLng;
  let matchedLabel = null;

  if (provinceName && provinceLabels.length) {
    matchedLabel = provinceLabels.find(
      (p) => (matchedProvinceProp?.id && p.id === matchedProvinceProp.id) || p.name === provinceName || p.name_en === matchedProvinceProp?.name_en
    );
  }
  if (!matchedLabel && countryName && countryLabels.length) {
    matchedLabel = countryLabels.find(
      (c) => (matchedCountryProp?.id && c.id === matchedCountryProp.id) || c.name === countryName || c.country === countryName
    );
  }

  if (matchedLabel && typeof matchedLabel.lat === 'number' && typeof matchedLabel.lng === 'number') {
    centerLat = matchedLabel.lat;
    centerLng = matchedLabel.lng;
  }

  // 5. Resolve Continent
  let continentName = detectContinentByPoint(parsedLng, parsedLat);
  if (!continentName && countryName) {
    continentName = getContinentForCountry(countryName);
  }
  if (!continentName) {
    // Nearest continent centroid
    const continentsMeta = getPreloadedContinents();
    if (continentsMeta?.continents) {
      let minDist = Infinity;
      for (const cm of continentsMeta.continents) {
        const d = Math.hypot(parsedLng - cm.lng, parsedLat - cm.lat);
        if (d < minDist) {
          minDist = d;
          continentName = cm.name;
        }
      }
    }
  }

  const isOcean = !matchedProvinceProp && !matchedCountryProp;
  if (isOcean && !countryName) {
    countryName = '大洋海域 / 未知水域';
  }

  const hierarchyParts = [continentName || '未知大洲', countryName];
  if (provinceName && provinceName !== countryName) {
    hierarchyParts.push(provinceName);
  }
  const hierarchyText = hierarchyParts.join(' · ');

  return {
    continent: continentName || '未知大洲',
    country: countryName || '公海 / 未知领地',
    province: provinceName || '',
    city: provinceName || '',
    centerLat,
    centerLng,
    inputLat: parsedLat,
    inputLng: parsedLng,
    isOcean,
    hierarchyText
  };
}

// Search provinces and countries by keyword
export function searchAdministrativeDivisions(keyword) {
  const query = (keyword || '').trim().toLowerCase();
  if (!query) return [];

  const provinceLabels = getPreloadedProvinceLabels() || [];
  const countryLabels = getPreloadedCountryLabels() || [];
  const results = [];

  // Match provinces
  for (const p of provinceLabels) {
    const nameMatch = (p.name || '').toLowerCase().includes(query);
    const enMatch = (p.name_en || '').toLowerCase().includes(query);
    const ctryMatch = (p.country || '').toLowerCase().includes(query);

    if (nameMatch || enMatch || ctryMatch) {
      const continent = getContinentForCountry(p.country || p.admin);
      results.push({
        id: p.id,
        name: p.name || p.name_en,
        nameEn: p.name_en || '',
        country: p.country || p.admin,
        continent,
        type: 'province',
        lat: p.lat,
        lng: p.lng,
        hierarchyText: `${continent} · ${p.country || p.admin} · ${p.name || p.name_en}`
      });
      if (results.length >= 12) break;
    }
  }

  // Match countries if results still small
  if (results.length < 8) {
    for (const c of countryLabels) {
      const nameMatch = (c.name || '').toLowerCase().includes(query);
      const enMatch = (c.name_en || '').toLowerCase().includes(query);
      if (nameMatch || enMatch) {
        const continent = getContinentForCountry(c.name || c.admin);
        results.push({
          id: c.id,
          name: c.name || c.name_en,
          nameEn: c.name_en || '',
          country: c.name || c.admin,
          continent,
          type: 'country',
          lat: c.lat,
          lng: c.lng,
          hierarchyText: `${continent} · ${c.name || c.name_en}`
        });
        if (results.length >= 15) break;
      }
    }
  }

  return results;
}
