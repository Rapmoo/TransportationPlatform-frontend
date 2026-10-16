function resolveApiBaseUrl() {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  const devDefault = import.meta.env.DEV ? 'http://localhost:8000/api' : '';
  if (!fromEnv) return devDefault;
  // A base URL that points at this very app (the Vite dev server) can never
  // reach the backend: every call would 404. Use the backend address instead.
  if (typeof window !== 'undefined' && fromEnv.replace(/\/api$/, '') === window.location.origin) {
    return devDefault || fromEnv;
  }
  // Backend routes all start with /api; add it if the .env value left it out.
  return /\/api$/.test(fromEnv) ? fromEnv : `${fromEnv}/api`;
}

const API_BASE_URL = resolveApiBaseUrl();
let workerSessionToken = null;

// The backend works in three steps: create a draft, attach the four locations,
// then submit. The draft's public id (used in every URL) and its worker token
// are kept here, outside React state, so they are never rendered.
let draft = null; // { publicId, employeeId, submitted }

export class ApiNotConfiguredError extends Error {
  constructor() {
    super('VITE_API_BASE_URL is not configured. The backend is not connected yet.');
    this.name = 'ApiNotConfiguredError';
  }
}

export class ApiRequestError extends Error {
  constructor(message, status, body = null) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.body = body;
  }
}

function assertConfigured() {
  if (!API_BASE_URL) throw new ApiNotConfiguredError();
}

export function setWorkerSessionToken(token) {
  workerSessionToken = token || null;
}

export function clearWorkerSessionToken() {
  workerSessionToken = null;
  draft = null;
}

// FastAPI errors come as a string, an object ({ message, ... }) or, for 422
// validation errors, a list of { loc, msg } items. Turn any of them into text.
function formatErrorDetail(detail) {
  if (!detail) return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = Array.isArray(item?.loc) ? item.loc.filter((p) => p !== 'body').join('.') : '';
        return field ? `${field}: ${item?.msg}` : item?.msg;
      })
      .filter(Boolean)
      .join('; ');
  }
  if (typeof detail === 'object') return detail.message || '';
  return '';
}

async function request(path, options = {}) {
  assertConfigured();

  const headers = {
    'Content-Type': 'application/json',
    ...(workerSessionToken ? { Authorization: `Bearer ${workerSessionToken}` } : {}),
    ...(options.headers || {}),
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (networkErr) {
    throw new ApiRequestError(`Network error contacting the server: ${networkErr.message}`, 0);
  }

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    const message = (body && (formatErrorDetail(body.detail) || body.message || body.error))
      || `Request failed with status ${response.status}`;
    throw new ApiRequestError(message, response.status, body);
  }

  return body;
}

// Same normalisation the backend applies to employee_id.
function normalizeEmployeeId(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

// Form location key -> backend location_type
const LOCATION_TYPES = {
  home: 'HOME',
  start: 'STARTING_POINT',
  boarding: 'BOARDING',
  afterWork: 'RETURN_STARTING_POINT',
};

export function buildSubmissionPayload(formState) {
  const { personal } = formState;
  return {
    // The Fayda ID collected by the form is the backend's employee_id.
    employee_id: normalizeEmployeeId(personal.faydaId),
    employee_name: `${personal.firstName.trim()} ${personal.middleName.trim()} ${personal.lastName.trim()}`.replace(/\s+/g, ' ').trim(),
    organization_name: personal.organization.trim(),
    phone_number: personal.phoneNumber.trim() || null,
    public_bus_id: personal.publicBusId.trim(),
    bus_number_going: personal.busNumberGoing.trim(),
    bus_number_return: personal.busNumberReturn.trim(),
  };
}

export function buildLocationPayloads(formState) {
  const { locations } = formState;
  return Object.entries(LOCATION_TYPES).map(([key, locationType]) => ({
    location_type: locationType,
    address_text: locations[key].address.trim(),
    latitude: locations[key].lat,
    longitude: locations[key].lon,
  }));
}

const STALE_DRAFT_STATUSES = [401, 403, 404];

async function ensureDraft(details) {
  const { employee_id: employeeId, ...updatable } = details;

  // Reuse the draft from an earlier attempt (for example after a network
  // error) so a retry does not leave orphan drafts behind.
  if (draft && !draft.submitted && draft.employeeId === employeeId) {
    try {
      await request(`/submissions/${draft.publicId}`, {
        method: 'PUT',
        body: JSON.stringify(updatable),
      });
      return draft;
    } catch (err) {
      if (!(err instanceof ApiRequestError) || !STALE_DRAFT_STATUSES.includes(err.status)) throw err;
      // The old draft or its token is no longer valid: start a new one.
    }
  }

  const created = await request('/submissions/', {
    method: 'POST',
    body: JSON.stringify(details),
  });
  setWorkerSessionToken(created.worker_token);
  draft = { publicId: created.public_id, employeeId, submitted: false };
  return draft;
}

export async function submitWorkerData(formState) {
  const details = buildSubmissionPayload(formState);
  const current = await ensureDraft(details);
  const base = `/submissions/${current.publicId}`;

  // Locations the draft already has (from a previous attempt) are updated,
  // the others are created. Creating a second one of the same type would 409.
  const existing = (await request(`${base}/locations`, { method: 'GET' })) || [];
  const existingByType = new Map(existing.map((loc) => [String(loc.location_type).toUpperCase(), loc]));

  for (const location of buildLocationPayloads(formState)) {
    const match = existingByType.get(location.location_type);
    if (match) {
      await request(`${base}/locations/${match.id}`, {
        method: 'PUT',
        body: JSON.stringify(location),
      });
    } else {
      await request(`${base}/locations`, {
        method: 'POST',
        body: JSON.stringify(location),
      });
    }
  }

  const result = await request(`${base}/submit`, { method: 'POST' });
  current.submitted = true;

  // Only the public reference (the submission number) goes back to the UI.
  // The worker token stays here for correction requests.
  return { reference_id: result?.submission_number || null };
}

function requireDraft() {
  if (!draft || !workerSessionToken) {
    throw new ApiRequestError('Your session has expired. Please start again.', 401);
  }
  return draft;
}

// The backend stores one free-text comment per change request, so the form
// inputs are packed into it in a fixed layout and unpacked again below. The
// same layout is read by the supervisor page.
function packCorrectionComment({ field, currentValue, requestedValue, reason }) {
  const current = String(currentValue || '').replace(/\s*\n\s*/g, ' ').trim();
  return `Field: ${field}\nCurrent value: ${current}\nRequested value: ${requestedValue.trim()}\nReason: ${reason.trim()}`;
}

function unpackCorrectionComment(comment) {
  const text = comment || '';
  const withCurrent = /^Field: (.*)\nCurrent value: (.*)\nRequested value: ([\s\S]*)\nReason: ([\s\S]*)$/.exec(text);
  if (withCurrent) {
    return { field: withCurrent[1], currentValue: withCurrent[2], requestedValue: withCurrent[3], reason: withCurrent[4] };
  }
  const legacy = /^Field: (.*)\nRequested value: ([\s\S]*)\nReason: ([\s\S]*)$/.exec(text);
  if (legacy) return { field: legacy[1], currentValue: '', requestedValue: legacy[2], reason: legacy[3] };
  return { field: '', currentValue: '', requestedValue: text, reason: '' };
}

export async function createCorrectionRequest({
  field,
  currentValue,
  requestedValue,
  reason,
  submissionNumber,
}) {
  const { publicId } = requireDraft();

  if (!submissionNumber) {
    throw new ApiRequestError(
      'Your submission number is required to request an edit.',
      400
    );
  }

  return request(`/submissions/${publicId}/change-requests`, {
    method: 'POST',
    body: JSON.stringify({
      submission_number: String(submissionNumber).trim(),
      worker_comment: packCorrectionComment({
        field,
        currentValue,
        requestedValue,
        reason,
      }),
    }),
  });
}

// ---- Landing-page requests (no session) --------------------------------
// The backend checks the 9-digit submission number plus the phone number or
// Fayda ID the worker submitted with, so no worker token is needed.

export async function createChangeRequestByNumber({
  submissionNumber, field, requestedValue, reason,
}) {
  return request('/change-requests/by-number', {
    method: 'POST',
    body: JSON.stringify({
      submission_number: String(submissionNumber).trim(),
      field,
      requested_value: String(requestedValue).trim(),
      reason: String(reason).trim(),
    }),
  });
}

function lookupBody({ submissionNumber }) {
  return JSON.stringify({ submission_number: String(submissionNumber).trim() });
}

export async function lookupChangeRequests(lookup) {
  const data = await request('/change-requests/by-number/status', {
    method: 'POST',
    body: lookupBody(lookup),
  });

  return {
    canEdit: Boolean(data?.can_edit),
    editExpiresAt: data?.edit_expires_at || null,
    requests: (data?.requests || []).map((item) => {
      const parsed = unpackCorrectionComment(item.worker_comment);
      return {
        id: item.public_id,
        status: String(item.status || '').toUpperCase(),
        created_at: item.created_at,
        field: parsed.field,
        current_value: parsed.currentValue,
        requested_value: parsed.requestedValue,
        reason: parsed.reason,
        admin_note: item.review_comment,
      };
    }),
  };
}

const LOCATION_KEYS = {
  HOME: 'home',
  STARTING_POINT: 'start',
  BOARDING: 'boarding',
  RETURN_STARTING_POINT: 'afterWork',
};

// Backend submission + locations -> the form's personal / locations state.
function mapSubmissionToForm(submission, locationList) {
  const parts = String(submission.employee_name || '').trim().split(/\s+/).filter(Boolean);
  const personal = {
    faydaId: submission.employee_id || '',
    firstName: parts[0] || '',
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
    lastName: parts.length > 1 ? parts[parts.length - 1] : '',
    phoneNumber: submission.phone_number || '',
    organization: submission.organization_name || '',
    homeAddress: '',
    startPointAddress: '',
    boardingAddress: '',
    afterWorkAddress: '',
    publicBusId: submission.public_bus_id || '',
    busNumberGoing: submission.bus_number_going || '',
    busNumberReturn: submission.bus_number_return || '',
  };
  const addressField = {
    home: 'homeAddress', start: 'startPointAddress', boarding: 'boardingAddress', afterWork: 'afterWorkAddress',
  };
  const locations = {};

  Object.values(LOCATION_KEYS).forEach((key) => {
    locations[key] = { address: '', lat: null, lon: null, confirmed: false, source: null };
  });

  (locationList || []).forEach((loc) => {
    const key = LOCATION_KEYS[String(loc.location_type).toUpperCase()];
    if (!key) return;
    locations[key] = {
      address: loc.address_text || '',
      lat: loc.latitude,
      lon: loc.longitude,
      confirmed: true,
      source: 'saved',
    };
    personal[addressField[key]] = loc.address_text || '';
  });

  return { personal, locations };
}

// Opens a supervisor-approved edit: gets a worker token for this one
// submission and loads it so the form can be pre-filled. Submitting afterwards
// uses the normal flow (PUT details, PUT locations, POST submit).
export async function openEditSession(lookup) {
  const session = await request('/change-requests/by-number/edit-session', {
    method: 'POST',
    body: lookupBody(lookup),
  });

  setWorkerSessionToken(session.worker_token);

  try {
    const submission = await request(`/submissions/${session.public_id}`, { method: 'GET' });
    const locationList = await request(`/submissions/${session.public_id}/locations`, { method: 'GET' });

    draft = {
      publicId: session.public_id,
      employeeId: normalizeEmployeeId(submission.employee_id),
      submitted: false,
    };

    return {
      submissionNumber: submission.submission_number,
      ...mapSubmissionToForm(submission, locationList),
    };
  } catch (err) {
    clearWorkerSessionToken();
    throw err;
  }
}

export async function getCorrectionRequests() {
  const { publicId } = requireDraft();
  const list = (await request(`/submissions/${publicId}/change-requests`, { method: 'GET' })) || [];
  return list.map((item) => {
    const parsed = unpackCorrectionComment(item.worker_comment);
    return {
      id: item.public_id,
      reference_id: String(item.public_id).slice(0, 8).toUpperCase(),
      requested_field: parsed.field,
      current_value: parsed.currentValue,
      requested_value: parsed.requestedValue,
      reason: parsed.reason,
      status: item.status,
      created_at: item.created_at,
      admin_note: item.review_comment,
    };
  });
}

export async function getCurrentSubmission() {
  const { publicId } = requireDraft();
  return request(`/submissions/${publicId}`, { method: 'GET' });
}

export async function searchAddressClientSide(query, { countryCode = 'et', limit = 5 } = {}) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(limit));
  if (countryCode) url.searchParams.set('countrycodes', countryCode);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const results = await res.json();
    return (results || []).map((r) => ({
      label: r.display_name,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
    }));
  } catch {
    return [];
  }
}
// Turns a map point into a readable place name (OpenStreetMap Nominatim).
// Returns '' when nothing usable is found or the request fails.
export async function reverseGeocode(lat, lon, { language = 'en' } = {}) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', language === 'en' ? 'en' : `${language},en`);

  try {
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) return '';
    const r = await res.json();
    if (!r || r.error) return '';
    const a = r.address || {};
    const parts = [
      r.name || a.road || a.pedestrian || a.neighbourhood,
      a.suburb || a.neighbourhood || a.city_district,
      a.city || a.town || a.village || a.county,
    ].filter(Boolean);
    const unique = parts.filter((part, i) => parts.indexOf(part) === i);
    const label = unique.join(', ') || r.display_name || '';
    return label.slice(0, 500);
  } catch {
    return '';
  }
}

// Your running LocationStep imports `searchAddress`; keep that name working.
export const searchAddress = searchAddressClientSide;