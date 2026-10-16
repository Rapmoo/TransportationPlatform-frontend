import { useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat, toLonLat } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control/defaults.js';
import { Style, Circle as CircleStyle, Fill, Stroke, Text } from 'ol/style';
import Translate from 'ol/interaction/Translate';

// Addis Ababa centre — default view before any pin exists.
const DEFAULT_CENTER = [38.7525, 9.0192];
const DEFAULT_ZOOM = 12;
const PIN_ZOOM = 16;
const STANDARD_TILE_URL =import.meta.env.VITE_STANDARD_MAP_TILE_URL ||'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_TILE_URL = import.meta.env.VITE_SATELLITE_MAP_TILE_URL || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const LABEL_TILE_URL = import.meta.env.VITE_SATELLITE_LABEL_TILE_URL || 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Numbered marker. The active point gets a soft halo and is drawn larger.
function markerStyle(color, number, active) {
  const styles = [];
  if (active) {
    styles.push(new Style({ image: new CircleStyle({ radius: 21, fill: new Fill({ color: hexToRgba(color, 0.22) }) }) }));
  }
  styles.push(
    new Style({
      image: new CircleStyle({
        radius: active ? 13 : 10,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: '#fff', width: 3 }),
      }),
      text: new Text({
        text: String(number),
        font: `600 ${active ? 13 : 11}px "IBM Plex Sans", sans-serif`,
        fill: new Fill({ color: '#fff' }),
      }),
      zIndex: active ? 10 : 1,
    })
  );
  return styles;
}

/**
 * One full-size map that shows every location's pin. Only the active point can
 * be placed (tap) or dragged. Controlled by the parent: `points` holds the
 * coordinates, `onPlace(lat, lon)` is called when the active pin is set/moved,
 * and `focus` ({ lat, lon }) recentres the map (e.g. after a search).
 */
export default function FullMap({ points, activeKey, onPlace, focus, basemap = 'standard' }) {
  const elRef = useRef(null);
  const { t } = useLanguage();
  const mapRef = useRef(null);
  const sourceRef = useRef(null);
  const featuresRef = useRef({});
  const layersRef = useRef({});
  const tRef = useRef(t);
  tRef.current = t;
  const onPlaceRef = useRef(onPlace);
  const activeRef = useRef(activeKey);
  onPlaceRef.current = onPlace;
  activeRef.current = activeKey;

  // Initialise the map once.
  useEffect(() => {
    const source = new VectorSource();
    sourceRef.current = source;
    const vectorLayer = new VectorLayer({ source });
    // Two basemaps: the standard street map, and Esri satellite imagery with a
    // place-name overlay (only shown together with the satellite layer).
    const standard = new TileLayer({
      source: new XYZ({
        url: STANDARD_TILE_URL,
        attributions: tRef.current('mapAttributionStandard'),
      }),
    });
    const satellite = new TileLayer({
      visible: false,
      source: new XYZ({
        url: SATELLITE_TILE_URL,
        maxZoom: 19,
        attributions: tRef.current('mapAttributionSatelliteFull'),
      }),
    });
    const labels = new TileLayer({
      visible: false,
      source: new XYZ({
        url: LABEL_TILE_URL,
        maxZoom: 19,
      }),
    });
    layersRef.current = { standard, satellite, labels };

    const first = points.find((p) => p.lat != null && p.lon != null);
    const map = new Map({
      target: elRef.current,
      layers: [standard, satellite, labels, vectorLayer],
      view: new View({
        center: fromLonLat(first ? [first.lon, first.lat] : DEFAULT_CENTER),
        zoom: first ? PIN_ZOOM : DEFAULT_ZOOM,
        maxZoom: 19,
      }),
      controls: defaultControls({ attribution: false, rotate: false }),
    });
    mapRef.current = map;

    map.on('click', (evt) => {
      const [lon, lat] = toLonLat(evt.coordinate);
      onPlaceRef.current(lat, lon, 'manual');
    });

    // Only the active point's pin can be dragged.
    const translate = new Translate({
      layers: [vectorLayer],
      filter: (feature) => feature.get('key') === activeRef.current,
    });
    translate.on('translateend', (evt) => {
      const [lon, lat] = toLonLat(evt.features.item(0).getGeometry().getCoordinates());
      onPlaceRef.current(lat, lon, 'manual');
    });
    map.addInteraction(translate);

    // Keep tiles sized correctly when the viewport changes (rotation, mobile bars).
    const ro = new ResizeObserver(() => map.updateSize());
    ro.observe(elRef.current);
    setTimeout(() => map.updateSize(), 50);

    return () => {
      ro.disconnect();
      map.setTarget(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-translate the attribution text when the language changes, without
  // rebuilding the map (which would drop the pins and the current view).
  useEffect(() => {
    const { standard, satellite } = layersRef.current;
    if (!standard) return;
    standard.getSource().setAttributions(t('mapAttributionStandard'));
    satellite.getSource().setAttributions(t('mapAttributionSatelliteFull'));
  }, [t]);

  // Switch between the standard and satellite basemaps.
  useEffect(() => {
    const { standard, satellite, labels } = layersRef.current;
    if (!standard) return;
    const sat = basemap === 'satellite';
    standard.setVisible(!sat);
    satellite.setVisible(sat);
    labels.setVisible(sat);
  }, [basemap]);

  // Keep the pins in sync with the form state.
  useEffect(() => {
    const source = sourceRef.current;
    const features = featuresRef.current;
    if (!source) return;
    points.forEach((p, i) => {
      const hasPin = p.lat != null && p.lon != null;
      let feature = features[p.key];
      if (!hasPin) {
        if (feature) {
          source.removeFeature(feature);
          delete features[p.key];
        }
        return;
      }
      const coord = fromLonLat([p.lon, p.lat]);
      if (!feature) {
        feature = new Feature({ geometry: new Point(coord) });
        feature.set('key', p.key);
        source.addFeature(feature);
        features[p.key] = feature;
      } else {
        feature.getGeometry().setCoordinates(coord);
      }
      feature.setStyle(markerStyle(p.color, i + 1, p.key === activeKey));
    });
  }, [points, activeKey]);

  // Recentre on request (search result, or switching to a point that has a pin).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    const view = map.getView();
    view.animate({
      center: fromLonLat([focus.lon, focus.lat]),
      zoom: Math.max(view.getZoom() || 0, PIN_ZOOM),
      duration: 300,
    });
  }, [focus]);

  return <div ref={elRef} className="mapfull-map" />;
}