# SafeStride Roadmap

Each session finishes a whole item when it can, and items stay split into steps so progress is easy to follow. The Live link section comes before everything else, because bugs are easier to find and fix while a link is up.

## Urgent

The public repository still holds a Google API key in `backend/.env` and hardcoded MongoDB Atlas and Gmail passwords in `backend/app.py`. Removing them from the current code does not remove them from git history, so every one of those credentials has to be rotated (see Needs Rohit below).

## Bug fixes

Take these before the next step of the numbered items, one per session.

- [x] Show route and error toasts above the map. The Radix toast viewport and the sonner toaster now share one `TOAST_Z` layer in `src/lib/layers.ts` that sits above every Leaflet pane and control, and a Vitest check (`npm test`) reads `leaflet.css` to keep it that way.

## Live link

Live link: not deployed yet. The backend goes to a Hugging Face Docker Space and the frontend goes to Vercel, both deployed from GitHub Actions with the `HF_TOKEN` and `VERCEL_TOKEN` repository secrets, so nothing is deployed by hand.

- [ ] Put SafeStride on a free live link.
  - [x] a. Replace the hardcoded `http://127.0.0.1:5000` calls with one `VITE_API_URL` setting. This was item 5. Every request now goes through `apiUrl` in `src/lib/api.ts` (covered by `api.test.ts`), which trims trailing slashes and falls back to the local Flask server when the setting is empty. `.env.example` documents it.
  - [x] b. Cache the Oakland walking graph to a file at image build time, so the server starts without downloading it from OpenStreetMap. This was item 8. `backend/street_graph.py` reads the GraphML file at `STREET_GRAPH_PATH` (default `backend/cache/oakland_walk.graphml`), downloads and saves it only when it is missing, and `python street_graph.py` builds it ahead of time for the Docker image. `tests/test_street_graph.py` covers the cache, the download fallback and a real save and load round trip.
  - [x] c. Keep Flask JWT as the only login and remove Firebase auth, so the hosted frontend needs no Firebase keys. This is the auth half of item 6. Nothing outside `src/firebase` used Firebase except the `/setup` page, which only stored Firebase settings and a Mapbox token nothing reads, so the folder, the page, the `firebase` package, its `@grpc/grpc-js` override and the `VITE_FIREBASE_` settings are gone. The bundle shrank and `npm audit` still reports no vulnerabilities.
  - [x] d. Add a backend Dockerfile for a Hugging Face Docker Space that serves the app with gunicorn on port 7860 and locks CORS to the frontend origin. Add a workflow that pushes it to the Space with `HF_TOKEN` and copies `MONGO_URI`, `SECRET_KEY` and `GOOGLE_API_KEY` from the repository secrets into the Space secrets. `backend/Dockerfile` bakes the street graph into the image and runs gunicorn on port 7860, `CORS_ORIGINS` (tested in `test_required_settings.py`) limits browser origins, and `.github/workflows/deploy-backend.yml` runs the tests, then `backend/deploy_space.py` creates the Space, copies the secrets, uploads the backend and waits for `/home` to answer. The first real deploy waits on the `SECRET_KEY` secret and the Atlas network rule under Needs Rohit.
  - [x] e. Add a workflow that builds the frontend with `VITE_API_URL` pointing at the Space and deploys it to Vercel with `VERCEL_TOKEN` on every push to main. `.github/workflows/deploy-frontend.yml` gets the Space URL from `backend/deploy_space.py url`, deploys with the Vercel CLI and `--build-env VITE_API_URL`, and fails the run when the published page does not load. `vercel.json` rewrites client routes to `index.html`.
  - [ ] f. Add a check after each deploy that loads the site, asks the backend for a route and fails the run when either breaks. Then put both live links at the top of the README and at the top of this section.

## Bugs found on the live site

Every session opens the live link first, adds anything broken here, and fixes these before the numbered items.

- None logged yet, because the site is not live.

## Items

- [x] 1. Move every secret to environment variables, add `backend/.env.example`, delete `backend/.env`, `__pycache__` and `cache/` from the repo, and tighten `.gitignore`.
  - [x] a. Read the MongoDB URI and the SMTP sender settings from environment variables through one config module, send mail through one helper, add `backend/.env.example`, delete `backend/.env` and ignore env files.
  - [x] b. Delete `backend/__pycache__` and `backend/cache/` from the repo and ignore Python build output and the osmnx cache.
  - [x] c. Move the Firebase web config in `src/firebase/config.ts` to `VITE_` environment variables and add a root `.env.example`.
  - [x] d. Fail fast with a clear message when a required backend variable is missing, and document local setup in the README.
- [x] 2. Fix the Gemini integration. Move from the retired gemini-1.5-flash model and the deprecated google-generativeai SDK to the google-genai SDK with a current free-tier Flash model and JSON structured output, with a keyword fallback when the API fails.
  - [x] a. Move `report_classifier.py` to the google-genai SDK with a current free-tier Flash model read from a `GEMINI_MODEL` setting, ask for JSON structured output limited to the known crime categories, update `requirements.txt`, and add pytest coverage with a fake client.
  - [x] b. Add a keyword fallback that classifies reports when `GOOGLE_API_KEY` is missing or the Gemini call fails, with tests. The rules live in `backend/keyword_classifier.py` and also cover replies that are not valid JSON.
  - [x] c. Add a GitHub Actions workflow that runs the backend tests on every push, plus a live Gemini smoke test that sends one sample report using the `GOOGLE_API_KEY` repository secret and is skipped when the secret is unavailable. The workflow lives in `.github/workflows/ci.yml`, and the smoke test runs locally with `python -m pytest -m live`.
- [ ] 3. Fix the npm audit vulnerabilities without `npm audit fix --force`, which downgrades firebase and `@tailwindcss/typography` and breaks the build. Each upgrade must keep the typecheck, lint and build passing.
  - [x] a. Apply the non-breaking `npm audit fix` updates (form-data, glob, sucrase), remove the `lovable-tagger` dev dependency and its use in `vite.config.ts`, and regenerate `package-lock.json`. Delete `bun.lockb` so npm is the only package manager. The audit fix also moved eslint to 9.39, so typescript-eslint moved to the latest 8.x to keep lint running. The gptengineer script and Lovable placeholder tags in `index.html` are gone too.
  - [x] b. Upgrade Vite to the current major with a matching `@vitejs/plugin-react-swc` to fix the esbuild dev server advisory. Vite is now 8.3 with plugin-react-swc 4.3, the configs use `import.meta.dirname`, and Node 20.19 or newer is required. Vitest 3 still pulled its own Vite 7 until step f moved it forward.
  - [x] c. Upgrade `react-router-dom` to a patched 7.x release and adjust any routes or links the upgrade changes. Routing now uses the single `react-router` 7.18 package, the page table lives in `src/routes.tsx`, and `src/routes.test.tsx` renders each path with Vitest so a future upgrade that breaks a route fails `npm test`.
  - [x] d. Upgrade eslint and typescript-eslint to current releases so the vulnerable minimatch drops out, and fix the lint errors. `npm run lint` already reported 15 errors (mostly `any` types in the pages and API helpers) before this item started, so clear those too and then add lint to CI. eslint is now 10.15 with typescript-eslint 8.73, react-hooks 7.1 and react-refresh 0.5. Caught errors go through `errorMessage` in `src/lib/errors.ts`, the speech API and auth user have real types, and CI now runs a frontend job with lint, typecheck, tests and build.
  - [x] e. Upgrade firebase to the current release to drop the vulnerable `@grpc/grpc-js`. If item 6 removes Firebase auth, remove the package instead. Firebase is now 12.19, the newest release that still runs on Node 20. Every firebase release, 13.x included, still pins Firestore to `@grpc/grpc-js` 1.9, so an npm `overrides` entry in `package.json` moves it to the patched 1.14.7. `src/firebase/config.test.ts` checks that auth, Firestore and storage start from the `VITE_FIREBASE_` settings. Firebase 13 needs Node 24.12, so moving to it waits until the project raises its Node floor.
  - [x] f. Upgrade Vitest to the current major to drop the vulnerable `tinypool` and `@vitest/mocker`, and keep `npm test` passing. Vitest is now 4.1.12, which shares the project's Vite 8 and no longer depends on `tinypool`. Vitest 5 needs Node 22.12, so it waits for the same Node floor change as firebase 13. `tsconfig.node.json` now typechecks `vitest.config.ts` too.
  - [x] g. Upgrade zod to 4.x (used by the shadcn form helpers) and check `@tailwindcss/typography` for a release with a patched `postcss-selector-parser`. If none exists, add an npm `overrides` entry for it. It turned out nothing in `src` imported zod or `@hookform/resolvers`, so both were removed, and the copy eslint-plugin-react-hooks pulls in now resolves to zod 4.6.7. The typography plugin was never registered in `tailwind.config.ts` and its newest release still pins the vulnerable parser, so it was removed instead of overridden. `npm audit` now reports no vulnerabilities.
  - [x] h. Add `npm audit --audit-level=high` to the CI workflow so new high or critical advisories fail the build. It runs right after `npm ci` in the frontend job.
  - [x] i. Clear the React Compiler warnings outside the map. The unused shadcn carousel and sidebar, the `use-mobile` hook and the `embla-carousel-react` package are gone, which also removed the `Math.random` skeleton. `Profile.tsx` and `IncidentReporter.tsx` now read the cached user once through `readStoredUser` in `src/lib/storedUser.ts` (covered by `storedUser.test.ts`) in a lazy `useState` initializer, and `MapView.tsx` adopts a changed `showHeatmap` prop during render instead of in an effect.
  - [ ] j. Clear the remaining React Compiler warnings in `LeafletMap.tsx` (functions used before they are declared, refs read during render, a mutated prop and two missing effect dependencies), then set `set-state-in-effect`, `immutability`, `refs` and `purity` back to errors in `eslint.config.js`.
- [ ] 4. Fix the login crash for unknown emails, the emergency contact bug where alerts go to an empty global variable, remove the unauthenticated `/add_user` route, and require a token on `/report_audio`.
- [x] 5. Moved into step a of the Live link section. Replace hardcoded `http://127.0.0.1:5000` calls with one `VITE_API_URL` setting.
- [ ] 6. Debloat. Remove duplicate imports, choose one auth system (Flask JWT or Firebase, not both), delete unused shadcn components and npm packages, and drop the random mock lighting and foot traffic columns.
- [x] 7. Improve routing. Spread each crime over nearby streets with a distance falloff, weight crimes by pedestrian severity, recency and time of day, use the OSM `lit` tag at night, score every street in one spatial index pass, and cap detours at 1.5 times the shortest path. Reports are replayed from MongoDB at startup, and the unused `edges_updated.parquet` snapshot is gone. Edge cost is length times one plus the darkness penalty, plus a safety weight times log(1 + exposure). This replaced the planned length times (1 + lambda times risk), because that formula made short edges next to hotspots almost free.
- [x] 8. Moved into step b of the Live link section. Cache the Oakland walking graph to a file so the server does not download it from OpenStreetMap on every start.
- [ ] 9. Covered by the Live link section, so tick it when that section is done. Host for free. Frontend on Vercel, backend as a Docker Space on Hugging Face, MongoDB Atlas M0, and the Gemini free tier.
- [ ] 10. Pytest coverage for routing and the classifier, Vitest for the map helpers, a CI workflow, and a real README. CI end to end tests start a throwaway MongoDB service seeded from `backend/crime_rate.csv` and never write to Atlas. The `MONGO_URI` secret is only used for a read only connection check.

## Needs Rohit

- Rotate the Google API key, the MongoDB Atlas user password and the Gmail password that were committed to this repository, because git history still holds the old values.
- Create a Gmail app password (or a free Resend key) and set `SMTP_USER` and `SMTP_PASSWORD` locally as described in `backend/.env.example`.
- Put the new Atlas connection string in `MONGO_URI` and a freshly generated `SECRET_KEY` in your local `backend/.env`. The backend now refuses to start without either one, and it no longer accepts `dev_key` as a signing secret.
- The Firebase web key that used to sit in `src/firebase/config.ts` is still in git history. The app no longer uses Firebase, so delete that web app (or the whole Firebase project) in the Firebase console, or at least restrict the key. No `VITE_FIREBASE_` values are needed anywhere now.
- Done. `GOOGLE_API_KEY` and `MONGO_URI` are saved as repository secrets for the CI workflow.
- Add `0.0.0.0/0` under Network Access in MongoDB Atlas. The hosted backend on Hugging Face has no fixed IP address and crashes at startup when Atlas refuses it, and the read only Atlas check in CI needs the same rule.
- Done. `VERCEL_TOKEN` and `HF_TOKEN` are saved as repository secrets for the Live link section.
- Add a `SECRET_KEY` repository secret with a long random string, for example the output of `python -c "import secrets; print(secrets.token_urlsafe(48))"`. The hosted backend refuses to start without it.
