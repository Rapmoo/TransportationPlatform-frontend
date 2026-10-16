import { ShieldX } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useWorkerForm, STEPS } from '../context/WorkerFormContext';

export default function RejectedStep() {
  const { t } = useLanguage();
  const { setStep, openCorrection } = useWorkerForm();

  return (
    <div className="rejected-screen">
      <div className="rejected-icon" aria-hidden="true"><ShieldX size={34} /></div>
      <div className="status-pill status-pill-danger">{t('alreadySubmittedStatus')}</div>
      <h1>{t('alreadySubmittedTitle')}</h1>
      <p>{t('alreadySubmittedBody')}</p>
      <div className="rejected-lock-note">
        <strong>{t('alreadySubmittedRuleTitle')}</strong>
        <span>{t('alreadySubmittedRuleBody')}</span>
      </div>
      <div className="success-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={() => openCorrection(STEPS.REJECTED)}>
          {t('requestCorrection')}
        </button>
        <button type="button" className="btn btn-block" onClick={() => setStep(STEPS.CORRECTION_STATUS)}>
          {t('viewCorrectionStatus')}
        </button>
      </div>
    </div>
  );
}