import { createContext, useContext, useMemo, useState, useCallback } from 'react';

const WorkerFormContext = createContext(null);

const EMPTY_LOCATION = { address: '', lat: null, lon: null, confirmed: false, source: null };

const INITIAL_PERSONAL = {
  faydaId: '',
  firstName: '',
  middleName: '',
  lastName: '',
  phoneNumber: '',
  organization: '',
  homeAddress: '',
  startPointAddress: '',
  boardingAddress: '',
  afterWorkAddress: '',
  publicBusId: '',
  busNumberGoing: '',
  busNumberReturn: '',
};

const INITIAL_LOCATIONS = {
  home: { ...EMPTY_LOCATION },
  start: { ...EMPTY_LOCATION },
  boarding: { ...EMPTY_LOCATION },
  afterWork: { ...EMPTY_LOCATION },
};

export const STEPS = {
  WELCOME: 'welcome',
  FORM: 'form',
  LOCATIONS: 'locations',
  REVIEW: 'review',
  SUCCESS: 'success',
  REJECTED: 'rejected',
  CORRECTION: 'correction',
  CORRECTION_STATUS: 'correction-status',
};

export function WorkerFormProvider({ children }) {
  const [step, setStep] = useState(STEPS.WELCOME);
  const [personal, setPersonal] = useState(INITIAL_PERSONAL);
  const [locations, setLocations] = useState(INITIAL_LOCATIONS);
  const [submissionResult, setSubmissionResult] = useState(null);
  // Set while a worker edits an already-submitted form with a supervisor's approval.
  const [editInfo, setEditInfo] = useState(null);
  // The screen the worker came from when opening the correction flow, so
  // "Back" returns there (success screen, rejected screen or status screen).
  const [correctionOrigin, setCorrectionOrigin] = useState(STEPS.SUCCESS);

  const locked = Boolean(submissionResult);

  const updatePersonalField = useCallback((field, value) => {
    setPersonal((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setPersonal(INITIAL_PERSONAL);
    setLocations(INITIAL_LOCATIONS);
    setSubmissionResult(null);
    setEditInfo(null);
  }, []);

  // Pre-fill the form from the saved submission and start editing it.
  const startEditing = useCallback(({ personal: savedPersonal, locations: savedLocations, submissionNumber }) => {
    setPersonal({ ...INITIAL_PERSONAL, ...savedPersonal });
    setLocations({ ...INITIAL_LOCATIONS, ...savedLocations });
    setSubmissionResult(null);
    setEditInfo({ submissionNumber });
    setStep(STEPS.FORM);
  }, []);

  const startNewSubmission = useCallback(() => {
    resetForm();
    setStep(STEPS.FORM);
  }, [resetForm]);

  const finishSession = useCallback(() => {
    resetForm();
    setStep(STEPS.WELCOME);
  }, [resetForm]);

  const markSubmitted = useCallback((result) => {
    const source = result?.submission || result?.data || result || {};
    // Only retain the public submission reference needed by the success screen.
    // Any private backend Worker ID must never be copied into client state.
    const submission = {
      id: source.id || null,
      reference_id: source.reference_id || source.referenceId || null,
    };
    setSubmissionResult(submission);
    setEditInfo(null);
    setStep(STEPS.SUCCESS);
  }, []);

  const syncLocationAddresses = useCallback(() => {
    setLocations((prev) => ({
      home: { ...prev.home, address: personal.homeAddress },
      start: { ...prev.start, address: personal.startPointAddress },
      boarding: { ...prev.boarding, address: personal.boardingAddress },
      afterWork: { ...prev.afterWork, address: personal.afterWorkAddress },
    }));
  }, [personal.homeAddress, personal.startPointAddress, personal.boardingAddress, personal.afterWorkAddress]);

  const setLocationPoint = useCallback((key, { lat, lon, source }) => {
    setLocations((prev) => ({
      ...prev,
      [key]: { ...prev[key], lat, lon, source, confirmed: false },
    }));
  }, []);

  const setLocationAddress = useCallback((key, address) => {
    setLocations((prev) => ({
      ...prev,
      [key]: { ...prev[key], address },
    }));
  }, []);

  const setLocationConfirmed = useCallback((key, confirmed) => {
    setLocations((prev) => ({
      ...prev,
      [key]: { ...prev[key], confirmed },
    }));
  }, []);

  const clearLocationPoint = useCallback((key) => {
    setLocations((prev) => ({
      ...prev,
      [key]: { ...prev[key], lat: null, lon: null, source: null, confirmed: false },
    }));
  }, []);

  const openCorrection = useCallback((origin) => {
    setCorrectionOrigin(origin || STEPS.SUCCESS);
    setStep(STEPS.CORRECTION);
  }, []);

  // Leave the correction screens and go back to where the worker came from.
  const returnFromCorrection = useCallback(() => {
    setStep(correctionOrigin || STEPS.SUCCESS);
  }, [correctionOrigin]);

  const guardedSetStep = useCallback((next) => {
    if (locked && ![STEPS.SUCCESS, STEPS.REJECTED, STEPS.CORRECTION, STEPS.CORRECTION_STATUS].includes(next)) return;
    if (step === STEPS.WELCOME && ![STEPS.FORM, STEPS.WELCOME, STEPS.CORRECTION].includes(next)) return;
    setStep(next);
  }, [locked, step]);

  const value = useMemo(
    () => ({
      step,
      setStep: guardedSetStep,
      personal,
      updatePersonalField,
      locations,
      syncLocationAddresses,
      setLocationPoint,
      setLocationAddress,
      setLocationConfirmed,
      clearLocationPoint,
      submissionResult,
      markSubmitted,
      editInfo,
      startEditing,
      locked,
      startNewSubmission,
      resetAll: finishSession,
      correctionOrigin,
      openCorrection,
      returnFromCorrection,
    }),
    [
      step,
      personal,
      locations,
      submissionResult,
      editInfo,
      startEditing,
      locked,
      updatePersonalField,
      syncLocationAddresses,
      setLocationPoint,
      setLocationAddress,
      setLocationConfirmed,
      clearLocationPoint,
      markSubmitted,
      startNewSubmission,
      finishSession,
      guardedSetStep,
      correctionOrigin,
      openCorrection,
      returnFromCorrection,
    ],
  );

  return <WorkerFormContext.Provider value={value}>{children}</WorkerFormContext.Provider>;
}

export function useWorkerForm() {
  const ctx = useContext(WorkerFormContext);
  if (!ctx) throw new Error('useWorkerForm must be used within a WorkerFormProvider');
  return ctx;
}