import { useEffect, useRef, useState, useCallback } from 'react';
import 'ol/ol.css';
import OLMap from 'ol/Map';
import View from 'ol/View';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Translate from 'ol/interaction/Translate';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Search, Check, RotateCcw, MapPin } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { searchAddressClientSide } from '../../api/workerApi';
import BaseLayerToggle from './BaseLayerToggle';
import {
  DEFAULT_CENTER_LONLAT,
  DEFAULT_ZOOM,
  PIN_ZOOM,
  createBaseLayers,
  applyBaseView,
  pinStyle,
} from './baseLayers';

export default function LocationPicker({ title, address, value, onChange, onConfirm, onEdit, onClear, accentColor = '#0E7C86' }) {
  const { t } = useLanguage();
  const mapElRef = useRef(null);
  const mapObjRef = useRef(null);
  const sourceRef = useRef(null);
  const featureRef = useRef(null);
  const layersRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const baseViewRef = useRef('street');
  const attemptedAutoGeocode = useRef(false);

  onChangeRef.current = onChange;

  const [baseView, setBaseView] = useState('street');
  const [searchQuery, setSearchQuery] = useState(address || '');
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');

  const placePoint = useCallback((lat, lon, source, { recenter = true } = {}) => {
    const map = mapObjRef.current;
    const vectorSource = sourceRef.current;
    if (!map || !vectorSource) return;

    const coords = fromLonLat([lon, lat]);

    if (!featureRef.current) {
      const feature = new Feature({ geometry: new Point(coords) });
      vectorSource.addFeature(feature);
      featureRef.current = feature;
    } else {
      featureRef.current.getGeometry().setCoordinates(coords);
    }

    if (recenter) {
      const view = map.getView();
      view.animate({
        center: coords,
        zoom: Math.max(view.getZoom() || 0, PIN_ZOOM),
        duration: 300,
      });
    }

    onChangeRef.current({ lat, lon, source });
  }, []);

  // Initialize the map once.
  useEffect(() => {
    const layers = createBaseLayers(t);
    applyBaseView(layers, baseViewRef.current);
    layersRef.current = layers;

    const vectorSource = new VectorSource();
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: pinStyle(accentColor),
      zIndex: 10,
    });
    sourceRef.current = vectorSource;

    const hasInitial = value?.lat != null && value?.lon != null;

    const map = new OLMap({
      target: mapElRef.current,
      layers: [layers.streetLayer, layers.satelliteLayer, vectorLayer],
      view: new View({
        center: fromLonLat(hasInitial ? [value.lon, value.lat] : DEFAULT_CENTER_LONLAT),
        zoom: hasInitial ? PIN_ZOOM : DEFAULT_ZOOM,
        maxZoom: 20,
      }),
    });
    mapObjRef.current = map;

    // Restore an existing pin (e.g. worker went back from Review).
    if (hasInitial) {
      const feature = new Feature({ geometry: new Point(fromLonLat([value.lon, value.lat])) });
      vectorSource.addFeature(feature);
      featureRef.current = feature;
    }

    // Drag the pin to fine-tune the position.
    const translate = new Translate({ layers: [vectorLayer] });
    translate.on('translateend', (evt) => {
      const [lon, lat] = toLonLat(evt.features.item(0).getGeometry().getCoordinates());
      onChangeRef.current({ lat, lon, source: 'manual' });
    });
    map.addInteraction(translate);

    // Click / tap anywhere on the map to place or reposition the pin.
    map.on('singleclick', (evt) => {
      const [lon, lat] = toLonLat(evt.coordinate);
      placePoint(lat, lon, 'manual', { recenter: false });
    });

    // Give the container a tick to get its final size (steps/layout shifts).
    const sizeTimer = setTimeout(() => map.updateSize(), 50);

    return () => {
      clearTimeout(sizeTimer);
      mapObjRef.current = null;
      sourceRef.current = null;
      featureRef.current = null;
      layersRef.current = null;
      map.setTarget(undefined);
      map.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Street <-> satellite switch.
  useEffect(() => {
    baseViewRef.current = baseView;
    applyBaseView(layersRef.current, baseView);
  }, [baseView]);

  // Attempt one automatic geocode of the typed address on first mount, if no
  // coordinates are already set. Centers the map and drops a pin, but never
  // auto-confirms — the worker must review and confirm.
  useEffect(() => {
    if (attemptedAutoGeocode.current) return;
    attemptedAutoGeocode.current = true;
    if (value?.lat != null || !address || !address.trim()) return;

    setSearching(true);
    searchAddressClientSide(address)
      .then((results) => {
        if (results.length > 0) {
          placePoint(results[0].lat, results[0].lon, 'geocoded');
        } else {
          setSearchMessage(t('mapSearchNoResults'));
        }
      })
      .catch(() => setSearchMessage(t('mapSearchFailed')))
      .finally(() => setSearching(false)); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchMessage('');
    try {
      const results = await searchAddressClientSide(searchQuery);
      if (results.length === 0) {
        setSearchMessage(t('mapSearchNoResults'));
      } else {
        placePoint(results[0].lat, results[0].lon, 'geocoded');
      }
    } catch {
      setSearchMessage(t('mapSearchFailed'));
    } finally {
      setSearching(false);
    }
  };

  const handleClear = () => {
    if (featureRef.current && sourceRef.current) {
      sourceRef.current.removeFeature(featureRef.current);
      featureRef.current = null;
    }
    setSearchMessage('');
    onClear();
  };

  const hasPin = value?.lat != null && value?.lon != null;
  const statusClass = value?.confirmed
    ? 'location-status-confirmed'
    : value?.source === 'manual'
      ? 'location-status-manual'
      : 'location-status-pending';
  const statusText = value?.confirmed ? t('statusConfirmed') : hasPin ? t('statusManual') : t('statusNotSet');

  return (
    <div className="location-block">
      <div className="location-block-head">
        <h3>{title}</h3>
        <span className={`location-status ${statusClass}`}>{statusText}</span>
      </div>

      <div className="map-hint">
        <MapPin size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{t('mapInstruction')}</span>
      </div>

      <div className="map-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('mapSearchPlaceholder')}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
        />
        <button type="button" className="btn" onClick={handleSearch} disabled={searching}>
          <Search size={15} />
          {searching ? t('mapSearching') : t('mapSearchButton')}
        </button>
      </div>

      <div className="map-shell">
        <div ref={mapElRef} style={{ width: '100%', height: '100%' }} />
        <BaseLayerToggle value={baseView} onChange={setBaseView} />
      </div>

      {searchMessage && <div className="helper" style={{ marginTop: 8 }}>{searchMessage}</div>}

      {hasPin ? (
        <div className="coord-readout">
          {t('coordLabel')}: {value.lat.toFixed(6)}, {value.lon.toFixed(6)}
        </div>
      ) : (
        <div className="helper" style={{ marginTop: 8 }}>{t('mapNoPinYet')}</div>
      )}

      <div className="map-actions">
        {!value?.confirmed ? (
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={!hasPin}>
            <Check size={15} />
            {t('mapConfirmButton')}
          </button>
        ) : (
          <button type="button" className="btn" onClick={onEdit}>
            <Check size={15} />
            {t('mapChangeButton')}
          </button>
        )}
        <button type="button" className="btn btn-danger-text" onClick={handleClear} disabled={!hasPin}>
          <RotateCcw size={14} />
          {t('mapClearButton')}
        </button>
      </div>
    </div>
  );
}