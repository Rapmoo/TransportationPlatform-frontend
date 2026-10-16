import { useLanguage } from '../i18n/LanguageContext';
import { useWorkerForm, STEPS } from '../context/WorkerFormContext';
import publicTransportMark from '../assets/logos/public-transport-mark.png';

export default function WelcomeStep() {
  const { t } = useLanguage();
  const { setStep } = useWorkerForm();

  return (
    <div className="welcome-layout">
      <aside className="welcome-side welcome-logo-side" aria-hidden="true">
        <div
          className="welcome-logo-mark"
          style={{ backgroundImage: `url(${publicTransportMark})` }}
        />
      </aside>

      <section className="welcome-content">
        <div className="welcome-content-inner">
          <h1>{t('welcomeTitle')}</h1>
          <p className="welcome-description">{t('welcomeSubtitle')}</p>
          <button
            type="button"
            className="btn btn-primary btn-block welcome-start-button"
            onClick={() => setStep(STEPS.FORM)}
          >
            {t('welcomeStart')}
          </button>
          <p className="welcome-privacy-note">{t('welcomePrivacyNote')}</p>
          <button
            type="button"
            className="btn change-request-trigger welcome-change-request-button"
            onClick={() => setStep(STEPS.CORRECTION)}
          >
            {t('changeReqTitle')}
          </button>
        </div>
      </section>
    </div>
  );
}
