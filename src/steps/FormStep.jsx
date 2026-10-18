import { useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useWorkerForm, STEPS } from '../context/WorkerFormContext';
import Field from '../components/common/Field';
import StepProgress from '../components/common/StepProgress';
import { validatePersonalForm, capitalizeEnglishWords } from '../utils/validation';
import { clearWorkerSessionToken } from '../api/workerApi';

export default function FormStep() {
  const { t } = useLanguage();
  const { personal, updatePersonalField, setStep, syncLocationAddresses, editInfo, resetAll } = useWorkerForm();
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);

  // Answers are always entered in English, regardless of interface language.
  // Short text answers are automatically normalized to consistent title case.
  const CAPITALIZED = ['firstName', 'middleName', 'lastName', 'organization',
    'homeAddress', 'startPointAddress', 'boardingAddress', 'afterWorkAddress',
    'busNumberGoing', 'busNumberReturn'];

  const handleChange = (field) => (e) => {
    const value = CAPITALIZED.includes(field)
      ? capitalizeEnglishWords(e.target.value)
      : e.target.value;
    updatePersonalField(field, value);
  };

  const handleContinue = () => {
    const nextErrors = validatePersonalForm(personal, t);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    syncLocationAddresses();
    setStep(STEPS.LOCATIONS);
  };

  // Enter moves to the next input (like Tab) instead of doing nothing; on the
  // last input it continues to the next step. Skips read-only/disabled inputs
  // and ignores Enter while an IME (e.g. Amharic keyboard) is composing text.
  const handleEnterKey = (e) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return;
    const el = e.target;
    if (el.tagName !== 'INPUT') return;
    e.preventDefault();
    const inputs = Array.from(
      formRef.current.querySelectorAll('input:not([type="hidden"]):not([readonly]):not([disabled])')
    );
    const next = inputs[inputs.indexOf(el) + 1];
    if (next) {
      next.focus();
      next.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
      el.blur();
      handleContinue();
    }
  };

  const cancelEditing = () => {
    clearWorkerSessionToken();
    resetAll();
  };

  return (
    <div ref={formRef} onKeyDown={handleEnterKey}>
      {editInfo && (
        <div className="card edit-mode-banner">
          <div className="eyebrow">{t('editModeEyebrow')}</div>
          <h2>{t('editModeTitle')} · {editInfo.submissionNumber}</h2>
          <p>{t('editModeBody')}</p>
          <button type="button" className="btn btn-sm" onClick={cancelEditing}>{t('editModeCancel')}</button>
        </div>
      )}

      <StepProgress current={1} total={3} labels={[t('stepPersonalInfo'), t('stepLocations'), t('stepReview')]} />

      <p className="form-language-rule">{t('englishAnswerRule')}</p>

      <div className="card">
        <h2>{t('sectionPersonal')}</h2>
        <Field label={t('fieldFirstName')} required error={errors.firstName}>
          <input
            type="text"
            autoCapitalize="words"
            value={personal.firstName}
            onChange={handleChange('firstName')}
            placeholder={t('fieldFirstNamePlaceholder')}
            autoComplete="given-name"
          />
        </Field>
        <Field label={t('fieldMiddleName')} required error={errors.middleName}>
          <input
            type="text"
            autoCapitalize="words"
            value={personal.middleName}
            onChange={handleChange('middleName')}
            placeholder={t('fieldMiddleNamePlaceholder')}
            autoComplete="additional-name"
          />
        </Field>
        <Field label={t('fieldLastName')} required error={errors.lastName}>
          <input
            type="text"
            autoCapitalize="words"
            value={personal.lastName}
            onChange={handleChange('lastName')}
            placeholder={t('fieldLastNamePlaceholder')}
            autoComplete="family-name"
          />
        </Field>
        <Field label={t('fieldFaydaId')} required error={errors.faydaId}>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={16}
            value={personal.faydaId}
            onChange={(e) => updatePersonalField('faydaId', e.target.value.replace(/\D/g, '').slice(0, 16))}
            placeholder={t('fieldFaydaIdPlaceholder')}
            autoComplete="off"
            readOnly={Boolean(editInfo)}
          />
          {editInfo && <div className="helper">{t('editFaydaLocked')}</div>}
        </Field>
        <Field label={t('fieldPhoneNumber')} required error={errors.phoneNumber}>
          <input
            type="tel"
            value={personal.phoneNumber}
            onChange={handleChange('phoneNumber')}
            placeholder={t('fieldPhoneNumberPlaceholder')}
            autoComplete="tel"
          />
        </Field>
      </div>

      <div className="card">
        <h2>{t('sectionEmployment')}</h2>
        <Field label={t('fieldOrganization')} required error={errors.organization}>
          <input
            type="text"
            value={personal.organization}
            onChange={handleChange('organization')}
            placeholder={t('fieldOrganizationPlaceholder')}
          />
        </Field>
      </div>

      <div className="card">
        <h2>{t('sectionTransportation')}</h2>
        <div className="transportation-form-grid">
          <div className="transportation-field-full">
            <Field label={t('fieldHomeAddress')} required error={errors.homeAddress}>
              <input
                type="text"
                value={personal.homeAddress}
                onChange={handleChange('homeAddress')}
                placeholder={t('fieldHomeAddressPlaceholder')}
              />
            </Field>
          </div>
          <Field label={t('fieldStartPoint')} required error={errors.startPointAddress}>
            <input
              type="text"
              value={personal.startPointAddress}
              onChange={handleChange('startPointAddress')}
              placeholder={t('fieldStartPointPlaceholder')}
            />
          </Field>
          <Field label={t('fieldBusNumberGoing')} required error={errors.busNumberGoing}>
            <input
              type="text"
              maxLength={50}
              value={personal.busNumberGoing}
              onChange={handleChange('busNumberGoing')}
              placeholder={t('fieldBusNumberGoingPlaceholder')}
              autoComplete="off"
            />
          </Field>
          <div className="transportation-field-full">
            <Field label={t('fieldBoardingAddress')} required error={errors.boardingAddress}>
              <input
                type="text"
                value={personal.boardingAddress}
                onChange={handleChange('boardingAddress')}
                placeholder={t('fieldBoardingAddressPlaceholder')}
              />
            </Field>
          </div>
          <Field label={t('fieldAfterWorkAddress')} required error={errors.afterWorkAddress}>
            <input
              type="text"
              value={personal.afterWorkAddress}
              onChange={handleChange('afterWorkAddress')}
              placeholder={t('fieldAfterWorkAddressPlaceholder')}
            />
          </Field>
          <Field label={t('fieldBusNumberReturn')} required error={errors.busNumberReturn}>
            <input
              type="text"
              maxLength={50}
              value={personal.busNumberReturn}
              onChange={handleChange('busNumberReturn')}
              placeholder={t('fieldBusNumberReturnPlaceholder')}
              autoComplete="off"
            />
          </Field>
        </div>
      </div>

      <div className="card">
        <h2>{t('sectionBus')}</h2>
        <Field label={t('fieldPublicBusId')} required error={errors.publicBusId}>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={16}
            value={personal.publicBusId}
            onChange={(e) => updatePersonalField('publicBusId', e.target.value.replace(/\D/g, '').slice(0, 16))}
            placeholder={t('fieldPublicBusIdPlaceholder')}
            autoComplete="off"
          />
        </Field>
      </div>

      <div className="step-actions">
        <button type="button" className="btn btn-primary" onClick={handleContinue}>
          {t('btnContinueToLocations')}
        </button>
      </div>
    </div>
  );
}