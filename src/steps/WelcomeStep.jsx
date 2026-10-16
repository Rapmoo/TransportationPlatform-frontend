import { useLanguage } from '../i18n/LanguageContext';
import { useWorkerForm, STEPS } from '../context/WorkerFormContext';
import publicTransportMark from '../assets/logos/public-transport-mark.png';

export default function WelcomeStep() {
  const { t } = useLanguage();
  const { setStep, openCorrection } = useWorkerForm();

  return (
    <div className="welcome-layout">
      <section className="welcome-content">
        <h1>{t('welcomeTitle')}</h1>
        <p>{t('welcomeSubtitle')}</p>
        <button type="button" className="btn btn-primary btn-block welcome-start-button" onClick={() => setStep(STEPS.FORM)}>
          {t('welcomeStart')}
        </button>
        <p className="welcome-privacy-note">
          {t('welcomePrivacyNote')}
        </p>
      </section>

      <aside className="welcome-side welcome-logo-side" aria-hidden="true">
        <div
          className="welcome-logo-mark"
          style={{ backgroundImage: `url(${publicTransportMark})` }}
        />
      </aside>

      <button
        type="button"
        className="btn btn-primary change-request-trigger welcome-change-request-button"
        onClick={() => openCorrection(STEPS.WELCOME)}
      >
        {t('changeReqTitle')}
      </button>
    </div>
  );
}