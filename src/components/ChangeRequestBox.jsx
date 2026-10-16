import { useState } from 'react';
import { Send, Search, Pencil, ChevronDown, Plus, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useWorkerForm } from '../context/WorkerFormContext';
import { translations } from '../i18n/translations';
import { capitalizeEnglishWords, capitalizeSentenceStarts, hasOnlyEnglishLetters } from '../utils/validation';
import {
  createChangeRequestByNumber,
  lookupChangeRequests,
  openEditSession,
  ApiNotConfiguredError,
  ApiRequestError,
} from '../api/workerApi';

const FIELD_OPTIONS = [
  ['fayda_id', 'fieldFaydaId'],
  ['phone_number', 'fieldPhoneNumber'],
  ['organization', 'fieldOrganization'],
  ['home_address', 'fieldHomeAddress'],
  ['start_point_address', 'fieldStartPoint'],
  ['boarding_address', 'fieldBoardingAddress'],
  ['after_work_bus_pickup_address', 'fieldAfterWorkAddress'],
  ['public_bus_id', 'fieldPublicBusId'],
  ['bus_number_going', 'fieldBusNumberGoing'],
  ['bus_number_return', 'fieldBusNumberReturn'],
  ['other', 'correctionOther'],
];

// The backend allows one open request per submission, so several corrections
// are bundled into a single request.
const MAX_ITEMS = 5;
const MAX_TEXT = 1000;
let nextItemId = 1;
const newItem = (field = 'home_address') => ({ id: nextItemId++, field, requestedValue: '', reason: '' });

// English label, so the supervisor reads the same wording whatever language the worker used.
const englishLabel = (field) => {
  const option = FIELD_OPTIONS.find(([value]) => value === field);
  return option ? translations.en[option[1]] : field;
};

const STATUS_KEYS = {
  PENDING: 'changeReqStatusPending',
  APPROVED: 'changeReqStatusApproved',
  REJECTED: 'changeReqStatusRejected',
  EXPIRED: 'changeReqStatusExpired',
  COMPLETED: 'changeReqStatusCompleted',
};

// The backend sends UTC timestamps without a timezone suffix.
function localTime(value) {
  if (!value) return '—';
  const text = String(value);
  const date = new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(text) ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleString();
}

function statusPillClass(status) {
  if (status === 'APPROVED' || status === 'COMPLETED') return 'status-pill status-pill-success';
  if (status === 'REJECTED' || status === 'EXPIRED') return 'status-pill status-pill-danger';
  return 'status-pill status-pill-pending';
}

// Landing-page box, no login needed. The worker proves the submission is
// theirs with the 9-digit submission number.
//   Tab 1: send an edit request.
//   Tab 2: view the status of requests and, once approved, open the form to edit it.
export default function ChangeRequestBox({ pageMode = false }) {
  const { t } = useLanguage();
  const { startEditing } = useWorkerForm();

  const [open, setOpen] = useState(pageMode);
  const [tab, setTab] = useState('request');
  const [submissionNumber, setSubmissionNumber] = useState('');
  const [items, setItems] = useState(() => [newItem()]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState(null); // { requests, canEdit, editExpiresAt }

  const switchTab = (next) => {
    setTab(next);
    setError('');
    setSent(false);
  };

  const updateItem = (id, patch) => {
    const formattedPatch = { ...patch };
    if (typeof patch.requestedValue === 'string') {
      formattedPatch.requestedValue = capitalizeEnglishWords(patch.requestedValue);
    }
    if (typeof patch.reason === 'string') {
      formattedPatch.reason = capitalizeSentenceStarts(patch.reason);
    }
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...formattedPatch } : item)));
    setSent(false);
  };

  const addItem = () => {
    setItems((prev) => {
      if (prev.length >= MAX_ITEMS) return prev;
      const used = prev.map((item) => item.field);
      const free = FIELD_OPTIONS.find(([value]) => value !== 'other' && !used.includes(value));
      return [...prev, newItem(free ? free[0] : 'other')];
    });
    setSent(false);
  };

  const removeItem = (id) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
    setSent(false);
  };

  const explain = (err) => {
    if (err instanceof ApiNotConfiguredError) return t('submitErrorNotConfigured');
    if (err instanceof ApiRequestError) {
      if (err.status === 404) return t('changeReqNotFound');
      if (err.status === 429) return t('changeReqTooMany');
      if (err.status === 409) {
        if (/maximum/i.test(err.message)) return t('changeReqLimit');
        if (/approved edit/i.test(err.message)) return t('changeReqEditUnavailable');
        return t('changeReqExisting');
      }
      if (err.status === 422) return t('changeReqRequired');
      return err.message || t('correctionSubmitError');
    }
    return t('correctionSubmitError');
  };

  const checkIdentity = () => {
    if (!submissionNumber.trim()) {
      setError(t('changeReqRequired'));
      return false;
    }
    if (!/^[1-9][0-9]{8}$/.test(submissionNumber.trim())) {
      setError(t('changeReqBadNumber'));
      return false;
    }
    return true;
  };

  const handleSend = async () => {
    setError('');
    if (!checkIdentity()) return;
    if (items.some((item) => !item.requestedValue.trim() || !item.reason.trim())) {
      setError(t('changeReqRequired'));
      return;
    }
    if (items.some((item) => !hasOnlyEnglishLetters(item.requestedValue) || !hasOnlyEnglishLetters(item.reason))) {
      setError(t('errorEnglishOnly'));
      return;
    }

    // One correction is sent as it is. Several are combined into one request
    // ("other") with one labelled line per correction.
    let payload;
    if (items.length === 1) {
      const [only] = items;
      payload = { field: only.field, requestedValue: only.requestedValue, reason: only.reason };
    } else {
      payload = {
        field: 'other',
        requestedValue: items.map((item) => `${englishLabel(item.field)}: ${item.requestedValue.trim()}`).join('\n'),
        reason: items.map((item) => `${englishLabel(item.field)}: ${item.reason.trim()}`).join('\n'),
      };
    }
    if (payload.requestedValue.length > MAX_TEXT || payload.reason.length > MAX_TEXT) {
      setError(t('changeReqTooLong'));
      return;
    }

    setLoading(true);
    try {
      await createChangeRequestByNumber({ submissionNumber, ...payload });
      setSent(true);
      setItems([newItem()]);
    } catch (err) {
      setError(explain(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async () => {
    setError('');
    if (!checkIdentity()) return;
    setLoading(true);
    try {
      setStatus(await lookupChangeRequests({ submissionNumber }));
    } catch (err) {
      setStatus(null);
      setError(explain(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    setError('');
    if (!checkIdentity()) return;
    setLoading(true);
    try {
      const saved = await openEditSession({ submissionNumber });
      startEditing(saved);
    } catch (err) {
      setError(err instanceof ApiRequestError ? explain(err) : t('editLoadError'));
      setLoading(false);
    }
  };

  const fieldLabel = (key) => {
    const option = FIELD_OPTIONS.find(([value]) => value === key);
    return option ? t(option[1]) : key;
  };

  if (!open && !pageMode) {
    return (
      <button type="button" className="btn btn-primary btn-block change-request-trigger" aria-expanded="false" aria-controls="cr-body" onClick={() => setOpen(true)}>
        {t('changeReqTitle')}
      </button>
    );
  }

  return (
    <div className={`card change-request-box${pageMode ? ' change-request-page-card' : ''}`}>
      {!pageMode && (
        <h2>
          <button type="button" className="cr-toggle" aria-expanded="true" aria-controls="cr-body" onClick={() => setOpen(false)}>
            <span>{t('changeReqTitle')}</span>
            <ChevronDown size={18} className="cr-chevron is-open" />
          </button>
        </h2>
      )}

      <div id="cr-body">
      <div className="cr-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'request'} className={`cr-tab${tab === 'request' ? ' is-active' : ''}`} onClick={() => switchTab('request')}>
          {t('changeReqTabRequest')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'status'} className={`cr-tab${tab === 'status' ? ' is-active' : ''}`} onClick={() => switchTab('status')}>
          {t('changeReqTabViewStatus')}
        </button>
      </div>

      <p className="change-request-help">{t(tab === 'request' ? 'changeReqHelp' : 'changeReqStatusHelp')}</p>
      {tab === 'request' && <p className="form-language-rule">{t('englishAnswerRule')}</p>}

      <div className="field">
        <label htmlFor="cr-number">{t('changeReqNumberLabel')} <span className="required-mark">*</span></label>
        <input
          id="cr-number"
          inputMode="numeric"
          maxLength={9}
          value={submissionNumber}
          onChange={(e) => { setSubmissionNumber(e.target.value.replace(/\D/g, '')); setSent(false); }}
          autoComplete="off"
        />
      </div>

      {tab === 'request' && (
      <>
          {sent && (
            <div className="banner-success" role="status">
              <strong>{t('changeReqSent')}.</strong> {t('changeReqSentBody')}
            </div>
          )}

          {items.map((item, index) => (
            <div className={items.length > 1 ? 'cr-item' : undefined} key={item.id}>
              {items.length > 1 && (
                <div className="cr-item-head">
                  <strong>{t('correctionItem').replace('{n}', index + 1)}</strong>
                  <button type="button" className="cr-item-remove" onClick={() => removeItem(item.id)} aria-label={t('correctionRemove')}>
                    <X size={15} /> {t('correctionRemove')}
                  </button>
                </div>
              )}

              <div className="field">
                <label htmlFor={`cr-field-${item.id}`}>{t('correctionFieldLabel')} <span className="required-mark">*</span></label>
                <select id={`cr-field-${item.id}`} value={item.field} onChange={(e) => updateItem(item.id, { field: e.target.value })}>
                  {FIELD_OPTIONS.map(([value, labelKey]) => (
                    <option
                      key={value}
                      value={value}
                      disabled={value !== 'other' && value !== item.field && items.some((other) => other.field === value)}
                    >
                      {t(labelKey)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor={`cr-requested-${item.id}`}>{t('correctionNewValueLabel')} <span className="required-mark">*</span></label>
                <textarea
                  id={`cr-requested-${item.id}`}
                  rows={3}
                  maxLength={MAX_TEXT}
                  value={item.requestedValue}
                  autoCapitalize="words"
                  onChange={(e) => updateItem(item.id, { requestedValue: e.target.value })}
                  placeholder={t('correctionNewValuePlaceholder')}
                />
              </div>

              <div className="field">
                <label htmlFor={`cr-reason-${item.id}`}>{t('correctionReasonLabel')} <span className="required-mark">*</span></label>
                <textarea
                  id={`cr-reason-${item.id}`}
                  rows={3}
                  maxLength={MAX_TEXT}
                  value={item.reason}
                  onChange={(e) => updateItem(item.id, { reason: e.target.value })}
                  placeholder={t('correctionReasonPlaceholder')}
                />
              </div>
            </div>
          ))}

          {items.length < MAX_ITEMS && (
            <button type="button" className="cr-add" onClick={addItem}>
              <Plus size={16} /> {t('correctionAddAnother')}
            </button>
          )}

          {error && <div className="banner-error" role="alert">{error}</div>}

          <button type="button" className="btn btn-primary btn-block" onClick={handleSend} disabled={loading}>
            <Send size={16} />
            {loading ? t('changeReqSending') : t('changeReqSend')}
          </button>
      </>
      )}

      {tab === 'status' && (
        <>
          {error && <div className="banner-error" role="alert">{error}</div>}

          <button type="button" className="btn btn-primary btn-block" onClick={handleCheck} disabled={loading}>
            <Search size={16} />
            {loading && !status ? t('changeReqChecking') : t('changeReqCheck')}
          </button>

          {status && status.requests.length === 0 && (
            <p className="change-request-help" style={{ marginTop: 14 }}>{t('changeReqNoRequests')}</p>
          )}

          {status && status.canEdit && (
            <div className="banner-success cr-edit-open" role="status">
              <div>
                <strong>{t('changeReqEditOpenUntil')}</strong>{' '}
                {localTime(status.editExpiresAt)}
              </div>
              <button type="button" className="btn btn-primary btn-block" onClick={handleEdit} disabled={loading}>
                <Pencil size={16} />
                {loading ? t('changeReqOpening') : t('changeReqEditButton')}
              </button>
            </div>
          )}

          {status && status.requests.length > 0 && (
            <div className="request-list" style={{ marginTop: 14 }}>
              {status.requests.map((item) => (
                <article className="card request-card" key={item.id}>
                  <div className="request-card-top">
                    <div>
                      <h2 style={{ border: 0, padding: 0, margin: 0 }}>
                        {item.field ? fieldLabel(item.field) : t('correctionOther')}
                      </h2>
                    </div>
                    <span className={statusPillClass(item.status)}>{t(STATUS_KEYS[item.status] || 'changeReqStatusPending')}</span>
                  </div>
                  <div className="request-details">
                    <div>
                      <span>{t('correctionRequestedOn')}</span>
                      <strong>{localTime(item.created_at)}</strong>
                    </div>
                    {item.requested_value && (
                      <div>
                        <span>{t('correctionNewValueLabel')}</span>
                        <strong>{item.requested_value}</strong>
                      </div>
                    )}
                    {item.admin_note && (
                      <div>
                        <span>{t('changeReqSupervisorNote')}</span>
                        <strong>{item.admin_note}</strong>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}