import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function ConfirmModal({ open, onCancel, onSubmit, submitting, submitError }) {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="overlay-sheet">
        <h2 id="confirm-title">{t('confirmTitle')}</h2>
        <p>{t('confirmBody')}</p>

        {submitError && (
          <div className="banner-error" role="alert">
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{submitError}</span>
          </div>
        )}

        <div className="step-actions" style={{ marginTop: 4 }}>
          <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
            {t('confirmGoBack')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={submitting}>
            {submitting ? t('submitting') : t('confirmSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}
