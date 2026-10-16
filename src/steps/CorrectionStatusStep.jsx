import { useEffect, useState } from 'react';
import { ArrowLeft, Clock3, Pencil, RefreshCcw } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useWorkerForm, STEPS } from '../context/WorkerFormContext';
import {
  getCorrectionRequests,
  lookupChangeRequests,
  openEditSession,
  ApiNotConfiguredError,
  ApiRequestError,
} from '../api/workerApi';

function statusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return 'status-pill status-pill-success';
  if (normalized === 'rejected') return 'status-pill status-pill-danger';
  return 'status-pill status-pill-pending';
}

function fieldLabel(field, t) {
  const labels = {
    fayda_id: 'fieldFaydaId',
    phone_number: 'fieldPhoneNumber',
    organization: 'fieldOrganization',
    home_address: 'fieldHomeAddress',
    start_point_address: 'fieldStartPoint',
    boarding_address: 'fieldBoardingAddress',
    after_work_bus_pickup_address: 'fieldAfterWorkAddress',
    public_bus_id: 'fieldPublicBusId',
    bus_number_going: 'fieldBusNumberGoing',
    bus_number_return: 'fieldBusNumberReturn',
  };
  return t(labels[field] || 'correctionOther');
}

export default function CorrectionStatusStep() {
  const { language, t } = useLanguage();
  const { returnFromCorrection, openCorrection, startEditing, submissionResult } = useWorkerForm();
  const submissionNumber = submissionResult?.reference_id || null;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [grant, setGrant] = useState({ canEdit: false, editExpiresAt: null });
  const [opening, setOpening] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await getCorrectionRequests();
      setRequests(result?.requests || result || []);

      // Is a supervisor-approved edit open right now?
      if (submissionNumber) {
        const status = await lookupChangeRequests({ submissionNumber });
        setGrant({ canEdit: status.canEdit, editExpiresAt: status.editExpiresAt });
      }
    } catch (err) {
      if (err instanceof ApiNotConfiguredError) setError(t('accessErrorNotConfigured'));
      else if (err instanceof ApiRequestError && err.status === 401) setError(t('workerSessionExpired'));
      else setError(t('correctionStatusError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Opens the saved submission in the form so the worker can change it.
  const handleEdit = async () => {
    setOpening(true);
    setError('');
    try {
      const saved = await openEditSession({ submissionNumber });
      startEditing(saved);
    } catch (err) {
      setError(err instanceof ApiRequestError && err.message ? err.message : t('editLoadError'));
      setOpening(false);
    }
  };

  return (
    <div>
      <button type="button" className="link-button" onClick={returnFromCorrection}>
        <ArrowLeft size={16} /> {t('backToSubmission')}
      </button>

      <div className="card correction-status-header">
        <div>
          <div className="eyebrow">{t('correctionStatusEyebrow')}</div>
          <h1>{t('correctionStatusTitle')}</h1>
          <p>{t('correctionStatusHelp')}</p>
        </div>
        <button type="button" className="icon-button" onClick={() => load(true)} disabled={refreshing} aria-label={t('refresh')} title={t('refresh')}>
          <RefreshCcw size={17} className={refreshing ? 'spin' : ''} />
        </button>
      </div>

      {error && <div className="banner-error" role="alert">{error}</div>}

      {grant.canEdit && (
        <div className="banner-success cr-edit-open" role="status">
          <p>
            <strong>{t('changeReqEditOpenUntil')}</strong>{' '}
            {grant.editExpiresAt ? new Date(grant.editExpiresAt).toLocaleString() : ''}
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={handleEdit} disabled={opening}>
            <Pencil size={16} /> {opening ? t('changeReqOpening') : t('changeReqEditButton')}
          </button>
        </div>
      )}

      {loading ? (
        <div className="card empty-state"><Clock3 size={22} /><p>{t('correctionStatusLoading')}</p></div>
      ) : requests.length === 0 ? (
        <div className="card empty-state">
          <Clock3 size={22} />
          <h2>{t('noCorrectionRequests')}</h2>
          <p>{t('noCorrectionRequestsHelp')}</p>
        </div>
      ) : (
        <div className="request-list">
          {requests.map((item) => (
            <article className="card request-card" key={item.id || item.reference_id || `${item.created_at}-${item.requested_field}`}>
              <div className="request-card-top">
                <div>
                  <h2>{fieldLabel(item.requested_field, t)}</h2>
                </div>
                <span className={statusClass(item.status)}>{(() => {
                  const normalizedStatus = String(item.status || 'pending').toLowerCase();
                  const statusKey = normalizedStatus === 'approved' ? 'statusApproved' : normalizedStatus === 'rejected' ? 'statusRejected' : 'statusPending';
                  return t(statusKey);
                })()}</span>
              </div>

              <div className="request-details">
                <div>
                  <span>{t('correctionRequestedOn')}</span>
                  <strong>{item.created_at ? new Date(item.created_at).toLocaleString(language === 'am' ? 'am-ET' : language === 'om' ? 'om-ET' : 'en-US') : '—'}</strong>
                </div>
                <div>
                  <span>{t('correctionNewValueLabel')}</span>
                  <strong>{item.requested_value || '—'}</strong>
                </div>
                {item.admin_note && (
                  <div>
                    <span>{t('adminNote')}</span>
                    <strong>{item.admin_note}</strong>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="step-actions">
        <button type="button" className="btn" onClick={returnFromCorrection}>{t('backToSubmission')}</button>
        <button type="button" className="btn btn-primary" onClick={() => openCorrection(STEPS.CORRECTION_STATUS)}>{t('requestAnotherCorrection')}</button>
      </div>
    </div>
  );
}