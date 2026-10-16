import { useLanguage } from '../i18n/LanguageContext';
import { useWorkerForm, STEPS } from '../context/WorkerFormContext';
import StepProgress from '../components/common/StepProgress';
import ReviewMap from '../components/map/ReviewMap';

function ReviewRow({ label, value }) {
  return (
    <div className="review-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function ReviewStep({ onContinue }) {
  const { t } = useLanguage();
  const { personal, locations, setStep } = useWorkerForm();

  return (
    <div>
      <StepProgress current={3} total={3} labels={[t('stepPersonalInfo'), t('stepLocations'), t('stepReview')]} />

      <div className="card">
        <h2>{t('reviewTitle')}</h2>
        <p style={{ fontSize: 13, color: 'var(--slate-700)', margin: '-4px 0 4px' }}>{t('reviewHelp')}</p>
      </div>

      <div className="card">
        <h2>{t('reviewPersonal')}</h2>
        <dl style={{ margin: 0 }}>
          <ReviewRow label={t('fieldFirstName')} value={personal.firstName} />
          <ReviewRow label={t('fieldMiddleName')} value={personal.middleName} />
          <ReviewRow label={t('fieldLastName')} value={personal.lastName} />
          <ReviewRow label={t('fieldFaydaId')} value={personal.faydaId} />
          <ReviewRow label={t('fieldPhoneNumber')} value={personal.phoneNumber} />
        </dl>
      </div>

      <div className="card">
        <h2>{t('reviewEmployment')}</h2>
        <dl style={{ margin: 0 }}>
          <ReviewRow label={t('fieldOrganization')} value={personal.organization} />
        </dl>
      </div>

      <div className="card">
        <h2>{t('reviewTransportation')}</h2>
        <dl style={{ margin: 0 }}>
          <ReviewRow label={t('fieldHomeAddress')} value={personal.homeAddress} />
          <ReviewRow label={t('fieldStartPoint')} value={personal.startPointAddress} />
          <ReviewRow label={t('fieldBoardingAddress')} value={personal.boardingAddress} />
          <ReviewRow label={t('fieldAfterWorkAddress')} value={personal.afterWorkAddress} />
        </dl>
      </div>

      <div className="card">
        <h2>{t('reviewBus')}</h2>
        <dl style={{ margin: 0 }}>
          <ReviewRow label={t('fieldBusNumberGoing')} value={personal.busNumberGoing} />
          <ReviewRow label={t('fieldBusNumberReturn')} value={personal.busNumberReturn} />
        </dl>
      </div>

      <div className="card">
        <h2>{t('reviewLocations')}</h2>
        <h3 style={{ fontSize: 13, color: 'var(--ink-900)', margin: '0 0 10px' }}>{t('reviewMapTitle')}</h3>
        <ReviewMap locations={locations} />
      </div>

      <div className="step-actions">
        <button type="button" className="btn" onClick={() => setStep(STEPS.LOCATIONS)}>
          {t('btnEdit')}
        </button>
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          {t('btnContinueToFinal')}
        </button>
      </div>
    </div>
  );
}