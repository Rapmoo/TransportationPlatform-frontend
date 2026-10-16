import { useLanguage } from '../../i18n/LanguageContext';
import publicTransportLogo from '../../assets/logos/public-transport-logo.png';

export default function WorkerHeader() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="worker-header">
      <div className="worker-header-logos">
        <img src={publicTransportLogo} alt={t('logoAlt')} />
        <span className="worker-header-title">{t('appTitle')}</span>
      </div>
      <div className="lang-switch" role="group" aria-label={t('languageSelector')}>
        <button
          type="button"
          className={language === 'am' ? 'active' : ''}
          onClick={() => setLanguage('am')}
          aria-pressed={language === 'am'}
        >
          AMH
        </button>
        <button
          type="button"
          className={language === 'en' ? 'active' : ''}
          onClick={() => setLanguage('en')}
          aria-pressed={language === 'en'}
        >
          ENG
        </button>
        <button
          type="button"
          className={language === 'om' ? 'active' : ''}
          onClick={() => setLanguage('om')}
          aria-pressed={language === 'om'}
        >
          ORO
        </button>
      </div>
    </header>
  );
}