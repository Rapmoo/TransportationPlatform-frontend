# Worker Transportation Registration (Worker-Facing Frontend)

The worker-facing counterpart to the existing **Worker Transportation Admin
Dashboard**. Built with the same stack — **React + Vite**, **OpenLayers**,
targeting a **FastAPI + PostgreSQL/PostGIS** backend, served via
**Docker + Nginx** — and reuses the admin's design tokens, logos, and data
field names. This is a separate app from the admin dashboard; it does not
modify or depend on the admin project's code.

A worker submission is a **one-time, linear flow**. The worker is never asked to enter a Worker ID. The normal survey identity field (currently Fayda ID) is sent with the final submission; the backend validates it, enforces uniqueness, and generates a private internal Worker ID only after the first successful submission. The frontend never relies on email, MAC address, IP address, browser fingerprinting, localStorage, or sessionStorage for the one-submission rule:

```
Welcome → Form → Location Selection → Review → Final Confirmation → Success
```

Once a submission succeeds, the backend locks the worker record against another final submission. The browser may reflect that state for the current session, but it is never the authority. There
is no submissions list, no login, and no admin functionality in this app.

## Run it

```bash
npm install
npm run dev
```

Open the printed local URL (defaults to `http://localhost:5174`, separate
from the admin app's default `5173` so both can run side by side).

```bash
npm run build     # production build to dist/
npm run preview   # preview the production build locally
npm run lint       # oxlint
```

## Backend connection

Set `VITE_API_BASE_URL` (see `.env.example`) to the FastAPI backend's base
URL. Until it is set, the app runs normally through Review and Final
Confirmation; the submit call itself fails with a clear
"service not connected" message instead of faking success.

All backend calls are isolated in `src/api/workerApi.js`:

- `submitWorkerData(formState)` — `POST /api/submissions` (proposed)
- `geocodeAddress(query)` / `searchAddress(query)` — `GET /api/geocode` (proposed; not required — see below)
- `confirmLocation(location)` — `POST /api/geocode/confirm` (proposed, optional hook)

**Map address search** works today without any backend endpoint: it calls
the public OpenStreetMap Nominatim API directly from the browser
(`searchAddressClientSide`), the same OSM ecosystem the admin map's CARTO
basemap tiles already come from. If the backend later exposes its own
`/api/geocode`, swap the call inside `LocationPicker.jsx`.

### Submission payload

Field names match the admin/backend data model exactly — see admin's
`src/data/mockData.js`. Do not rename these when wiring up the real backend:

```json
{
  "employee_id": "string",
  "employee_name": "string",
  "phone_number": "string",
  "job_position": "string",
  "organization": "string",
  "home_address": "string",
  "start_point_address": "string",
  "boarding_address": "string",
  "transport_mode": "Company Shuttle | Public Minibus | Private Vehicle | On Foot | Bajaj",
  "home_coords": { "lat": 0, "lon": 0 },
  "start_point_coords": { "lat": 0, "lon": 0 },
  "boarding_coords": { "lat": 0, "lon": 0 },
  "home_location_source": "geocoded | manual",
  "start_point_location_source": "geocoded | manual",
  "boarding_location_source": "geocoded | manual"
}
```

System-generated fields (submission datetime, geocoding status,
latitude/longitude precision handling beyond what's listed above) are never
requested from the worker and are expected to be produced by the backend on
receipt, matching the admin's existing model.

## Structure

```
src/
  api/workerApi.js        Centralized backend calls + Nominatim fallback for map search
  i18n/                   translations.js (en + am) and LanguageContext
  context/
    WorkerFormContext.jsx  Form state, 3 independent location states, submit-lock
  components/
    layout/                WorkerHeader, WorkerFooter (real logos)
    common/                 Field, StepProgress
    map/                    LocationPicker (draggable pin + search), ReviewMap (3-pin summary)
  steps/                   WelcomeStep, FormStep, LocationStep, ReviewStep, ConfirmModal, SuccessStep
  utils/                   validation.js, transportModes.js
```

## Docker

```bash
docker build --build-arg VITE_API_BASE_URL=https://api.example.gov.et -t worker-transport-worker .
docker run -p 8080:80 worker-transport-worker
```

Note: Vite inlines `VITE_*` env vars at **build time**, so the backend URL
must be supplied as a build arg (or baked into a `.env` before `npm run
build`), not as a container runtime environment variable.

## One-time submission and correction workflow

The worker-facing flow intentionally does **not** ask the worker for a Worker ID.

1. The worker opens the form and completes the normal survey, including the existing Fayda ID field.
2. The worker reviews the answers and confirms the final submission.
3. `POST /api/submissions` validates the worker identity and checks the database for an existing final submission.
4. On the first accepted submission, the backend generates a random private `worker_code` and stores it internally against that worker/submission.
5. The private `worker_code` is never displayed or requested by the worker-facing frontend.
6. The backend returns a short-lived correction session (or secure HttpOnly session cookie) so the worker can request a controlled correction without editing the original submission.
7. A second final submission for the same worker must be rejected by a database uniqueness constraint/transaction.

See `FRONTEND_API_CONTRACT.md` for the API shapes and backend requirements.


## Current identity model
The worker enters only the existing Public Service Transport ID in the normal form. The frontend does not ask for a Worker ID or email. The backend enforces one final submission per Public Service Transport ID and generates a unique 7-digit Reference ID after the first accepted submission. The Reference ID is retained for backend/admin tracking and is not displayed on the worker success page.