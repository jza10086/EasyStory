const fs = require('fs');
const path = require('path');

const WRAP_OFFSETS = [-720, -360, 0, 360, 720];

console.log('=== Step 1: Loading Processed Provinces ===');
const provData = JSON.parse(fs.readFileSync('scripts/ne_10m_clean_single.json', 'utf8'));
console.log('Total provinces/states:', provData.features.length);

// Save public/geo/provinces.json
fs.writeFileSync('public/geo/provinces.json', JSON.stringify(provData));
console.log('Saved public/geo/provinces.json');

console.log('=== Step 2: Generating provinces_wrapped.json ===');
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

function createWrappedGeoJSON(geoJson, offsets = WRAP_OFFSETS) {
  if (!geoJson || !geoJson.features) return geoJson;

  const wrapped = [];
  offsets.forEach(offset => {
    geoJson.features.forEach(feature => {
      if (offset === 0) {
        wrapped.push(feature);
      } else {
        wrapped.push({
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
    features: wrapped
  };
}

const provWrapped = createWrappedGeoJSON(provData);
fs.writeFileSync('public/geo/provinces_wrapped.json', JSON.stringify(provWrapped));
const provSizeMb = (fs.statSync('public/geo/provinces_wrapped.json').size / 1024 / 1024).toFixed(2);
console.log(`Saved public/geo/provinces_wrapped.json (${provWrapped.features.length} features, ${provSizeMb} MB)`);

console.log('=== Step 3: Computing Province Labels for GPU Canvas ===');
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
    country: f.properties.country || '',
    admin: f.properties.admin || '',
    lat: Number(((minLat + maxLat) / 2).toFixed(3)),
    lng: Number(((minLng + maxLng) / 2).toFixed(3)),
    width: Number((maxLng - minLng).toFixed(2)),
    height: Number((maxLat - minLat).toFixed(2)),
    area: Number(maxArea.toFixed(2)),
    totalArea: Number(totalArea.toFixed(2))
  };
}

const provinceLabels = [];
provData.features.forEach(f => {
  const meta = getFeatureCenterAndArea(f);
  if (meta) {
    provinceLabels.push(meta);
  }
});
fs.writeFileSync('public/geo/province_labels.json', JSON.stringify(provinceLabels, null, 2));
console.log(`Saved public/geo/province_labels.json (${provinceLabels.length} labels)`);

console.log('=== Step 4: Processing Dissolved Countries (Level 2) ===');
const countriesRaw = JSON.parse(fs.readFileSync('scripts/countries_dissolved.json', 'utf8'));

// Enrich country features
const countryFeatures = countriesRaw.features.map(f => {
  const admin = f.properties.admin;
  const name = f.properties.country || admin;
  return {
    type: 'Feature',
    properties: {
      id: admin,
      name: name,
      name_en: admin,
      country: name,
      admin: admin
    },
    geometry: f.geometry
  };
});

const countriesGeo = {
  type: 'FeatureCollection',
  features: countryFeatures
};
fs.writeFileSync('public/geo/countries.json', JSON.stringify(countriesGeo));
console.log('Saved public/geo/countries.json');

const countriesWrapped = createWrappedGeoJSON(countriesGeo);
fs.writeFileSync('public/geo/countries_wrapped.json', JSON.stringify(countriesWrapped));
const countrySizeMb = (fs.statSync('public/geo/countries_wrapped.json').size / 1024 / 1024).toFixed(2);
console.log(`Saved public/geo/countries_wrapped.json (${countriesWrapped.features.length} features, ${countrySizeMb} MB)`);

console.log('=== Step 5: Computing Country Labels ===');
const countryLabels = [];
countriesGeo.features.forEach(f => {
  const meta = getFeatureCenterAndArea(f);
  if (meta) {
    countryLabels.push(meta);
  }
});
fs.writeFileSync('public/geo/country_labels.json', JSON.stringify(countryLabels, null, 2));
console.log(`Saved public/geo/country_labels.json (${countryLabels.length} labels)`);

console.log('=== All Natural Earth Geo assets successfully built! ===');
