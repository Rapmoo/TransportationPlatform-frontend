import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';

// Addis Ababa centre in [lon, lat] (OpenLayers order, EPSG:4326 input).
export const DEFAULT_CENTER_LONLAT = [38.7525, 9.0192];
export const DEFAULT_ZOOM = 12;
export const PIN_ZOOM = 16;

/**
 * Street map (visible by default) + satellite (hidden until toggled).
 * Both are "base" layers: only one is visible at a time.
 */
export function createBaseLayers(t) {
  const streetLayer = new TileLayer({
    source: new OSM(),
    title: t('mapStreet'),
    visible: true,
    type: 'base',
  });


const satelliteLayer = new TileLayer({
  source: new XYZ({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attributions: 'Tiles © Esri and its imagery providers',
  }),
  title: t('mapSatellite'),
  visible: false,
  type: 'base',
});
 

  return { streetLayer, satelliteLayer };
}

export function applyBaseView(layers, view) {
  if (!layers) return;
  layers.streetLayer.setVisible(view === 'street');
  layers.satelliteLayer.setVisible(view === 'satellite');
}

// Plain coloured dot used for the draggable pin on the picker map.
export function pinStyle(color) {
  return new Style({
    image: new CircleStyle({
      radius: 9,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#ffffff', width: 2.5 }),
    }),
  });
}

// Lettered dot (H / S / B / W) used on the review map.
export function labelledPinStyle(color, label) {
  return new Style({
    image: new CircleStyle({
      radius: 11,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: '#ffffff', width: 2 }),
    }),
    text: new Text({
      text: label,
      font: "600 11px 'IBM Plex Sans', sans-serif",
      fill: new Fill({ color: '#ffffff' }),
    }),
  });
}