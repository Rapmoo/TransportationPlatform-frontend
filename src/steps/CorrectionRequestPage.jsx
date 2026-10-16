import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useWorkerForm } from '../context/WorkerFormContext';
import ChangeRequestBox from '../components/ChangeRequestBox';

export default function CorrectionRequestPage() {
  const { t } = useLanguage();
  const { returnFromCorrection } = useWorkerForm();

  return (
    <div className="correction-request-page">
      <button type="button" className="link-button correction-request-back" onClick={returnFromCorrection}>
        <ArrowLeft size={16} /> {t('backToSubmission')}
      </button>

      <div className="card correction-request-page-header">
        <div className="eyebrow">{t('changeReqTitle')}</div>
        <h1>{t('changeReqTitle')}</h1>
        <p>{t('changeReqHelp')}</p>
      </div>

      <ChangeRequestBox pageMode />
    </div>
  );
}