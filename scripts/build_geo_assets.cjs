const fs = require('fs');
const path = require('path');

const WRAP_OFFSETS = [-720, -360, 0, 360, 720];

// Dictionaries for Chinese Province/State Name Localization
const usStateZh = {
  'Alabama': '阿拉巴马州', 'Alaska': '阿拉斯加州', 'Arizona': '亚利桑那州', 'Arkansas': '阿肯色州',
  'California': '加利福尼亚州', 'Colorado': '科罗拉多州', 'Connecticut': '康涅狄格州', 'Delaware': '特拉华州',
  'Florida': '佛罗里达州', 'Georgia': '佐治亚州', 'Hawaii': '夏威夷州', 'Idaho': '爱达荷州',
  'Illinois': '伊利诺伊州', 'Indiana': '印第安纳州', 'Iowa': '爱荷华州', 'Kansas': '堪萨斯州',
  'Kentucky': '肯塔基州', 'Louisiana': '路易斯安那州', 'Maine': '缅因州', 'Maryland': '马里兰州',
  'Massachusetts': '马萨诸塞州', 'Michigan': '密歇根州', 'Minnesota': '明尼苏达州', 'Mississippi': '密西西比州',
  'Missouri': '密苏里州', 'Montana': '蒙大拿州', 'Nebraska': '内布拉斯加州', 'Nevada': '内华达州',
  'New Hampshire': '新罕布什尔州', 'New Jersey': '新泽西州', 'New Mexico': '新墨西哥州', 'New York': '纽约州',
  'North Carolina': '北卡罗来纳州', 'North Dakota': '北达科他州', 'Ohio': '俄亥俄州', 'Oklahoma': '俄克拉荷马州',
  'Oregon': '俄勒冈州', 'Pennsylvania': '宾夕法尼亚州', 'Rhode Island': '罗德岛州', 'South Carolina': '南卡罗来纳州',
  'South Dakota': '南达科他州', 'Tennessee': '田纳西州', 'Texas': '德克萨斯州', 'Utah': '犹他州',
  'Vermont': '佛蒙特州', 'Virginia': '弗吉尼亚州', 'Washington': '华盛顿州', 'West Virginia': '西弗吉尼亚州',
  'Wisconsin': '威斯康星州', 'Wyoming': '怀俄明州', 'District of Columbia': '华盛顿特区'
};

const caProvinceZh = {
  'Ontario': '安大略省', 'Quebec': '魁北克省', 'British Columbia': '不列颠哥伦比亚省',
  'Alberta': '阿尔伯塔省', 'Manitoba': '曼尼托巴省', 'Saskatchewan': '萨斯喀彻温省',
  'Nova Scotia': '新斯科舍省', 'New Brunswick': '新不伦瑞克省', 'Newfoundland and Labrador': '纽芬兰与拉布拉多省',
  'Prince Edward Island': '爱德华王子岛省', 'Northwest Territories': '西北地区', 'Yukon': '育空地区',
  'Nunavut': '努纳武特地区'
};

const auStateZh = {
  'New South Wales': '新南威尔士州', 'Victoria': '维多利亚州', 'Queensland': '昆士兰州',
  'Western Australia': '西澳大利亚州', 'South Australia': '南澳大利亚州', 'Tasmania': '塔斯马尼亚州',
  'Northern Territory': '北领地', 'Australian Capital Territory': '首都领地'
};

const ukNationZh = {
  'England': '英格兰', 'Scotland': '苏格兰', 'Wales': '威尔士', 'Northern Ireland': '北爱尔兰'
};

const deStateZh = {
  'Bavaria': '拜仁州', 'Bayern': '拜仁州', 'Baden-Württemberg': '巴登-符腾堡州',
  'North Rhine-Westphalia': '北莱茵-威斯特法伦州', 'Nordrhein-Westfalen': '北莱茵-威斯特法伦州',
  'Hesse': '黑森州', 'Hessen': '黑森州', 'Saxony': '萨克森州', 'Sachsen': '萨克森州',
  'Lower Saxony': '下萨克森州', 'Niedersachsen': '下萨克森州', 'Rhineland-Palatinate': '莱茵兰-普法尔茨州',
  'Rheinland-Pfalz': '莱茵兰-普法尔茨州', 'Thuringia': '图林根州', 'Thüringen': '图林根州',
  'Brandenburg': '勃兰登堡州', 'Saxony-Anhalt': '萨克森-安哈尔特州', 'Sachsen-Anhalt': '萨克森-安哈尔特州',
  'Mecklenburg-Vorpommern': '梅克伦堡-前波美拉尼亚州', 'Schleswig-Holstein': '石勒苏益格-荷尔斯泰因州',
  'Saarland': '萨尔州', 'Berlin': '柏林', 'Hamburg': '汉堡', 'Bremen': '不来梅'
};

const frRegionZh = {
  'Île-de-France': '法兰西岛', 'Auvergne-Rhône-Alpes': '奥弗涅-罗讷-阿尔卑斯',
  'Nouvelle-Aquitaine': '新阿基坦', 'Occitanie': '奥克西塔尼', 'Grand Est': '大东部',
  'Hauts-de-France': '上法兰西', 'Normandie': '诺曼底', 'Bretagne': '布列塔尼',
  'Provence-Alpes-Côte d\'Azur': '普罗旺斯-阿尔卑斯-蓝色海岸', 'Pays de la Loire': '卢瓦尔河地区',
  'Bourgogne-Franche-Comté': '勃艮第-弗朗什-孔泰', 'Centre-Val de Loire': '中央-卢瓦尔河谷',
  'Corse': '科西嘉'
};

function getLocalizedProvinceName(rawName, country) {
  if (country === '美国' && usStateZh[rawName]) return { name: usStateZh[rawName], name_en: rawName };
  if (country === '加拿大' && caProvinceZh[rawName]) return { name: caProvinceZh[rawName], name_en: rawName };
  if (country === '澳大利亚' && auStateZh[rawName]) return { name: auStateZh[rawName], name_en: rawName };
  if (country === '英国' && ukNationZh[rawName]) return { name: ukNationZh[rawName], name_en: rawName };
  if (country === '德国' && deStateZh[rawName]) return { name: deStateZh[rawName], name_en: rawName };
  if (country === '法国' && frRegionZh[rawName]) return { name: frRegionZh[rawName], name_en: rawName };
  return { name: rawName, name_en: rawName };
}

// Shift GeoJSON coordinates by a given longitude offset
function shiftGeoJSONCoordinates(geometry, offset) {
  if (!geometry || !geometry.coordinates) return geometry;

  const shiftRing = (ring) => ring.map(([lng, lat]) => [Number((lng + offset).toFixed(4)), Number(lat.toFixed(4))]);
  const shiftPolygon = (poly) => poly.map(shiftRing);
  const shiftMultiPolygon = (multi) => multi.map(shiftPolygon);

  let newCoordinates;
  if (geometry.type === 'Point') {
    newCoordinates = [Number((geometry.coordinates[0] + offset).toFixed(4)), Number(geometry.coordinates[1].toFixed(4))];
  } else if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
    newCoordinates = geometry.coordinates.map(([lng, lat]) => [Number((lng + offset).toFixed(4)), Number(lat.toFixed(4))]);
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

// Generate horizontally wrapped GeoJSON with world copies
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

// Douglas-Peucker ring simplification
function simplifyRing(ring, sqTolerance = 0.0001) {
  if (ring.length <= 4) return ring;
  let maxSqDist = 0, index = 0;
  const p1 = ring[0], p2 = ring[ring.length - 1];
  for (let i = 1; i < ring.length - 1; i++) {
    const p = ring[i];
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    let sqDist;
    if (dx === 0 && dy === 0) {
      sqDist = (p[0] - p1[0])**2 + (p[1] - p1[1])**2;
    } else {
      const t = ((p[0] - p1[0]) * dx + (p[1] - p1[1]) * dy) / (dx*dx + dy*dy);
      const clampedT = Math.max(0, Math.min(1, t));
      const projX = p1[0] + clampedT * dx;
      const projY = p1[1] + clampedT * dy;
      sqDist = (p[0] - projX)**2 + (p[1] - projY)**2;
    }
    if (sqDist > maxSqDist) {
      maxSqDist = sqDist;
      index = i;
    }
  }
  if (maxSqDist > sqTolerance) {
    const left = simplifyRing(ring.slice(0, index + 1), sqTolerance);
    const right = simplifyRing(ring.slice(index), sqTolerance);
    return left.slice(0, -1).concat(right);
  } else {
    return [p1, p2];
  }
}

function processGeom(geom, sqTolerance = 0.0001) {
  if (geom.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geom.coordinates.map(r => simplifyRing(r, sqTolerance)).filter(r => r.length >= 4)
    };
  }
  if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.map(p => p.map(r => simplifyRing(r, sqTolerance)).filter(r => r.length >= 4)).filter(p => p.length > 0)
    };
  }
  return geom;
}

function roundCoords(c) {
  if (typeof c[0] === 'number') {
    return [Number(c[0].toFixed(4)), Number(c[1].toFixed(4))];
  }
  return c.map(roundCoords);
}

// -----------------------------------------------------------------------------
// 1. Continents GeoJSON Processing
// -----------------------------------------------------------------------------
console.log('=== Step 1: Processing Continents GeoJSON ===');
const continentsGist = JSON.parse(fs.readFileSync('public/geo/continents_gist.json'));
const metaMap = {
  'Asia': { id: 'asia', name: '亚洲', name_en: 'Asia' },
  'Europe': { id: 'europe', name: '欧洲', name_en: 'Europe' },
  'Africa': { id: 'africa', name: '非洲', name_en: 'Africa' },
  'North America': { id: 'north-america', name: '北美洲', name_en: 'North America' },
  'South America': { id: 'south-america', name: '南美洲', name_en: 'South America' },
  'Oceania': { id: 'oceania', name: '大洋洲', name_en: 'Oceania' },
  'Antarctica': { id: 'antarctica', name: '南极洲', name_en: 'Antarctica' }
};

const continentsDict = {};
continentsGist.features.forEach(f => {
  let cName = f.properties.CONTINENT;
  if (cName === 'Australia') cName = 'Oceania';
  if (!continentsDict[cName]) {
    continentsDict[cName] = {
      type: 'Feature',
      properties: metaMap[cName],
      geometry: {
        type: 'MultiPolygon',
        coordinates: []
      }
    };
  }
  const geom = f.geometry;
  if (geom.type === 'Polygon') {
    continentsDict[cName].geometry.coordinates.push(geom.coordinates);
  } else if (geom.type === 'MultiPolygon') {
    continentsDict[cName].geometry.coordinates.push(...geom.coordinates);
  }
});

const continentFeatures = Object.values(continentsDict).map(f => ({
  ...f,
  geometry: {
    ...f.geometry,
    coordinates: roundCoords(f.geometry.coordinates)
  }
}));

const continentsGeo = { type: 'FeatureCollection', features: continentFeatures };
fs.writeFileSync('public/geo/continents_geo.json', JSON.stringify(continentsGeo));
const continentsWrapped = createWrappedGeoJSON(continentsGeo);
fs.writeFileSync('public/geo/continents_wrapped.json', JSON.stringify(continentsWrapped));
console.log('Continents written: 7 features, wrapped:', continentsWrapped.features.length);

// -----------------------------------------------------------------------------
// 2. High-Detail Worldwide Provinces & States Processing
// -----------------------------------------------------------------------------
console.log('\n=== Step 2: Processing Worldwide Provinces & States ===');

const partitionedCountryIds = new Set([
  'US', 'USA', 'United States of America', '美国',
  'CA', 'CAN', 'Canada', '加拿大',
  'AU', 'AUS', 'Australia', '澳大利亚',
  'BR', 'BRA', 'Brazil', '巴西',
  'CN', 'CHN', 'China', '中国',
  'JP', 'JPN', 'Japan', '日本',
  'IN', 'IND', 'India', '印度',
  'DE', 'DEU', 'Germany', '德国',
  'FR', 'FRA', 'France', '法国',
  'GB', 'GBR', 'United Kingdom', '英国',
  'MX', 'MEX', 'Mexico', '墨西哥',
  'ES', 'ESP', 'Spain', '西班牙',
  'IT', 'ITA', 'Italy', '意大利',
  'RU', 'RUS', 'Russia', '俄罗斯'
]);

const provinceFeatures = [];

// A. Natural Earth 50m (US, Canada, Australia, Brazil) - Crisp, authentic borders
const ne = JSON.parse(fs.readFileSync('public/geo/ne_50m_admin_1.json'));
ne.features.forEach(f => {
  const admin = f.properties.admin || f.properties.sov_a3;
  let countryName = admin;
  if (admin === 'United States of America') countryName = '美国';
  else if (admin === 'Canada') countryName = '加拿大';
  else if (admin === 'Australia') countryName = '澳大利亚';
  else if (admin === 'Brazil') countryName = '巴西';

  const localized = getLocalizedProvinceName(f.properties.name, countryName);

  provinceFeatures.push({
    type: 'Feature',
    properties: {
      id: f.properties.code_hasc || f.properties.adm1_code || f.properties.name,
      name: localized.name,
      name_en: localized.name_en,
      country: countryName,
      admin: admin
    },
    geometry: {
      type: f.geometry.type,
      coordinates: roundCoords(f.geometry.coordinates)
    }
  });
});

// B. China and Japan
const oldProv = JSON.parse(fs.readFileSync('public/geo/provinces.json'));
oldProv.features.forEach(f => {
  if (f.properties.country === '中国' || f.properties.country === '日本') {
    provinceFeatures.push({
      type: 'Feature',
      properties: {
        id: f.properties.id || f.properties.name,
        name: f.properties.name,
        name_en: f.properties.name_en || f.properties.name,
        country: f.properties.country,
        admin: f.properties.country
      },
      geometry: {
        type: f.geometry.type,
        coordinates: roundCoords(f.geometry.coordinates)
      }
    });
  }
});

// C. geoBoundaries ADM1 (India, Germany, France, UK, Mexico, Spain, Russia, Italy)
const gbMap = {
  IND: { country: '印度', admin: 'India', sqTol: 0.0002 },
  DEU: { country: '德国', admin: 'Germany', sqTol: 0.0001 },
  FRA: { country: '法国', admin: 'France', sqTol: 0.0001 },
  GBR: { country: '英国', admin: 'United Kingdom', sqTol: 0.0001 },
  MEX: { country: '墨西哥', admin: 'Mexico', sqTol: 0.0002 },
  ESP: { country: '西班牙', admin: 'Spain', sqTol: 0.0001 },
  RUS: { country: '俄罗斯', admin: 'Russia', sqTol: 0.0004 },
  ITA: { country: '意大利', admin: 'Italy', sqTol: 0.0001 }
};

Object.entries(gbMap).forEach(([code, meta]) => {
  const filePath = path.join('public/geo', 'adm1_' + code + '.json');
  if (fs.existsSync(filePath)) {
    const d = JSON.parse(fs.readFileSync(filePath));
    d.features.forEach(f => {
      const geom = processGeom(f.geometry, meta.sqTol);
      const rawName = f.properties.shapeName;
      const localized = getLocalizedProvinceName(rawName, meta.country);

      provinceFeatures.push({
        type: 'Feature',
        properties: {
          id: f.properties.shapeISO || f.properties.shapeID || localized.name,
          name: localized.name,
          name_en: localized.name_en,
          country: meta.country,
          admin: meta.admin
        },
        geometry: {
          type: geom.type,
          coordinates: roundCoords(geom.coordinates)
        }
      });
    });
  }
});

// D. Remaining countries from countries.json (100% full coverage without any missing holes)
const countries = JSON.parse(fs.readFileSync('public/geo/countries.json'));
let unpartitionedCount = 0;
countries.features.forEach(f => {
  const id = f.properties.id;
  const name = f.properties.name;
  const name_en = f.properties.name_en;
  if (!partitionedCountryIds.has(id) && !partitionedCountryIds.has(name) && !partitionedCountryIds.has(name_en)) {
    unpartitionedCount++;
    provinceFeatures.push({
      type: 'Feature',
      properties: {
        id: id,
        name: name,
        name_en: name_en,
        country: name,
        admin: name
      },
      geometry: {
        type: f.geometry.type,
        coordinates: roundCoords(f.geometry.coordinates)
      }
    });
  }
});

console.log(`Total Level 3 administrative entities: ${provinceFeatures.length} (${unpartitionedCount} unpartitioned countries seamless filled)`);

const provincesGeo = { type: 'FeatureCollection', features: provinceFeatures };
fs.writeFileSync('public/geo/provinces.json', JSON.stringify(provincesGeo));
console.log('provinces.json written, size:', (fs.statSync('public/geo/provinces.json').size / 1024 / 1024).toFixed(2), 'MB');

// Wrap with 5 offsets
const provincesWrapped = createWrappedGeoJSON(provincesGeo);
fs.writeFileSync('public/geo/provinces_wrapped.json', JSON.stringify(provincesWrapped));
console.log('provinces_wrapped.json written, size:', (fs.statSync('public/geo/provinces_wrapped.json').size / 1024 / 1024).toFixed(2), 'MB');

// -----------------------------------------------------------------------------
// 3. Precompute Country Mainland Centers & Areas for Level 2 Labels
// -----------------------------------------------------------------------------
console.log('\n=== Step 3: Computing Country Centers for Level 2 Labels ===');

function getRingArea(ring) {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += (ring[i][0] * ring[i+1][1] - ring[i+1][0] * ring[i][1]);
  }
  return Math.abs(area) / 2;
}

function getFeatureCenterAndArea(f) {
  const geom = f.geometry;
  let bestRing = null, maxArea = -1;
  let totalArea = 0;

  if (geom.type === 'Polygon') {
    bestRing = geom.coordinates[0];
    maxArea = getRingArea(bestRing);
    totalArea = maxArea;
  } else if (geom.type === 'MultiPolygon') {
    geom.coordinates.forEach(poly => {
      const ring = poly[0];
      const a = getRingArea(ring);
      totalArea += a;
      if (a > maxArea) {
        maxArea = a;
        bestRing = ring;
      }
    });
  }

  if (!bestRing) return null;

  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  bestRing.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });

  return {
    id: f.properties.id,
    name: f.properties.name,
    name_en: f.properties.name_en,
    continent: f.properties.continent,
    country: f.properties.country,
    lat: Number(((minLat + maxLat) / 2).toFixed(3)),
    lng: Number(((minLng + maxLng) / 2).toFixed(3)),
    width: Number((maxLng - minLng).toFixed(2)),
    height: Number((maxLat - minLat).toFixed(2)),
    area: Number(maxArea.toFixed(2)),
    totalArea: Number(totalArea.toFixed(2))
  };
}

const countryLabels = [];
countries.features.forEach(f => {
  const meta = getFeatureCenterAndArea(f);
  if (meta) {
    countryLabels.push(meta);
  }
});

fs.writeFileSync('public/geo/country_labels.json', JSON.stringify(countryLabels, null, 2));
console.log('country_labels.json written with', countryLabels.length, 'countries.');

// -----------------------------------------------------------------------------
// 4. Precompute Province & State Centers for Level 3 Labels
// -----------------------------------------------------------------------------
console.log('\n=== Step 4: Computing Province & State Centers for Level 3 Labels ===');

const provinceLabels = [];
provinceFeatures.forEach(f => {
  const meta = getFeatureCenterAndArea(f);
  if (meta) {
    provinceLabels.push({
      ...meta,
      country: f.properties.country || '',
      admin: f.properties.admin || ''
    });
  }
});

fs.writeFileSync('public/geo/province_labels.json', JSON.stringify(provinceLabels, null, 2));
console.log('province_labels.json written with', provinceLabels.length, 'provinces.');

console.log('\n=== Geo assets generation completed successfully! ===');
