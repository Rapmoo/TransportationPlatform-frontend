import { useMemo, useState } from 'react';
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useWorkerForm, STEPS } from '../context/WorkerFormContext';
import { createCorrectionRequest, ApiNotConfiguredError, ApiRequestError } from '../api/workerApi';
import { capitalizeEnglishWords, capitalizeSentenceStarts, hasOnlyEnglishLetters } from '../utils/validation';

function getCurrentValue(personal, locations, field) {
  const values = {
    fayda_id: personal.faydaId,
    phone_number: personal.phoneNumber,
    organization: personal.organization,
    home_address: locations.home.address,
    start_point_address: locations.start.address,
    boarding_address: locations.boarding.address,
    after_work_bus_pickup_address: locations.afterWork.address,
    public_bus_id: personal.publicBusId,
    bus_number_going: personal.busNumberGoing,
    bus_number_return: personal.busNumberReturn,
  };
  return values[field] || '';
}

export default function CorrectionStep() {
  const { t } = useLanguage();
  const { personal, locations, submissionResult, setStep, returnFromCorrection } = useWorkerForm();
  const [field, setField] = useState('home_address');
  const [requestedValue, setRequestedValue] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const currentValue = useMemo(() => getCurrentValue(personal, locations, field), [personal, locations, field]);

  const fields = [
    ['fayda_id', t('fieldFaydaId')],
    ['phone_number', t('fieldPhoneNumber')],
    ['organization', t('fieldOrganization')],
    ['home_address', t('fieldHomeAddress')],
    ['start_point_address', t('fieldStartPoint')],
    ['boarding_address', t('fieldBoardingAddress')],
    ['after_work_bus_pickup_address', t('fieldAfterWorkAddress')],
    ['public_bus_id', t('fieldPublicBusId')],
    ['bus_number_going', t('fieldBusNumberGoing')],
    ['bus_number_return', t('fieldBusNumberReturn')],
    ['other', t('correctionOther')],
  ];

  const handleSubmit = async () => {
    if (!field || !requestedValue.trim() || !reason.trim()) {
      setError(t('correctionRequired'));
      return;
    }
    if (!hasOnlyEnglishLetters(requestedValue) || !hasOnlyEnglishLetters(reason)) {
      setError(t('errorEnglishOnly'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      await createCorrectionRequest({ field, currentValue: field === 'other' ? '' : currentValue, requestedValue, reason, submissionNumber: submissionResult?.reference_id });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiNotConfiguredError) setError(t('accessErrorNotConfigured'));
      else if (err instanceof ApiRequestError && err.status === 409) setError(t('correctionExistingRequest'));
      else setError(err?.message || t('correctionSubmitError'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="card correction-success-card">
        <div className="success-mini-icon"><ShieldCheck size={24} /></div>
        <div className="status-pill status-pill-success">{t('correctionSentStatus')}</div>
        <h1>{t('correctionSentTitle')}</h1>
        <p>{t('correctionSentBody')}</p>
        <div className="step-actions correction-success-actions">
          <button type="button" className="btn" onClick={returnFromCorrection}>{t('backToSubmission')}</button>
          <button type="button" className="btn btn-primary" onClick={() => setStep(STEPS.CORRECTION_STATUS)}>{t('viewCorrectionStatus')}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="link-button" onClick={returnFromCorrection}>
        <ArrowLeft size={16} /> {t('backToSubmission')}
      </button>

      <div className="card correction-intro-card">
        <div className="eyebrow">{t('correctionEyebrow')}</div>
        <h1>{t('correctionTitle')}</h1>
        <p>{t('correctionHelp')}</p>
      </div>

      <p className="form-language-rule">{t('englishAnswerRule')}</p>

      <div className="card">
        <h2>{t('correctionDetailsTitle')}</h2>

        <div className="field">
          <label htmlFor="correction-field">{t('correctionFieldLabel')} <span className="required-mark">*</span></label>
          <select id="correction-field" value={field} onChange={(e) => setField(e.target.value)}>
            {fields.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        {field !== 'other' && (
          <div className="current-answer-box">
            <div className="current-answer-label">{t('correctionCurrentLabel')}</div>
            <div>{currentValue || t('correctionNoCurrentValue')}</div>
          </div>
        )}

        <div className="field">
          <label htmlFor="requested-value">{t('correctionNewValueLabel')} <span className="required-mark">*</span></label>
          <textarea
            id="requested-value"
            rows={4}
            value={requestedValue}
            autoCapitalize="words"
            onChange={(e) => setRequestedValue(capitalizeEnglishWords(e.target.value))}
            placeholder={t('correctionNewValuePlaceholder')}
          />
          <div className="helper">{t('correctionNewValueHelp')}</div>
        </div>

        <div className="field">
          <label htmlFor="correction-reason">{t('correctionReasonLabel')} <span className="required-mark">*</span></label>
          <textarea
            id="correction-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(capitalizeSentenceStarts(e.target.value))}
            placeholder={t('correctionReasonPlaceholder')}
          />
        </div>

        {error && <div className="banner-error" role="alert">{error}</div>}
      </div>

      <div className="correction-policy-note">
        <ShieldCheck size={17} />
        <p>{t('correctionPolicyNote')}</p>
      </div>

      <div className="step-actions">
        <button type="button" className="btn" onClick={returnFromCorrection} disabled={loading}>{t('cancelCorrection')}</button>
        <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          <Send size={16} />
          {loading ? t('correctionSending') : t('sendCorrection')}
        </button>
      </div>
    </div>
  );
}