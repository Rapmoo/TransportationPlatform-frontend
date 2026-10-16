import { useLanguage } from '../../i18n/LanguageContext';

export default function BaseLayerToggle({ value, onChange }) {
  const { t } = useLanguage();
  return (
    <div className="map-layer-toggle" role="group" aria-label={t('mapLayerLabel')}>
      <button
        type="button"
        className={value === 'street' ? 'active' : ''}
        onClick={() => onChange('street')}
      >
        {t('mapStreet')}
      </button>
      <button
        type="button"
        className={value === 'satellite' ? 'active' : ''}
        onClick={() => onChange('satellite')}
      >
        {t('mapSatellite')}
      </button>
    </div>
  );
}