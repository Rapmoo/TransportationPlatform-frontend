import { useEffect, useRef, useState } from 'react';
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
import { fromLonLat } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control/defaults.js';
import FullScreen from 'ol/control/FullScreen';
import { Style, Circle as CircleStyle, Fill, Stroke, Text } from 'ol/style';
import { BASEMAPS } from './basemaps';
import BaseLayerToggle from './BaseLayerToggle';

const POINT_DEFS = [
  { key: 'home', color: '#0E7C86', labelKey: 'mapMarkerHome' },
  { key: 'start', color: '#B9791F', labelKey: 'mapMarkerStart' },
  { key: 'boarding', color: '#7A4FB5', labelKey: 'mapMarkerBoarding' },
  { key: 'afterWork', color: '#C0392B', labelKey: 'mapMarkerAfterWork' },
];

// Read-only overview of the worker's four points. Same basemaps and controls
// (zoom, full screen, Standard / Satellite) as the admin GIS map.
export default function ReviewMap({ locations }) {
  const shellRef = useRef(null);
  const elRef = useRef(null);
  const baseRef = useRef(null);
  const labelsRef = useRef(null);
  const { t } = useLanguage();
  const [basemap, setBasemap] = useState('street');
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;

  useEffect(() => {
    const features = POINT_DEFS.filter((def) => locations[def.key]?.lat != null).map((def) => {
      const loc = locations[def.key];
      const feature = new Feature({ geometry: new Point(fromLonLat([loc.lon, loc.lat])) });
      feature.setStyle(new Style({
        image: new CircleStyle({
          radius: 10,
          fill: new Fill({ color: def.color }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
        text: new Text({ text: t(def.labelKey), fill: new Fill({ color: '#fff' }), font: '600 11px IBM Plex Sans, sans-serif' }),
      }));
      return feature;
    });

    if (features.length === 0) return undefined;

    const source = new VectorSource({ features });
    const sat = basemapRef.current === 'satellite';
    const base = new TileLayer({
      source: new XYZ({
        url: sat ? BASEMAPS.satellite.url : BASEMAPS.standard.url,
        maxZoom: 19,
        crossOrigin: 'anonymous',
        attributions: sat ? t('mapAttributionSatelliteFull') : '© OpenStreetMap contributors',
      }),
    });
    const labels = new TileLayer({
      visible: sat,
      source: new XYZ({ url: BASEMAPS.labels.url, maxZoom: 19, crossOrigin: 'anonymous' }),
    });
    baseRef.current = base;
    labelsRef.current = labels;

    const map = new Map({
      target: elRef.current,
      layers: [base, labels, new VectorLayer({ source })],
      view: new View({ center: fromLonLat([38.7525, 9.0192]), zoom: 12, maxZoom: 19 }),
      controls: defaultControls({ rotate: false }).extend([
        new FullScreen({ source: shellRef.current }),
      ]),
    });

    map.getView().fit(source.getExtent(), { padding: [50, 50, 50, 50], maxZoom: 16 });
    setTimeout(() => map.updateSize(), 50);
    const ro = new ResizeObserver(() => map.updateSize());
    ro.observe(shellRef.current);

    return () => {
      ro.disconnect();
      map.setTarget(null);
    };
  }, [locations, t]);

  // Switch Standard / Satellite without rebuilding the map (keeps zoom and position).
  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;
    const sat = basemap === 'satellite';
    base.setSource(new XYZ({
      url: sat ? BASEMAPS.satellite.url : BASEMAPS.standard.url,
      maxZoom: 19,
      crossOrigin: 'anonymous',
      attributions: sat ? t('mapAttributionSatelliteFull') : '© OpenStreetMap contributors',
    }));
    labelsRef.current?.setVisible(sat);
  }, [basemap, t]);

  return (
    <div className="map-shell review-map-shell" ref={shellRef}>
      <div ref={elRef} style={{ width: '100%', height: '100%' }} />
      <div className="review-map-toggle">
        <BaseLayerToggle value={basemap} onChange={setBasemap} />
      </div>
    </div>
  );
}

export { POINT_DEFS };