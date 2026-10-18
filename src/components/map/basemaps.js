
export const OSM_TILE_URL = 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const BASEMAPS = {
  standard: {
    url: import.meta.env.VITE_STANDARD_MAP_TILE_URL || OSM_TILE_URL,
    maxZoom: 19,
  },
  satellite: {
    url:
      import.meta.env.VITE_SATELLITE_MAP_TILE_URL ||
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
  },
  // Place-name overlay, only drawn on top of the satellite imagery.
  labels: {
    url:
      import.meta.env.VITE_SATELLITE_LABEL_TILE_URL ||
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
  },
};