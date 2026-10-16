import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Check, RotateCcw, MapPin } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useWorkerForm, STEPS } from '../context/WorkerFormContext';
import FullMap from '../components/map/FullMap';
import StepProgress from '../components/common/StepProgress';
import { searchAddress, reverseGeocode } from '../api/workerApi';
import { capitalizeEnglishWords, hasOnlyEnglishLetters } from '../utils/validation';

const LOCATION_DEFS = [
  { key: 'home', titleKey: 'selectHomeLocation', color: '#0E7C86' },
  { key: 'start', titleKey: 'selectStartLocation', color: '#B9791F' },
  { key: 'boarding', titleKey: 'selectBoardingLocation', color: '#7A4FB5' },
  { key: 'afterWork', titleKey: 'selectAfterWorkLocation', color: '#C0392B' },
];

// Personal-form field that holds each location's typed name.
const ADDRESS_FIELD = {
  home: 'homeAddress',
  start: 'startPointAddress',
  boarding: 'boardingAddress',
  afterWork: 'afterWorkAddress',
};

// A manually placed pin within this distance (metres) of the searched place
// counts as "the same place", so the typed name is kept.
const SAME_PLACE_METRES = 75;

function distanceMetres(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const hasPin = (loc) => loc.lat != null && loc.lon != null;
const isDone = (loc) => loc.confirmed && hasPin(loc);

// One full-page map. The worker picks the points one after another (home ->
// start -> boarding -> after work) on that same map; earlier pins stay visible.
export default function LocationStep() {
  const { t } = useLanguage();
  const { locations, setLocationPoint, setLocationAddress, updatePersonalField, setLocationConfirmed, clearLocationPoint, setStep } = useWorkerForm();

  const [active, setActive] = useState(() => {
    const i = LOCATION_DEFS.findIndex((d) => !isDone(locations[d.key]));
    return i === -1 ? 0 : i;
  });
  const [showWarning, setShowWarning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [focus, setFocus] = useState(null);
  const [basemap, setBasemap] = useState('standard');
  // Where the last address search put the pin, per point; and a counter so a
  // slow reverse lookup can't overwrite a newer one.
  const searchedAtRef = useRef({});
  const reverseSeqRef = useRef(0);

  const def = LOCATION_DEFS[active];
  const loc = locations[def.key];
  const isLast = active === LOCATION_DEFS.length - 1;
  const confirmed = isDone(loc);

  const points = useMemo(
    () => LOCATION_DEFS.map((d) => ({ key: d.key, color: d.color, ...locations[d.key] })),
    [locations]
  );

  // The map covers the whole page, so stop the page behind it from scrolling.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // When the active point changes: show its address in the search box, centre
  // on its pin, or — if it has none yet — try one automatic geocode of the
  // typed address (drops a pin but never auto-confirms).
  useEffect(() => {
    const current = locations[def.key];
    setSearchQuery(current.address || '');
    setSearchMessage('');
    if (hasPin(current)) {
      setFocus({ lat: current.lat, lon: current.lon });
      return;
    }
    // Geocoding is explicit only. This avoids background geocoding requests at scale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const setName = (key, name) => {
    const englishName = capitalizeEnglishWords(name);
    setLocationAddress(key, englishName);
    updatePersonalField(ADDRESS_FIELD[key], englishName);
    return englishName;
  };

  const handlePlace = async (lat, lon, source) => {
    const key = def.key;
    setLocationPoint(key, { lat, lon, source });
    if (source !== 'manual') return;

    // If the pin is still on the place that was searched for, keep that name.
    const searched = searchedAtRef.current[key];
    if (searched && distanceMetres(searched, { lat, lon }) <= SAME_PLACE_METRES) return;

    // Otherwise the pin marks a different place: use that place's name.
    const seq = ++reverseSeqRef.current;
    const name = await reverseGeocode(lat, lon, { language: 'en' });
    if (seq !== reverseSeqRef.current || !name) return;
    if (!hasOnlyEnglishLetters(name)) {
      setSearchMessage(t('errorEnglishOnly'));
      return;
    }
    const englishName = setName(key, name);
    setSearchQuery(englishName);
    searchedAtRef.current[key] = { lat, lon };
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    if (!hasOnlyEnglishLetters(searchQuery)) {
      setSearchMessage(t('errorEnglishOnly'));
      return;
    }
    const englishQuery = capitalizeEnglishWords(searchQuery.trim());
    setSearchQuery(englishQuery);
    setSearching(true);
    setSearchMessage('');
    try {
      const results = await searchAddress(englishQuery);
      if (results.length === 0) {
        setSearchMessage(t('mapSearchNoResults'));
      } else {
        setLocationPoint(def.key, { lat: results[0].lat, lon: results[0].lon, source: 'geocoded' });
        // Searched place: remember where it is, and keep what the worker typed as its name.
        searchedAtRef.current[def.key] = { lat: results[0].lat, lon: results[0].lon };
        setName(def.key, englishQuery);
        setFocus({ lat: results[0].lat, lon: results[0].lon });
      }
    } catch {
      setSearchMessage(t('mapSearchFailed'));
    } finally {
      setSearching(false);
    }
  };

  const handleClear = () => {
    clearLocationPoint(def.key);
    delete searchedAtRef.current[def.key];
    setSearchMessage('');
  };

  const handlePrimary = () => {
    if (!hasPin(loc)) return;
    if (!confirmed) setLocationConfirmed(def.key, true);
    if (!isLast) {
      setActive(active + 1);
      return;
    }
    const allDone = LOCATION_DEFS.every((d) => d.key === def.key || isDone(locations[d.key]));
    if (allDone) {
      setStep(STEPS.REVIEW);
    } else {
      setShowWarning(true);
      const missing = LOCATION_DEFS.findIndex((d) => d.key !== def.key && !isDone(locations[d.key]));
      if (missing !== -1) setActive(missing);
    }
  };

  const handleBack = () => {
    if (active > 0) setActive(active - 1);
    else setStep(STEPS.FORM);
  };

  const primaryLabel = isLast
    ? (confirmed ? t('btnContinueToReview') : t('mapFinishPoint'))
    : (confirmed ? t('btnNext') : t('mapNextPoint'));

  const statusClass = confirmed
    ? 'location-status-confirmed'
    : loc.source === 'manual'
      ? 'location-status-manual'
      : 'location-status-pending';
  const statusText = confirmed ? t('statusConfirmed') : hasPin(loc) ? t('statusManual') : t('statusNotSet');

  const allConfirmed = LOCATION_DEFS.every((d) => isDone(locations[d.key]));

  return (
    <div className="mapfull">
      <FullMap points={points} activeKey={def.key} onPlace={handlePlace} focus={focus} basemap={basemap} />

      <div className="mapfull-basemap" role="group" aria-label={t('mapBasemap')}>
        <button type="button" className={basemap === 'standard' ? 'is-active' : ''} aria-pressed={basemap === 'standard'} onClick={() => setBasemap('standard')}>
          {t('mapStandard')}
        </button>
        <button type="button" className={basemap === 'satellite' ? 'is-active' : ''} aria-pressed={basemap === 'satellite'} onClick={() => setBasemap('satellite')}>
          {t('mapSatellite')}
        </button>
      </div>

      <div className="mapfull-top">
        <div className="mapfull-card">
          <div className="mapfull-heading-row">
            <div className="mapfull-step-heading">{t(def.titleKey)}</div>
            <span className={`location-status ${statusClass}`}>{statusText}</span>
          </div>
          <StepProgress current={2} total={3} labels={[t('stepPersonalInfo'), t('stepLocations'), t('stepReview')]} />
          <div className="mapfull-steps" role="tablist">
            {LOCATION_DEFS.map((d, i) => (
              <button
                key={d.key}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={t(d.titleKey)}
                className={`mapfull-pill${i === active ? ' is-active' : ''}${isDone(locations[d.key]) ? ' is-done' : ''}`}
                style={{ '--pill': d.color }}
                onClick={() => setActive(i)}
              >
                {isDone(locations[d.key]) && i !== active ? <Check size={14} /> : i + 1}
              </button>
            ))}
            <span className="mapfull-count">
              {t('mapStepOf').replace('{n}', active + 1).replace('{total}', LOCATION_DEFS.length)}
            </span>
          </div>

          <div className="map-search" style={{ marginBottom: 6 }}>
            <input
              type="text"
              value={searchQuery}
              autoCapitalize="words"
              onChange={(e) => setSearchQuery(capitalizeEnglishWords(e.target.value))}
              placeholder={t('mapSearchPlaceholder')}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
            />
            <button type="button" className="btn" onClick={handleSearch} disabled={searching}>
              <Search size={15} />
              {searching ? t('mapSearching') : t('mapSearchButton')}
            </button>
          </div>

          <div className="map-hint" style={{ margin: 0 }}>
            <MapPin size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{searchMessage || (hasPin(loc) ? t('mapInstruction') : t('mapNoPinYet'))}</span>
          </div>

          {showWarning && !allConfirmed && (
            <div className="banner-error" role="alert" style={{ marginTop: 8, marginBottom: 0 }}>
              {t('locationRequiredWarning')}
            </div>
          )}
        </div>
      </div>

      <div className="mapfull-bottom">
        <div className="mapfull-card">
          <div className="mapfull-actions">
            <button type="button" className="btn" onClick={handleBack}>
              {t('btnBack')}
            </button>
            <button type="button" className="btn btn-danger-text" onClick={handleClear} disabled={!hasPin(loc)}>
              <RotateCcw size={14} />
              {t('mapClearButton')}
            </button>
            <button type="button" className="btn btn-primary mapfull-primary" onClick={handlePrimary} disabled={!hasPin(loc)}>
              <Check size={15} />
              {primaryLabel}
            </button>
          </div>
          <div className="mapfull-credit">
            {basemap === 'satellite' ? t('mapAttributionSatellite') : t('mapAttributionStandard')}
          </div>
        </div>
      </div>
    </div>
  );
}