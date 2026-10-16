import { useState } from 'react';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { WorkerFormProvider, useWorkerForm, STEPS } from './context/WorkerFormContext';
import WorkerHeader from './components/layout/WorkerHeader';
import WorkerFooter from './components/layout/WorkerFooter';
import WelcomeStep from './steps/WelcomeStep';
import FormStep from './steps/FormStep';
import LocationStep from './steps/LocationStep';
import ReviewStep from './steps/ReviewStep';
import ConfirmModal from './steps/ConfirmModal';
import SuccessStep from './steps/SuccessStep';
import CorrectionStep from './steps/CorrectionStep';
import CorrectionRequestPage from './steps/CorrectionRequestPage';
import CorrectionStatusStep from './steps/CorrectionStatusStep';
import RejectedStep from './steps/RejectedStep';
import { submitWorkerData, ApiNotConfiguredError, ApiRequestError } from './api/workerApi';

function WorkerFlow() {
  const { t } = useLanguage();
  const formState = useWorkerForm();
  const { step } = formState;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await submitWorkerData(formState);
      setConfirmOpen(false);
      formState.markSubmitted(result || {});
    } catch (err) {
      // A repeated employee ID is NOT an error any more (the backend returns
      // 201 and only warns the supervisor), so there is no REJECTED redirect.
      if (err instanceof ApiNotConfiguredError) {
        setSubmitError(t('submitErrorNotConfigured'));
      } else if (err instanceof ApiRequestError) {
        setSubmitError(err.message || t('submitErrorGeneric'));
      } else {
        setSubmitError(t('submitErrorGeneric'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`worker-app${step === STEPS.WELCOME ? ' worker-app-welcome' : ''}`}>
      <WorkerHeader />
      <main className={`worker-main${step === STEPS.WELCOME ? ' worker-main-welcome' : ''}`}>
        {step === STEPS.WELCOME && <WelcomeStep />}
        {step === STEPS.FORM && <FormStep />}
        {step === STEPS.LOCATIONS && <LocationStep />}
        {step === STEPS.REVIEW && <ReviewStep onContinue={() => { setSubmitError(''); setConfirmOpen(true); }} />}
        {step === STEPS.SUCCESS && <SuccessStep />}
        {step === STEPS.REJECTED && <RejectedStep />}
        {step === STEPS.CORRECTION && <CorrectionRequestPage />}
        {step === STEPS.CORRECTION_STATUS && <CorrectionStatusStep />}
      </main>
      <WorkerFooter />

      <ConfirmModal
        open={confirmOpen && step === STEPS.REVIEW}
        onCancel={() => { if (!submitting) setConfirmOpen(false); }}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitError={submitError}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <WorkerFormProvider>
        <WorkerFlow />
      </WorkerFormProvider>
    </LanguageProvider>
  );
}