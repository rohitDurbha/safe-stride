# SafeStride Roadmap

Work moves one step at a time, so each item is split into small steps that land over several days.

## Urgent

The public repository still holds a Google API key in `backend/.env` and hardcoded MongoDB Atlas and Gmail passwords in `backend/app.py`. Removing them from the current code does not remove them from git history, so every one of those credentials has to be rotated (see Needs Rohit below).

## Bug fixes

Take these before the next step of the numbered items, one per session.

- [x] Show route and error toasts above the map. The Radix toast viewport and the sonner toaster now share one `TOAST_Z` layer in `src/lib/layers.ts` that sits above every Leaflet pane and control, and a Vitest check (`npm test`) reads `leaflet.css` to keep it that way.

## Items

- [x] 1. Move every secret to environment variables, add `backend/.env.example`, delete `backend/.env`, `__pycache__` and `cache/` from the repo, and tighten `.gitignore`.
  - [x] a. Read the MongoDB URI and the SMTP sender settings from environment variables through one config module, send mail through one helper, add `backend/.env.example`, delete `backend/.env` and ignore env files.
  - [x] b. Delete `backend/__pycache__` and `backend/cache/` from the repo and ignore Python build output and the osmnx cache.
  - [x] c. Move the Firebase web config in `src/firebase/config.ts` to `VITE_` environment variables and add a root `.env.example`.
  - [x] d. Fail fast with a clear message when a required backend variable is missing, and document local setup in the README.
- [ ] 2. Fix the Gemini integration. Move from the retired gemini-1.5-flash model and the deprecated google-generativeai SDK to the google-genai SDK with a current free-tier Flash model and JSON structured output, with a keyword fallback when the API fails.
  - [x] a. Move `report_classifier.py` to the google-genai SDK with a current free-tier Flash model read from a `GEMINI_MODEL` setting, ask for JSON structured output limited to the known crime categories, update `requirements.txt`, and add pytest coverage with a fake client.
  - [x] b. Add a keyword fallback that classifies reports when `GOOGLE_API_KEY` is missing or the Gemini call fails, with tests. The rules live in `backend/keyword_classifier.py` and also cover replies that are not valid JSON.
  - [ ] c. Add a GitHub Actions workflow that runs the backend tests on every push, plus a live Gemini smoke test that sends one sample report using the `GOOGLE_API_KEY` repository secret and is skipped when the secret is unavailable.
- [ ] 3. Fix the npm audit vulnerabilities without `npm audit fix --force`, which downgrades firebase and `@tailwindcss/typography` and breaks the build. Each upgrade must keep the typecheck, lint and build passing.
  - [ ] a. Apply the non-breaking `npm audit fix` updates (form-data, glob, sucrase), remove the `lovable-tagger` dev dependency and its use in `vite.config.ts`, and regenerate `package-lock.json`. Delete `bun.lockb` so npm is the only package manager.
  - [ ] b. Upgrade Vite to the current major with a matching `@vitejs/plugin-react-swc` to fix the esbuild dev server advisory.
  - [ ] c. Upgrade `react-router-dom` to a patched 7.x release and adjust any routes or links the upgrade changes.
  - [ ] d. Upgrade eslint and typescript-eslint to current releases so the vulnerable minimatch drops out, and fix any new lint errors.
  - [ ] e. Upgrade firebase to the current release to drop the vulnerable `@grpc/grpc-js`. If item 6 removes Firebase auth, remove the package instead.
  - [ ] f. Add `npm audit --audit-level=high` to the CI workflow so new high or critical advisories fail the build.
- [ ] 4. Fix the login crash for unknown emails, the emergency contact bug where alerts go to an empty global variable, remove the unauthenticated `/add_user` route, and require a token on `/report_audio`.
- [ ] 5. Replace hardcoded `http://127.0.0.1:5000` calls with one `VITE_API_URL` setting.
- [ ] 6. Debloat. Remove duplicate imports, choose one auth system (Flask JWT or Firebase, not both), delete unused shadcn components and npm packages, and drop the random mock lighting and foot traffic columns.
- [x] 7. Improve routing. Spread each crime over nearby streets with a distance falloff, weight crimes by pedestrian severity, recency and time of day, use the OSM `lit` tag at night, score every street in one spatial index pass, and cap detours at 1.5 times the shortest path. Reports are replayed from MongoDB at startup, and the unused `edges_updated.parquet` snapshot is gone. Edge cost is length times one plus the darkness penalty, plus a safety weight times log(1 + exposure). This replaced the planned length times (1 + lambda times risk), because that formula made short edges next to hotspots almost free.
- [ ] 8. Cache the Oakland walking graph to a file so the server does not download it from OpenStreetMap on every start.
- [ ] 9. Host for free. Frontend on Vercel, backend as a Docker Space on Hugging Face, MongoDB Atlas M0, and the Gemini free tier.
- [ ] 10. Pytest coverage for routing and the classifier, Vitest for the map helpers, a CI workflow, and a real README. CI end to end tests start a throwaway MongoDB service seeded from `backend/crime_rate.csv` and never write to Atlas. The `MONGO_URI` secret is only used for a read only connection check.

## Needs Rohit

- Rotate the Google API key, the MongoDB Atlas user password and the Gmail password that were committed to this repository, because git history still holds the old values.
- Create a Gmail app password (or a free Resend key) and set `SMTP_USER` and `SMTP_PASSWORD` locally as described in `backend/.env.example`.
- Put the new Atlas connection string in `MONGO_URI` and a freshly generated `SECRET_KEY` in your local `backend/.env`. The backend now refuses to start without either one, and it no longer accepts `dev_key` as a signing secret.
- The Firebase web key that used to sit in `src/firebase/config.ts` is still in git history. Restrict it to your domains in the Google Cloud console (or rotate it), then copy `.env.example` to `.env` and fill in the `VITE_FIREBASE_` values. Set the same values in Vercel when the frontend is hosted.
- Done. `GOOGLE_API_KEY` and `MONGO_URI` are saved as repository secrets for the CI workflow.
- GitHub Actions runners have changing IP addresses, so the read only Atlas check in CI only works after adding `0.0.0.0/0` under Network Access in Atlas. Until then that check is skipped and everything else still runs.
- Vercel and Hugging Face accounts for item 9.
