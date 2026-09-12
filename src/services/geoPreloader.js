// Global In-Memory GeoJSON Preloader & Cache Service for 0ms Instant Startup
let preloadedCountries = null;
let preloadedProvinces = null;
let preloadedContinents = null;
let preloadedContinentsGeo = null;
let preloadedCountryLabels = null;
let preloadedProvinceLabels = null;

let preloadPromise = null;

export function preloadGeoAssets() {
  if (preloadPromise) return preloadPromise;

  preloadPromise = Promise.all([
    fetch('/geo/continents_geo.json')
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((data) => {
        preloadedContinentsGeo = data;
        return data;
      })
      .catch((err) => {
        console.error('Failed to preload continents_geo.json', err);
        return null;
      }),

    fetch('/geo/countries.json')
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((data) => {
        preloadedCountries = data;
        return data;
      })
      .catch((err) => {
        console.error('Failed to preload countries.json', err);
        return null;
      }),

    fetch('/geo/provinces.json')
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((data) => {
        preloadedProvinces = data;
        return data;
      })
      .catch((err) => {
        console.error('Failed to preload provinces.json', err);
        return null;
      }),

    fetch('/geo/country_labels.json')
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((data) => {
        preloadedCountryLabels = data;
        return data;
      })
      .catch((err) => console.error('Failed to preload country_labels.json', err)),

    fetch('/geo/province_labels.json')
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((data) => {
        preloadedProvinceLabels = data;
        return data;
      })
      .catch((err) => console.error('Failed to preload province_labels.json', err)),

    fetch('/geo/continents.json')
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((data) => {
        preloadedContinents = data;
        return data;
      })
      .catch((err) => console.error('Failed to preload continents.json', err))
  ]);

  return preloadPromise;
}

export function getPreloadedContinentsGeo() {
  return preloadedContinentsGeo;
}

export function getPreloadedCountries() {
  return preloadedCountries;
}

export function getPreloadedProvinces() {
  return preloadedProvinces;
}

export function getPreloadedCountryLabels() {
  return preloadedCountryLabels;
}

export function getPreloadedProvinceLabels() {
  return preloadedProvinceLabels;
}

export function getPreloadedContinents() {
  return preloadedContinents;
}

// Immediate eager preloading upon application startup
preloadGeoAssets();

