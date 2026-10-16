import { useState } from 'react';
import { CheckCircle2, ClipboardPenLine, FilePlus2, Copy, Check } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useWorkerForm, STEPS } from '../context/WorkerFormContext';

const BALLOON_COLORS = ['#0E7C86', '#B9791F', '#7A4FB5', '#2F7D4F', '#C0392B'];

function SuccessBalloons() {
  const balloons = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    left: `${6 + i * 9.5}%`,
    color: BALLOON_COLORS[i % BALLOON_COLORS.length],
    delay: `${(i % 5) * 0.25}s`,
    duration: `${4.6 + (i % 4) * 0.2}s`,
  }));

  return (
    <div className="success-balloons" aria-hidden="true">
      {balloons.map((b) => (
        <span
          key={b.id}
          className="success-balloon"
          style={{
            left: b.left,
            background: b.color,
            color: b.color,
            animationDelay: b.delay,
            animationDuration: b.duration,
          }}
        />
      ))}
    </div>
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers / non-secure pages without the Clipboard API.
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function SuccessStep() {
  const { t } = useLanguage();
  const { openCorrection, startNewSubmission, submissionResult } = useWorkerForm();
  const [copied, setCopied] = useState(false);

  // The submit call returns the number as reference_id.
  const submissionId = submissionResult?.reference_id || submissionResult?.submission_number || '';

  const handleCopy = async () => {
    if (await copyText(submissionId)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="success-screen">
      <SuccessBalloons />
      <div className="success-icon">
        <CheckCircle2 size={34} />
      </div>
      <div className="status-pill status-pill-success">{t('submittedStatus')}</div>
      <h1>{t('successHeading')}</h1>
      <p>{t('successMessage')}</p>
      <p>{t('successNoEditNote')}</p>

      {submissionId && (
        <div className="submission-id-card">
          <div className="submission-id-label">{t('submissionIdLabel')}</div>
          <div className="submission-id-row">
            <span className="submission-id-value" data-testid="submission-id">{submissionId}</span>
            <button type="button" className="btn btn-sm submission-id-copy" onClick={handleCopy} aria-live="polite">
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? t('copiedId') : t('copyId')}
            </button>
          </div>
          <div className="helper">{t('successSaveId')}</div>
        </div>
      )}

      <div className="success-actions success-another">
        <button type="button" className="btn btn-primary btn-block" onClick={startNewSubmission}>
          <FilePlus2 size={16} />
          {t('changeReqTabNewSubmission')}
        </button>
      </div>

      <p className="success-thanks">{t('successThanks')}</p>

      <div className="success-actions">
        <button type="button" className="btn success-request-correction" onClick={() => openCorrection(STEPS.SUCCESS)}>
          <ClipboardPenLine size={16} />
          {t('requestCorrection')}
        </button>
      </div>
    </div>
  );
}