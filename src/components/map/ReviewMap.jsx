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
import { fromLonLat } from 'ol/proj';

const STANDARD_TILE_URL = import.meta.env.VITE_STANDARD_MAP_TILE_URL || 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
import { Style, Circle as CircleStyle, Fill, Stroke, Text } from 'ol/style';

const POINT_DEFS = [
  { key: 'home', color: '#0E7C86', labelKey: 'mapMarkerHome' },
  { key: 'start', color: '#B9791F', labelKey: 'mapMarkerStart' },
  { key: 'boarding', color: '#7A4FB5', labelKey: 'mapMarkerBoarding' },
  { key: 'afterWork', color: '#C0392B', labelKey: 'mapMarkerAfterWork' },
];

export default function ReviewMap({ locations }) {
  const elRef = useRef(null);
  const { t } = useLanguage();


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
    const base = new TileLayer({
      source: new XYZ({
        url: STANDARD_TILE_URL,
        attributions: t('mapAttributionStandard'),
      }),
    });

    const map = new Map({
      target: elRef.current,
      layers: [base, new VectorLayer({ source })],
      view: new View({ center: fromLonLat([38.7525, 9.0192]), zoom: 12 }),
      controls: [],
    });

    map.getView().fit(source.getExtent(), { padding: [40, 40, 40, 40], maxZoom: 16 });
    setTimeout(() => map.updateSize(), 50);

    return () => map.setTarget(null);
  }, [locations, t]);

  return (
    <div className="map-shell">
      <div ref={elRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

export { POINT_DEFS };