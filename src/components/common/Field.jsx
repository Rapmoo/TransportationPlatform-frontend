import { AlertCircle } from 'lucide-react';

export default function Field({ label, required, error, helper, children }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label>
        {label}
        {required && <span className="required-mark">*</span>}
      </label>
      {children}
      {error ? (
        <div className="error">
          <AlertCircle size={13} />
          <span>{error}</span>
        </div>
      ) : helper ? (
        <div className="helper">{helper}</div>
      ) : null}
    </div>
  );
}
